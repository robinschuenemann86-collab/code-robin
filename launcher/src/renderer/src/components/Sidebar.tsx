import { useState, type ReactElement } from 'react'
import type { Category, Entry, ViewMode } from '../types'

interface SidebarProps {
  categories: Category[]
  entries: Entry[]
  selectedCategoryId: string | null
  onSelectCategory: (id: string | null) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onAddCategory: (name: string) => void
  onRenameCategory: (id: string, name: string) => void
  onRemoveCategory: (id: string) => void
}

export function Sidebar({
  categories,
  entries,
  selectedCategoryId,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
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
    <aside className="flex w-56 shrink-0 flex-col gap-4 border-r border-neutral-800 p-4">
      <input
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Suchen …"
        className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm outline-none focus:border-neutral-600"
      />

      <div className="flex gap-1">
        <button
          onClick={() => onViewModeChange('grid')}
          className={`flex-1 rounded-md px-2 py-1 text-xs ${
            viewMode === 'grid'
              ? 'bg-neutral-100 text-neutral-900'
              : 'bg-neutral-900 text-neutral-400'
          }`}
        >
          Raster
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          className={`flex-1 rounded-md px-2 py-1 text-xs ${
            viewMode === 'list'
              ? 'bg-neutral-100 text-neutral-900'
              : 'bg-neutral-900 text-neutral-400'
          }`}
        >
          Liste
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        <button
          onClick={() => onSelectCategory(null)}
          className={`rounded px-2 py-1.5 text-left text-sm ${
            selectedCategoryId === null ? 'bg-neutral-800' : 'hover:bg-neutral-900'
          }`}
        >
          Alle <span className="text-neutral-500">({entries.length})</span>
        </button>
        <button
          onClick={() => onSelectCategory('')}
          className={`rounded px-2 py-1.5 text-left text-sm ${
            selectedCategoryId === '' ? 'bg-neutral-800' : 'hover:bg-neutral-900'
          }`}
        >
          Unsortiert <span className="text-neutral-500">({uncategorizedCount})</span>
        </button>

        {categories.map((category) => {
          const count = entries.filter((e) => e.category === category.id).length
          const isEditing = editingCategoryId === category.id
          return (
            <div
              key={category.id}
              className={`group flex items-center rounded px-2 py-1.5 text-sm ${
                selectedCategoryId === category.id ? 'bg-neutral-800' : 'hover:bg-neutral-900'
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
                  className="w-full rounded bg-neutral-700 px-1 text-sm outline-none"
                />
              ) : (
                <>
                  <button
                    onClick={() => onSelectCategory(category.id)}
                    className="flex-1 truncate text-left"
                  >
                    {category.name} <span className="text-neutral-500">({count})</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingCategoryId(category.id)
                      setEditingCategoryName(category.name)
                    }}
                    title="Umbenennen"
                    className="hidden text-xs group-hover:inline"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => onRemoveCategory(category.id)}
                    title="Löschen"
                    className="hidden text-xs group-hover:inline"
                  >
                    🗑️
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
          className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm outline-none"
        />
      ) : (
        <button
          onClick={() => setAddingCategory(true)}
          className="rounded-md px-2 py-1 text-left text-sm text-neutral-400 hover:bg-neutral-900"
        >
          + Kategorie
        </button>
      )}
    </aside>
  )
}
