import { contextBridge, ipcRenderer } from 'electron'
import type { Entry, Category } from '../main/store'
import type { Candidate } from '../main/scanner'
import type { EntryStats } from '../main/stats'
import type { UpdaterStatus } from '../main/updater'

// Jede Funktion hier entspricht genau einem erlaubten IPC-Kanal.
// Kein genereller Durchgriff auf ipcRenderer.invoke aus dem Renderer.
const api = {
  listEntries: (): Promise<Entry[]> => ipcRenderer.invoke('entries:list'),
  addEntryViaDialog: (): Promise<Entry[]> => ipcRenderer.invoke('entries:addViaDialog'),
  renameEntry: (id: string, name: string): Promise<Entry[]> =>
    ipcRenderer.invoke('entries:rename', id, name),
  setEntryCategory: (id: string, categoryId: string): Promise<Entry[]> =>
    ipcRenderer.invoke('entries:setCategory', id, categoryId),
  removeEntry: (id: string): Promise<Entry[]> => ipcRenderer.invoke('entries:remove', id),
  launchEntry: (id: string): Promise<void> => ipcRenderer.invoke('entries:launch', id),
  toggleFavorite: (id: string): Promise<Entry[]> =>
    ipcRenderer.invoke('entries:toggleFavorite', id),

  listCategories: (): Promise<Category[]> => ipcRenderer.invoke('categories:list'),
  addCategory: (name: string): Promise<Category[]> => ipcRenderer.invoke('categories:add', name),
  renameCategory: (id: string, name: string): Promise<Category[]> =>
    ipcRenderer.invoke('categories:rename', id, name),
  removeCategory: (id: string): Promise<Category[]> => ipcRenderer.invoke('categories:remove', id),

  scan: (): Promise<Candidate[]> => ipcRenderer.invoke('scanner:scan'),
  importCandidates: (candidates: Candidate[]): Promise<Entry[]> =>
    ipcRenderer.invoke('scanner:import', candidates),

  listStats: (): Promise<EntryStats[]> => ipcRenderer.invoke('stats:list'),

  onUpdaterStatus: (callback: (status: UpdaterStatus) => void): (() => void) => {
    const listener = (_event: unknown, status: UpdaterStatus): void => callback(status)
    ipcRenderer.on('updater:status', listener)
    return () => ipcRenderer.removeListener('updater:status', listener)
  },
  installUpdate: (): Promise<void> => ipcRenderer.invoke('updater:install')
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
