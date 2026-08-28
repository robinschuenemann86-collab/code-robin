import { ipcMain, nativeImage, type BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { getStore, setEntries, setSettings, type Entry } from './store'
import { hashPath, iconFilePath, removeCachedIcon } from './icons'

const DIRECT_API_BASE = 'https://www.steamgriddb.com/api/v2'

// Zur Build-Zeit fest eingebackene Adresse eines eigenen Proxys (siehe
// metadata-proxy/ und electron.vite.config.ts) — hält den echten SteamGridDB-
// Key serverseitig, damit nicht jeder Nutzer selbst einen anlegen muss. Ohne
// gesetzten Proxy (leerer String im Build) bleibt alles wie zuvor: jeder
// trägt seinen eigenen, kostenlosen Key ein.
const METADATA_PROXY_URL = process.env.METADATA_PROXY_URL || null

interface SteamGridDbSearchResult {
  success: boolean
  data?: { id: number; name: string }[]
}

interface SteamGridDbGridsResult {
  success: boolean
  data?: { url: string }[]
}

interface SteamGridDbHeroesResult {
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

// true, wenn Cover-Art überhaupt möglich ist — entweder über einen eigenen
// Key oder über den eingebauten Proxy.
export function canFetchCoverArt(): boolean {
  return getApiKey() !== null || METADATA_PROXY_URL !== null
}

// Für den Hinweistext im Key-Dialog: ist ein Proxy eingebacken, ist ein
// eigener Key nur noch optional (höhere Ratenlimits), nicht mehr nötig.
export function hasProxyConfigured(): boolean {
  return METADATA_PROXY_URL !== null
}

// Ein eigener, eingetragener Key hat immer Vorrang vor dem Proxy (z. B. für
// höhere Ratenlimits) — ist keiner gesetzt, aber ein Proxy eingebacken, läuft
// die Anfrage dort durch, ganz ohne dass die App einen Key kennt.
async function callSteamGridDb(path: string, apiKey: string | null): Promise<Response> {
  if (apiKey) {
    return fetch(`${DIRECT_API_BASE}${path}`, { headers: { Authorization: `Bearer ${apiKey}` } })
  }
  if (METADATA_PROXY_URL) {
    return fetch(`${METADATA_PROXY_URL}${path}`)
  }
  throw new Error('Kein SteamGridDB-Key hinterlegt und kein Proxy konfiguriert.')
}

async function searchGameId(name: string, apiKey: string | null): Promise<number | null> {
  const response = await callSteamGridDb(`/search/autocomplete/${encodeURIComponent(name)}`, apiKey)
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
async function fetchGridUrl(gameId: number, apiKey: string | null): Promise<string | null> {
  const response = await callSteamGridDb(
    `/grids/game/${gameId}?dimensions=600x900&nsfw=false&humor=false`,
    apiKey
  )
  if (!response.ok) {
    throw new Error(`SteamGridDB antwortete mit Fehler ${response.status}.`)
  }
  const body = (await response.json()) as SteamGridDbGridsResult
  return body.data?.[0]?.url ?? null
}

// Breites Kopfbild (wie die Hero-Grafik einer Store-Seite) — anders als das
// Grid-Cover nicht für jedes Spiel verfügbar, deshalb hier bewusst kein Fehler
// bei einer leeren Antwort, nur null (siehe fetchCoverArt: optional).
async function fetchHeroUrl(gameId: number, apiKey: string | null): Promise<string | null> {
  const response = await callSteamGridDb(`/heroes/game/${gameId}?nsfw=false&humor=false`, apiKey)
  if (!response.ok) {
    throw new Error(`SteamGridDB antwortete mit Fehler ${response.status}.`)
  }
  const body = (await response.json()) as SteamGridDbHeroesResult
  return body.data?.[0]?.url ?? null
}

// Neuer, bisher unbenutzter Hash statt eines pfadbasierten — sonst würde der
// Renderer über den identischen launcher-icon://<hash>-Link weiter das alte
// Bild aus dem Cache zeigen, obwohl dahinter eine neue Datei liegt.
async function downloadAndCache(entryId: string, imageUrl: string, kind: string): Promise<string> {
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error('Bild konnte nicht heruntergeladen werden.')
  }
  const buffer = Buffer.from(await imageResponse.arrayBuffer())
  const image = nativeImage.createFromBuffer(buffer)
  if (image.isEmpty()) {
    throw new Error('Heruntergeladenes Bild war ungültig.')
  }
  const hash = hashPath(`${kind}:${entryId}:${Date.now()}`)
  await fs.writeFile(iconFilePath(hash), image.toPNG())
  return hash
}

export async function fetchCoverArt(entryId: string): Promise<Entry[]> {
  const apiKey = getApiKey()
  if (!apiKey && !METADATA_PROXY_URL) {
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

  let newCoverHash: string
  try {
    newCoverHash = await downloadAndCache(entryId, gridUrl, 'cover')
  } catch (error) {
    throw new Error(
      `Cover-Bild konnte nicht geladen werden (${error instanceof Error ? error.message : String(error)}).`
    )
  }

  // Das breite Hero-Banner ist ein Extra, kein für alle Spiele verfügbares
  // Pflichtbild wie das Grid-Cover — ein Fehlschlag hier lässt den Rest der
  // Cover-Art-Suche nicht scheitern, heroHash bleibt dann einfach null.
  let newHeroHash: string | null = null
  try {
    const heroUrl = await fetchHeroUrl(gameId, apiKey)
    if (heroUrl) newHeroHash = await downloadAndCache(entryId, heroUrl, 'hero')
  } catch {
    // Kein Hero-Bild verfügbar oder Download fehlgeschlagen — ignorieren.
  }

  // Erst jetzt, nach den langsamen Netzwerk-Aufrufen, den aktuellsten Stand
  // lesen und schreiben — sonst überschreiben sich mehrere gleichzeitig
  // angestoßene Abrufe gegenseitig (wer zuletzt fertig ist, gewinnt und
  // verwirft die Treffer aller anderen, obwohl die erfolgreich waren).
  const latest = getStore().get('entries')
  const oldCoverHash = latest.find((e) => e.id === entryId)?.coverHash ?? null
  const oldHeroHash = latest.find((e) => e.id === entryId)?.heroHash ?? null
  const updated = latest.map((e) =>
    e.id === entryId
      ? { ...e, coverHash: newCoverHash, heroHash: newHeroHash ?? e.heroHash }
      : e
  )
  setEntries(updated)

  const oldCoverStillUsed =
    oldCoverHash !== null && updated.some((e) => e.coverHash === oldCoverHash)
  if (oldCoverHash && !oldCoverStillUsed) {
    await removeCachedIcon(oldCoverHash)
  }
  const oldHeroStillUsed =
    newHeroHash !== null && oldHeroHash !== null && updated.some((e) => e.heroHash === oldHeroHash)
  if (newHeroHash && oldHeroHash && !oldHeroStillUsed) {
    await removeCachedIcon(oldHeroHash)
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
  if (!canFetchCoverArt()) return
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
  if (!canFetchCoverArt()) {
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
  ipcMain.handle('coverArt:hasProxy', () => hasProxyConfigured())
}
