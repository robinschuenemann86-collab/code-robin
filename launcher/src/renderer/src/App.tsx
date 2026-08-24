import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { Category, Entry, ViewMode } from './types'
import { EntryIcon } from './components/EntryIcon'
import { Sidebar } from './components/Sidebar'
import { DetailPanel } from './components/DetailPanel'
import { ScannerDialog } from './components/ScannerDialog'

function App(): ReactElement {
  const [entries, setEntries] = useState<Entry[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([window.api.listEntries(), window.api.listCategories()]).then(
      ([loadedEntries, loadedCategories]) => {
        setEntries(loadedEntries)
        setCategories(loadedCategories)
        setLoading(false)
      }
    )
  }, [])

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return entries.filter((entry) => {
      if (selectedCategoryId !== null && entry.category !== selectedCategoryId) return false
      if (query && !entry.name.toLowerCase().includes(query)) return false
      return true
    })
  }, [entries, searchQuery, selectedCategoryId])

  const selectedEntry = entries.find((e) => e.id === selectedEntryId) ?? null

  async function handleAdd(): Promise<void> {
    const updated = await window.api.addEntryViaDialog()
    setEntries(updated)
  }

  async function handleLaunch(entry: Entry): Promise<void> {
    setStatus(`Starte "${entry.name}" …`)
    try {
      await window.api.launchEntry(entry.id)
      setStatus(`"${entry.name}" wurde gestartet.`)
    } catch (error) {
      setStatus(`Fehler beim Starten: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function handleDelete(entry: Entry): Promise<void> {
    if (!window.confirm(`"${entry.name}" aus dem Launcher entfernen?`)) return
    const updated = await window.api.removeEntry(entry.id)
    setEntries(updated)
    if (selectedEntryId === entry.id) setSelectedEntryId(null)
  }

  async function handleRename(id: string, name: string): Promise<void> {
    setEntries(await window.api.renameEntry(id, name))
  }

  async function handleSetCategory(id: string, categoryId: string): Promise<void> {
    setEntries(await window.api.setEntryCategory(id, categoryId))
  }

  async function handleAddCategory(name: string): Promise<void> {
    try {
      setCategories(await window.api.addCategory(name))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleRenameCategory(id: string, name: string): Promise<void> {
    try {
      setCategories(await window.api.renameCategory(id, name))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleRemoveCategory(id: string): Promise<void> {
    const category = categories.find((c) => c.id === id)
    if (category && !window.confirm(`Kategorie "${category.name}" löschen?`)) return
    setCategories(await window.api.removeCategory(id))
    setEntries(await window.api.listEntries())
    if (selectedCategoryId === id) setSelectedCategoryId(null)
  }

  // Pfeiltasten wandern durch die aktuell gefilterte Liste, Enter startet,
  // Entf/Rücktaste löscht — nur solange kein Eingabefeld fokussiert ist.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const activeTag = document.activeElement?.tagName
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return
      if (filteredEntries.length === 0) return

      const currentIndex = filteredEntries.findIndex((entry) => entry.id === selectedEntryId)

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        const next = filteredEntries[Math.min(currentIndex + 1, filteredEntries.length - 1)]
        setSelectedEntryId((next ?? filteredEntries[0]).id)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        const prevIndex = currentIndex <= 0 ? 0 : currentIndex - 1
        setSelectedEntryId(filteredEntries[prevIndex].id)
      } else if (e.key === 'Home') {
        e.preventDefault()
        setSelectedEntryId(filteredEntries[0].id)
      } else if (e.key === 'End') {
        e.preventDefault()
        setSelectedEntryId(filteredEntries[filteredEntries.length - 1].id)
      } else if (e.key === 'Enter' && selectedEntry) {
        e.preventDefault()
        handleLaunch(selectedEntry)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEntry) {
        e.preventDefault()
        handleDelete(selectedEntry)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // handleLaunch/handleDelete read `entries` via the `selectedEntry` closure captured above,
    // so listing them here would only force pointless re-subscriptions on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredEntries, selectedEntryId, selectedEntry])

  function resetFilters(): void {
    setSearchQuery('')
    setSelectedCategoryId(null)
  }

  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Launcher</h1>
          <p className="text-sm text-neutral-400">{entries.length} Programme</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setScannerOpen(true)}
            className="rounded-md border border-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            Programme suchen
          </button>
          <button
            onClick={handleAdd}
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white"
          >
            + Programm hinzufügen
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar
          categories={categories}
          entries={entries}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onAddCategory={handleAddCategory}
          onRenameCategory={handleRenameCategory}
          onRemoveCategory={handleRemoveCategory}
        />

        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-sm text-neutral-500">Lade …</p>
          ) : entries.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-neutral-500">
              <p>Noch keine Programme hinzugefügt.</p>
              <p className="text-sm">Klicke oben rechts auf &quot;+ Programm hinzufügen&quot;.</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-neutral-500">
              <p>Keine Treffer.</p>
              <button onClick={resetFilters} className="text-sm underline hover:text-neutral-300">
                Filter zurücksetzen
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => setSelectedEntryId(entry.id)}
                  onDoubleClick={() => handleLaunch(entry)}
                  className={`group relative flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 text-center transition ${
                    selectedEntryId === entry.id
                      ? 'border-neutral-500 bg-neutral-800'
                      : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600 hover:bg-neutral-800'
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(entry)
                    }}
                    title="Entfernen"
                    className="absolute right-2 top-2 hidden rounded bg-neutral-800 px-1.5 py-0.5 text-xs hover:bg-neutral-700 group-hover:block"
                  >
                    🗑️
                  </button>
                  <EntryIcon iconHash={entry.iconHash} />
                  <span className="truncate text-sm font-medium">{entry.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => setSelectedEntryId(entry.id)}
                  onDoubleClick={() => handleLaunch(entry)}
                  className={`group flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition ${
                    selectedEntryId === entry.id
                      ? 'border-neutral-500 bg-neutral-800'
                      : 'border-transparent hover:bg-neutral-900'
                  }`}
                >
                  <EntryIcon iconHash={entry.iconHash} className="h-8 w-8" />
                  <span className="flex-1 truncate text-sm font-medium">{entry.name}</span>
                  <span className="text-xs text-neutral-500">
                    {categories.find((c) => c.id === entry.category)?.name ?? 'Unsortiert'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(entry)
                    }}
                    title="Entfernen"
                    className="hidden rounded bg-neutral-800 px-1.5 py-0.5 text-xs hover:bg-neutral-700 group-hover:block"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>

        {selectedEntry && (
          <DetailPanel
            key={selectedEntry.id}
            entry={selectedEntry}
            categories={categories}
            onLaunch={handleLaunch}
            onRename={handleRename}
            onSetCategory={handleSetCategory}
            onRemove={handleDelete}
            onClose={() => setSelectedEntryId(null)}
          />
        )}
      </div>

      {status && (
        <footer className="border-t border-neutral-800 px-6 py-3 text-sm text-neutral-400">
          {status}
        </footer>
      )}

      {scannerOpen && (
        <ScannerDialog
          onClose={() => setScannerOpen(false)}
          onImported={async () => {
            setEntries(await window.api.listEntries())
            setScannerOpen(false)
          }}
        />
      )}
    </div>
  )
}

export default App
