import { contextBridge, ipcRenderer } from 'electron'
import type { Entry, SavedView, Session, Tag } from '../main/store'
import type { Candidate, ScanResult } from '../main/scanner'
import type { EntryStats, OverviewData } from '../main/stats'
import type { UpdaterStatus } from '../main/updater'

// Jede Funktion hier entspricht genau einem erlaubten IPC-Kanal.
// Kein genereller Durchgriff auf ipcRenderer.invoke aus dem Renderer.
const api = {
  listEntries: (): Promise<Entry[]> => ipcRenderer.invoke('entries:list'),
  addEntryViaDialog: (): Promise<Entry[]> => ipcRenderer.invoke('entries:addViaDialog'),
  renameEntry: (id: string, name: string): Promise<Entry[]> =>
    ipcRenderer.invoke('entries:rename', id, name),
  setLaunchArgs: (id: string, args: string): Promise<Entry[]> =>
    ipcRenderer.invoke('entries:setLaunchArgs', id, args),
  toggleEntryTag: (id: string, tagId: string): Promise<Entry[]> =>
    ipcRenderer.invoke('entries:toggleTag', id, tagId),
  removeEntry: (id: string): Promise<Entry[]> => ipcRenderer.invoke('entries:remove', id),
  moveEntry: (id: string, targetId: string | null, position: 'before' | 'after'): Promise<Entry[]> =>
    ipcRenderer.invoke('entries:move', id, targetId, position),
  launchEntry: (id: string): Promise<void> => ipcRenderer.invoke('entries:launch', id),
  getEntrySize: (id: string): Promise<number | null> => ipcRenderer.invoke('entries:getSize', id),
  toggleFavorite: (id: string): Promise<Entry[]> =>
    ipcRenderer.invoke('entries:toggleFavorite', id),
  setRating: (id: string, rating: number): Promise<Entry[]> =>
    ipcRenderer.invoke('entries:setRating', id, rating),
  bulkSetFavorite: (ids: string[], favorite: boolean): Promise<Entry[]> =>
    ipcRenderer.invoke('entries:bulkSetFavorite', ids, favorite),
  bulkAddTag: (ids: string[], tagId: string): Promise<Entry[]> =>
    ipcRenderer.invoke('entries:bulkAddTag', ids, tagId),
  bulkRemoveEntries: (ids: string[]): Promise<Entry[]> =>
    ipcRenderer.invoke('entries:bulkRemove', ids),
  addEntriesFromPaths: (paths: string[]): Promise<Entry[]> =>
    ipcRenderer.invoke('entries:addPaths', paths),
  showEntryInExplorer: (id: string): void => ipcRenderer.send('entries:showInExplorer', id),
  onEntriesChanged: (callback: (entries: Entry[]) => void): (() => void) => {
    const listener = (_event: unknown, entries: Entry[]): void => callback(entries)
    ipcRenderer.on('entries:changed', listener)
    return () => ipcRenderer.removeListener('entries:changed', listener)
  },
  checkEntryPaths: (): Promise<Record<string, boolean>> => ipcRenderer.invoke('entries:checkPaths'),
  pickCustomIcon: (id: string): Promise<Entry[]> => ipcRenderer.invoke('entries:pickCustomIcon', id),

  listTags: (): Promise<Tag[]> => ipcRenderer.invoke('tags:list'),
  addTag: (name: string): Promise<Tag[]> => ipcRenderer.invoke('tags:add', name),
  renameTag: (id: string, name: string): Promise<Tag[]> =>
    ipcRenderer.invoke('tags:rename', id, name),
  removeTag: (id: string): Promise<Tag[]> => ipcRenderer.invoke('tags:remove', id),
  cycleTagColor: (id: string, palette: string[]): Promise<Tag[]> =>
    ipcRenderer.invoke('tags:cycleColor', id, palette),

  listSavedViews: (): Promise<SavedView[]> => ipcRenderer.invoke('savedViews:list'),
  addSavedView: (view: Omit<SavedView, 'id'>): Promise<SavedView[]> =>
    ipcRenderer.invoke('savedViews:add', view),
  removeSavedView: (id: string): Promise<SavedView[]> =>
    ipcRenderer.invoke('savedViews:remove', id),

  scan: (): Promise<ScanResult> => ipcRenderer.invoke('scanner:scan'),
  importCandidates: (candidates: Candidate[]): Promise<Entry[]> =>
    ipcRenderer.invoke('scanner:import', candidates),

  listStats: (): Promise<EntryStats[]> => ipcRenderer.invoke('stats:list'),
  getOverview: (): Promise<OverviewData> => ipcRenderer.invoke('stats:overview'),
  getEntrySessions: (id: string): Promise<Session[]> =>
    ipcRenderer.invoke('stats:sessionsForEntry', id),
  getRunningEntries: (): Promise<string[]> => ipcRenderer.invoke('stats:runningEntries'),
  setWeeklyGoal: (minutes: number | null): Promise<void> =>
    ipcRenderer.invoke('stats:setWeeklyGoal', minutes),
  setBreakReminder: (minutes: number | null): Promise<void> =>
    ipcRenderer.invoke('stats:setBreakReminder', minutes),

  onUpdaterStatus: (callback: (status: UpdaterStatus) => void): (() => void) => {
    const listener = (_event: unknown, status: UpdaterStatus): void => callback(status)
    ipcRenderer.on('updater:status', listener)
    return () => ipcRenderer.removeListener('updater:status', listener)
  },
  installUpdate: (): Promise<void> => ipcRenderer.invoke('updater:install'),

  setFullscreen: (value: boolean): Promise<void> =>
    ipcRenderer.invoke('window:setFullscreen', value),
  onFullscreenChanged: (callback: (value: boolean) => void): (() => void) => {
    const listener = (_event: unknown, value: boolean): void => callback(value)
    ipcRenderer.on('window:fullscreenChanged', listener)
    return () => ipcRenderer.removeListener('window:fullscreenChanged', listener)
  },

  showEntryContextMenu: (id: string): void => ipcRenderer.send('contextMenu:showForEntry', id),
  showAppMenu: (): void => ipcRenderer.send('appMenu:show'),

  getCoverArtKey: (): Promise<string | null> => ipcRenderer.invoke('coverArt:get'),
  setCoverArtKey: (key: string): Promise<void> => ipcRenderer.invoke('coverArt:set', key),
  hasCoverArtProxy: (): Promise<boolean> => ipcRenderer.invoke('coverArt:hasProxy'),
  fetchCoverArt: (id: string): Promise<Entry[]> => ipcRenderer.invoke('coverArt:fetch', id),
  fetchAllMissingCoverArt: (): Promise<void> => ipcRenderer.invoke('coverArt:fetchAllMissing'),
  onOpenCoverArtKeyDialog: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('coverArt:openKeyDialog', listener)
    return () => ipcRenderer.removeListener('coverArt:openKeyDialog', listener)
  },

  hasSeenWelcome: (): Promise<boolean> => ipcRenderer.invoke('onboarding:hasSeenWelcome'),
  markWelcomeSeen: (): Promise<void> => ipcRenderer.invoke('onboarding:markWelcomeSeen'),

  onStatusMessage: (callback: (message: string) => void): (() => void) => {
    const listener = (_event: unknown, message: string): void => callback(message)
    ipcRenderer.on('status:message', listener)
    return () => ipcRenderer.removeListener('status:message', listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
