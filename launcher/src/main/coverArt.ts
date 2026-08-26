import { ipcMain, nativeImage } from 'electron'
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

  const entries = getStore().get('entries')
  const entry = entries.find((e) => e.id === entryId)
  if (!entry) {
    throw new Error('Eintrag wurde nicht gefunden.')
  }

  const gameId = await searchGameId(entry.name, apiKey)
  if (!gameId) {
    throw new Error(`Kein SteamGridDB-Eintrag für "${entry.name}" gefunden.`)
  }
  const gridUrl = await fetchGridUrl(gameId, apiKey)
  if (!gridUrl) {
    throw new Error(`Für "${entry.name}" gibt es dort kein Cover-Bild.`)
  }

  const newHash = await downloadAndCache(entryId, gridUrl)
  const oldHash = entry.coverHash
  const updated = entries.map((e) => (e.id === entryId ? { ...e, coverHash: newHash } : e))
  setEntries(updated)

  const oldHashStillUsed = oldHash !== null && updated.some((e) => e.coverHash === oldHash)
  if (oldHash && !oldHashStillUsed) {
    await removeCachedIcon(oldHash)
  }

  return updated
}

export function registerCoverArtHandlers(): void {
  ipcMain.handle('coverArt:get', () => getApiKey())

  ipcMain.handle('coverArt:set', (_event, key: string) => {
    setApiKey(key)
  })

  ipcMain.handle('coverArt:fetch', (_event, entryId: string) => fetchCoverArt(entryId))
}
