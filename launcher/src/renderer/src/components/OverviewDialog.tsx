import { useMemo, type ReactElement } from 'react'
import type { Entry, EntryStats, OverviewData } from '../types'
import { EntryIcon } from './EntryIcon'
import { IconX } from './icons'
import { useEscapeToClose } from '../hooks'

interface OverviewDialogProps {
  entries: Entry[]
  stats: EntryStats[]
  overview: OverviewData
  onClose: () => void
}

const DAY_LABELS = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO']
const RING_RADIUS = 64
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 60) return `vor ${minutes} Min.`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.round(hours / 24)
  if (days === 1) return 'gestern'
  return `vor ${days} Tagen`
}

export function OverviewDialog({
  entries,
  stats,
  overview,
  onClose
}: OverviewDialogProps): ReactElement {
  useEscapeToClose(onClose)
  const thisWeek = overview.weekActivity.slice(21, 28)
  const daysActive = thisWeek.filter((d) => d === true).length
  const ringOffset = RING_CIRCUMFERENCE * (1 - daysActive / 7)

  const mostPlayed = useMemo(() => {
    const top = [...stats].sort((a, b) => b.totalPlayedMs - a.totalPlayedMs)[0]
    if (!top || top.totalPlayedMs === 0) return null
    return entries.find((e) => e.id === top.entryId) ?? null
  }, [stats, entries])

  const recent = overview.recentSessions
    .map((session) => ({ session, entry: entries.find((e) => e.id === session.entryId) }))
    .filter((row): row is { session: (typeof overview.recentSessions)[number]; entry: Entry } =>
      Boolean(row.entry)
    )

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col gap-6 overflow-y-auto rounded-2xl border border-border bg-base p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight">
            Deine Woche
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-gold" title="Schließen">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-4">
          <div className="flex flex-[1.2] items-center gap-6 rounded-2xl border border-border bg-panel p-6">
            <div className="relative h-32 w-32 shrink-0">
              <svg width="128" height="128" viewBox="0 0 148 148">
                <circle cx="74" cy="74" r={RING_RADIUS} fill="none" stroke="var(--color-panel-active)" strokeWidth="14" />
                <circle
                  cx="74"
                  cy="74"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="url(#ringGrad)"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={ringOffset}
                  transform="rotate(-90 74 74)"
                />
                <defs>
                  <linearGradient id="ringGrad" x1="10" y1="10" x2="140" y2="140" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#ff5b1f" />
                    <stop offset="1" stopColor="#ffd873" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold">{daysActive}/7</span>
                <span className="text-[10px] font-semibold text-text-muted">Tage aktiv</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="text-lg font-bold">{formatDuration(overview.playedThisWeekMs)} diese Woche</div>
              <p className="max-w-[220px] text-sm text-text-muted">
                {daysActive === 0
                  ? 'Diese Woche noch nichts gestartet.'
                  : `An ${daysActive} von 7 Tagen war was los.`}
              </p>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-center justify-between rounded-xl border border-border bg-panel px-5 py-3">
              <div>
                <div className="text-xl font-extrabold">{overview.streakDays}</div>
                <div className="text-xs font-semibold text-text-muted">Tage Streak</div>
              </div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="url(#flameGradDialog)">
                <path d="M12 2c1 3-2 4-2 7a4 4 0 0 0 8 0c0-1-.5-2-1-2.5.6 2-.4 3-1.5 3-1.6 0-2-1.4-1-2.5 1.2-1.3 1-3.3-.5-5C13.3 3.5 12.6 2.7 12 2Z" />
                <defs>
                  <linearGradient id="flameGradDialog" x1="8" y1="2" x2="17" y2="18" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#ff5b1f" />
                    <stop offset="1" stopColor="#ffd873" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-panel px-5 py-3">
              <div className="min-w-0">
                <div className="truncate text-xl font-extrabold">{mostPlayed?.name ?? '—'}</div>
                <div className="text-xs font-semibold text-text-muted">Meistgespielt</div>
              </div>
              {mostPlayed && (
                <EntryIcon
                  iconHash={mostPlayed.iconHash}
                  coverHash={mostPlayed.coverHash}
                  className="h-8 w-8 shrink-0"
                />
              )}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-panel px-5 py-3">
              <div>
                <div className="text-xl font-extrabold">{overview.totalLaunches}</div>
                <div className="text-xs font-semibold text-text-muted">Starts insgesamt</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex flex-[1.4] flex-col gap-4 rounded-2xl border border-border bg-panel p-6">
            <span className="font-display text-xs font-bold uppercase tracking-wider text-text-muted">
              Spielaktivität &middot; letzte 4 Wochen
            </span>
            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-text-muted">
              {DAY_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {overview.weekActivity.map((played, index) => (
                <div
                  key={index}
                  className={`aspect-square rounded-lg ${
                    played === null
                      ? 'bg-transparent'
                      : played
                        ? 'ember-grad-bg'
                        : 'border border-dashed border-border bg-panel-active'
                  }`}
                />
              ))}
            </div>
            <div className="mt-auto flex items-center gap-2 text-xs text-text-muted">
              <span className="ember-grad-bg inline-block h-3 w-3 rounded" /> gespielt
              <span className="ml-2 inline-block h-3 w-3 rounded border border-dashed border-border bg-panel-active" />{' '}
              Pause
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-border bg-panel p-6">
            <span className="font-display text-xs font-bold uppercase tracking-wider text-text-muted">
              Zuletzt aktiv
            </span>
            {recent.length === 0 ? (
              <p className="text-sm text-text-muted">Noch keine erfasste Spielzeit.</p>
            ) : (
              recent.map(({ session, entry }) => (
                <div key={`${entry.id}-${session.endedAt}`} className="flex items-center gap-3">
                  <EntryIcon
                    iconHash={entry.iconHash}
                    coverHash={entry.coverHash}
                    className="h-9 w-9 shrink-0"
                  />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-bold">{entry.name}</span>
                    <span className="text-xs text-text-muted">
                      {formatDuration(session.durationMs)} &middot; {formatRelativeTime(session.endedAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
