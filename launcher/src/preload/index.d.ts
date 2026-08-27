import type { Entry, SavedView, Session, Tag } from '../main/store'
import type { Candidate } from '../main/scanner'
import type { EntryStats, OverviewData } from '../main/stats'
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

  scan: () => Promise<Candidate[]>
  importCandidates: (candidates: Candidate[]) => Promise<Entry[]>

  listStats: () => Promise<EntryStats[]>
  getOverview: () => Promise<OverviewData>
  getEntrySessions: (id: string) => Promise<Session[]>
  getRunningEntries: () => Promise<string[]>
  setWeeklyGoal: (minutes: number | null) => Promise<void>

  onUpdaterStatus: (callback: (status: UpdaterStatus) => void) => () => void
  installUpdate: () => Promise<void>

  setFullscreen: (value: boolean) => Promise<void>
  onFullscreenChanged: (callback: (value: boolean) => void) => () => void

  showEntryContextMenu: (id: string) => void
  showAppMenu: () => void

  getCoverArtKey: () => Promise<string | null>
  setCoverArtKey: (key: string) => Promise<void>
  fetchCoverArt: (id: string) => Promise<Entry[]>
  onOpenCoverArtKeyDialog: (callback: () => void) => () => void

  onStatusMessage: (callback: (message: string) => void) => () => void
}

declare global {
  interface Window {
    api: LauncherApi
  }
}
