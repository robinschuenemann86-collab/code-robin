import { useEffect, useMemo, useState, type DragEvent, type ReactElement } from 'react'
import type { Entry, EntryStats, OverviewData, SavedView, SortMode, Tag, ViewMode } from './types'
import type { UpdaterStatus } from '../../main/updater'
import { TAG_COLORS } from './constants'
import { EntryIcon } from './components/EntryIcon'
import { Sidebar } from './components/Sidebar'
import { DetailPanel } from './components/DetailPanel'
import { ScannerDialog } from './components/ScannerDialog'
import { StatsDialog } from './components/StatsDialog'
import { OverviewDialog } from './components/OverviewDialog'
import { CoverArtKeyDialog } from './components/CoverArtKeyDialog'
import { ShortcutsDialog } from './components/ShortcutsDialog'
import { BigPictureView } from './components/BigPictureView'
import {
  IconAlertTriangle,
  IconApps,
  IconClock,
  IconDice,
  IconExpand,
  IconHelp,
  IconMore,
  IconPlus,
  IconSearch,
  IconStar,
  IconTrash
} from './components/icons'
import logo from './assets/logo.png'

const NEW_THRESHOLD_MS = 48 * 60 * 60 * 1000

function isNewEntry(entry: Entry): boolean {
  return Date.now() - entry.addedAt < NEW_THRESHOLD_MS
}

function App(): ReactElement {
  const [entries, setEntries] = useState<Entry[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [stats, setStats] = useState<EntryStats[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [coverArtKeyDialogOpen, setCoverArtKeyDialogOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus | null>(null)
  const [bigPictureMode, setBigPictureMode] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [missingOnly, setMissingOnly] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortMode, setSortMode] = useState<SortMode>('added')
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [draggingOver, setDraggingOver] = useState(false)
  const [missingPaths, setMissingPaths] = useState<Set<string>>(new Set())
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null)
  const [dragOverEntryId, setDragOverEntryId] = useState<string | null>(null)
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set())
  const [savedViews, setSavedViews] = useState<SavedView[]>([])

  useEffect(() => {
    window.api.listSavedViews().then(setSavedViews)
  }, [])

  // Das Prozess-Polling im Main-Prozess läuft alle 15s (siehe playtime.ts) —
  // hier reicht ein ähnlich grobes Intervall, das "Läuft gerade"-Abzeichen
  // muss nicht sekundengenau sein.
  useEffect(() => {
    function refresh(): void {
      window.api.getRunningEntries().then((ids) => setRunningIds(new Set(ids)))
    }
    refresh()
    const interval = setInterval(refresh, 10_000)
    return () => clearInterval(interval)
  }, [])

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

  useEffect(() => {
    return window.api.onOpenCoverArtKeyDialog(() => setCoverArtKeyDialogOpen(true))
  }, [])

  // Rückmeldungen aus dem nativen Rechtsklick-Menü (z. B. Cover-Art-Suche) —
  // die haben von dort aus keinen anderen Weg in die Statuszeile.
  useEffect(() => {
    return window.api.onStatusMessage(setStatus)
  }, [])

  // Änderungen über das native Kontextmenü oder eine wiederhergestellte
  // Sicherung kommen vom Main-Prozess, nicht als Antwort auf einen eigenen Aufruf.
  useEffect(() => {
    return window.api.onEntriesChanged(setEntries)
  }, [])

  // Prüft erneut, sobald sich die Liste ändert (z. B. nach einer
  // Wiederherstellung auf diesem Rechner oder wenn ein Spiel deinstalliert wurde).
  useEffect(() => {
    window.api.checkEntryPaths().then((result) => {
      setMissingPaths(new Set(Object.keys(result).filter((id) => !result[id])))
    })
  }, [entries])

  // Spielzeit läuft im Hintergrund weiter (Prozess-Polling im Main-Prozess),
  // daher hier frisch nachladen statt die Werte vom App-Start zu behalten. Der
  // Fokus-Fall deckt "zuletzt gespielt": nach dem Beenden eines Spiels kommt
  // man ins Fenster zurück, und die Leiste soll das dann schon zeigen.
  useEffect(() => {
    function refresh(): void {
      window.api.listStats().then(setStats)
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  useEffect(() => {
    if (selectedEntryId || statsOpen) {
      window.api.listStats().then(setStats)
    }
  }, [selectedEntryId, statsOpen])

  useEffect(() => {
    if (overviewOpen) {
      window.api.getOverview().then(setOverview)
    }
  }, [overviewOpen])

  async function handleSetWeeklyGoal(minutes: number | null): Promise<void> {
    await window.api.setWeeklyGoal(minutes)
    setOverview(await window.api.getOverview())
  }

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const statsByEntry = new Map(stats.map((s) => [s.entryId, s]))

    const filtered = entries.filter((entry) => {
      if (favoritesOnly && !entry.favorite) return false
      if (missingOnly && !missingPaths.has(entry.id)) return false
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
        case 'custom':
          return a.order - b.order
        case 'added':
        default:
          return b.addedAt - a.addedAt
      }
    })
  }, [entries, searchQuery, selectedTagId, favoritesOnly, missingOnly, missingPaths, sortMode, stats])

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

  // Zwei ganz unterschiedliche Dinge landen im selben onDrop: von außen
  // hereingezogene Dateien (neues Programm) und intern verschobene Kacheln
  // (Umsortieren). Ein Fallback aufs Container-Element, falls jemand eine
  // Kachel hinter die letzte fallen lässt statt genau auf eine andere.
  async function handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault()
    setDraggingOver(false)

    if (draggedEntryId) {
      const lastEntry = filteredEntries[filteredEntries.length - 1]
      if (lastEntry) handleMoveEntry(draggedEntryId, lastEntry.id, 'after')
      return
    }

    // Electron reichert File-Objekte aus Drag&Drop um einen echten Dateisystem-
    // pfad an (`.path`) — Standard-Web-APIs kennen das nicht, ist aber die
    // übliche Electron-Erweiterung dafür.
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
      // Sonst dauert es bis zu 10s (Poll-Intervall), bis das "Läuft
      // gerade"-Abzeichen nach dem Start erscheint.
      window.api.getRunningEntries().then((ids) => setRunningIds(new Set(ids)))
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

  async function handleSetLaunchArgs(id: string, args: string): Promise<void> {
    setEntries(await window.api.setLaunchArgs(id, args))
  }

  async function handleChangeIcon(id: string): Promise<void> {
    setEntries(await window.api.pickCustomIcon(id))
  }

  async function handleFetchCoverArt(id: string): Promise<void> {
    try {
      setEntries(await window.api.fetchCoverArt(id))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleMoveEntry(id: string, targetId: string, position: 'before' | 'after'): Promise<void> {
    setDraggedEntryId(null)
    setDragOverEntryId(null)
    if (id === targetId) return
    // Eine per Drag & Drop verschobene Kachel landet an einer festen Position —
    // das ergibt nur in der eigenen Reihenfolge einen Sinn, nicht während z. B.
    // nach Name sortiert ist. Deshalb hier automatisch umschalten, statt den
    // Nutzer vorher zwingend im Dropdown "Eigene Reihenfolge" wählen zu lassen.
    setSortMode('custom')
    setEntries(await window.api.moveEntry(id, targetId, position))
  }

  async function handleInstallUpdate(): Promise<void> {
    await window.api.installUpdate()
  }

  function handleRandomPick(): void {
    if (filteredEntries.length === 0) {
      setStatus('Keine Programme in der aktuellen Ansicht.')
      return
    }
    const pick = filteredEntries[Math.floor(Math.random() * filteredEntries.length)]
    setSelectedEntryId(pick.id)
    setStatus(`Wie wär's mit "${pick.name}"?`)
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

  async function handleCycleTagColor(id: string): Promise<void> {
    setTags(await window.api.cycleTagColor(id, TAG_COLORS))
  }

  async function handleSaveCurrentView(name: string): Promise<void> {
    setSavedViews(
      await window.api.addSavedView({ name, selectedTagId, sortMode, searchQuery, favoritesOnly })
    )
  }

  function handleApplyView(view: SavedView): void {
    setSelectedTagId(view.selectedTagId)
    setSortMode(view.sortMode)
    setSearchQuery(view.searchQuery)
    setFavoritesOnly(view.favoritesOnly)
  }

  async function handleRemoveView(id: string): Promise<void> {
    setSavedViews(await window.api.removeSavedView(id))
  }

  // Pfeiltasten wandern durch die aktuell gefilterte Liste, Enter startet,
  // Entf/Rücktaste löscht — nur solange kein Eingabefeld fokussiert ist.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (bigPictureMode) return
      // Sonst würden Pfeiltasten/Enter/Entf durch einen offenen Dialog
      // hindurch auf die dahinterliegende Bibliothek wirken — z. B. Enter
      // startet ein Spiel, während gerade der Übersicht-Dialog offen ist.
      if (scannerOpen || statsOpen || overviewOpen || coverArtKeyDialogOpen || shortcutsOpen) return
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
      } else if (e.key.toLowerCase() === 'f' && selectedEntry) {
        // Der Favoriten-Stern auf der Kachel ist nur per Hover erreichbar —
        // ohne das ließe sich Favorisieren rein per Tastatur gar nicht auslösen.
        e.preventDefault()
        handleToggleFavorite(selectedEntry)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // handleLaunch/handleDelete/handleToggleFavorite read `entries` via the `selectedEntry`
    // closure captured above, so listing them here would only force pointless re-subscriptions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filteredEntries,
    selectedEntryId,
    selectedEntry,
    bigPictureMode,
    scannerOpen,
    statsOpen,
    overviewOpen,
    coverArtKeyDialogOpen,
    shortcutsOpen
  ])

  function resetFilters(): void {
    setSearchQuery('')
    setSelectedTagId(null)
    setFavoritesOnly(false)
    setMissingOnly(false)
  }

  if (bigPictureMode) {
    return (
      <BigPictureView
        entries={filteredEntries}
        totalEntryCount={entries.length}
        runningIds={runningIds}
        onLaunch={handleLaunch}
        onExit={() => window.api.setFullscreen(false)}
        onResetFilters={resetFilters}
      />
    )
  }

  return (
    <div className="flex h-screen flex-col bg-base text-text">
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-20 w-20 rounded-md object-cover" />
          <div>
            <h1 className="ember-grad-text font-display text-2xl font-extrabold uppercase tracking-tight">
              MR Launch
            </h1>
            <p className="text-sm font-medium text-text-muted">{entries.length} Programme</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.api.setFullscreen(true)}
            title="Big-Picture-Modus"
            className="rounded-lg border border-border bg-panel p-2.5 text-text transition hover:border-gold/50 hover:text-gold"
          >
            <IconExpand />
          </button>
          <button
            onClick={() => setOverviewOpen(true)}
            title="Übersicht"
            className="rounded-lg border border-border bg-panel p-2.5 text-text transition hover:border-gold/50 hover:text-gold"
          >
            <IconApps />
          </button>
          <button
            onClick={() => setStatsOpen(true)}
            title="Statistik"
            className="rounded-lg border border-border bg-panel p-2.5 text-text transition hover:border-gold/50 hover:text-gold"
          >
            <IconClock />
          </button>
          <button
            onClick={() => setScannerOpen(true)}
            title="Programme suchen"
            className="rounded-lg border border-border bg-panel p-2.5 text-text transition hover:border-gold/50 hover:text-gold"
          >
            <IconSearch />
          </button>
          <button
            onClick={handleRandomPick}
            title="Was soll ich spielen?"
            className="rounded-lg border border-border bg-panel p-2.5 text-text transition hover:border-gold/50 hover:text-gold"
          >
            <IconDice />
          </button>
          <button
            onClick={handleAdd}
            title="Programm hinzufügen"
            className="glow-ember ember-grad-bg rounded-lg p-2.5 text-on-ember transition hover:brightness-110"
          >
            <IconPlus />
          </button>
          <button
            onClick={() => window.api.showAppMenu()}
            title="Weitere Optionen"
            className="rounded-lg border border-border bg-panel p-2.5 text-text transition hover:border-gold/50 hover:text-gold"
          >
            <IconMore />
          </button>
          <button
            onClick={() => setShortcutsOpen(true)}
            title="Tastenkürzel"
            className="rounded-lg border border-border bg-panel p-2.5 text-text transition hover:border-gold/50 hover:text-gold"
          >
            <IconHelp />
          </button>
        </div>
      </header>

      {updaterStatus?.state === 'downloading' && (
        <div className="relative overflow-hidden border-b border-gold/30 bg-panel-active px-8 py-2 text-sm text-text">
          <span>Update wird heruntergeladen … {updaterStatus.percent}%</span>
          <div
            className="absolute inset-x-0 bottom-0 h-0.5 bg-gold transition-all"
            style={{ width: `${updaterStatus.percent}%` }}
          />
        </div>
      )}
      {updaterStatus?.state === 'downloaded' && (
        <div className="glow-gold flex items-center justify-between border-b border-gold/40 bg-panel-active px-8 py-2 text-sm text-text">
          <span>Update auf Version {updaterStatus.version} ist bereit.</span>
          <button
            onClick={handleInstallUpdate}
            className="glow-ember ember-grad-bg rounded-lg px-3 py-1.5 text-sm text-on-ember transition hover:brightness-110"
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
          missingCount={missingPaths.size}
          missingOnly={missingOnly}
          onMissingOnlyChange={setMissingOnly}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          onAddTag={handleAddTag}
          onRenameTag={handleRenameTag}
          onRemoveTag={handleRemoveTag}
          onCycleTagColor={handleCycleTagColor}
          savedViews={savedViews}
          onSaveCurrentView={handleSaveCurrentView}
          onApplyView={handleApplyView}
          onRemoveView={handleRemoveView}
        />

        <main
          onDragOver={(e) => {
            e.preventDefault()
            setDraggingOver(true)
          }}
          onDragLeave={() => setDraggingOver(false)}
          onDrop={handleDrop}
          className={`flex-1 overflow-y-auto p-8 transition ${
            draggingOver ? 'bg-panel-active outline-dashed outline-2 outline-gold/50 -outline-offset-4' : ''
          }`}
        >
          {recentlyPlayed.length > 0 && (
            <div className="mb-6">
              <h2 className="font-display mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">
                Zuletzt gespielt
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {recentlyPlayed.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEntryId(entry.id)}
                    onDoubleClick={() => handleLaunch(entry)}
                    className={`flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl border p-3 text-center transition ${
                      selectedEntryId === entry.id
                        ? 'glow-gold border-gold/60 bg-panel-active'
                        : 'border-border bg-panel hover:border-gold/30 hover:bg-panel-hover'
                    }`}
                  >
                    <EntryIcon
                      iconHash={entry.iconHash}
                      coverHash={entry.coverHash}
                      className="aspect-[2/3] w-full"
                    />
                    <span className="w-full truncate text-xs font-medium">{entry.name}</span>
                  </button>
                ))}
              </div>
              <div className="divider mt-6" />
            </div>
          )}
          {!loading && filteredEntries.length > 0 && (
            <h2 className="font-display mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">
              Deine Bibliothek
            </h2>
          )}
          {loading ? (
            <p className="text-sm text-text-muted">Lade …</p>
          ) : entries.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
              <IconPlus className="h-8 w-8" />
              <p className="text-sm">Noch keine Programme</p>
              <button
                onClick={handleAdd}
                className="glow-ember ember-grad-bg rounded-lg px-4 py-2 text-sm text-on-ember transition hover:brightness-110"
              >
                Programm hinzufügen
              </button>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
              <IconSearch className="h-8 w-8" />
              <button
                onClick={resetFilters}
                className="text-sm text-gold underline hover:brightness-125"
              >
                Filter zurücksetzen
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  draggable
                  onDragStart={() => setDraggedEntryId(entry.id)}
                  onDragEnd={() => {
                    setDraggedEntryId(null)
                    setDragOverEntryId(null)
                  }}
                  onDragOver={(e) => {
                    if (!draggedEntryId) return
                    e.preventDefault()
                    setDragOverEntryId(entry.id)
                  }}
                  onDrop={(e) => {
                    if (!draggedEntryId) return
                    e.preventDefault()
                    e.stopPropagation()
                    handleMoveEntry(draggedEntryId, entry.id, 'before')
                  }}
                  onClick={() => setSelectedEntryId(entry.id)}
                  onDoubleClick={() => handleLaunch(entry)}
                  onContextMenu={() => {
                    setSelectedEntryId(entry.id)
                    window.api.showEntryContextMenu(entry.id)
                  }}
                  className={`group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 text-center transition ${
                    dragOverEntryId === entry.id && draggedEntryId && draggedEntryId !== entry.id
                      ? 'border-gold bg-panel-active'
                      : selectedEntryId === entry.id
                        ? 'glow-gold border-gold/60 bg-panel-active'
                        : 'border-border bg-panel hover:border-gold/30 hover:bg-panel-hover'
                  } ${draggedEntryId === entry.id ? 'opacity-40' : ''}`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleFavorite(entry)
                    }}
                    title="Favorit (F)"
                    className={`absolute left-2 top-2 z-10 p-1 ${
                      entry.favorite
                        ? 'block text-amber'
                        : selectedEntryId === entry.id
                          ? 'block text-text-muted hover:text-amber'
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
                    title="Entfernen (Entf)"
                    className={`absolute right-2 top-2 z-10 rounded-md bg-panel-hover p-1 hover:bg-panel-active ${
                      selectedEntryId === entry.id
                        ? 'block'
                        : 'hidden group-hover:block group-focus-within:block'
                    }`}
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </button>
                  <div className="relative w-full">
                    <EntryIcon
                      iconHash={entry.iconHash}
                      coverHash={entry.coverHash}
                      className="aspect-[2/3] w-full"
                    />
                    {isNewEntry(entry) && (
                      <span className="absolute -right-1 -top-1 rounded-full ember-grad-bg px-1.5 py-0.5 text-[9px] font-semibold leading-none text-on-ember">
                        NEU
                      </span>
                    )}
                    {runningIds.has(entry.id) && (
                      <span
                        title="Läuft gerade"
                        className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-base/90 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-emerald-400 ring-1 ring-emerald-400/50"
                      >
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                        Läuft
                      </span>
                    )}
                  </div>
                  <span className="flex max-w-full items-center gap-1 truncate text-sm font-medium">
                    {missingPaths.has(entry.id) && (
                      <IconAlertTriangle
                        className="h-3.5 w-3.5 shrink-0 text-amber"
                        title="Pfad nicht gefunden"
                      />
                    )}
                    <span className="truncate">{entry.name}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  draggable
                  onDragStart={() => setDraggedEntryId(entry.id)}
                  onDragEnd={() => {
                    setDraggedEntryId(null)
                    setDragOverEntryId(null)
                  }}
                  onDragOver={(e) => {
                    if (!draggedEntryId) return
                    e.preventDefault()
                    setDragOverEntryId(entry.id)
                  }}
                  onDrop={(e) => {
                    if (!draggedEntryId) return
                    e.preventDefault()
                    e.stopPropagation()
                    handleMoveEntry(draggedEntryId, entry.id, 'before')
                  }}
                  onClick={() => setSelectedEntryId(entry.id)}
                  onDoubleClick={() => handleLaunch(entry)}
                  onContextMenu={() => {
                    setSelectedEntryId(entry.id)
                    window.api.showEntryContextMenu(entry.id)
                  }}
                  className={`group flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${
                    dragOverEntryId === entry.id && draggedEntryId && draggedEntryId !== entry.id
                      ? 'border-gold bg-panel-active'
                      : selectedEntryId === entry.id
                        ? 'glow-gold border-gold/60 bg-panel-active'
                        : 'border-transparent hover:bg-panel-hover'
                  } ${draggedEntryId === entry.id ? 'opacity-40' : ''}`}
                >
                  <EntryIcon
                    iconHash={entry.iconHash}
                    coverHash={entry.coverHash}
                    className="h-8 w-8"
                  />
                  <span className="flex flex-1 items-center gap-1.5 truncate text-sm font-medium">
                    {missingPaths.has(entry.id) && (
                      <IconAlertTriangle
                        className="h-3.5 w-3.5 shrink-0 text-amber"
                        title="Pfad nicht gefunden"
                      />
                    )}
                    <span className="truncate">{entry.name}</span>
                    {runningIds.has(entry.id) && (
                      <span
                        title="Läuft gerade"
                        className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400"
                      />
                    )}
                    {isNewEntry(entry) && (
                      <span className="shrink-0 rounded-full ember-grad-bg px-1.5 py-0.5 text-[9px] font-semibold leading-none text-on-ember">
                        NEU
                      </span>
                    )}
                  </span>
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
                    title="Favorit (F)"
                    className={`p-1 ${
                      entry.favorite
                        ? 'text-amber'
                        : selectedEntryId === entry.id
                          ? 'inline-flex text-text-muted hover:text-amber'
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
                    title="Entfernen (Entf)"
                    className={`rounded-md bg-panel-hover p-1 hover:bg-panel-active ${
                      selectedEntryId === entry.id
                        ? 'block'
                        : 'hidden group-hover:block group-focus-within:block'
                    }`}
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
            pathMissing={missingPaths.has(selectedEntry.id)}
            stats={stats.find((s) => s.entryId === selectedEntry.id) ?? null}
            onLaunch={handleLaunch}
            onRename={handleRename}
            onSetLaunchArgs={handleSetLaunchArgs}
            onToggleTag={handleToggleTag}
            onChangeIcon={handleChangeIcon}
            onFetchCoverArt={handleFetchCoverArt}
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

      {overviewOpen && overview && (
        <OverviewDialog
          entries={entries}
          stats={stats}
          overview={overview}
          onSetGoal={handleSetWeeklyGoal}
          onClose={() => setOverviewOpen(false)}
        />
      )}

      {coverArtKeyDialogOpen && (
        <CoverArtKeyDialog onClose={() => setCoverArtKeyDialogOpen(false)} />
      )}

      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
    </div>
  )
}

export default App
