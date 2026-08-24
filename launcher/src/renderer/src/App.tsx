import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { Category, Entry, EntryStats, ViewMode } from './types'
import { EntryIcon } from './components/EntryIcon'
import { Sidebar } from './components/Sidebar'
import { DetailPanel } from './components/DetailPanel'
import { ScannerDialog } from './components/ScannerDialog'
import { StatsDialog } from './components/StatsDialog'
import { IconClock, IconPlus, IconSearch, IconStar, IconTrash } from './components/icons'

function App(): ReactElement {
  const [entries, setEntries] = useState<Entry[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [stats, setStats] = useState<EntryStats[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      window.api.listEntries(),
      window.api.listCategories(),
      window.api.listStats()
    ]).then(([loadedEntries, loadedCategories, loadedStats]) => {
      setEntries(loadedEntries)
      setCategories(loadedCategories)
      setStats(loadedStats)
      setLoading(false)
    })
  }, [])

  // Spielzeit läuft im Hintergrund weiter (Prozess-Polling im Main-Prozess),
  // daher hier frisch nachladen statt die Werte vom App-Start zu behalten.
  useEffect(() => {
    if (selectedEntryId || statsOpen) {
      window.api.listStats().then(setStats)
    }
  }, [selectedEntryId, statsOpen])

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return entries.filter((entry) => {
      if (favoritesOnly && !entry.favorite) return false
      if (selectedCategoryId !== null && entry.category !== selectedCategoryId) return false
      if (query && !entry.name.toLowerCase().includes(query)) return false
      return true
    })
  }, [entries, searchQuery, selectedCategoryId, favoritesOnly])

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

  async function handleToggleFavorite(entry: Entry): Promise<void> {
    setEntries(await window.api.toggleFavorite(entry.id))
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
    <div className="flex h-screen flex-col bg-base text-text">
      <header className="flex items-center justify-between px-8 py-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Launcher</h1>
          <p className="text-sm text-text-muted">{entries.length} Programme</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStatsOpen(true)}
            title="Statistik"
            className="rounded-lg border border-border bg-panel p-2.5 text-text transition hover:border-cyan/50 hover:text-cyan"
          >
            <IconClock />
          </button>
          <button
            onClick={() => setScannerOpen(true)}
            title="Programme suchen"
            className="rounded-lg border border-border bg-panel p-2.5 text-text transition hover:border-cyan/50 hover:text-cyan"
          >
            <IconSearch />
          </button>
          <button
            onClick={handleAdd}
            title="Programm hinzufügen"
            className="glow-pink rounded-lg bg-pink p-2.5 text-white transition hover:brightness-110"
          >
            <IconPlus />
          </button>
        </div>
      </header>
      <div className="divider" />

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
          favoritesOnly={favoritesOnly}
          onFavoritesOnlyChange={setFavoritesOnly}
          onAddCategory={handleAddCategory}
          onRenameCategory={handleRenameCategory}
          onRemoveCategory={handleRemoveCategory}
        />

        <main className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <p className="text-sm text-text-muted">Lade …</p>
          ) : entries.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
              <IconPlus className="h-8 w-8" />
              <p className="text-sm">Noch keine Programme</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
              <IconSearch className="h-8 w-8" />
              <button
                onClick={resetFilters}
                className="text-sm text-cyan underline hover:brightness-125"
              >
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
                  className={`group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 text-center transition ${
                    selectedEntryId === entry.id
                      ? 'glow-cyan border-cyan/60 bg-panel-active'
                      : 'border-border bg-panel hover:border-cyan/30 hover:bg-panel-hover'
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleFavorite(entry)
                    }}
                    title="Favorit"
                    className={`absolute left-2 top-2 p-1 ${
                      entry.favorite
                        ? 'block text-amber'
                        : 'hidden text-text-muted hover:text-amber group-hover:block'
                    }`}
                  >
                    <IconStar className="h-3.5 w-3.5" filled={entry.favorite} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(entry)
                    }}
                    title="Entfernen"
                    className="absolute right-2 top-2 hidden rounded-md bg-panel-hover p-1 hover:bg-panel-active group-hover:block"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
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
                  className={`group flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${
                    selectedEntryId === entry.id
                      ? 'glow-cyan border-cyan/60 bg-panel-active'
                      : 'border-transparent hover:bg-panel-hover'
                  }`}
                >
                  <EntryIcon iconHash={entry.iconHash} className="h-8 w-8" />
                  <span className="flex-1 truncate text-sm font-medium">{entry.name}</span>
                  <span className="text-xs text-text-muted">
                    {categories.find((c) => c.id === entry.category)?.name ?? 'Unsortiert'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleFavorite(entry)
                    }}
                    title="Favorit"
                    className={`p-1 ${
                      entry.favorite
                        ? 'text-amber'
                        : 'hidden text-text-muted hover:text-amber group-hover:inline-flex'
                    }`}
                  >
                    <IconStar className="h-3.5 w-3.5" filled={entry.favorite} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(entry)
                    }}
                    title="Entfernen"
                    className="hidden rounded-md bg-panel-hover p-1 hover:bg-panel-active group-hover:block"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
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
            stats={stats.find((s) => s.entryId === selectedEntry.id) ?? null}
            onLaunch={handleLaunch}
            onRename={handleRename}
            onSetCategory={handleSetCategory}
            onToggleFavorite={handleToggleFavorite}
            onRemove={handleDelete}
            onClose={() => setSelectedEntryId(null)}
          />
        )}
      </div>

      {status && (
        <>
          <div className="divider" />
          <footer className="px-8 py-3 text-sm text-text-muted">{status}</footer>
        </>
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

      {statsOpen && (
        <StatsDialog entries={entries} stats={stats} onClose={() => setStatsOpen(false)} />
      )}
    </div>
  )
}

export default App
