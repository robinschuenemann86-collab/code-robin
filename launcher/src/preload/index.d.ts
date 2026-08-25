import type { Entry, Tag } from '../main/store'
import type { Candidate } from '../main/scanner'
import type { EntryStats } from '../main/stats'
import type { UpdaterStatus } from '../main/updater'

export interface LauncherApi {
  listEntries: () => Promise<Entry[]>
  addEntryViaDialog: () => Promise<Entry[]>
  renameEntry: (id: string, name: string) => Promise<Entry[]>
  toggleEntryTag: (id: string, tagId: string) => Promise<Entry[]>
  removeEntry: (id: string) => Promise<Entry[]>
  launchEntry: (id: string) => Promise<void>
  getEntrySize: (id: string) => Promise<number | null>
  toggleFavorite: (id: string) => Promise<Entry[]>

  listTags: () => Promise<Tag[]>
  addTag: (name: string) => Promise<Tag[]>
  renameTag: (id: string, name: string) => Promise<Tag[]>
  removeTag: (id: string) => Promise<Tag[]>

  scan: () => Promise<Candidate[]>
  importCandidates: (candidates: Candidate[]) => Promise<Entry[]>

  listStats: () => Promise<EntryStats[]>

  onUpdaterStatus: (callback: (status: UpdaterStatus) => void) => () => void
  installUpdate: () => Promise<void>

  setFullscreen: (value: boolean) => Promise<void>
  onFullscreenChanged: (callback: (value: boolean) => void) => () => void
}

declare global {
  interface Window {
    api: LauncherApi
  }
}
