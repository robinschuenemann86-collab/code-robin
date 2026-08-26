import { useMemo, type ReactElement } from 'react'
import type { Entry, EntryStats } from '../types'
import { EntryIcon } from './EntryIcon'
import { IconClock, IconX } from './icons'

interface StatsDialogProps {
  entries: Entry[]
  stats: EntryStats[]
  onClose: () => void
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

export function StatsDialog({ entries, stats, onClose }: StatsDialogProps): ReactElement {
  const rows = useMemo(() => {
    return stats
      .map((stat) => ({ stat, entry: entries.find((e) => e.id === stat.entryId) }))
      .filter((row): row is { stat: EntryStats; entry: Entry } => row.entry !== undefined)
      .filter((row) => row.stat.totalPlayedMs > 0)
      .sort((a, b) => b.stat.totalPlayedMs - a.stat.totalPlayedMs)
  }, [entries, stats])

  const maxPlayedMs = rows[0]?.stat.totalPlayedMs ?? 0

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70">
      <div className="flex max-h-[80vh] w-[28rem] flex-col gap-4 rounded-xl border border-border bg-base p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Statistik</h2>
          <button onClick={onClose} className="text-text-muted hover:text-gold" title="Schließen">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-text-muted">
            <IconClock className="h-8 w-8" />
            <p className="text-sm">Noch keine erfasste Spielzeit</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto">
            {rows.map(({ stat, entry }, index) => (
              <div key={entry.id} className="flex flex-col gap-1 rounded-lg px-2 py-1.5">
                <div className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-right text-xs text-text-muted">
                    {index + 1}.
                  </span>
                  <EntryIcon iconHash={entry.iconHash} className="h-8 w-8" />
                  <span className="flex-1 truncate text-sm">{entry.name}</span>
                  <span className="text-xs text-text-muted">
                    {stat.launchCount}× ·{' '}
                    {stat.lastPlayedAt && new Date(stat.lastPlayedAt).toLocaleDateString('de-DE')}
                  </span>
                  <span className="text-sm text-gold">{formatDuration(stat.totalPlayedMs)}</span>
                </div>
                <div className="ml-7 h-1 overflow-hidden rounded-full bg-panel">
                  <div
                    className="h-full rounded-full bg-gold"
                    style={{ width: `${(stat.totalPlayedMs / maxPlayedMs) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
