import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { basename, dirname, extname, join } from 'path'
import { readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { getStore, setEntries, nextOrder, type Entry } from './store'
import { ensureIconCached, removeCachedIcon, setCustomIcon } from './icons'
import { startSession } from './playtime'

function deriveName(targetPath: string): string {
  return basename(targetPath, extname(targetPath))
}

// Gemeinsame Basis für den Datei-Dialog und Drag & Drop — beide liefern am
// Ende nur eine Liste von Dateipfaden, der Rest (Dubletten prüfen, Icon
// laden, Eintrag anlegen) ist identisch.
async function addEntriesFromPaths(paths: string[]): Promise<Entry[]> {
  const existing = getStore().get('entries')
  const existingPaths = new Set(existing.map((entry) => entry.path))

  const newEntries: Entry[] = []
  let order = nextOrder(existing) - 1000
  for (const filePath of paths) {
    if (existingPaths.has(filePath) || !existsSync(filePath)) {
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
      battlenetCode: null,
      favorite: false,
      expectedProcessName: basename(filePath),
      order: (order += 1000)
    })
  }

  const updated = [...existing, ...newEntries]
  setEntries(updated)
  return updated
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

  return addEntriesFromPaths(result.filePaths)
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

export function toggleEntryTag(id: string, tagId: string): Entry[] {
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

// Setzt die Reihenfolge aller Einträge neu, statt Bruchteils-Positionen
// zwischen Nachbarn zu berechnen — bei ein paar hundert Programmen kein
// Performance-Thema, dafür ohne Sonderfall für "Lücke wird zu klein".
function moveEntry(id: string, targetId: string | null, position: 'before' | 'after'): Entry[] {
  const entries = getStore().get('entries')
  const sorted = [...entries].sort((a, b) => a.order - b.order)

  const fromIndex = sorted.findIndex((e) => e.id === id)
  if (fromIndex === -1) {
    throw new Error('Eintrag wurde nicht gefunden.')
  }
  const [moved] = sorted.splice(fromIndex, 1)

  let insertIndex = sorted.length
  if (targetId) {
    const targetIndex = sorted.findIndex((e) => e.id === targetId)
    if (targetIndex === -1) {
      throw new Error('Zielposition wurde nicht gefunden.')
    }
    insertIndex = position === 'before' ? targetIndex : targetIndex + 1
  }
  sorted.splice(insertIndex, 0, moved)

  const renumbered = sorted.map((entry, index) => ({ ...entry, order: (index + 1) * 1000 }))
  setEntries(renumbered)
  return renumbered
}

export function toggleFavorite(id: string): Entry[] {
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

export async function removeEntry(id: string): Promise<Entry[]> {
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
export async function launchEntry(id: string): Promise<void> {
  const entries = getStore().get('entries')
  const entry = entries.find((e) => e.id === id)
  if (!entry) {
    throw new Error('Eintrag wurde nicht gefunden.')
  }
  // Steam-, Epic- und Battle.net-Spiele laufen über den jeweiligen Client,
  // nicht per direktem Programmstart — sonst fehlen Overlay, Cloud-Saves,
  // Achievements und ggf. der Anti-Cheat-Unterbau.
  if (entry.steamAppId) {
    await shell.openExternal(`steam://rungameid/${entry.steamAppId}`)
  } else if (entry.epicAppName) {
    await shell.openExternal(
      `com.epicgames.launcher://apps/${entry.epicAppName}?action=launch&silent=true`
    )
  } else if (entry.battlenetCode) {
    await shell.openExternal(`battlenet://${entry.battlenetCode}`)
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

// Für Steam-/Epic-Einträge ist ein fehlender Pfad kein Problem — die starten
// über den jeweiligen Client, nicht über den gespeicherten Ordner.
function checkEntryPaths(): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const entry of getStore().get('entries')) {
    result[entry.id] = Boolean(entry.steamAppId || entry.epicAppName || existsSync(entry.path))
  }
  return result
}

export async function pickCustomIcon(window: BrowserWindow, id: string): Promise<Entry[]> {
  const entries = getStore().get('entries')
  const entry = entries.find((e) => e.id === id)
  if (!entry) {
    throw new Error('Eintrag wurde nicht gefunden.')
  }

  const result = await dialog.showOpenDialog(window, {
    title: 'Icon auswählen',
    properties: ['openFile'],
    filters: [{ name: 'Bilder', extensions: ['png', 'jpg', 'jpeg', 'ico', 'bmp'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return entries

  const newHash = await setCustomIcon(id, result.filePaths[0])
  if (!newHash) return entries

  const oldHash = entry.iconHash
  const updated = entries.map((e) => (e.id === id ? { ...e, iconHash: newHash } : e))
  setEntries(updated)

  const oldHashStillUsed = oldHash !== null && updated.some((e) => e.iconHash === oldHash)
  if (oldHash && !oldHashStillUsed) {
    await removeCachedIcon(oldHash)
  }

  return updated
}

export function showEntryInExplorer(id: string): void {
  const entry = getStore()
    .get('entries')
    .find((e) => e.id === id)
  if (entry) {
    shell.showItemInFolder(entry.path)
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

  ipcMain.handle(
    'entries:move',
    (_event, id: string, targetId: string | null, position: 'before' | 'after') =>
      moveEntry(id, targetId, position)
  )

  ipcMain.handle('entries:launch', (_event, id: string) => launchEntry(id))

  ipcMain.handle('entries:getSize', (_event, id: string) => getEntrySize(id))

  ipcMain.handle('entries:addPaths', (_event, paths: string[]) => addEntriesFromPaths(paths))

  ipcMain.on('entries:showInExplorer', (_event, id: string) => showEntryInExplorer(id))

  ipcMain.handle('entries:checkPaths', () => checkEntryPaths())

  ipcMain.handle('entries:pickCustomIcon', (_event, id: string) => {
    const window = getWindow()
    if (!window) {
      throw new Error('Kein Fenster verfügbar.')
    }
    return pickCustomIcon(window, id)
  })
}
