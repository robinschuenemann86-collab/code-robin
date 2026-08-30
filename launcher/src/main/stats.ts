import { ipcMain } from 'electron'
import { getStore, setSettings, type Session } from './store'
import { getBreakReminderMinutes, setBreakReminderMinutes } from './playtime'

export interface EntryStats {
  entryId: string
  totalPlayedMs: number
  lastPlayedAt: number | null
  launchCount: number
}

function computeStats(): EntryStats[] {
  const sessions = getStore().get('sessions')
  const archive = getStore().get('sessionArchive')
  const byEntry = new Map<string, EntryStats>()

  // Archivierte (weil zu alte) Sitzungen fließen als Aggregat ein, damit
  // Gesamtspielzeit und Start-Zähler durchs Archivieren nicht zurückspringen
  // (siehe playtime.ts archiveOldSessions). lastPlayedAt kommt bewusst nur aus
  // den verbliebenen Sitzungen unten — archiviert werden immer die ältesten,
  // die neueste (und damit "zuletzt gespielt") bleibt also erhalten.
  for (const [entryId, rollup] of Object.entries(archive)) {
    byEntry.set(entryId, {
      entryId,
      totalPlayedMs: rollup.totalPlayedMs,
      lastPlayedAt: null,
      launchCount: rollup.launchCount
    })
  }

  for (const session of sessions) {
    const existing = byEntry.get(session.entryId) ?? {
      entryId: session.entryId,
      totalPlayedMs: 0,
      lastPlayedAt: null,
      launchCount: 0
    }
    existing.launchCount += 1
    // Spielzeit und "zuletzt gespielt" zählen erst, wenn die Sitzung beendet
    // ist — ein noch laufendes Spiel hat schon einen Start, aber noch keine
    // fertige Dauer.
    if (session.endedAt !== null) {
      existing.totalPlayedMs += session.endedAt - session.startedAt
      existing.lastPlayedAt = Math.max(existing.lastPlayedAt ?? 0, session.startedAt)
    }
    byEntry.set(session.entryId, existing)
  }

  return [...byEntry.values()]
}

export interface OverviewData {
  streakDays: number
  // 28 Einträge (4 Kalenderwochen, Montag-Start), ältester zuerst.
  // null = liegt noch in der Zukunft dieser Woche, gab's noch nicht.
  weekActivity: (boolean | null)[]
  playedThisWeekMs: number
  playedLastWeekMs: number
  totalLaunches: number
  recentSessions: { entryId: string; endedAt: number; durationMs: number }[]
  // Selbst gesetztes Wochenziel in Minuten, null wenn keins gesetzt ist.
  weeklyGoalMinutes: number | null
  // Optionale Pausen-Erinnerung in Minuten, null wenn keine gesetzt ist.
  breakReminderMinutes: number | null
}

export function getWeeklyGoalMinutes(): number | null {
  const value = getStore().get('settings').weeklyGoalMinutes
  return typeof value === 'number' && value > 0 ? value : null
}

export function setWeeklyGoalMinutes(minutes: number | null): void {
  setSettings({ ...getStore().get('settings'), weeklyGoalMinutes: minutes })
}

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function mondayOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts))
  const day = d.getDay()
  const diffFromMonday = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diffFromMonday)
  return d.getTime()
}

function computeOverview(): OverviewData {
  const sessions = getStore().get('sessions')
  const today = startOfDay(Date.now())
  const thisWeekMonday = mondayOfWeek(today)
  const gridStart = thisWeekMonday - 3 * 7 * DAY_MS

  const playedDays = new Set(sessions.map((s) => startOfDay(s.startedAt)))

  const weekActivity: (boolean | null)[] = []
  for (let i = 0; i < 28; i++) {
    const day = gridStart + i * DAY_MS
    weekActivity.push(day > today ? null : playedDays.has(day))
  }

  // Ein Streak bricht erst nach einem ganzen Tag ohne Sitzung ab — "heute
  // noch nicht gespielt" beendet ihn also noch nicht, das Fenster läuft ja
  // noch bis Mitternacht.
  let streakDays = 0
  let cursor = playedDays.has(today) ? today : today - DAY_MS
  while (playedDays.has(cursor)) {
    streakDays++
    cursor -= DAY_MS
  }

  const lastWeekMonday = thisWeekMonday - 7 * DAY_MS

  let playedThisWeekMs = 0
  let playedLastWeekMs = 0
  // Archivierte Sitzungen zählen weiter zur Gesamtzahl der Starts mit — nur
  // die Einzelsitzungen dahinter sind aus `sessions` verschwunden.
  let totalLaunches = Object.values(getStore().get('sessionArchive')).reduce(
    (sum, rollup) => sum + rollup.launchCount,
    0
  )
  const recentSessions: OverviewData['recentSessions'] = []

  for (const session of sessions) {
    totalLaunches += 1
    if (session.endedAt !== null) {
      const durationMs = session.endedAt - session.startedAt
      if (session.startedAt >= thisWeekMonday) {
        playedThisWeekMs += durationMs
      } else if (session.startedAt >= lastWeekMonday) {
        playedLastWeekMs += durationMs
      }
      recentSessions.push({ entryId: session.entryId, endedAt: session.endedAt, durationMs })
    }
  }
  recentSessions.sort((a, b) => b.endedAt - a.endedAt)

  return {
    streakDays,
    weekActivity,
    playedThisWeekMs,
    playedLastWeekMs,
    totalLaunches,
    recentSessions: recentSessions.slice(0, 6),
    weeklyGoalMinutes: getWeeklyGoalMinutes(),
    breakReminderMinutes: getBreakReminderMinutes()
  }
}

// Für den globalen Hotkey zum Sofort-Start — greift auf dieselbe
// Session-Auswertung wie die "Zuletzt gespielt"-Sortierung im Renderer zu,
// nur eben aus dem Main-Prozess heraus.
export function getMostRecentlyPlayedEntryId(): string | null {
  const withLastPlayed = computeStats().filter(
    (s): s is EntryStats & { lastPlayedAt: number } => s.lastPlayedAt !== null
  )
  if (withLastPlayed.length === 0) return null
  return withLastPlayed.reduce((a, b) => (b.lastPlayedAt > a.lastPlayedAt ? b : a)).entryId
}

// Für die Sitzungshistorie im Detail-Panel — bislang gab es dafür nur
// Aggregate (Gesamtspielzeit, Anzahl Starts) oder eine globale, spielübergreifende
// Liste, aber keine Sitzung-für-Sitzung-Ansicht für ein einzelnes Programm.
const MAX_SESSION_HISTORY = 50

function getSessionsForEntry(entryId: string): Session[] {
  return getStore()
    .get('sessions')
    .filter((session) => session.entryId === entryId && session.endedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, MAX_SESSION_HISTORY)
}

// Für das "Läuft gerade"-Abzeichen in der Bibliothek — eine offene Sitzung
// (endedAt: null) bedeutet, dass das Prozess-Polling in playtime.ts das
// Programm zuletzt noch laufend gesehen hat.
function getRunningEntryIds(): string[] {
  return getStore()
    .get('sessions')
    .filter((session) => session.endedAt === null)
    .map((session) => session.entryId)
}

// Schaut, welches Programm am aktuellen Wochentag historisch am häufigsten
// gestartet wurde — eine einfache, nachvollziehbare Musteranalyse statt einer
// komplexen Empfehlungslogik. Erst ab 3 Treffern an diesem Wochentag als
// "Muster" gewertet, um einzelne Zufallsstarts nicht als Vorschlag zu zeigen.
export interface SmartSuggestion {
  entryId: string
  playCountOnThisWeekday: number
}

export function getSmartSuggestion(): SmartSuggestion | null {
  const sessions = getStore()
    .get('sessions')
    .filter((s) => s.endedAt !== null)
  const todayWeekday = new Date().getDay()

  const countsByEntry = new Map<string, number>()
  for (const session of sessions) {
    if (new Date(session.startedAt).getDay() !== todayWeekday) continue
    countsByEntry.set(session.entryId, (countsByEntry.get(session.entryId) ?? 0) + 1)
  }

  let best: SmartSuggestion | null = null
  for (const [entryId, count] of countsByEntry) {
    if (!best || count > best.playCountOnThisWeekday) {
      best = { entryId, playCountOnThisWeekday: count }
    }
  }
  return best && best.playCountOnThisWeekday >= 3 ? best : null
}

export interface WrappedData {
  year: number
  totalPlayedMs: number
  topGame: { entryId: string; totalPlayedMs: number } | null
  wildestDay: { date: string; totalPlayedMs: number } | null
  longestSession: { entryId: string; durationMs: number } | null
  gamesAdded: number
  totalLaunches: number
}

// Ausgewertet wird bewusst nur, was aktuell in `sessions` steht — sehr alte,
// bereits archivierte Sitzungen (siehe playtime.ts archiveOldSessions)
// fließen dann nicht mehr mit ein. Für den Normalfall (ein Kalenderjahr)
// unkritisch, nur bei sehr intensiver Nutzung eines einzelnen Programms
// könnten vereinzelte ältere Tage fehlen.
export function getWrapped(): WrappedData {
  const year = new Date().getFullYear()
  const yearStart = new Date(year, 0, 1).getTime()
  const sessions = getStore()
    .get('sessions')
    .filter((s) => s.endedAt !== null && s.startedAt >= yearStart)
  const entries = getStore().get('entries')

  let totalPlayedMs = 0
  const byEntry = new Map<string, number>()
  const byDay = new Map<string, number>()
  let longestSession: WrappedData['longestSession'] = null

  for (const session of sessions) {
    const duration = (session.endedAt as number) - session.startedAt
    totalPlayedMs += duration
    byEntry.set(session.entryId, (byEntry.get(session.entryId) ?? 0) + duration)

    const dayKey = new Date(session.startedAt).toISOString().slice(0, 10)
    byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + duration)

    if (!longestSession || duration > longestSession.durationMs) {
      longestSession = { entryId: session.entryId, durationMs: duration }
    }
  }

  let topGame: WrappedData['topGame'] = null
  for (const [entryId, ms] of byEntry) {
    if (!topGame || ms > topGame.totalPlayedMs) topGame = { entryId, totalPlayedMs: ms }
  }

  let wildestDay: WrappedData['wildestDay'] = null
  for (const [date, ms] of byDay) {
    if (!wildestDay || ms > wildestDay.totalPlayedMs) wildestDay = { date, totalPlayedMs: ms }
  }

  return {
    year,
    totalPlayedMs,
    topGame,
    wildestDay,
    longestSession,
    gamesAdded: entries.filter((e) => e.addedAt >= yearStart).length,
    totalLaunches: sessions.length
  }
}

export function registerStatsHandlers(): void {
  ipcMain.handle('stats:list', () => computeStats())
  ipcMain.handle('stats:overview', () => computeOverview())
  ipcMain.handle('stats:sessionsForEntry', (_event, entryId: string) =>
    getSessionsForEntry(entryId)
  )
  ipcMain.handle('stats:runningEntries', () => getRunningEntryIds())
  ipcMain.handle('stats:smartSuggestion', () => getSmartSuggestion())
  ipcMain.handle('stats:wrapped', () => getWrapped())
  ipcMain.handle('stats:setWeeklyGoal', (_event, minutes: number | null) =>
    setWeeklyGoalMinutes(minutes)
  )
  ipcMain.handle('stats:setBreakReminder', (_event, minutes: number | null) =>
    setBreakReminderMinutes(minutes)
  )
}
