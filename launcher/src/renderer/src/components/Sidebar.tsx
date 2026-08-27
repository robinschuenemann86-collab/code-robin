import { useState, type ReactElement } from 'react'
import type { Entry, SortMode, Tag, ViewMode } from '../types'
import {
  IconAlertTriangle,
  IconEdit,
  IconGrid,
  IconList,
  IconPlus,
  IconSearch,
  IconStar,
  IconTrash
} from './icons'

interface SidebarProps {
  tags: Tag[]
  entries: Entry[]
  selectedTagId: string | null
  onSelectTag: (id: string | null) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  favoritesOnly: boolean
  onFavoritesOnlyChange: (value: boolean) => void
  missingCount: number
  missingOnly: boolean
  onMissingOnlyChange: (value: boolean) => void
  sortMode: SortMode
  onSortModeChange: (mode: SortMode) => void
  onAddTag: (name: string) => void
  onRenameTag: (id: string, name: string) => void
  onRemoveTag: (id: string) => void
}

// Kleine, sich wiederholende Akzentfarben für die Tag-Punkte —
// rein kosmetisch zur Wiedererkennung, keine feste Bedeutung pro Farbe.
const DOT_COLORS = ['bg-gold', 'bg-ember', 'bg-rust', 'bg-amber']

export function Sidebar({
  tags,
  entries,
  selectedTagId,
  onSelectTag,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  missingCount,
  missingOnly,
  onMissingOnlyChange,
  sortMode,
  onSortModeChange,
  onAddTag,
  onRenameTag,
  onRemoveTag
}: SidebarProps): ReactElement {
  const [addingTag, setAddingTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagName, setEditingTagName] = useState('')

  const untaggedCount = entries.filter((e) => e.tags.length === 0).length

  function commitNewTag(): void {
    const trimmed = newTagName.trim()
    if (trimmed) onAddTag(trimmed)
    setNewTagName('')
    setAddingTag(false)
  }

  function commitRename(): void {
    if (!editingTagId) return
    const trimmed = editingTagName.trim()
    if (trimmed) onRenameTag(editingTagId, trimmed)
    setEditingTagId(null)
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-5 border-r border-border p-5">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Suchen …"
          className="w-full rounded-lg border border-border bg-panel py-1.5 pl-9 pr-3 text-sm text-text outline-none placeholder:text-text-muted focus:border-gold/50"
        />
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-panel p-1">
        <button
          onClick={() => onViewModeChange('grid')}
          title="Raster"
          className={`flex-1 rounded-md py-1.5 flex items-center justify-center transition ${
            viewMode === 'grid' ? 'bg-panel-active text-gold' : 'text-text-muted hover:text-text'
          }`}
        >
          <IconGrid className="h-4 w-4" />
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          title="Liste"
          className={`flex-1 rounded-md py-1.5 flex items-center justify-center transition ${
            viewMode === 'list' ? 'bg-panel-active text-gold' : 'text-text-muted hover:text-text'
          }`}
        >
          <IconList className="h-4 w-4" />
        </button>
        <button
          onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
          title="Nur Favoriten"
          className={`flex-1 rounded-md py-1.5 flex items-center justify-center transition ${
            favoritesOnly ? 'bg-panel-active text-amber' : 'text-text-muted hover:text-text'
          }`}
        >
          <IconStar className="h-4 w-4" filled={favoritesOnly} />
        </button>
      </div>

      <select
        value={sortMode}
        onChange={(e) => onSortModeChange(e.target.value as SortMode)}
        className="rounded-lg border border-border bg-panel px-2 py-1.5 text-sm text-text outline-none focus:border-gold/50"
      >
        <option value="added">Zuletzt hinzugefügt</option>
        <option value="name">Name (A-Z)</option>
        <option value="recent">Zuletzt gespielt</option>
        <option value="playtime">Spielzeit</option>
        <option value="custom">Eigene Reihenfolge</option>
      </select>
      {sortMode === 'custom' && (
        <p className="-mt-3 text-xs text-text-muted">Programme per Drag & Drop verschieben.</p>
      )}

      <div className="flex flex-col gap-1">
        <button
          onClick={() => onSelectTag(null)}
          className={`rounded-lg px-2 py-1.5 text-left text-sm transition ${
            selectedTagId === null
              ? 'bg-panel-active text-text'
              : 'text-text-muted hover:bg-panel-hover hover:text-text'
          }`}
        >
          Alle <span className="text-text-muted">({entries.length})</span>
        </button>
        <button
          onClick={() => onSelectTag('')}
          className={`rounded-lg px-2 py-1.5 text-left text-sm transition ${
            selectedTagId === ''
              ? 'bg-panel-active text-text'
              : 'text-text-muted hover:bg-panel-hover hover:text-text'
          }`}
        >
          Unsortiert <span className="text-text-muted">({untaggedCount})</span>
        </button>
        {missingCount > 0 && (
          <button
            onClick={() => onMissingOnlyChange(!missingOnly)}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm transition ${
              missingOnly
                ? 'bg-panel-active text-amber'
                : 'text-amber/80 hover:bg-panel-hover hover:text-amber'
            }`}
          >
            <IconAlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Fehlende Pfade <span className="text-text-muted">({missingCount})</span>
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        <span className="font-display text-[11px] font-bold tracking-wider text-text-muted">
          DEINE TAGS
        </span>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, index) => {
            const count = entries.filter((e) => e.tags.includes(tag.id)).length
            const isEditing = editingTagId === tag.id
            const color = DOT_COLORS[index % DOT_COLORS.length]
            const active = selectedTagId === tag.id

            if (isEditing) {
              return (
                <input
                  key={tag.id}
                  autoFocus
                  value={editingTagName}
                  onChange={(e) => setEditingTagName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setEditingTagId(null)
                  }}
                  className="w-28 rounded-full bg-panel-hover px-3 py-1.5 text-xs text-text outline-none"
                />
              )
            }

            return (
              <div
                key={tag.id}
                className={`group flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-on-ember transition ${color} ${
                  active ? 'ring-2 ring-text/60' : 'opacity-90 hover:opacity-100'
                }`}
              >
                <button onClick={() => onSelectTag(tag.id)} className="truncate">
                  {tag.name} <span className="opacity-70">({count})</span>
                </button>
                <button
                  onClick={() => {
                    setEditingTagId(tag.id)
                    setEditingTagName(tag.name)
                  }}
                  title="Umbenennen"
                  className="hidden p-0.5 group-hover:inline-flex group-focus-within:inline-flex"
                >
                  <IconEdit className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onRemoveTag(tag.id)}
                  title="Löschen"
                  className="hidden p-0.5 group-hover:inline-flex group-focus-within:inline-flex"
                >
                  <IconTrash className="h-3 w-3" />
                </button>
              </div>
            )
          })}

          {addingTag ? (
            <input
              autoFocus
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onBlur={commitNewTag}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitNewTag()
                if (e.key === 'Escape') setAddingTag(false)
              }}
              placeholder="Neuer Tag"
              className="w-28 rounded-full border border-border bg-panel px-3 py-1.5 text-xs text-text outline-none focus:border-gold/50"
            />
          ) : (
            <button
              onClick={() => setAddingTag(true)}
              title="Tag hinzufügen"
              className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:border-gold/50 hover:text-gold"
            >
              <IconPlus className="h-3 w-3" />
              Tag
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
