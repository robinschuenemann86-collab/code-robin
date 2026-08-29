import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { basename, dirname, extname, join } from 'path'
import { readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { getStore, setEntries, setSessions, nextOrder, type Entry } from './store'
import { ensureIconCached, removeCachedIcon, setCustomIcon } from './icons'
import { startSession } from './playtime'
import { setDiscordPresence } from './discordPresence'
import { showOverlay } from './overlayWindow'
import { fetchCoverArtForNewEntries } from './coverArt'

function deriveName(targetPath: string): string {
  return basename(targetPath, extname(targetPath))
}

// Windows-Pfade sind nicht case-sensitiv — ohne das würde dasselbe Programm
// zweimal auftauchen, wenn eine Verknüpfung oder ein zweiter Datei-Dialog den
// Pfad mit anderer Groß-/Kleinschreibung liefert.
function pathKey(path: string): string {
  return path.toLowerCase()
}

// .lnk-Verknüpfungen sind über den Datei-Dialog und Drag & Drop wählbar,
// zeigen aber selbst nicht auf eine ausführbare Datei — ohne Auflösung landet
// der Verknüpfungspfad unverändert in `path` und spawn() kann ihn beim Start
// nicht ausführen. Bei einer defekten/nicht lesbaren Verknüpfung bleibt es
// beim Original-Pfad; das führt dann zu einer Fehlermeldung beim Start statt
// zu einem stillen Fehlschlag hier.
function resolveLaunchPath(filePath: string): string {
  if (extname(filePath).toLowerCase() !== '.lnk') return filePath
  try {
    const { target } = shell.readShortcutLink(filePath)
    return target || filePath
  } catch {
    return filePath
  }
}

// Gemeinsame Basis für den Datei-Dialog und Drag & Drop — beide liefern am
// Ende nur eine Liste von Dateipfaden, der Rest (Dubletten prüfen, Icon
// laden, Eintrag anlegen) ist identisch.
async function addEntriesFromPaths(paths: string[]): Promise<Entry[]> {
  const existing = getStore().get('entries')
  const existingPaths = new Set(existing.map((entry) => pathKey(entry.path)))

  const newEntries: Entry[] = []
  let order = nextOrder(existing) - 1000
  for (const filePath of paths) {
    if (!existsSync(filePath)) continue
    const resolvedPath = resolveLaunchPath(filePath)
    if (existingPaths.has(pathKey(resolvedPath))) continue

    const iconHash = await ensureIconCached(filePath)
    newEntries.push({
      id: randomUUID(),
      name: deriveName(filePath),
      path: resolvedPath,
      iconHash,
      coverHash: null,
      heroHash: null,
      tags: [],
      addedAt: Date.now(),
      steamAppId: null,
      epicAppName: null,
      battlenetCode: null,
      ubisoftId: null,
      favorite: false,
      rating: 0,
      expectedProcessName: basename(resolvedPath),
      order: (order += 1000),
      launchArgs: null
    })
    existingPaths.add(pathKey(resolvedPath))
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

function setLaunchArgs(id: string, args: string): Entry[] {
  const entries = getStore().get('entries')
  const index = entries.findIndex((entry) => entry.id === id)
  if (index === -1) {
    throw new Error('Eintrag wurde nicht gefunden.')
  }
  const trimmed = args.trim()
  const updated = [...entries]
  updated[index] = { ...updated[index], launchArgs: trimmed || null }
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

export function setRating(id: string, rating: number): Entry[] {
  if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
    throw new Error('Bewertung muss zwischen 0 und 5 liegen.')
  }
  const entries = getStore().get('entries')
  const index = entries.findIndex((entry) => entry.id === id)
  if (index === -1) {
    throw new Error('Eintrag wurde nicht gefunden.')
  }
  const updated = [...entries]
  updated[index] = { ...updated[index], rating }
  setEntries(updated)
  return updated
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

export function setFavoriteForMany(ids: string[], favorite: boolean): Entry[] {
  const idSet = new Set(ids)
  const entries = getStore().get('entries')
  const updated = entries.map((entry) => (idSet.has(entry.id) ? { ...entry, favorite } : entry))
  setEntries(updated)
  return updated
}

export function addTagToMany(ids: string[], tagId: string): Entry[] {
  if (
    !getStore()
      .get('tags')
      .some((t) => t.id === tagId)
  ) {
    throw new Error('Tag wurde nicht gefunden.')
  }
  const idSet = new Set(ids)
  const entries = getStore().get('entries')
  const updated = entries.map((entry) =>
    idSet.has(entry.id) && !entry.tags.includes(tagId)
      ? { ...entry, tags: [...entry.tags, tagId] }
      : entry
  )
  setEntries(updated)
  return updated
}

// Ruft removeEntry() nacheinander statt parallel auf — die Cache-GC-Prüfung
// darin ("wird der Hash noch von einem anderen Eintrag verwendet?") liest den
// jeweils aktuellen Datenbestand, was bei gleichzeitigen Aufrufen zu falschen
// Ergebnissen führen könnte.
export async function removeMany(ids: string[]): Promise<Entry[]> {
  let result = getStore().get('entries')
  for (const id of ids) {
    if (result.some((entry) => entry.id === id)) {
      result = await removeEntry(id)
    }
  }
  return result
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
  const coverStillUsed =
    target.coverHash !== null && remaining.some((entry) => entry.coverHash === target.coverHash)
  if (target.coverHash && !coverStillUsed) {
    await removeCachedIcon(target.coverHash)
  }
  const heroStillUsed =
    target.heroHash !== null && remaining.some((entry) => entry.heroHash === target.heroHash)
  if (target.heroHash && !heroStillUsed) {
    await removeCachedIcon(target.heroHash)
  }

  // Sonst sammeln sich Spielzeit-Sitzungen für längst entfernte Programme
  // unbegrenzt in der Datendatei an — sichtbar sind sie ohnehin nirgends
  // mehr, da jede Auswertung über die (jetzt fehlende) entryId joint.
  setSessions(getStore().get('sessions').filter((session) => session.entryId !== id))

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
  // Steam-, Epic-, Battle.net- und Ubisoft-Spiele laufen über den jeweiligen
  // Client, nicht per direktem Programmstart — sonst fehlen Overlay,
  // Cloud-Saves, Achievements und ggf. der Anti-Cheat-Unterbau/DRM-Check.
  if (entry.steamAppId) {
    await shell.openExternal(`steam://rungameid/${entry.steamAppId}`)
  } else if (entry.epicAppName) {
    await shell.openExternal(
      `com.epicgames.launcher://apps/${entry.epicAppName}?action=launch&silent=true`
    )
  } else if (entry.battlenetCode) {
    await shell.openExternal(`battlenet://${entry.battlenetCode}`)
  } else if (entry.ubisoftId) {
    await shell.openExternal(`uplay://launch/${entry.ubisoftId}/0`)
  } else {
    await spawnDetached(entry.path, dirname(entry.path), parseArgs(entry.launchArgs))
  }

  startSession(entry.id, entry.expectedProcessName)
  // Nur wenn wirklich eine Sitzung getrackt wird (siehe startSession-Guard) —
  // sonst würde "Spielt gerade X" nie wieder verschwinden, weil auch das
  // Ende nur über das Prozess-Polling erkannt wird.
  if (entry.expectedProcessName) {
    setDiscordPresence(entry.name)
    showOverlay(entry.name, Date.now())
  }
}

// Einfacher Tokenizer statt eines echten Shell-Parsers — reicht für den
// üblichen Fall ("-arg1 -arg2" oder "-datapath \"C:\\Pfad mit Leerzeichen\"")
// und läuft nie durch eine Shell (kein Interpolieren, siehe CLAUDE.md).
function parseArgs(raw: string | null): string[] {
  if (!raw) return []
  const matches = raw.match(/"[^"]*"|\S+/g) ?? []
  return matches.map((token) =>
    token.startsWith('"') && token.endsWith('"') ? token.slice(1, -1) : token
  )
}

// spawn() meldet einen ungültigen Pfad (z. B. ein verschobenes/deinstalliertes
// Programm) erst asynchronisch über das "error"-Event. Ohne Listener dafür
// wird das zu einer unbehandelten Exception im Main-Prozess — die ganze App
// stürzt ab, statt dass der Start einfach fehlschlägt und der Renderer eine
// Fehlermeldung zeigen kann.
function spawnDetached(path: string, cwd: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(path, args, { detached: true, stdio: 'ignore', cwd })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
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

// Holt für neu hinzugefügte Einträge automatisch Cover-Art nach — läuft im
// Hintergrund weiter, nachdem die IPC-Antwort mit den neuen Einträgen schon
// beim Renderer angekommen ist, und schiebt jedes gefundene Bild einzeln per
// entries:changed nach, statt auf alle Ergebnisse zu warten.
function triggerCoverArtForNewEntries(
  before: Set<string>,
  updated: Entry[],
  getWindow: () => BrowserWindow | null
): void {
  const newIds = updated.filter((e) => !before.has(e.id)).map((e) => e.id)
  if (newIds.length === 0) return
  void fetchCoverArtForNewEntries(newIds, (entries) =>
    getWindow()?.webContents.send('entries:changed', entries)
  )
}

export function registerEntryHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('entries:list', () => getStore().get('entries'))

  ipcMain.handle('entries:addViaDialog', async () => {
    const window = getWindow()
    if (!window) {
      throw new Error('Kein Fenster verfügbar.')
    }
    const before = new Set(getStore().get('entries').map((e) => e.id))
    const updated = await addEntryViaDialog(window)
    triggerCoverArtForNewEntries(before, updated, getWindow)
    return updated
  })

  ipcMain.handle('entries:rename', (_event, id: string, name: string) => renameEntry(id, name))

  ipcMain.handle('entries:setLaunchArgs', (_event, id: string, args: string) =>
    setLaunchArgs(id, args)
  )

  ipcMain.handle('entries:toggleTag', (_event, id: string, tagId: string) =>
    toggleEntryTag(id, tagId)
  )

  ipcMain.handle('entries:toggleFavorite', (_event, id: string) => toggleFavorite(id))

  ipcMain.handle('entries:setRating', (_event, id: string, rating: number) =>
    setRating(id, rating)
  )

  ipcMain.handle('entries:remove', (_event, id: string) => removeEntry(id))

  ipcMain.handle('entries:bulkSetFavorite', (_event, ids: string[], favorite: boolean) =>
    setFavoriteForMany(ids, favorite)
  )

  ipcMain.handle('entries:bulkAddTag', (_event, ids: string[], tagId: string) =>
    addTagToMany(ids, tagId)
  )

  ipcMain.handle('entries:bulkRemove', (_event, ids: string[]) => removeMany(ids))

  ipcMain.handle(
    'entries:move',
    (_event, id: string, targetId: string | null, position: 'before' | 'after') =>
      moveEntry(id, targetId, position)
  )

  ipcMain.handle('entries:launch', (_event, id: string) => launchEntry(id))

  ipcMain.handle('entries:getSize', (_event, id: string) => getEntrySize(id))

  ipcMain.handle('entries:addPaths', async (_event, paths: string[]) => {
    const before = new Set(getStore().get('entries').map((e) => e.id))
    const updated = await addEntriesFromPaths(paths)
    triggerCoverArtForNewEntries(before, updated, getWindow)
    return updated
  })

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
