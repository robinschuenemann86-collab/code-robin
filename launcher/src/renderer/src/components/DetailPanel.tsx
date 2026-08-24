import { useState, type ReactElement } from 'react'
import type { Category, Entry } from '../types'
import { EntryIcon } from './EntryIcon'

interface DetailPanelProps {
  entry: Entry
  categories: Category[]
  onLaunch: (entry: Entry) => void
  onRename: (id: string, name: string) => void
  onSetCategory: (id: string, categoryId: string) => void
  onRemove: (entry: Entry) => void
  onClose: () => void
}

export function DetailPanel({
  entry,
  categories,
  onLaunch,
  onRename,
  onSetCategory,
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
    <aside className="flex w-72 shrink-0 flex-col gap-4 border-l border-neutral-800 p-4">
      <div className="flex items-start justify-between">
        <span className="text-xs uppercase tracking-wide text-neutral-500">Details</span>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-neutral-300"
          title="Schließen"
        >
          ✕
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
            className="w-full rounded bg-neutral-800 px-2 py-1 text-center text-sm outline-none"
          />
        ) : (
          <button onClick={() => setEditingName(true)} className="text-center text-sm font-medium">
            {entry.name} <span className="text-xs text-neutral-500">✏️</span>
          </button>
        )}
      </div>

      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        Kategorie
        <select
          value={entry.category}
          onChange={(e) => onSetCategory(entry.id, e.target.value)}
          className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-neutral-100 outline-none"
        >
          <option value="">Unsortiert</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1 text-xs text-neutral-500">
        Pfad
        <span
          className="break-all rounded-md bg-neutral-900 p-2 font-mono text-neutral-300"
          title={entry.path}
        >
          {entry.path}
        </span>
      </div>

      <div className="text-xs text-neutral-500">
        Hinzugefügt am {new Date(entry.addedAt).toLocaleDateString('de-DE')}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <button
          onClick={() => onLaunch(entry)}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white"
        >
          Starten
        </button>
        <button
          onClick={() => onRemove(entry)}
          className="rounded-md border border-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
        >
          Entfernen
        </button>
      </div>
    </aside>
  )
}
