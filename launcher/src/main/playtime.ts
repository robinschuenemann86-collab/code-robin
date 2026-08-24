import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { getStore, setSessions, type Session } from './store'

const POLL_INTERVAL_MS = 15_000
const MISSES_BEFORE_END = 2 // ~30s Abwesenheit, bevor eine Sitzung als beendet gilt
const STARTUP_GRACE_MS = 3 * 60_000 // Zeit, die ein Spiel zum Starten haben darf

// Reine In-Memory-Zähler pro laufender Sitzung — müssen die App-Laufzeit nicht
// überleben, da beim Start ohnehin alle offenen Sitzungen geschlossen werden.
const tracking = new Map<string, { misses: number; everSeen: boolean }>()
let pollHandle: ReturnType<typeof setInterval> | null = null

function getRunningProcessNames(): Promise<Set<string>> {
  return new Promise((resolve) => {
    let stdout = ''
    try {
      const child = spawn('tasklist', ['/fo', 'csv', '/nh'], { windowsHide: true })
      child.stdout.on('data', (chunk) => (stdout += chunk.toString()))
      child.on('error', () => resolve(new Set()))
      child.on('close', () => {
        const names = new Set<string>()
        for (const line of stdout.split(/\r?\n/)) {
          const match = line.match(/^"([^"]+)"/)
          if (match) names.add(match[1].toLowerCase())
        }
        resolve(names)
      })
    } catch {
      resolve(new Set())
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

async function pollTick(): Promise<void> {
  const sessions = getStore().get('sessions')
  const openSessions = sessions.filter((s) => s.endedAt === null)

  if (openSessions.length === 0) {
    if (pollHandle) clearInterval(pollHandle)
    pollHandle = null
    return
  }

  const entries = getStore().get('entries')
  const runningNames = await getRunningProcessNames()
  const now = Date.now()
  let changed = false

  const updated = sessions.map((session) => {
    if (session.endedAt !== null) return session

    const entry = entries.find((e) => e.id === session.entryId)
    const expectedName = entry?.expectedProcessName?.toLowerCase() ?? null
    const state = tracking.get(session.id) ?? { misses: 0, everSeen: false }

    const isRunning = expectedName !== null && runningNames.has(expectedName)

    if (isRunning) {
      state.everSeen = true
      state.misses = 0
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

  if (changed) setSessions(updated)
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
  tracking.set(session.id, { misses: 0, everSeen: false })
  ensurePolling()
}
