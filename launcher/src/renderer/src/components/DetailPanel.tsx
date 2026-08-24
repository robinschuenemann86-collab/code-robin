import { useState, type ReactElement } from 'react'
import type { Category, Entry, EntryStats } from '../types'
import { EntryIcon } from './EntryIcon'
import {
  IconCalendar,
  IconClock,
  IconEdit,
  IconFolder,
  IconPlay,
  IconStar,
  IconTag,
  IconTrash,
  IconX
} from './icons'

interface DetailPanelProps {
  entry: Entry
  categories: Category[]
  stats: EntryStats | null
  onLaunch: (entry: Entry) => void
  onRename: (id: string, name: string) => void
  onSetCategory: (id: string, categoryId: string) => void
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
  categories,
  stats,
  onLaunch,
  onRename,
  onSetCategory,
  onToggleFavorite,
  onRemove,
  onClose
}: DetailPanelProps): ReactElement {
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(entry.name)

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

      <div className="flex flex-col items-center gap-3">
        <EntryIcon iconHash={entry.iconHash} className="h-20 w-20" />
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

      <div className="flex items-center gap-2">
        <IconTag className="h-4 w-4 shrink-0 text-text-muted" />
        <select
          value={entry.category}
          onChange={(e) => onSetCategory(entry.id, e.target.value)}
          className="w-full rounded-lg border border-border bg-panel px-2 py-1 text-sm text-text outline-none focus:border-cyan/50"
        >
          <option value="">Unsortiert</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-start gap-2">
        <IconFolder className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
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

      {stats && stats.totalPlayedMs > 0 && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <IconClock className="h-4 w-4 shrink-0" />
          {formatDuration(stats.totalPlayedMs)}
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
