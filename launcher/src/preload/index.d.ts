import type { Entry, Category } from '../main/store'
import type { Candidate } from '../main/scanner'

export interface LauncherApi {
  listEntries: () => Promise<Entry[]>
  addEntryViaDialog: () => Promise<Entry[]>
  renameEntry: (id: string, name: string) => Promise<Entry[]>
  setEntryCategory: (id: string, categoryId: string) => Promise<Entry[]>
  removeEntry: (id: string) => Promise<Entry[]>
  launchEntry: (id: string) => Promise<void>

  listCategories: () => Promise<Category[]>
  addCategory: (name: string) => Promise<Category[]>
  renameCategory: (id: string, name: string) => Promise<Category[]>
  removeCategory: (id: string) => Promise<Category[]>

  scan: () => Promise<Candidate[]>
  importCandidates: (candidates: Candidate[]) => Promise<Entry[]>
}

declare global {
  interface Window {
    api: LauncherApi
  }
}
