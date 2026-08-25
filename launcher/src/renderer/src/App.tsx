import { useEffect, useMemo, useState, type DragEvent, type ReactElement } from 'react'
import type { Entry, EntryStats, SortMode, Tag, ViewMode } from './types'
import type { UpdaterStatus } from '../../main/updater'
import { EntryIcon } from './components/EntryIcon'
import { Sidebar } from './components/Sidebar'
import { DetailPanel } from './components/DetailPanel'
import { ScannerDialog } from './components/ScannerDialog'
import { StatsDialog } from './components/StatsDialog'
import { BigPictureView } from './components/BigPictureView'
import {
  IconClock,
  IconExpand,
  IconMore,
  IconPlus,
  IconSearch,
  IconStar,
  IconTrash
} from './components/icons'
import logo from './assets/logo.png'

function App(): ReactElement {
  const [entries, setEntries] = useState<Entry[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [stats, setStats] = useState<EntryStats[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus | null>(null)
  const [bigPictureMode, setBigPictureMode] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortMode, setSortMode] = useState<SortMode>('added')
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [draggingOver, setDraggingOver] = useState(false)

  useEffect(() => {
    Promise.all([window.api.listEntries(), window.api.listTags(), window.api.listStats()]).then(
      ([loadedEntries, loadedTags, loadedStats]) => {
        setEntries(loadedEntries)
        setTags(loadedTags)
        setStats(loadedStats)
        setLoading(false)
      }
    )
  }, [])

  useEffect(() => {
    return window.api.onUpdaterStatus(setUpdaterStatus)
  }, [])

  useEffect(() => {
    return window.api.onFullscreenChanged(setBigPictureMode)
  }, [])

  // Änderungen über das native Kontextmenü oder eine wiederhergestellte
  // Sicherung kommen vom Main-Prozess, nicht als Antwort auf einen eigenen Aufruf.
  useEffect(() => {
    return window.api.onEntriesChanged(setEntries)
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
    const statsByEntry = new Map(stats.map((s) => [s.entryId, s]))

    const filtered = entries.filter((entry) => {
      if (favoritesOnly && !entry.favorite) return false
      if (selectedTagId === '' && entry.tags.length > 0) return false
      if (selectedTagId && selectedTagId !== '' && !entry.tags.includes(selectedTagId))
        return false
      if (query && !entry.name.toLowerCase().includes(query)) return false
      return true
    })

    return [...filtered].sort((a, b) => {
      switch (sortMode) {
        case 'name':
          return a.name.localeCompare(b.name, 'de')
        case 'recent':
          return (
            (statsByEntry.get(b.id)?.lastPlayedAt ?? 0) - (statsByEntry.get(a.id)?.lastPlayedAt ?? 0)
          )
        case 'playtime':
          return (
            (statsByEntry.get(b.id)?.totalPlayedMs ?? 0) -
            (statsByEntry.get(a.id)?.totalPlayedMs ?? 0)
          )
        case 'added':
        default:
          return b.addedAt - a.addedAt
      }
    })
  }, [entries, searchQuery, selectedTagId, favoritesOnly, sortMode, stats])

  const selectedEntry = entries.find((e) => e.id === selectedEntryId) ?? null

  // Nur im ungefilterten Grundzustand zeigen — sonst wirkt es wie eine zweite,
  // widersprüchliche Liste neben den gerade gefilterten Ergebnissen.
  const recentlyPlayed = useMemo(() => {
    if (searchQuery.trim() || selectedTagId !== null || favoritesOnly) return []
    return stats
      .filter((s) => s.lastPlayedAt !== null)
      .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
      .slice(0, 6)
      .map((s) => entries.find((e) => e.id === s.entryId))
      .filter((e): e is Entry => e !== undefined)
  }, [stats, entries, searchQuery, selectedTagId, favoritesOnly])

  async function handleAdd(): Promise<void> {
    const updated = await window.api.addEntryViaDialog()
    setEntries(updated)
  }

  // Electron reichert File-Objekte aus Drag&Drop um einen echten Dateisystem-
  // pfad an (`.path`) — Standard-Web-APIs kennen das nicht, ist aber die
  // übliche Electron-Erweiterung dafür.
  async function handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault()
    setDraggingOver(false)
    const paths = Array.from(e.dataTransfer.files)
      .map((file) => file.path)
      .filter((path) => /\.(exe|lnk)$/i.test(path))
    if (paths.length === 0) return
    setEntries(await window.api.addEntriesFromPaths(paths))
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

  async function handleInstallUpdate(): Promise<void> {
    await window.api.installUpdate()
  }

  async function handleToggleTag(id: string, tagId: string): Promise<void> {
    setEntries(await window.api.toggleEntryTag(id, tagId))
  }

  async function handleAddTag(name: string): Promise<void> {
    try {
      setTags(await window.api.addTag(name))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleRenameTag(id: string, name: string): Promise<void> {
    try {
      setTags(await window.api.renameTag(id, name))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleRemoveTag(id: string): Promise<void> {
    const tag = tags.find((t) => t.id === id)
    if (tag && !window.confirm(`Tag "${tag.name}" löschen?`)) return
    setTags(await window.api.removeTag(id))
    setEntries(await window.api.listEntries())
    if (selectedTagId === id) setSelectedTagId(null)
  }

  // Pfeiltasten wandern durch die aktuell gefilterte Liste, Enter startet,
  // Entf/Rücktaste löscht — nur solange kein Eingabefeld fokussiert ist.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (bigPictureMode) return
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
  }, [filteredEntries, selectedEntryId, selectedEntry, bigPictureMode])

  function resetFilters(): void {
    setSearchQuery('')
    setSelectedTagId(null)
  }

  if (bigPictureMode) {
    return (
      <BigPictureView
        entries={filteredEntries}
        onLaunch={handleLaunch}
        onExit={() => window.api.setFullscreen(false)}
      />
    )
  }

  return (
    <div className="flex h-screen flex-col bg-base text-text">
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-20 w-20 rounded-md object-cover" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">MR Launch</h1>
            <p className="text-sm text-text-muted">{entries.length} Programme</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.api.setFullscreen(true)}
            title="Big-Picture-Modus"
            className="rounded-lg border border-border bg-panel p-2.5 text-text transition hover:border-cyan/50 hover:text-cyan"
          >
            <IconExpand />
          </button>
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
          <button
            onClick={() => window.api.showAppMenu()}
            title="Weitere Optionen"
            className="rounded-lg border border-border bg-panel p-2.5 text-text transition hover:border-cyan/50 hover:text-cyan"
          >
            <IconMore />
          </button>
        </div>
      </header>

      {updaterStatus?.state === 'downloading' && (
        <div className="relative overflow-hidden border-b border-cyan/30 bg-panel-active px-8 py-2 text-sm text-text">
          <span>Update wird heruntergeladen … {updaterStatus.percent}%</span>
          <div
            className="absolute inset-x-0 bottom-0 h-0.5 bg-cyan transition-all"
            style={{ width: `${updaterStatus.percent}%` }}
          />
        </div>
      )}
      {updaterStatus?.state === 'downloaded' && (
        <div className="glow-cyan flex items-center justify-between border-b border-cyan/40 bg-panel-active px-8 py-2 text-sm text-text">
          <span>Update auf Version {updaterStatus.version} ist bereit.</span>
          <button
            onClick={handleInstallUpdate}
            className="glow-pink rounded-lg bg-pink px-3 py-1.5 text-sm text-white transition hover:brightness-110"
          >
            Jetzt neu starten
          </button>
        </div>
      )}

      <div className="divider" />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          tags={tags}
          entries={entries}
          selectedTagId={selectedTagId}
          onSelectTag={setSelectedTagId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          favoritesOnly={favoritesOnly}
          onFavoritesOnlyChange={setFavoritesOnly}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          onAddTag={handleAddTag}
          onRenameTag={handleRenameTag}
          onRemoveTag={handleRemoveTag}
        />

        <main
          onDragOver={(e) => {
            e.preventDefault()
            setDraggingOver(true)
          }}
          onDragLeave={() => setDraggingOver(false)}
          onDrop={handleDrop}
          className={`flex-1 overflow-y-auto p-8 transition ${
            draggingOver ? 'bg-panel-active outline-dashed outline-2 outline-cyan/50 -outline-offset-4' : ''
          }`}
        >
          {recentlyPlayed.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-sm font-medium text-text-muted">Zuletzt gespielt</h2>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {recentlyPlayed.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEntryId(entry.id)}
                    onDoubleClick={() => handleLaunch(entry)}
                    className={`flex w-24 shrink-0 flex-col items-center gap-2 rounded-xl border p-3 text-center transition ${
                      selectedEntryId === entry.id
                        ? 'glow-cyan border-cyan/60 bg-panel-active'
                        : 'border-border bg-panel hover:border-cyan/30 hover:bg-panel-hover'
                    }`}
                  >
                    <EntryIcon iconHash={entry.iconHash} />
                    <span className="w-full truncate text-xs font-medium">{entry.name}</span>
                  </button>
                ))}
              </div>
              <div className="divider mt-6" />
            </div>
          )}
          {loading ? (
            <p className="text-sm text-text-muted">Lade …</p>
          ) : entries.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
              <IconPlus className="h-8 w-8" />
              <p className="text-sm">Noch keine Programme</p>
              <button
                onClick={handleAdd}
                className="glow-pink rounded-lg bg-pink px-4 py-2 text-sm text-white transition hover:brightness-110"
              >
                Programm hinzufügen
              </button>
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
                  onContextMenu={() => {
                    setSelectedEntryId(entry.id)
                    window.api.showEntryContextMenu(entry.id)
                  }}
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
                        : 'hidden text-text-muted hover:text-amber group-hover:block group-focus-within:block'
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
                    className="absolute right-2 top-2 hidden rounded-md bg-panel-hover p-1 hover:bg-panel-active group-hover:block group-focus-within:block"
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
                  onContextMenu={() => {
                    setSelectedEntryId(entry.id)
                    window.api.showEntryContextMenu(entry.id)
                  }}
                  className={`group flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${
                    selectedEntryId === entry.id
                      ? 'glow-cyan border-cyan/60 bg-panel-active'
                      : 'border-transparent hover:bg-panel-hover'
                  }`}
                >
                  <EntryIcon iconHash={entry.iconHash} className="h-8 w-8" />
                  <span className="flex-1 truncate text-sm font-medium">{entry.name}</span>
                  <span className="truncate text-xs text-text-muted">
                    {entry.tags.length > 0
                      ? entry.tags
                          .map((id) => tags.find((t) => t.id === id)?.name)
                          .filter(Boolean)
                          .join(', ')
                      : 'Unsortiert'}
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
                        : 'hidden text-text-muted hover:text-amber group-hover:inline-flex group-focus-within:inline-flex'
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
                    className="hidden rounded-md bg-panel-hover p-1 hover:bg-panel-active group-hover:block group-focus-within:block"
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
            tags={tags}
            stats={stats.find((s) => s.entryId === selectedEntry.id) ?? null}
            onLaunch={handleLaunch}
            onRename={handleRename}
            onToggleTag={handleToggleTag}
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
