import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { basename, dirname, extname, join } from 'path'
import { readdir, stat } from 'fs/promises'
import { getStore, setEntries, type Entry } from './store'
import { ensureIconCached, removeCachedIcon } from './icons'
import { startSession } from './playtime'

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
      tags: [],
      addedAt: Date.now(),
      steamAppId: null,
      epicAppName: null,
      favorite: false,
      expectedProcessName: basename(filePath)
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

function toggleEntryTag(id: string, tagId: string): Entry[] {
  const entries = getStore().get('entries')
  const index = entries.findIndex((entry) => entry.id === id)
  if (index === -1) {
    throw new Error('Eintrag wurde nicht gefunden.')
  }
  if (
    !getStore()
      .get('tags')
      .some((t) => t.id === tagId)
  ) {
    throw new Error('Tag wurde nicht gefunden.')
  }
  const current = entries[index].tags
  const tags = current.includes(tagId) ? current.filter((t) => t !== tagId) : [...current, tagId]
  const updated = [...entries]
  updated[index] = { ...updated[index], tags }
  setEntries(updated)
  return updated
}

function toggleFavorite(id: string): Entry[] {
  const entries = getStore().get('entries')
  const index = entries.findIndex((entry) => entry.id === id)
  if (index === -1) {
    throw new Error('Eintrag wurde nicht gefunden.')
  }
  const updated = [...entries]
  updated[index] = { ...updated[index], favorite: !updated[index].favorite }
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
  // Steam- und Epic-Spiele laufen über den jeweiligen Client, nicht per direktem
  // Programmstart — sonst fehlen Overlay, Cloud-Saves und Achievements.
  if (entry.steamAppId) {
    await shell.openExternal(`steam://rungameid/${entry.steamAppId}`)
  } else if (entry.epicAppName) {
    await shell.openExternal(
      `com.epicgames.launcher://apps/${entry.epicAppName}?action=launch&silent=true`
    )
  } else {
    spawn(entry.path, [], { detached: true, stdio: 'ignore', cwd: dirname(entry.path) }).unref()
  }

  startSession(entry.id, entry.expectedProcessName)
}

// Läuft rekursiv einen Ordner ab und summiert die Dateigrößen. Einzelne
// Dateien/Unterordner ohne Zugriff werden übersprungen statt die ganze
// Berechnung abzubrechen — bei Spielordnern sind vereinzelte Sperren normal.
async function directorySize(dir: string): Promise<number> {
  let total = 0
  let items: import('fs').Dirent[]
  try {
    items = await readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const item of items) {
    const itemPath = join(dir, item.name)
    if (item.isDirectory()) {
      total += await directorySize(itemPath)
    } else if (item.isFile()) {
      try {
        total += (await stat(itemPath)).size
      } catch {
        // Datei zwischen readdir und stat verschwunden oder gesperrt — ignorieren.
      }
    }
  }
  return total
}

async function getEntrySize(id: string): Promise<number | null> {
  const entries = getStore().get('entries')
  const entry = entries.find((e) => e.id === id)
  if (!entry) {
    throw new Error('Eintrag wurde nicht gefunden.')
  }
  try {
    const info = await stat(entry.path)
    const folder = info.isDirectory() ? entry.path : dirname(entry.path)
    return await directorySize(folder)
  } catch {
    return null
  }
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

  ipcMain.handle('entries:toggleTag', (_event, id: string, tagId: string) =>
    toggleEntryTag(id, tagId)
  )

  ipcMain.handle('entries:toggleFavorite', (_event, id: string) => toggleFavorite(id))

  ipcMain.handle('entries:remove', (_event, id: string) => removeEntry(id))

  ipcMain.handle('entries:launch', (_event, id: string) => launchEntry(id))

  ipcMain.handle('entries:getSize', (_event, id: string) => getEntrySize(id))
}
