import type { Entry, Category } from '../main/store'
import type { Candidate } from '../main/scanner'
import type { EntryStats } from '../main/stats'
import type { UpdaterStatus } from '../main/updater'

export interface LauncherApi {
  listEntries: () => Promise<Entry[]>
  addEntryViaDialog: () => Promise<Entry[]>
  renameEntry: (id: string, name: string) => Promise<Entry[]>
  setEntryCategory: (id: string, categoryId: string) => Promise<Entry[]>
  removeEntry: (id: string) => Promise<Entry[]>
  launchEntry: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<Entry[]>

  listCategories: () => Promise<Category[]>
  addCategory: (name: string) => Promise<Category[]>
  renameCategory: (id: string, name: string) => Promise<Category[]>
  removeCategory: (id: string) => Promise<Category[]>

  scan: () => Promise<Candidate[]>
  importCandidates: (candidates: Candidate[]) => Promise<Entry[]>

  listStats: () => Promise<EntryStats[]>

  onUpdaterStatus: (callback: (status: UpdaterStatus) => void) => () => void
  installUpdate: () => Promise<void>
}

declare global {
  interface Window {
    api: LauncherApi
  }
}
