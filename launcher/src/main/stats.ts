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

export function registerStatsHandlers(): void {
  ipcMain.handle('stats:list', () => computeStats())
}
