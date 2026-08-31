import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement
} from 'react'
import type {
  Entry,
  EntryStats,
  OverviewData,
  SavedView,
  SmartSuggestion,
  SortMode,
  Tag,
  TagFilterMode,
  ViewMode
} from './types'
import type { UpdaterStatus } from '../../main/updater'
import { TAG_COLORS } from './constants'
import { EntryIcon } from './components/EntryIcon'
import { Sidebar } from './components/Sidebar'
import { DetailPanel } from './components/DetailPanel'
import { ScannerDialog } from './components/ScannerDialog'
import { StatsDialog } from './components/StatsDialog'
import { OverviewDialog } from './components/OverviewDialog'
import { CoverArtKeyDialog } from './components/CoverArtKeyDialog'
import { MetadataKeyDialog } from './components/MetadataKeyDialog'
import { SteamAchievementsKeyDialog } from './components/SteamAchievementsKeyDialog'
import { HelpDialog } from './components/HelpDialog'
import { ConfirmDialog } from './components/ConfirmDialog'
import { EntryContextMenu } from './components/EntryContextMenu'
import { SyncDialog } from './components/SyncDialog'
import { ConfettiBurst } from './components/ConfettiBurst'
import { DiceRollOverlay } from './components/DiceRollOverlay'
import { isSoundEnabled, playLaunchSound, playSuccessSound, setSoundEnabled } from './sounds'
import {
  distinctPlatformCount,
  loadSeenAchievementIds,
  saveSeenAchievementIds,
  unlockedAchievements,
  type AchievementContext
} from './achievements'
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
  IconTrash,
  IconX
} from './components/icons'
import logo from './assets/logo.png'

const NEW_THRESHOLD_MS = 48 * 60 * 60 * 1000

const WEEKDAY_NAMES = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag'
]

function isNewEntry(entry: Entry): boolean {
  return Date.now() - entry.addedAt < NEW_THRESHOLD_MS
}

// Kleines Kürzel-Badge für die Kachel, damit auf einen Blick erkennbar ist,
// über welchen Client ein Programm läuft — nur für Quellen, die eine eigene
// Kennung im Eintrag hinterlassen (GOG/EA/Registry-Importe sehen identisch
// aus wie manuell hinzugefügte Programme, bekommen also bewusst kein Badge).
function platformBadge(entry: Entry): { label: string; className: string } | null {
  if (entry.steamAppId) return { label: 'S', className: 'bg-[#1b2838] text-[#66c0f4]' }
  if (entry.epicAppName) return { label: 'E', className: 'bg-black text-white' }
  if (entry.battlenetCode) return { label: 'B', className: 'bg-[#00aeff] text-black' }
  if (entry.ubisoftId) return { label: 'U', className: 'bg-[#0d1c2e] text-white' }
  if (entry.xboxAumid) return { label: 'X', className: 'bg-[#107c10] text-white' }
  return null
}

function App(): ReactElement {
  const [entries, setEntries] = useState<Entry[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [stats, setStats] = useState<EntryStats[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  // Statuszeile blendet sich nach kurzer Zeit von selbst aus, statt bis zur
  // nächsten Aktion stehen zu bleiben.
  useEffect(() => {
    if (!status) return
    const timeout = setTimeout(() => setStatus(''), 5000)
    return () => clearTimeout(timeout)
  }, [status])
  const [scannerOpen, setScannerOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [coverArtKeyDialogOpen, setCoverArtKeyDialogOpen] = useState(false)
  const [metadataKeyDialogOpen, setMetadataKeyDialogOpen] = useState(false)
  const [steamAchievementsKeyDialogOpen, setSteamAchievementsKeyDialogOpen] = useState(false)
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ entry: Entry; x: number; y: number } | null>(
    null
  )
  const [diceRollPool, setDiceRollPool] = useState<Entry[] | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus | null>(null)
  const [bigPictureMode, setBigPictureMode] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())
  const [tagFilterMode, setTagFilterMode] = useState<TagFilterMode>('and')
  const [unsortedOnly, setUnsortedOnly] = useState(false)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [soundEnabled, setSoundEnabledState] = useState(isSoundEnabled)
  const [missingOnly, setMissingOnly] = useState(false)
  const [missingCoverOnly, setMissingCoverOnly] = useState(false)
  const [recentOnly, setRecentOnly] = useState(false)
  const [neverPlayedOnly, setNeverPlayedOnly] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortMode, setSortMode] = useState<SortMode>('added')
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [draggingOver, setDraggingOver] = useState(false)
  const [missingPaths, setMissingPaths] = useState<Set<string>>(new Set())
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null)
  const [dragOverEntryId, setDragOverEntryId] = useState<string | null>(null)
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set())
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [coverArtNudgeDismissed, setCoverArtNudgeDismissedState] = useState(
    () => localStorage.getItem('coverArtNudgeDismissed') === 'true'
  )
  function setCoverArtNudgeDismissed(value: boolean): void {
    localStorage.setItem('coverArtNudgeDismissed', String(value))
    setCoverArtNudgeDismissedState(value)
  }
  const [smartSuggestion, setSmartSuggestion] = useState<SmartSuggestion | null>(null)
  // Merkt sich, WELCHER Vorschlag (Tag + Programm) ausgeblendet wurde, statt
  // eines bloßen Ja/Nein — sonst würde das Ausblenden am Montag den Vorschlag
  // für alle künftigen Tage/Programme dauerhaft verstecken.
  const [dismissedSuggestionKey, setDismissedSuggestionKeyState] = useState(() =>
    localStorage.getItem('dismissedSuggestionKey')
  )
  function dismissSuggestion(key: string): void {
    localStorage.setItem('dismissedSuggestionKey', key)
    setDismissedSuggestionKeyState(key)
  }
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null)

  useEffect(() => {
    window.api.listSavedViews().then(setSavedViews)
  }, [])

  useEffect(() => {
    window.api.getSmartSuggestion().then(setSmartSuggestion)
  }, [])

  // Zeigt die Hilfe beim allerersten Programmstart automatisch — danach nie
  // wieder von selbst, erreichbar bleibt sie über den "?"-Knopf.
  useEffect(() => {
    window.api.hasSeenWelcome().then((seen) => {
      if (seen) return
      setHelpOpen(true)
      window.api.markWelcomeSeen()
    })
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

  useEffect(() => {
    return window.api.onOpenMetadataKeyDialog(() => setMetadataKeyDialogOpen(true))
  }, [])

  useEffect(() => {
    return window.api.onOpenSteamAchievementsKeyDialog(() =>
      setSteamAchievementsKeyDialogOpen(true)
    )
  }, [])

  useEffect(() => {
    return window.api.onOpenSyncDialog(() => setSyncDialogOpen(true))
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

  // Nur die id+Pfad-Kombinationen als Abhängigkeit nehmen, nicht `entries`
  // direkt — sonst würde jede Kleinigkeit (Favorit, Bewertung, Umbenennen,
  // Umsortieren) eine komplette, synchrone Datei-Existenzprüfung über die
  // ganze Bibliothek im Main-Prozess auslösen, obwohl sich an den Pfaden
  // gar nichts geändert hat.
  const entryPathsKey = useMemo(
    () => entries.map((e) => `${e.id}:${e.path}`).join('|'),
    [entries]
  )

  // Prüft erneut, sobald sich Einträge oder Pfade ändern (z. B. nach einer
  // Wiederherstellung auf diesem Rechner oder wenn ein Spiel deinstalliert wurde).
  useEffect(() => {
    window.api.checkEntryPaths().then((result) => {
      setMissingPaths(new Set(Object.keys(result).filter((id) => !result[id])))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryPathsKey])

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

  // Meldet neu freigeschaltete Erfolge über die Statuszeile. Der allererste
  // Durchlauf säht den "schon gesehen"-Stand nur still ein, statt jemandem mit
  // vorhandener Bibliothek gleich eine ganze Salve an Meldungen zu zeigen.
  const seenAchievementsRef = useRef<Set<string> | null>(null)
  const isFirstAchievementPassRef = useRef(true)
  useEffect(() => {
    if (seenAchievementsRef.current === null) {
      seenAchievementsRef.current = loadSeenAchievementIds()
    }
    const context: AchievementContext = {
      entryCount: entries.length,
      totalPlayedMs: stats.reduce((sum, s) => sum + s.totalPlayedMs, 0),
      totalLaunches: stats.reduce((sum, s) => sum + s.launchCount, 0),
      streakDays: overview?.streakDays ?? 0,
      favoriteCount: entries.filter((e) => e.favorite).length,
      tagCount: tags.length,
      distinctPlatformCount: distinctPlatformCount(entries)
    }
    const unlocked = unlockedAchievements(context)
    const seen = seenAchievementsRef.current
    const freshlyUnlocked = unlocked.filter((a) => !seen.has(a.id))
    // Läuft z. B. beim Start mehrfach mit noch leeren Listen durch, bevor die
    // echten Daten geladen sind — solche leeren Durchgänge sollen den
    // "erster echter Durchlauf"-Zustand unten nicht schon verbrauchen.
    if (freshlyUnlocked.length === 0) return

    unlocked.forEach((a) => seen.add(a.id))
    saveSeenAchievementIds(seen)

    // Der erste Durchlauf, der wirklich etwas Neues findet (z. B. direkt nach
    // dem Laden einer bereits gefüllten Bibliothek), säht nur still, statt
    // gleich eine ganze Salve an Meldungen/Konfetti zu zeigen.
    const isFirstMeaningfulPass = isFirstAchievementPassRef.current
    isFirstAchievementPassRef.current = false
    if (isFirstMeaningfulPass) return

    const [first, ...rest] = freshlyUnlocked
    setStatus(
      rest.length === 0
        ? `🏆 Erfolg freigeschaltet: „${first.name}"`
        : `🏆 ${freshlyUnlocked.length} neue Erfolge freigeschaltet!`
    )
    playSuccessSound()
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 1800)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, stats, tags, overview])

  async function handleSetWeeklyGoal(minutes: number | null): Promise<void> {
    await window.api.setWeeklyGoal(minutes)
    setOverview(await window.api.getOverview())
  }

  async function handleSetBreakReminder(minutes: number | null): Promise<void> {
    await window.api.setBreakReminder(minutes)
    setOverview(await window.api.getOverview())
  }

  const statsByEntry = useMemo(() => new Map(stats.map((s) => [s.entryId, s])), [stats])

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    const filtered = entries.filter((entry) => {
      if (!showHidden && entry.hidden) return false
      if (favoritesOnly && !entry.favorite) return false
      if (missingOnly && !missingPaths.has(entry.id)) return false
      if (missingCoverOnly && entry.coverHash) return false
      if (recentOnly && !isNewEntry(entry)) return false
      if (neverPlayedOnly && (statsByEntry.get(entry.id)?.launchCount ?? 0) > 0) return false
      if (unsortedOnly && entry.tags.length > 0) return false
      if (selectedTagIds.size > 0) {
        const matches =
          tagFilterMode === 'and'
            ? [...selectedTagIds].every((id) => entry.tags.includes(id))
            : [...selectedTagIds].some((id) => entry.tags.includes(id))
        if (!matches) return false
      }
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
        case 'rating':
          return b.rating - a.rating
        case 'added':
        default:
          return b.addedAt - a.addedAt
      }
    })
  }, [
    entries,
    searchQuery,
    selectedTagIds,
    tagFilterMode,
    unsortedOnly,
    favoritesOnly,
    missingOnly,
    missingCoverOnly,
    recentOnly,
    neverPlayedOnly,
    showHidden,
    missingPaths,
    sortMode,
    statsByEntry
  ])

  const selectedEntry = entries.find((e) => e.id === selectedEntryId) ?? null
  // Zählt nur unter denselben Bedingungen, unter denen der Filter sie auch
  // tatsächlich zeigen würde — sonst zeigt die Seitenleiste z. B. "Nie
  // gespielt (5)", aber der Klick darauf liefert weniger Treffer, weil
  // ausgeblendete Einträge dort schon rausgefiltert werden (siehe
  // filteredEntries oben).
  const visibleEntries = showHidden ? entries : entries.filter((e) => !e.hidden)
  const missingCoverCount = visibleEntries.filter((e) => !e.coverHash).length
  const recentCount = visibleEntries.filter(isNewEntry).length
  const neverPlayedCount = visibleEntries.filter(
    (e) => (statsByEntry.get(e.id)?.launchCount ?? 0) === 0
  ).length
  const hiddenCount = entries.filter((e) => e.hidden).length
  const suggestedEntry = smartSuggestion
    ? (entries.find((e) => e.id === smartSuggestion.entryId) ?? null)
    : null
  const suggestionKey = smartSuggestion
    ? `${new Date().toDateString()}:${smartSuggestion.entryId}`
    : null
  const suggestionDismissed = suggestionKey !== null && suggestionKey === dismissedSuggestionKey

  // Nur im ungefilterten Grundzustand zeigen — sonst wirkt es wie eine zweite,
  // widersprüchliche Liste neben den gerade gefilterten Ergebnissen.
  const recentlyPlayed = useMemo(() => {
    if (
      searchQuery.trim() ||
      selectedTagIds.size > 0 ||
      unsortedOnly ||
      favoritesOnly ||
      missingOnly ||
      missingCoverOnly ||
      recentOnly ||
      neverPlayedOnly
    )
      return []
    return stats
      .filter((s) => s.lastPlayedAt !== null)
      .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
      .slice(0, 6)
      .map((s) => entries.find((e) => e.id === s.entryId))
      // Ausgeblendete Einträge tauchen sonst hier weiter auf, obwohl "Ausblenden"
      // genau das verhindern soll — siehe filteredEntries' showHidden-Check oben.
      .filter((e): e is Entry => e !== undefined && (showHidden || !e.hidden))
  }, [
    stats,
    entries,
    searchQuery,
    selectedTagIds,
    unsortedOnly,
    favoritesOnly,
    missingOnly,
    missingCoverOnly,
    recentOnly,
    showHidden,
    neverPlayedOnly
  ])

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
      playLaunchSound()
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

  async function handleToggleHidden(entry: Entry): Promise<void> {
    setEntries(await window.api.toggleHidden(entry.id))
  }

  async function handleSetNotes(id: string, notes: string): Promise<void> {
    setEntries(await window.api.setNotes(id, notes))
  }

  async function handleSetRating(id: string, rating: number): Promise<void> {
    setEntries(await window.api.setRating(id, rating))
  }

  function handleDelete(entry: Entry): void {
    setPendingConfirm({
      title: 'Programm entfernen',
      message: `"${entry.name}" aus dem Launcher entfernen?`,
      onConfirm: async () => {
        setPendingConfirm(null)
        const updated = await window.api.removeEntry(entry.id)
        setEntries(updated)
        if (selectedEntryId === entry.id) setSelectedEntryId(null)
      }
    })
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

  async function handleSetLaunchScripts(
    id: string,
    preLaunchCommand: string,
    postLaunchCommand: string
  ): Promise<void> {
    setEntries(await window.api.setLaunchScripts(id, preLaunchCommand, postLaunchCommand))
  }

  async function handlePickEmulator(id: string): Promise<void> {
    setEntries(await window.api.pickEmulator(id))
  }

  async function handleClearEmulatorPath(id: string): Promise<void> {
    setEntries(await window.api.clearEmulatorPath(id))
  }

  async function handleFetchCoverArt(id: string): Promise<void> {
    try {
      setEntries(await window.api.fetchCoverArt(id))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleFetchMetadata(id: string): Promise<void> {
    try {
      setEntries(await window.api.fetchMetadata(id))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleOpenTrailer(id: string): Promise<void> {
    try {
      await window.api.openTrailer(id)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleFetchAllMissingCoverArt(): Promise<void> {
    await window.api.fetchAllMissingCoverArt()
  }

  // Normaler Klick wählt wie bisher genau ein Programm für das Detail-Panel.
  // Strg+Klick schaltet ein Programm in der Mehrfachauswahl um, Umschalt+Klick
  // markiert einen ganzen Bereich ab dem zuletzt angeklickten Programm — beides
  // schließt das Detail-Panel, da beide Ansichten (Detail vs. Sammelaktionen)
  // sich sonst gegenseitig im Weg stünden.
  function handleTileClick(entry: Entry, index: number, e: ReactMouseEvent): void {
    if (e.shiftKey) {
      const anchor = lastClickedIndex ?? index
      const [start, end] = anchor <= index ? [anchor, index] : [index, anchor]
      const rangeIds = filteredEntries.slice(start, end + 1).map((rangeEntry) => rangeEntry.id)
      setSelectedIds((prev) => new Set([...prev, ...rangeIds]))
      setSelectedEntryId(null)
      return
    }
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(entry.id)) next.delete(entry.id)
        else next.add(entry.id)
        return next
      })
      setLastClickedIndex(index)
      setSelectedEntryId(null)
      return
    }
    setSelectedIds(new Set())
    setSelectedEntryId(entry.id)
    setLastClickedIndex(index)
  }

  async function handleBulkSetFavorite(favorite: boolean): Promise<void> {
    setEntries(await window.api.bulkSetFavorite([...selectedIds], favorite))
  }

  async function handleBulkFetchCoverArt(): Promise<void> {
    await window.api.fetchCoverArtForSelected([...selectedIds])
  }

  async function handleBulkAddTag(tagId: string): Promise<void> {
    try {
      setEntries(await window.api.bulkAddTag([...selectedIds], tagId))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  function handleBulkDelete(): void {
    setPendingConfirm({
      title: 'Programme entfernen',
      message: `${selectedIds.size} Programme aus dem Launcher entfernen?`,
      onConfirm: async () => {
        setPendingConfirm(null)
        setEntries(await window.api.bulkRemoveEntries([...selectedIds]))
        setSelectedIds(new Set())
      }
    })
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

  function handleRandomPick(e: ReactMouseEvent): void {
    const pool = e.shiftKey ? filteredEntries.filter((entry) => entry.favorite) : filteredEntries
    if (pool.length === 0) {
      setStatus(
        e.shiftKey
          ? 'Keine Favoriten in der aktuellen Ansicht.'
          : 'Keine Programme in der aktuellen Ansicht.'
      )
      return
    }
    setDiceRollPool(pool)
  }

  function handleDiceRollDone(pick: Entry): void {
    setDiceRollPool(null)
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

  async function removeTagNow(id: string): Promise<void> {
    setTags(await window.api.removeTag(id))
    setEntries(await window.api.listEntries())
    setSelectedTagIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function handleRemoveTag(id: string): void {
    const tag = tags.find((t) => t.id === id)
    if (!tag) {
      void removeTagNow(id)
      return
    }
    setPendingConfirm({
      title: 'Tag löschen',
      message: `Tag "${tag.name}" löschen?`,
      onConfirm: () => {
        setPendingConfirm(null)
        void removeTagNow(id)
      }
    })
  }

  async function handleCycleTagColor(id: string): Promise<void> {
    setTags(await window.api.cycleTagColor(id, TAG_COLORS))
  }

  function handleToggleTagFilter(id: string): void {
    setUnsortedOnly(false)
    setSelectedTagIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleToggleUnsortedOnly(): void {
    setSelectedTagIds(new Set())
    setUnsortedOnly((prev) => !prev)
  }

  function handleClearTagFilter(): void {
    setSelectedTagIds(new Set())
    setUnsortedOnly(false)
  }

  async function handleSaveCurrentView(name: string): Promise<void> {
    setSavedViews(
      await window.api.addSavedView({
        name,
        selectedTagIds: [...selectedTagIds],
        tagFilterMode,
        unsortedOnly,
        sortMode,
        searchQuery,
        favoritesOnly,
        missingOnly,
        missingCoverOnly,
        recentOnly,
        neverPlayedOnly
      })
    )
  }

  function handleApplyView(view: SavedView): void {
    setSelectedTagIds(new Set(view.selectedTagIds))
    setTagFilterMode(view.tagFilterMode)
    setUnsortedOnly(view.unsortedOnly)
    setSortMode(view.sortMode)
    setSearchQuery(view.searchQuery)
    setFavoritesOnly(view.favoritesOnly)
    setMissingOnly(view.missingOnly)
    setMissingCoverOnly(view.missingCoverOnly)
    setRecentOnly(view.recentOnly)
    setNeverPlayedOnly(view.neverPlayedOnly)
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
      if (
        scannerOpen ||
        statsOpen ||
        overviewOpen ||
        coverArtKeyDialogOpen ||
        syncDialogOpen ||
        helpOpen ||
        pendingConfirm
      )
        return

      if (contextMenu) {
        if (e.key === 'Escape') setContextMenu(null)
        return
      }
      const activeTag = document.activeElement?.tagName
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return

      if (e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (e.key === 'Escape' && selectedIds.size > 0) {
        e.preventDefault()
        setSelectedIds(new Set())
        return
      }
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
    syncDialogOpen,
    helpOpen,
    pendingConfirm,
    contextMenu,
    selectedIds
  ])

  function resetFilters(): void {
    setSearchQuery('')
    setSelectedTagIds(new Set())
    setUnsortedOnly(false)
    setFavoritesOnly(false)
    setMissingOnly(false)
    setMissingCoverOnly(false)
    setRecentOnly(false)
    setNeverPlayedOnly(false)
    setShowHidden(false)
  }

  if (bigPictureMode) {
    return (
      <BigPictureView
        entries={filteredEntries}
        totalEntryCount={entries.length}
        runningIds={runningIds}
        missingPaths={missingPaths}
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
            title="Was soll ich spielen? (Umschalt+Klick: nur Favoriten)"
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
            onClick={() => setHelpOpen(true)}
            title="Hilfe"
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

      {!loading && missingCoverCount > 0 && !coverArtNudgeDismissed && (
        <div className="flex items-center justify-between border-b border-gold/30 bg-panel-active px-8 py-2 text-sm text-text">
          <span>
            {missingCoverCount} {missingCoverCount === 1 ? 'Programm hat' : 'Programme haben'} noch
            kein Cover-Bild.
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={handleFetchAllMissingCoverArt}
              className="text-sm font-semibold text-gold hover:brightness-125"
            >
              Jetzt laden
            </button>
            <button
              onClick={() => setCoverArtNudgeDismissed(true)}
              title="Ausblenden"
              className="text-text-muted hover:text-gold"
            >
              <IconX className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {!loading && suggestedEntry && !suggestionDismissed && (
        <div className="flex items-center justify-between border-b border-gold/30 bg-panel-active px-8 py-2 text-sm text-text">
          <span>
            Am {WEEKDAY_NAMES[new Date().getDay()]} spielst du oft{' '}
            <span className="font-semibold">{suggestedEntry.name}</span> — jetzt starten?
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleLaunch(suggestedEntry)}
              className="text-sm font-semibold text-gold hover:brightness-125"
            >
              Starten
            </button>
            <button
              onClick={() => suggestionKey && dismissSuggestion(suggestionKey)}
              title="Ausblenden"
              className="text-text-muted hover:text-gold"
            >
              <IconX className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="divider" />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          tags={tags}
          entries={entries}
          selectedTagIds={selectedTagIds}
          onToggleTagFilter={handleToggleTagFilter}
          onClearTagFilter={handleClearTagFilter}
          unsortedOnly={unsortedOnly}
          onToggleUnsortedOnly={handleToggleUnsortedOnly}
          tagFilterMode={tagFilterMode}
          onTagFilterModeChange={setTagFilterMode}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchInputRef={searchInputRef}
          resultCount={filteredEntries.length}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          favoritesOnly={favoritesOnly}
          onFavoritesOnlyChange={setFavoritesOnly}
          soundEnabled={soundEnabled}
          onSoundEnabledChange={(value) => {
            setSoundEnabled(value)
            setSoundEnabledState(value)
          }}
          missingCount={missingPaths.size}
          missingOnly={missingOnly}
          onMissingOnlyChange={setMissingOnly}
          missingCoverCount={missingCoverCount}
          missingCoverOnly={missingCoverOnly}
          onMissingCoverOnlyChange={setMissingCoverOnly}
          recentCount={recentCount}
          recentOnly={recentOnly}
          onRecentOnlyChange={setRecentOnly}
          neverPlayedCount={neverPlayedCount}
          neverPlayedOnly={neverPlayedOnly}
          onNeverPlayedOnlyChange={setNeverPlayedOnly}
          hiddenCount={hiddenCount}
          showHidden={showHidden}
          onShowHiddenChange={setShowHidden}
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
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setSelectedEntryId(entry.id)
                      setContextMenu({ entry, x: e.clientX, y: e.clientY })
                    }}
                    className={`flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl border p-3 text-center transition ${
                      selectedEntryId === entry.id
                        ? 'glow-gold border-gold/60 bg-panel-active'
                        : 'border-border bg-panel hover:border-gold/30 hover:bg-panel-hover'
                    }`}
                  >
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
                    </div>
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
              {filteredEntries.map((entry, index) => {
                const badge = platformBadge(entry)
                return (
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
                  onClick={(e) => handleTileClick(entry, index, e)}
                  onDoubleClick={() => handleLaunch(entry)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setSelectedEntryId(entry.id)
                    setContextMenu({ entry, x: e.clientX, y: e.clientY })
                  }}
                  className={`group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 text-center transition ${
                    dragOverEntryId === entry.id && draggedEntryId && draggedEntryId !== entry.id
                      ? 'border-gold bg-panel-active'
                      : selectedIds.has(entry.id)
                        ? 'border-sky-400/70 bg-panel-active ring-2 ring-sky-400/40'
                        : selectedEntryId === entry.id
                          ? 'glow-gold border-gold/60 bg-panel-active'
                          : 'border-border bg-panel hover:border-gold/30 hover:bg-panel-hover'
                  } ${draggedEntryId === entry.id ? 'opacity-40' : ''} ${
                    entry.hidden ? 'opacity-50' : ''
                  }`}
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
                    {badge && (
                      <span
                        className={`absolute bottom-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold leading-none ${badge.className}`}
                      >
                        {badge.label}
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
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredEntries.map((entry, index) => {
                const badge = platformBadge(entry)
                return (
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
                  onClick={(e) => handleTileClick(entry, index, e)}
                  onDoubleClick={() => handleLaunch(entry)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setSelectedEntryId(entry.id)
                    setContextMenu({ entry, x: e.clientX, y: e.clientY })
                  }}
                  className={`group flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${
                    dragOverEntryId === entry.id && draggedEntryId && draggedEntryId !== entry.id
                      ? 'border-gold bg-panel-active'
                      : selectedIds.has(entry.id)
                        ? 'border-sky-400/70 bg-panel-active ring-2 ring-sky-400/40'
                        : selectedEntryId === entry.id
                          ? 'glow-gold border-gold/60 bg-panel-active'
                          : 'border-transparent hover:bg-panel-hover'
                  } ${draggedEntryId === entry.id ? 'opacity-40' : ''} ${
                    entry.hidden ? 'opacity-50' : ''
                  }`}
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
                    {badge && (
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold leading-none ${badge.className}`}
                      >
                        {badge.label}
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
                )
              })}
            </div>
          )}
        </main>

        {selectedEntry && (
          <DetailPanel
            key={selectedEntry.id}
            entry={selectedEntry}
            tags={tags}
            pathMissing={missingPaths.has(selectedEntry.id)}
            stats={statsByEntry.get(selectedEntry.id) ?? null}
            onLaunch={handleLaunch}
            onRename={handleRename}
            onSetLaunchArgs={handleSetLaunchArgs}
            onToggleTag={handleToggleTag}
            onChangeIcon={handleChangeIcon}
            onFetchCoverArt={handleFetchCoverArt}
            onToggleFavorite={handleToggleFavorite}
            onSetRating={handleSetRating}
            onRemove={handleDelete}
            onClose={() => setSelectedEntryId(null)}
            onSetLaunchScripts={handleSetLaunchScripts}
            onPickEmulator={handlePickEmulator}
            onClearEmulatorPath={handleClearEmulatorPath}
            onFetchMetadata={handleFetchMetadata}
            onOpenTrailer={handleOpenTrailer}
            onSetNotes={handleSetNotes}
          />
        )}
      </div>

      {selectedIds.size > 0 ? (
        <>
          <div className="divider" />
          <div className="flex items-center gap-3 px-8 py-3 text-sm">
            <span className="font-medium text-text">{selectedIds.size} ausgewählt</span>
            <button
              onClick={() => handleBulkSetFavorite(true)}
              className="rounded-lg border border-border bg-panel px-3 py-1.5 text-text transition hover:border-gold/50 hover:text-gold"
            >
              Favorisieren
            </button>
            <button
              onClick={() => handleBulkSetFavorite(false)}
              className="rounded-lg border border-border bg-panel px-3 py-1.5 text-text transition hover:border-gold/50 hover:text-gold"
            >
              Favorit entfernen
            </button>
            {tags.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) handleBulkAddTag(e.target.value)
                }}
                className="rounded-lg border border-border bg-panel px-3 py-1.5 text-text outline-none focus:border-gold/50"
              >
                <option value="">Tag hinzufügen …</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={handleBulkFetchCoverArt}
              className="rounded-lg border border-border bg-panel px-3 py-1.5 text-text transition hover:border-gold/50 hover:text-gold"
            >
              Cover-Art laden
            </button>
            <button
              onClick={handleBulkDelete}
              className="rounded-lg border border-border bg-panel px-3 py-1.5 text-text transition hover:border-red-400/50 hover:text-red-400"
            >
              Entfernen
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-text-muted hover:text-gold"
            >
              Auswahl aufheben
            </button>
          </div>
        </>
      ) : (
        status && (
          <>
            <div className="divider" />
            <footer className="px-8 py-3 text-sm text-text-muted">{status}</footer>
          </>
        )
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
          onSetBreakReminder={handleSetBreakReminder}
          onClose={() => setOverviewOpen(false)}
        />
      )}

      {coverArtKeyDialogOpen && (
        <CoverArtKeyDialog onClose={() => setCoverArtKeyDialogOpen(false)} />
      )}

      {metadataKeyDialogOpen && (
        <MetadataKeyDialog onClose={() => setMetadataKeyDialogOpen(false)} />
      )}

      {steamAchievementsKeyDialogOpen && (
        <SteamAchievementsKeyDialog onClose={() => setSteamAchievementsKeyDialogOpen(false)} />
      )}

      {syncDialogOpen && (
        <SyncDialog
          onClose={() => setSyncDialogOpen(false)}
          onSynced={() => {
            window.api.listEntries().then(setEntries)
            window.api.listTags().then(setTags)
          }}
        />
      )}

      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}

      {pendingConfirm && (
        <ConfirmDialog
          title={pendingConfirm.title}
          message={pendingConfirm.message}
          onConfirm={pendingConfirm.onConfirm}
          onCancel={() => setPendingConfirm(null)}
        />
      )}

      {diceRollPool && <DiceRollOverlay entries={diceRollPool} onDone={handleDiceRollDone} />}

      {showConfetti && <ConfettiBurst />}

      {contextMenu && (
        <EntryContextMenu
          entry={contextMenu.entry}
          tags={tags}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onLaunch={handleLaunch}
          onToggleFavorite={handleToggleFavorite}
          onToggleHidden={handleToggleHidden}
          onToggleTag={handleToggleTag}
          onShowInExplorer={(id) => window.api.showEntryInExplorer(id)}
          onChangeIcon={handleChangeIcon}
          onFetchCoverArt={handleFetchCoverArt}
          onRemove={handleDelete}
        />
      )}
    </div>
  )
}

export default App
