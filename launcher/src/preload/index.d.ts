import type { Entry, SavedView, Session, Tag } from '../main/store'
import type { Candidate, ScanResult } from '../main/scanner'
import type { EntryStats, OverviewData, SmartSuggestion, WrappedData } from '../main/stats'
import type { SyncResult } from '../main/sync'
import type { UpdaterStatus } from '../main/updater'

export interface LauncherApi {
  listEntries: () => Promise<Entry[]>
  addEntryViaDialog: () => Promise<Entry[]>
  renameEntry: (id: string, name: string) => Promise<Entry[]>
  setLaunchArgs: (id: string, args: string) => Promise<Entry[]>
  toggleEntryTag: (id: string, tagId: string) => Promise<Entry[]>
  removeEntry: (id: string) => Promise<Entry[]>
  moveEntry: (id: string, targetId: string | null, position: 'before' | 'after') => Promise<Entry[]>
  launchEntry: (id: string) => Promise<void>
  getEntrySize: (id: string) => Promise<number | null>
  toggleFavorite: (id: string) => Promise<Entry[]>
  setRating: (id: string, rating: number) => Promise<Entry[]>
  bulkSetFavorite: (ids: string[], favorite: boolean) => Promise<Entry[]>
  bulkAddTag: (ids: string[], tagId: string) => Promise<Entry[]>
  bulkRemoveEntries: (ids: string[]) => Promise<Entry[]>
  addEntriesFromPaths: (paths: string[]) => Promise<Entry[]>
  showEntryInExplorer: (id: string) => void
  onEntriesChanged: (callback: (entries: Entry[]) => void) => () => void
  checkEntryPaths: () => Promise<Record<string, boolean>>
  pickCustomIcon: (id: string) => Promise<Entry[]>

  listTags: () => Promise<Tag[]>
  addTag: (name: string) => Promise<Tag[]>
  renameTag: (id: string, name: string) => Promise<Tag[]>
  removeTag: (id: string) => Promise<Tag[]>
  cycleTagColor: (id: string, palette: string[]) => Promise<Tag[]>

  listSavedViews: () => Promise<SavedView[]>
  addSavedView: (view: Omit<SavedView, 'id'>) => Promise<SavedView[]>
  removeSavedView: (id: string) => Promise<SavedView[]>

  scan: () => Promise<ScanResult>
  importCandidates: (candidates: Candidate[]) => Promise<Entry[]>

  listStats: () => Promise<EntryStats[]>
  getOverview: () => Promise<OverviewData>
  getEntrySessions: (id: string) => Promise<Session[]>
  getRunningEntries: () => Promise<string[]>
  getSmartSuggestion: () => Promise<SmartSuggestion | null>
  getWrapped: () => Promise<WrappedData>
  setWeeklyGoal: (minutes: number | null) => Promise<void>
  setBreakReminder: (minutes: number | null) => Promise<void>

  onUpdaterStatus: (callback: (status: UpdaterStatus) => void) => () => void
  installUpdate: () => Promise<void>

  setFullscreen: (value: boolean) => Promise<void>
  onFullscreenChanged: (callback: (value: boolean) => void) => () => void

  showAppMenu: () => void

  getCoverArtKey: () => Promise<string | null>
  setCoverArtKey: (key: string) => Promise<void>
  hasCoverArtProxy: () => Promise<boolean>
  fetchCoverArt: (id: string) => Promise<Entry[]>
  fetchAllMissingCoverArt: () => Promise<void>
  fetchCoverArtForSelected: (ids: string[]) => Promise<void>
  onOpenCoverArtKeyDialog: (callback: () => void) => () => void

  getScreenshots: (id: string) => Promise<string[]>

  getSyncCode: () => Promise<string | null>
  setSyncCode: (code: string | null) => Promise<void>
  syncNow: () => Promise<SyncResult>
  onOpenSyncDialog: (callback: () => void) => () => void

  hasSeenWelcome: () => Promise<boolean>
  markWelcomeSeen: () => Promise<void>

  onStatusMessage: (callback: (message: string) => void) => () => void
}

declare global {
  interface Window {
    api: LauncherApi
  }
}
