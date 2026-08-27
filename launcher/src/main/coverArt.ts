import { ipcMain, nativeImage, type BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { getStore, setEntries, setSettings, type Entry } from './store'
import { hashPath, iconFilePath, removeCachedIcon } from './icons'

const API_BASE = 'https://www.steamgriddb.com/api/v2'

interface SteamGridDbSearchResult {
  success: boolean
  data?: { id: number; name: string }[]
}

interface SteamGridDbGridsResult {
  success: boolean
  data?: { url: string }[]
}

export function getApiKey(): string | null {
  const value = getStore().get('settings').steamGridDbApiKey
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function setApiKey(key: string): void {
  setSettings({ ...getStore().get('settings'), steamGridDbApiKey: key.trim() })
}

async function searchGameId(name: string, apiKey: string): Promise<number | null> {
  const response = await fetch(`${API_BASE}/search/autocomplete/${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  })
  if (response.status === 401) {
    throw new Error('SteamGridDB-Key ist ungültig.')
  }
  if (!response.ok) {
    throw new Error(`SteamGridDB antwortete mit Fehler ${response.status}.`)
  }
  const body = (await response.json()) as SteamGridDbSearchResult
  return body.data?.[0]?.id ?? null
}

// Bevorzugt das klassische Steam-Bibliotheks-Hochformat (600x900) — das
// entspricht der großen Kachel-Darstellung, die wir im Raster zeigen wollen.
async function fetchGridUrl(gameId: number, apiKey: string): Promise<string | null> {
  const response = await fetch(`${API_BASE}/grids/game/${gameId}?dimensions=600x900&nsfw=false&humor=false`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  })
  if (!response.ok) {
    throw new Error(`SteamGridDB antwortete mit Fehler ${response.status}.`)
  }
  const body = (await response.json()) as SteamGridDbGridsResult
  return body.data?.[0]?.url ?? null
}

// Neuer, bisher unbenutzter Hash statt eines pfadbasierten — sonst würde der
// Renderer über den identischen launcher-icon://<hash>-Link weiter das alte
// Bild aus dem Cache zeigen, obwohl dahinter eine neue Datei liegt.
async function downloadAndCache(entryId: string, imageUrl: string): Promise<string> {
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error('Bild konnte nicht heruntergeladen werden.')
  }
  const buffer = Buffer.from(await imageResponse.arrayBuffer())
  const image = nativeImage.createFromBuffer(buffer)
  if (image.isEmpty()) {
    throw new Error('Heruntergeladenes Bild war ungültig.')
  }
  const hash = hashPath(`cover:${entryId}:${Date.now()}`)
  await fs.writeFile(iconFilePath(hash), image.toPNG())
  return hash
}

export async function fetchCoverArt(entryId: string): Promise<Entry[]> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('Kein SteamGridDB-Key hinterlegt. Über "…" → "SteamGridDB-Key…" eintragen.')
  }

  const entry = getStore()
    .get('entries')
    .find((e) => e.id === entryId)
  if (!entry) {
    throw new Error('Eintrag wurde nicht gefunden.')
  }

  // fetch() wirft bei einem reinen Netzwerkproblem (kein DNS, Firewall,
  // Timeout) eine technische "fetch failed"-Meldung ohne HTTP-Status — hier
  // in eine verständliche Meldung übersetzen, statt sie roh durchzureichen.
  let gameId: number | null
  let gridUrl: string | null
  try {
    gameId = await searchGameId(entry.name, apiKey)
  } catch (error) {
    throw new Error(
      `Verbindung zu SteamGridDB fehlgeschlagen (${error instanceof Error ? error.message : String(error)}).`
    )
  }
  if (!gameId) {
    throw new Error(`Kein SteamGridDB-Eintrag für "${entry.name}" gefunden.`)
  }
  try {
    gridUrl = await fetchGridUrl(gameId, apiKey)
  } catch (error) {
    throw new Error(
      `Verbindung zu SteamGridDB fehlgeschlagen (${error instanceof Error ? error.message : String(error)}).`
    )
  }
  if (!gridUrl) {
    throw new Error(`Für "${entry.name}" gibt es dort kein Cover-Bild.`)
  }

  let newHash: string
  try {
    newHash = await downloadAndCache(entryId, gridUrl)
  } catch (error) {
    throw new Error(
      `Cover-Bild konnte nicht geladen werden (${error instanceof Error ? error.message : String(error)}).`
    )
  }

  // Erst jetzt, nach den langsamen Netzwerk-Aufrufen, den aktuellsten Stand
  // lesen und schreiben — sonst überschreiben sich mehrere gleichzeitig
  // angestoßene Abrufe gegenseitig (wer zuletzt fertig ist, gewinnt und
  // verwirft die Treffer aller anderen, obwohl die erfolgreich waren).
  const latest = getStore().get('entries')
  const oldHash = latest.find((e) => e.id === entryId)?.coverHash ?? null
  const updated = latest.map((e) => (e.id === entryId ? { ...e, coverHash: newHash } : e))
  setEntries(updated)

  const oldHashStillUsed = oldHash !== null && updated.some((e) => e.coverHash === oldHash)
  if (oldHash && !oldHashStillUsed) {
    await removeCachedIcon(oldHash)
  }

  return updated
}

// Läuft nach dem Hinzufügen neuer Einträge automatisch im Hintergrund, damit
// nicht mehr für jedes Spiel einzeln "Cover-Art laden" geklickt werden muss.
// Sequenziell statt parallel, um SteamGridDB nicht mit vielen gleichzeitigen
// Anfragen auf einmal zu belasten (z. B. nach einem Scan mit vielen Treffern).
export async function fetchCoverArtForNewEntries(
  entryIds: string[],
  onUpdate: (entries: Entry[]) => void
): Promise<void> {
  if (!getApiKey()) return
  for (const entryId of entryIds) {
    try {
      onUpdate(await fetchCoverArt(entryId))
    } catch {
      // Kein Treffer, kein Netzwerk, ungültiger Key etc. — beim automatischen
      // Nachladen einfach überspringen statt eine Fehlermeldung zu zeigen.
    }
  }
}

// Für Bibliotheken, die schon vor der automatischen Cover-Art existierten —
// holt sie rückwirkend für alle Einträge nach, die noch keine haben, statt
// dass man jedes einzeln über das Kontextmenü anstoßen muss.
export async function fetchMissingCoverArtForAll(window: BrowserWindow): Promise<void> {
  if (!getApiKey()) {
    window.webContents.send(
      'status:message',
      'Kein SteamGridDB-Key hinterlegt. Über "…" → "SteamGridDB-Key…" eintragen.'
    )
    return
  }

  const missing = getStore()
    .get('entries')
    .filter((entry) => !entry.coverHash)
  if (missing.length === 0) {
    window.webContents.send('status:message', 'Alle Programme haben bereits Cover-Art.')
    return
  }

  window.webContents.send('status:message', `Suche Cover-Art für ${missing.length} Programme …`)
  const beforeHashes = new Map(missing.map((entry) => [entry.id, entry.coverHash]))

  await fetchCoverArtForNewEntries(
    missing.map((entry) => entry.id),
    (entries) => window.webContents.send('entries:changed', entries)
  )

  const found = getStore()
    .get('entries')
    .filter((entry) => beforeHashes.has(entry.id) && entry.coverHash !== beforeHashes.get(entry.id))
    .length
  window.webContents.send(
    'status:message',
    `Cover-Art für ${found} von ${missing.length} Programmen gefunden.`
  )
}

export function registerCoverArtHandlers(): void {
  ipcMain.handle('coverArt:get', () => getApiKey())

  ipcMain.handle('coverArt:set', (_event, key: string) => {
    setApiKey(key)
  })

  ipcMain.handle('coverArt:fetch', (_event, entryId: string) => fetchCoverArt(entryId))
}
