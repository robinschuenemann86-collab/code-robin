import { contextBridge, ipcRenderer } from 'electron'
import type { Entry, Tag } from '../main/store'
import type { Candidate } from '../main/scanner'
import type { EntryStats, OverviewData } from '../main/stats'
import type { UpdaterStatus } from '../main/updater'

// Jede Funktion hier entspricht genau einem erlaubten IPC-Kanal.
// Kein genereller Durchgriff auf ipcRenderer.invoke aus dem Renderer.
const api = {
  listEntries: (): Promise<Entry[]> => ipcRenderer.invoke('entries:list'),
  addEntryViaDialog: (): Promise<Entry[]> => ipcRenderer.invoke('entries:addViaDialog'),
  renameEntry: (id: string, name: string): Promise<Entry[]> =>
    ipcRenderer.invoke('entries:rename', id, name),
  toggleEntryTag: (id: string, tagId: string): Promise<Entry[]> =>
    ipcRenderer.invoke('entries:toggleTag', id, tagId),
  removeEntry: (id: string): Promise<Entry[]> => ipcRenderer.invoke('entries:remove', id),
  moveEntry: (id: string, targetId: string | null, position: 'before' | 'after'): Promise<Entry[]> =>
    ipcRenderer.invoke('entries:move', id, targetId, position),
  launchEntry: (id: string): Promise<void> => ipcRenderer.invoke('entries:launch', id),
  getEntrySize: (id: string): Promise<number | null> => ipcRenderer.invoke('entries:getSize', id),
  toggleFavorite: (id: string): Promise<Entry[]> =>
    ipcRenderer.invoke('entries:toggleFavorite', id),
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

  scan: (): Promise<Candidate[]> => ipcRenderer.invoke('scanner:scan'),
  importCandidates: (candidates: Candidate[]): Promise<Entry[]> =>
    ipcRenderer.invoke('scanner:import', candidates),

  listStats: (): Promise<EntryStats[]> => ipcRenderer.invoke('stats:list'),
  getOverview: (): Promise<OverviewData> => ipcRenderer.invoke('stats:overview'),

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
  fetchCoverArt: (id: string): Promise<Entry[]> => ipcRenderer.invoke('coverArt:fetch', id),
  onOpenCoverArtKeyDialog: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('coverArt:openKeyDialog', listener)
    return () => ipcRenderer.removeListener('coverArt:openKeyDialog', listener)
  },

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
