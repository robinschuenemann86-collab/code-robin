import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { Notification } from 'electron'
import { getStore, setSessionArchive, setSessions, setSettings, type Session } from './store'
import { clearDiscordPresence, setDiscordPresence } from './discordPresence'
import { hideOverlay, showOverlay } from './overlayWindow'
import { setTrayRunningEntry } from './tray'

const POLL_INTERVAL_MS = 15_000
const MISSES_BEFORE_END = 2 // ~30s Abwesenheit, bevor eine Sitzung als beendet gilt
const STARTUP_GRACE_MS = 3 * 60_000 // Zeit, die ein Spiel zum Starten haben darf

// Wie viele abgeschlossene Sitzungen pro Programm im Detail behalten werden,
// bevor ältere in ein Aggregat wandern — verhindert, dass die Datendatei bei
// jahrelanger Nutzung unbegrenzt wächst, ohne Gesamtspielzeit oder
// Start-Zähler zu verlieren (siehe archiveOldSessions).
const MAX_SESSIONS_PER_ENTRY = 200

// Reine In-Memory-Zähler pro laufender Sitzung — müssen die App-Laufzeit nicht
// überleben, da beim Start ohnehin alle offenen Sitzungen geschlossen werden.
// reminderCount zählt, wie oft für diese Sitzung schon eine Pausen-Erinnerung
// gezeigt wurde, damit dieselbe Schwelle nicht bei jedem Poll erneut auslöst.
const tracking = new Map<string, { misses: number; everSeen: boolean; reminderCount: number }>()
let pollHandle: ReturnType<typeof setInterval> | null = null

// Optionale Erinnerung nach X Minuten ununterbrochenem Spielen, 0/null =
// deaktiviert (Standard) — MR Launch meldet sich sonst nie von sich aus.
export function getBreakReminderMinutes(): number | null {
  const value = getStore().get('settings').breakReminderMinutes
  return typeof value === 'number' && value > 0 ? value : null
}

export function setBreakReminderMinutes(minutes: number | null): void {
  setSettings({ ...getStore().get('settings'), breakReminderMinutes: minutes })
}

// Absoluter Pfad statt bloßem Namen: bei einem bloßen Namen sucht Windows
// zuerst im Programm- und Arbeitsverzeichnis, eine dort abgelegte gleichnamige
// Datei würde also statt des echten Werkzeugs ausgeführt.
const TASKLIST = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tasklist.exe')

// Fragt gezielt nach genau einem Prozessnamen, statt die vollständige
// Prozessliste des Rechners zu holen und darin zu suchen. Inhaltlich dasselbe
// Ergebnis, aber das Programm liest nicht mehr bei jeder Messung mit, was sonst
// noch alles auf dem Rechner läuft — das ist ein Verhalten, das die
// Verhaltensüberwachung von Virenscannern zu Recht misstrauisch beäugt.
function isProcessRunning(imageName: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Der /fi-Filter hat eine eigene Syntax; ungewöhnliche Zeichen würden ihn
    // stillschweigend unbrauchbar machen. Ausgeführt wird hier ohnehin nichts
    // davon — der Name landet als einzelnes Argument, nie in einer Shell.
    if (!/^[\w .+-]+\.exe$/i.test(imageName)) {
      resolve(false)
      return
    }
    let stdout = ''
    const expected = `"${imageName.toLowerCase()}"`
    try {
      const child = spawn(TASKLIST, ['/nh', '/fo', 'csv', '/fi', `IMAGENAME eq ${imageName}`], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore']
      })
      child.stdout.on('data', (chunk) => (stdout += chunk.toString()))
      child.on('error', () => resolve(false))
      child.on('close', () => {
        // Treffer ist eine CSV-Zeile, die mit dem Namen beginnt. Ohne Treffer
        // gibt tasklist einen übersetzten Hinweistext aus, der hier nicht passt.
        resolve(
          stdout
            .split(/\r?\n/)
            .some((line) => line.trim().toLowerCase().startsWith(expected))
        )
      })
    } catch {
      resolve(false)
    }
  })
}

// Schließt beim App-Start alle noch offenen Sitzungen aus einem vorigen Lauf
// (z. B. nach einem Absturz) — ohne die In-Memory-Zähler kann ihr echtes Ende
// nicht mehr bestimmt werden, also werden sie mit 0 Spielzeit verworfen.
export function closeDanglingSessions(): void {
  const sessions = getStore().get('sessions')
  const hasOpen = sessions.some((s) => s.endedAt === null)
  if (!hasOpen) return
  setSessions(sessions.map((s) => (s.endedAt === null ? { ...s, endedAt: s.startedAt } : s)))
}

// Läuft einmal beim App-Start: für jedes Programm mit mehr als
// MAX_SESSIONS_PER_ENTRY abgeschlossenen Sitzungen wandern die ältesten
// überzähligen in ein Aggregat (Gesamtspielzeit + Anzahl), statt für immer
// als Einzelsitzungen in der Datendatei zu bleiben. Eine laufende Sitzung
// (endedAt: null) wird nie archiviert.
export function archiveOldSessions(): void {
  const sessions = getStore().get('sessions')

  const byEntry = new Map<string, Session[]>()
  for (const session of sessions) {
    if (session.endedAt === null) continue
    const list = byEntry.get(session.entryId)
    if (list) list.push(session)
    else byEntry.set(session.entryId, [session])
  }

  const toRemove = new Set<string>()
  const archive = { ...getStore().get('sessionArchive') }
  let changed = false

  for (const [entryId, entrySessions] of byEntry) {
    if (entrySessions.length <= MAX_SESSIONS_PER_ENTRY) continue

    entrySessions.sort((a, b) => a.startedAt - b.startedAt)
    const excess = entrySessions.slice(0, entrySessions.length - MAX_SESSIONS_PER_ENTRY)
    const addedMs = excess.reduce((sum, s) => sum + ((s.endedAt as number) - s.startedAt), 0)
    for (const session of excess) toRemove.add(session.id)

    const current = archive[entryId] ?? { totalPlayedMs: 0, launchCount: 0 }
    archive[entryId] = {
      totalPlayedMs: current.totalPlayedMs + addedMs,
      launchCount: current.launchCount + excess.length
    }
    changed = true
  }

  if (!changed) return
  setSessionArchive(archive)
  setSessions(sessions.filter((s) => !toRemove.has(s.id)))
}

async function pollTick(): Promise<void> {
  const sessions = getStore().get('sessions')
  const openSessions = sessions.filter((s) => s.endedAt === null)

  if (openSessions.length === 0) {
    if (pollHandle) clearInterval(pollHandle)
    pollHandle = null
    return
  }

  const entries = getStore().get('entries')

  // Nur die Prozessnamen abfragen, die für die gerade offenen Sitzungen
  // überhaupt gebraucht werden — im Normalfall also genau einer.
  const neededNames = new Set<string>()
  for (const session of openSessions) {
    const entry = entries.find((e) => e.id === session.entryId)
    const name = entry?.expectedProcessName?.toLowerCase()
    if (name) neededNames.add(name)
  }
  const runningNames = new Set<string>()
  await Promise.all(
    [...neededNames].map(async (name) => {
      if (await isProcessRunning(name)) runningNames.add(name)
    })
  )

  const now = Date.now()
  const reminderMinutes = getBreakReminderMinutes()
  let changed = false

  const updated = sessions.map((session) => {
    if (session.endedAt !== null) return session

    const entry = entries.find((e) => e.id === session.entryId)
    const expectedName = entry?.expectedProcessName?.toLowerCase() ?? null
    const state = tracking.get(session.id) ?? { misses: 0, everSeen: false, reminderCount: 0 }

    const isRunning = expectedName !== null && runningNames.has(expectedName)

    if (isRunning) {
      state.everSeen = true
      state.misses = 0

      // Löst nur beim Überschreiten einer neuen Vielfachen aus (reminderCount
      // steigt), nicht bei jedem 15s-Poll erneut — sonst würde ab der ersten
      // Schwelle alle 15 Sekunden eine neue Benachrichtigung aufpoppen.
      if (reminderMinutes) {
        const dueCount = Math.floor((now - session.startedAt) / (reminderMinutes * 60_000))
        if (dueCount > state.reminderCount) {
          state.reminderCount = dueCount
          new Notification({
            title: 'MR Launch',
            body: `Du spielst seit ${reminderMinutes * dueCount} Minuten am Stück "${entry?.name ?? 'diesem Programm'}" — Zeit für eine Pause?`
          }).show()
        }
      }

      tracking.set(session.id, state)
      return session
    }

    if (!state.everSeen) {
      if (now - session.startedAt > STARTUP_GRACE_MS) {
        tracking.delete(session.id)
        changed = true
        return { ...session, endedAt: session.startedAt }
      }
      tracking.set(session.id, state)
      return session
    }

    state.misses += 1
    if (state.misses >= MISSES_BEFORE_END) {
      tracking.delete(session.id)
      changed = true
      return { ...session, endedAt: now }
    }
    tracking.set(session.id, state)
    return session
  })

  if (changed) {
    setSessions(updated)
    const stillOpen = updated.filter((s) => s.endedAt === null)
    if (stillOpen.length === 0) {
      // Keine Sitzung mehr offen — "Spielt gerade X" soll wieder verschwinden
      // statt das zuletzt beendete Spiel weiter anzuzeigen.
      clearDiscordPresence()
      hideOverlay()
      setTrayRunningEntry(null)
    } else {
      // Mindestens eine Sitzung läuft noch weiter (z. B. zwei Programme
      // gleichzeitig gestartet) — Anzeige auf die zuletzt gestartete davon
      // umschalten, statt weiter das soeben beendete Programm zu zeigen.
      const mostRecent = stillOpen.reduce((a, b) => (b.startedAt > a.startedAt ? b : a))
      const entry = entries.find((e) => e.id === mostRecent.entryId)
      if (entry) {
        setDiscordPresence(entry.name)
        showOverlay(entry.name, mostRecent.startedAt)
        setTrayRunningEntry(entry.name)
      }
    }
  }
}

function ensurePolling(): void {
  if (pollHandle) return
  pollHandle = setInterval(() => {
    pollTick().catch(() => {})
  }, POLL_INTERVAL_MS)
}

// Wird nach jedem erfolgreichen Start aufgerufen. Ohne bekannten Prozessnamen
// kann keine Spielzeit erfasst werden — dann wird bewusst keine Sitzung angelegt.
export function startSession(entryId: string, expectedProcessName: string | null): void {
  if (!expectedProcessName) return

  const sessions = getStore().get('sessions')
  const session: Session = {
    id: randomUUID(),
    entryId,
    startedAt: Date.now(),
    endedAt: null
  }
  setSessions([...sessions, session])
  tracking.set(session.id, { misses: 0, everSeen: false, reminderCount: 0 })
  ensurePolling()
}
