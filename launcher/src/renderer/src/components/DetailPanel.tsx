import { useEffect, useState, type ReactElement } from 'react'
import type { Entry, EntryStats, Tag } from '../types'
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
  onToggleTag: (id: string, tagId: string) => void
  onChangeIcon: (id: string) => void
  onToggleFavorite: (entry: Entry) => void
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
  onToggleTag,
  onChangeIcon,
  onToggleFavorite,
  onRemove,
  onClose
}: DetailPanelProps): ReactElement {
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(entry.name)
  const [size, setSize] = useState<number | null | 'loading'>('loading')

  useEffect(() => {
    setSize('loading')
    window.api.getEntrySize(entry.id).then(setSize)
  }, [entry.id])

  function commitName(): void {
    const trimmed = name.trim()
    if (trimmed && trimmed !== entry.name) onRename(entry.id, trimmed)
    setEditingName(false)
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 border-l border-border bg-panel/40 p-5">
      <div className="flex items-center justify-between">
        <button
          onClick={() => onToggleFavorite(entry)}
          title="Favorit"
          className={entry.favorite ? 'text-amber' : 'text-text-muted hover:text-amber'}
        >
          <IconStar className="h-4 w-4" filled={entry.favorite} />
        </button>
        <button onClick={onClose} className="text-text-muted hover:text-cyan" title="Schließen">
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
          <EntryIcon iconHash={entry.iconHash} className="h-20 w-20" />
          <span className="absolute inset-0 hidden items-center justify-center rounded-xl bg-black/50 group-hover:flex">
            <IconEdit className="h-5 w-5 text-white" />
          </span>
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
                      ? 'border-cyan/60 bg-panel-active text-cyan'
                      : 'border-border text-text-muted hover:border-cyan/30 hover:text-text'
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
          className="mt-0.5 shrink-0 text-text-muted hover:text-cyan"
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

      <div className="mt-auto flex gap-2">
        <button
          onClick={() => onLaunch(entry)}
          title="Starten"
          className="glow-cyan flex flex-1 items-center justify-center rounded-lg bg-cyan py-2.5 text-base transition hover:brightness-110"
        >
          <IconPlay className="h-5 w-5" />
        </button>
        <button
          onClick={() => onRemove(entry)}
          title="Entfernen"
          className="flex items-center justify-center rounded-lg border border-border px-4 text-text-muted transition hover:border-pink/50 hover:text-pink"
        >
          <IconTrash className="h-4 w-4" />
        </button>
      </div>
    </aside>
  )
}
