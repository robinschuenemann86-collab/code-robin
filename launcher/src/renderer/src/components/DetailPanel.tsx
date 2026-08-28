import { useEffect, useState, type ReactElement } from 'react'
import type { Entry, EntryStats, Tag } from '../types'
import type { Session } from '../../../main/store'
import { EntryIcon } from './EntryIcon'
import {
  IconAlertTriangle,
  IconCalendar,
  IconClock,
  IconDisc,
  IconEdit,
  IconFolder,
  IconPlay,
  IconStar,
  IconTag,
  IconTrash,
  IconX
} from './icons'

function formatSize(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

interface DetailPanelProps {
  entry: Entry
  tags: Tag[]
  pathMissing: boolean
  stats: EntryStats | null
  onLaunch: (entry: Entry) => void
  onRename: (id: string, name: string) => void
  onSetLaunchArgs: (id: string, args: string) => void
  onToggleTag: (id: string, tagId: string) => void
  onChangeIcon: (id: string) => void
  onFetchCoverArt: (id: string) => void
  onToggleFavorite: (entry: Entry) => void
  onSetRating: (id: string, rating: number) => void
  onRemove: (entry: Entry) => void
  onClose: () => void
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

export function DetailPanel({
  entry,
  tags,
  pathMissing,
  stats,
  onLaunch,
  onRename,
  onSetLaunchArgs,
  onToggleTag,
  onChangeIcon,
  onFetchCoverArt,
  onToggleFavorite,
  onSetRating,
  onRemove,
  onClose
}: DetailPanelProps): ReactElement {
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(entry.name)
  const [launchArgs, setLaunchArgsValue] = useState(entry.launchArgs ?? '')
  const [size, setSize] = useState<number | null | 'loading'>('loading')
  const [sessions, setSessions] = useState<Session[]>([])
  const canUseLaunchArgs = !entry.steamAppId && !entry.epicAppName && !entry.battlenetCode

  useEffect(() => {
    setSize('loading')
    window.api.getEntrySize(entry.id).then(setSize)
  }, [entry.id])

  useEffect(() => {
    window.api.getEntrySessions(entry.id).then(setSessions)
  }, [entry.id, stats])

  function commitName(): void {
    const trimmed = name.trim()
    if (trimmed && trimmed !== entry.name) onRename(entry.id, trimmed)
    setEditingName(false)
  }

  function commitLaunchArgs(): void {
    if (launchArgs.trim() !== (entry.launchArgs ?? '')) {
      onSetLaunchArgs(entry.id, launchArgs)
    }
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 border-l border-border bg-panel/40 p-5">
      {entry.heroHash && (
        <img
          src={`launcher-icon://${entry.heroHash}`}
          alt=""
          className="-mx-5 -mt-5 mb-1 h-28 w-[calc(100%+2.5rem)] max-w-none object-cover"
        />
      )}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onToggleFavorite(entry)}
          title="Favorit"
          className={entry.favorite ? 'text-amber' : 'text-text-muted hover:text-amber'}
        >
          <IconStar className="h-4 w-4" filled={entry.favorite} />
        </button>
        <button onClick={onClose} className="text-text-muted hover:text-gold" title="Schließen">
          <IconX className="h-4 w-4" />
        </button>
      </div>

      {pathMissing && (
        <div className="flex items-center gap-2 rounded-lg border border-amber/40 bg-amber/10 p-2 text-xs text-amber">
          <IconAlertTriangle className="h-4 w-4 shrink-0" />
          Pfad nicht gefunden — das Programm wurde vermutlich verschoben oder deinstalliert.
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => onChangeIcon(entry.id)}
          title="Icon ändern"
          className="group relative"
        >
          <EntryIcon
            iconHash={entry.iconHash}
            coverHash={entry.coverHash}
            className={entry.coverHash ? 'aspect-[2/3] w-32' : 'h-20 w-20'}
          />
          <span className="absolute inset-0 hidden items-center justify-center rounded-xl bg-black/50 group-hover:flex">
            <IconEdit className="h-5 w-5 text-white" />
          </span>
        </button>
        <button
          onClick={() => onFetchCoverArt(entry.id)}
          className="text-xs font-semibold text-gold hover:brightness-125"
        >
          {entry.coverHash ? 'Cover-Art neu laden' : 'Cover-Art laden'}
        </button>
        {editingName ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName()
              if (e.key === 'Escape') {
                setName(entry.name)
                setEditingName(false)
              }
            }}
            className="w-full rounded-lg bg-panel-hover px-2 py-1 text-center text-sm text-text outline-none"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="flex items-center gap-1.5 text-center text-sm font-medium"
          >
            {entry.name} <IconEdit className="h-3 w-3 text-text-muted" />
          </button>
        )}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              onClick={() => onSetRating(entry.id, entry.rating === value ? 0 : value)}
              title={`${value} von 5 Sternen`}
              className={value <= entry.rating ? 'text-amber' : 'text-text-muted hover:text-amber'}
            >
              <IconStar className="h-3.5 w-3.5" filled={value <= entry.rating} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2">
        <IconTag className="mt-1 h-4 w-4 shrink-0 text-text-muted" />
        {tags.length === 0 ? (
          <p className="pt-1 text-xs text-text-muted">Noch keine Tags angelegt.</p>
        ) : (
          <div className="flex flex-1 flex-wrap gap-1.5">
            {tags.map((tag) => {
              const active = entry.tags.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  onClick={() => onToggleTag(entry.id, tag.id)}
                  className={`rounded-full border px-2 py-0.5 text-xs transition ${
                    active
                      ? 'border-gold/60 bg-panel-active text-gold'
                      : 'border-border text-text-muted hover:border-gold/30 hover:text-text'
                  }`}
                >
                  {tag.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-start gap-2">
        <button
          onClick={() => window.api.showEntryInExplorer(entry.id)}
          title="Im Explorer anzeigen"
          className="mt-0.5 shrink-0 text-text-muted hover:text-gold"
        >
          <IconFolder className="h-4 w-4" />
        </button>
        <span
          className="break-all rounded-lg border border-border bg-panel p-2 font-mono text-xs text-text"
          title={entry.path}
        >
          {entry.path}
        </span>
      </div>

      {canUseLaunchArgs && (
        <div className="flex flex-col gap-1.5">
          <span className="font-display text-[11px] font-bold tracking-wider text-text-muted">
            START-PARAMETER
          </span>
          <input
            value={launchArgs}
            onChange={(e) => setLaunchArgsValue(e.target.value)}
            onBlur={commitLaunchArgs}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setLaunchArgsValue(entry.launchArgs ?? '')
            }}
            placeholder="z. B. -windowed -novid"
            className="w-full rounded-lg border border-border bg-panel px-2 py-1.5 font-mono text-xs text-text outline-none focus:border-gold/50"
          />
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-text-muted">
        <IconCalendar className="h-4 w-4 shrink-0" />
        {new Date(entry.addedAt).toLocaleDateString('de-DE')}
      </div>

      <div className="flex items-center gap-2 text-xs text-text-muted">
        <IconDisc className="h-4 w-4 shrink-0" />
        {size === 'loading' ? 'Größe wird berechnet …' : size === null ? 'Größe unbekannt' : formatSize(size)}
      </div>

      {stats && stats.launchCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <IconClock className="h-4 w-4 shrink-0" />
          {formatDuration(stats.totalPlayedMs)} · {stats.launchCount}× gestartet
          {stats.lastPlayedAt &&
            ` · zuletzt ${new Date(stats.lastPlayedAt).toLocaleDateString('de-DE')}`}
        </div>
      )}

      {sessions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="font-display text-[11px] font-bold tracking-wider text-text-muted">
            SITZUNGEN
          </span>
          <div className="flex max-h-32 flex-col gap-1 overflow-y-auto pr-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between text-xs text-text-muted"
              >
                <span>{new Date(session.startedAt).toLocaleDateString('de-DE')}</span>
                <span>{formatDuration((session.endedAt ?? session.startedAt) - session.startedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto flex gap-2">
        <button
          onClick={() => onLaunch(entry)}
          title="Starten"
          className="glow-gold flex flex-1 items-center justify-center rounded-lg bg-gold py-2.5 text-base transition hover:brightness-110"
        >
          <IconPlay className="h-5 w-5" />
        </button>
        <button
          onClick={() => onRemove(entry)}
          title="Entfernen"
          className="flex items-center justify-center rounded-lg border border-border px-4 text-text-muted transition hover:border-danger/50 hover:text-danger"
        >
          <IconTrash className="h-4 w-4" />
        </button>
      </div>
    </aside>
  )
}
