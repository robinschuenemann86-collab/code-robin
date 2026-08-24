import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { basename, dirname, extname } from 'path'
import { getStore, setEntries, type Entry } from './store'
import { ensureIconCached, removeCachedIcon } from './icons'

function deriveName(targetPath: string): string {
  return basename(targetPath, extname(targetPath))
}

async function addEntryViaDialog(window: BrowserWindow): Promise<Entry[]> {
  const result = await dialog.showOpenDialog(window, {
    title: 'Programm hinzufügen',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Programme', extensions: ['exe', 'lnk'] },
      { name: 'Alle Dateien', extensions: ['*'] }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return getStore().get('entries')
  }

  const existing = getStore().get('entries')
  const existingPaths = new Set(existing.map((entry) => entry.path))

  const newEntries: Entry[] = []
  for (const filePath of result.filePaths) {
    if (existingPaths.has(filePath)) {
      continue
    }
    const iconHash = await ensureIconCached(filePath)
    newEntries.push({
      id: randomUUID(),
      name: deriveName(filePath),
      path: filePath,
      iconHash,
      category: '',
      addedAt: Date.now(),
      steamAppId: null
    })
  }

  const updated = [...existing, ...newEntries]
  setEntries(updated)
  return updated
}

function renameEntry(id: string, name: string): Entry[] {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Der Name darf nicht leer sein.')
  }
  const entries = getStore().get('entries')
  const index = entries.findIndex((entry) => entry.id === id)
  if (index === -1) {
    throw new Error('Eintrag wurde nicht gefunden.')
  }
  const updated = [...entries]
  updated[index] = { ...updated[index], name: trimmed }
  setEntries(updated)
  return updated
}

function setEntryCategory(id: string, categoryId: string): Entry[] {
  const entries = getStore().get('entries')
  const index = entries.findIndex((entry) => entry.id === id)
  if (index === -1) {
    throw new Error('Eintrag wurde nicht gefunden.')
  }
  if (
    categoryId !== '' &&
    !getStore()
      .get('categories')
      .some((c) => c.id === categoryId)
  ) {
    throw new Error('Kategorie wurde nicht gefunden.')
  }
  const updated = [...entries]
  updated[index] = { ...updated[index], category: categoryId }
  setEntries(updated)
  return updated
}

async function removeEntry(id: string): Promise<Entry[]> {
  const entries = getStore().get('entries')
  const target = entries.find((entry) => entry.id === id)
  if (!target) {
    throw new Error('Eintrag wurde nicht gefunden.')
  }
  const remaining = entries.filter((entry) => entry.id !== id)

  const hashStillUsed =
    target.iconHash !== null && remaining.some((entry) => entry.iconHash === target.iconHash)
  if (target.iconHash && !hashStillUsed) {
    await removeCachedIcon(target.iconHash)
  }

  setEntries(remaining)
  return remaining
}

// Der Renderer schickt nur die id — der echte Pfad kommt ausschließlich aus dem
// bereits validierten Datenbestand im Main-Prozess, nie direkt vom Renderer.
async function launchEntry(id: string): Promise<void> {
  const entries = getStore().get('entries')
  const entry = entries.find((e) => e.id === id)
  if (!entry) {
    throw new Error('Eintrag wurde nicht gefunden.')
  }
  // Steam-Spiele laufen über den Steam-Client, nicht per direktem Programmstart —
  // sonst fehlen Overlay, Cloud-Saves und Achievements.
  if (entry.steamAppId) {
    await shell.openExternal(`steam://rungameid/${entry.steamAppId}`)
    return
  }
  spawn(entry.path, [], { detached: true, stdio: 'ignore', cwd: dirname(entry.path) }).unref()
}

export function registerEntryHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('entries:list', () => getStore().get('entries'))

  ipcMain.handle('entries:addViaDialog', () => {
    const window = getWindow()
    if (!window) {
      throw new Error('Kein Fenster verfügbar.')
    }
    return addEntryViaDialog(window)
  })

  ipcMain.handle('entries:rename', (_event, id: string, name: string) => renameEntry(id, name))

  ipcMain.handle('entries:setCategory', (_event, id: string, categoryId: string) =>
    setEntryCategory(id, categoryId)
  )

  ipcMain.handle('entries:remove', (_event, id: string) => removeEntry(id))

  ipcMain.handle('entries:launch', (_event, id: string) => launchEntry(id))
}
