import { ipcMain } from 'electron'
import { getStore } from './store'

export interface EntryStats {
  entryId: string
  totalPlayedMs: number
  lastPlayedAt: number | null
  launchCount: number
}

function computeStats(): EntryStats[] {
  const sessions = getStore().get('sessions')
  const byEntry = new Map<string, EntryStats>()

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
  totalLaunches: number
  recentSessions: { entryId: string; endedAt: number; durationMs: number }[]
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

  let playedThisWeekMs = 0
  let totalLaunches = 0
  const recentSessions: OverviewData['recentSessions'] = []

  for (const session of sessions) {
    totalLaunches += 1
    if (session.endedAt !== null) {
      const durationMs = session.endedAt - session.startedAt
      if (session.startedAt >= thisWeekMonday) {
        playedThisWeekMs += durationMs
      }
      recentSessions.push({ entryId: session.entryId, endedAt: session.endedAt, durationMs })
    }
  }
  recentSessions.sort((a, b) => b.endedAt - a.endedAt)

  return {
    streakDays,
    weekActivity,
    playedThisWeekMs,
    totalLaunches,
    recentSessions: recentSessions.slice(0, 6)
  }
}

export function registerStatsHandlers(): void {
  ipcMain.handle('stats:list', () => computeStats())
  ipcMain.handle('stats:overview', () => computeOverview())
}
