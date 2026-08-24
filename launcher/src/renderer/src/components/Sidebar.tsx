import { useState, type ReactElement } from 'react'
import type { Category, Entry, ViewMode } from '../types'
import { IconEdit, IconGrid, IconList, IconPlus, IconSearch, IconStar, IconTrash } from './icons'

interface SidebarProps {
  categories: Category[]
  entries: Entry[]
  selectedCategoryId: string | null
  onSelectCategory: (id: string | null) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  favoritesOnly: boolean
  onFavoritesOnlyChange: (value: boolean) => void
  onAddCategory: (name: string) => void
  onRenameCategory: (id: string, name: string) => void
  onRemoveCategory: (id: string) => void
}

// Kleine, sich wiederholende Akzentfarben für die Kategorie-Punkte —
// rein kosmetisch zur Wiedererkennung, keine feste Bedeutung pro Farbe.
const DOT_COLORS = ['bg-cyan', 'bg-pink', 'bg-violet', 'bg-amber']

export function Sidebar({
  categories,
  entries,
  selectedCategoryId,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  onAddCategory,
  onRenameCategory,
  onRemoveCategory
}: SidebarProps): ReactElement {
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')

  const uncategorizedCount = entries.filter((e) => e.category === '').length

  function commitNewCategory(): void {
    const trimmed = newCategoryName.trim()
    if (trimmed) onAddCategory(trimmed)
    setNewCategoryName('')
    setAddingCategory(false)
  }

  function commitRename(): void {
    if (!editingCategoryId) return
    const trimmed = editingCategoryName.trim()
    if (trimmed) onRenameCategory(editingCategoryId, trimmed)
    setEditingCategoryId(null)
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-5 border-r border-border p-5">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Suchen …"
          className="w-full rounded-lg border border-border bg-panel py-1.5 pl-9 pr-3 text-sm text-text outline-none placeholder:text-text-muted focus:border-cyan/50"
        />
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-panel p-1">
        <button
          onClick={() => onViewModeChange('grid')}
          title="Raster"
          className={`flex-1 rounded-md py-1.5 flex items-center justify-center transition ${
            viewMode === 'grid' ? 'bg-panel-active text-cyan' : 'text-text-muted hover:text-text'
          }`}
        >
          <IconGrid className="h-4 w-4" />
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          title="Liste"
          className={`flex-1 rounded-md py-1.5 flex items-center justify-center transition ${
            viewMode === 'list' ? 'bg-panel-active text-cyan' : 'text-text-muted hover:text-text'
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

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        <button
          onClick={() => onSelectCategory(null)}
          className={`rounded-lg px-2 py-1.5 text-left text-sm transition ${
            selectedCategoryId === null
              ? 'bg-panel-active text-text'
              : 'text-text-muted hover:bg-panel-hover hover:text-text'
          }`}
        >
          Alle <span className="text-text-muted">({entries.length})</span>
        </button>
        <button
          onClick={() => onSelectCategory('')}
          className={`rounded-lg px-2 py-1.5 text-left text-sm transition ${
            selectedCategoryId === ''
              ? 'bg-panel-active text-text'
              : 'text-text-muted hover:bg-panel-hover hover:text-text'
          }`}
        >
          Unsortiert <span className="text-text-muted">({uncategorizedCount})</span>
        </button>

        {categories.map((category, index) => {
          const count = entries.filter((e) => e.category === category.id).length
          const isEditing = editingCategoryId === category.id
          const dotColor = DOT_COLORS[index % DOT_COLORS.length]
          return (
            <div
              key={category.id}
              className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                selectedCategoryId === category.id
                  ? 'bg-panel-active text-text'
                  : 'text-text-muted hover:bg-panel-hover hover:text-text'
              }`}
            >
              {isEditing ? (
                <input
                  autoFocus
                  value={editingCategoryName}
                  onChange={(e) => setEditingCategoryName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setEditingCategoryId(null)
                  }}
                  className="w-full rounded bg-panel-hover px-1 text-sm text-text outline-none"
                />
              ) : (
                <>
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
                  <button
                    onClick={() => onSelectCategory(category.id)}
                    className="flex-1 truncate text-left"
                  >
                    {category.name} <span className="text-text-muted">({count})</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingCategoryId(category.id)
                      setEditingCategoryName(category.name)
                    }}
                    title="Umbenennen"
                    className="hidden p-0.5 text-text-muted hover:text-cyan group-hover:inline-flex"
                  >
                    <IconEdit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onRemoveCategory(category.id)}
                    title="Löschen"
                    className="hidden p-0.5 text-text-muted hover:text-pink group-hover:inline-flex"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          )
        })}
      </nav>

      {addingCategory ? (
        <input
          autoFocus
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onBlur={commitNewCategory}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitNewCategory()
            if (e.key === 'Escape') setAddingCategory(false)
          }}
          placeholder="Neue Kategorie"
          className="rounded-lg border border-border bg-panel px-2 py-1 text-sm text-text outline-none focus:border-cyan/50"
        />
      ) : (
        <button
          onClick={() => setAddingCategory(true)}
          title="Kategorie hinzufügen"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-text-muted transition hover:bg-panel-hover hover:text-cyan"
        >
          <IconPlus className="h-3.5 w-3.5" />
          Kategorie
        </button>
      )}
    </aside>
  )
}
