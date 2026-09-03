import { dialog, ipcMain, nativeImage, type BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { getStore, setEntries, setSettings, type Entry } from './store'
import { hashPath, iconFilePath, removeCachedIcon, setCustomIcon } from './icons'
// Adresse des eigenen Proxys (siehe src/main/config.ts und metadata-proxy/) —
// hält den echten SteamGridDB-Key serverseitig, damit nicht jeder Nutzer selbst
// einen anlegen muss. Ist kein Proxy konfiguriert, bleibt alles wie zuvor:
// jeder trägt seinen eigenen, kostenlosen Key ein.
import { METADATA_PROXY_URL } from './config'

const DIRECT_API_BASE = 'https://www.steamgriddb.com/api/v2'

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

const MATCH_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'of',
  'and',
  'edition',
  'remastered',
  'goty',
  'definitive'
])

function significantWords(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[™®©]/g, '')
      // Genitiv-Endung zuerst entfernen: sonst zerfällt "Sid Meier's" in
      // "meier" + "s", und dieses bedeutungslose "s" zählt als eigenes Wort
      // gegen die Übereinstimmung.
      .replace(/['’`]s\b/g, '')
      .replace(/['’`]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      // length > 0 statt > 1 — sonst fallen einstellige Fortsetzungsnummern
      // ("Portal 2", "Half-Life 2") raus, obwohl die gerade entscheidend sind.
      .filter((word) => word.length > 0 && !MATCH_STOPWORDS.has(word))
  )
}

// Ein einzelnes, langes gemeinsames Wort reicht nicht als Beleg für einen
// Treffer — sonst würde z. B. "UTW Beginnings" auf ein unverwandtes "Bigger
// Beginnings" passen, nur weil beide "beginnings" enthalten. Verlangt
// stattdessen eine Mehrheits-Übereinstimmung der bedeutungstragenden Wörter
// in beide Richtungen (Jaccard-Ähnlichkeit).
export function namesLikelyMatch(searched: string, candidate: string): boolean {
  const a = significantWords(searched)
  const b = significantWords(candidate)
  if (a.size === 0 || b.size === 0) return true
  const intersection = [...a].filter((word) => b.has(word)).length
  const union = new Set([...a, ...b]).size
  if (intersection / union >= 0.5) return true

  // Zusätzlich gilt als Treffer, wenn der kürzere Name vollständig im längeren
  // steckt: Launcher führen Spiele oft mit Herausgeber-Vorsatz ("Tom Clancy's
  // The Division 2"), während sie in der Cover-Datenbank unter dem kurzen Namen
  // stehen. Rein anteilig gerechnet fallen solche Paare knapp durch, obwohl es
  // dasselbe Spiel ist. Erst ab zwei Wörtern, damit ein einzelnes gemeinsames
  // Wort nicht reicht (siehe "Bigger Beginnings" oben).
  const shorter = a.size <= b.size ? a : b
  if (shorter.size >= 2 && intersection === shorter.size) return true

  // Letzter Weg: fast identische Schreibweise. Die Suche von SteamGridDB
  // verzeiht Tippfehler und liefert dann den richtigen Titel — ein reiner
  // Wortvergleich verwirft ihn aber, weil "sumble" und "stumble" zwei
  // verschiedene Wörter sind. Enthaltene Zahlen müssen exakt übereinstimmen,
  // sonst würde hier "Far Cry 5" auf "Far Cry 3" passen.
  return charactersNearlyEqual(searched, candidate)
}

function normalizeForCompare(name: string): string {
  return name
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function digitGroups(name: string): string {
  return (name.match(/\d+/g) ?? []).join(',')
}

// Levenshtein-Distanz: wie viele einzelne Zeichen müssen geändert werden, um
// von einem Text zum anderen zu kommen. Bewusst selbst geschrieben statt als
// Abhängigkeit — es sind ein paar Zeilen und das Projekt kommt ohne
// Fremdbibliotheken aus.
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    previous = current
  }
  return previous[b.length]
}

function charactersNearlyEqual(searched: string, candidate: string): boolean {
  const a = normalizeForCompare(searched)
  const b = normalizeForCompare(candidate)
  if (!a || !b) return false
  if (digitGroups(a) !== digitGroups(b)) return false
  const longest = Math.max(a.length, b.length)
  // Sehr kurze Namen sind zu leicht zu verwechseln ("Rust"/"Rust").
  if (longest < 6) return false
  return 1 - editDistance(a, b) / longest >= 0.85
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
  // Nicht blind den ersten Treffer nehmen — SteamGridDBs Rangfolge bleibt
  // maßgeblich, aber ein Treffer, dessen Name kaum etwas mit dem gesuchten
  // Namen zu tun hat, wird übersprungen statt falsche Cover-Art zu laden.
  const match = body.data?.find((candidate) => namesLikelyMatch(name, candidate.name))
  return match?.id ?? null
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

// searchName erlaubt es, unter einem abweichenden Titel zu suchen: manche
// Spiele heißen in der Cover-Datenbank schlicht anders ("PUBG" statt
// "PLAYERUNKNOWN'S BATTLEGROUNDS", englische statt deutscher Titel), und
// manuell hinzugefügte Programme tragen oft nur ihren Dateinamen.
export async function fetchCoverArt(entryId: string, searchName?: string): Promise<Entry[]> {
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

  const nameToSearch = searchName?.trim() || entry.name

  // fetch() wirft bei einem reinen Netzwerkproblem (kein DNS, Firewall,
  // Timeout) eine technische "fetch failed"-Meldung ohne HTTP-Status — hier
  // in eine verständliche Meldung übersetzen, statt sie roh durchzureichen.
  let gameId: number | null
  let gridUrl: string | null
  try {
    gameId = await searchGameId(nameToSearch, apiKey)
  } catch (error) {
    throw new Error(
      `Verbindung zu SteamGridDB fehlgeschlagen (${error instanceof Error ? error.message : String(error)}).`
    )
  }
  if (!gameId) {
    throw new Error(`Kein SteamGridDB-Eintrag für "${nameToSearch}" gefunden.`)
  }
  try {
    gridUrl = await fetchGridUrl(gameId, apiKey)
  } catch (error) {
    throw new Error(
      `Verbindung zu SteamGridDB fehlgeschlagen (${error instanceof Error ? error.message : String(error)}).`
    )
  }
  if (!gridUrl) {
    throw new Error(`Für "${nameToSearch}" gibt es dort kein Cover-Bild.`)
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

// Gemeinsamer Kern für "alle fehlenden nachladen" und "für Auswahl laden" —
// beide unterscheiden sich nur darin, welche ids sie übergeben.
async function fetchCoverArtForIdsWithStatus(window: BrowserWindow, ids: string[]): Promise<void> {
  window.webContents.send('status:message', `Suche Cover-Art für ${ids.length} Programme …`)
  const beforeHashes = new Map(
    getStore()
      .get('entries')
      .filter((entry) => ids.includes(entry.id))
      .map((entry) => [entry.id, entry.coverHash])
  )

  await fetchCoverArtForNewEntries(ids, (entries) =>
    window.webContents.send('entries:changed', entries)
  )

  const found = getStore()
    .get('entries')
    .filter((entry) => beforeHashes.has(entry.id) && entry.coverHash !== beforeHashes.get(entry.id))
    .length
  window.webContents.send('status:message', `Cover-Art für ${found} von ${ids.length} Programmen gefunden.`)
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

  const missingIds = getStore()
    .get('entries')
    .filter((entry) => !entry.coverHash)
    .map((entry) => entry.id)
  if (missingIds.length === 0) {
    window.webContents.send('status:message', 'Alle Programme haben bereits Cover-Art.')
    return
  }

  await fetchCoverArtForIdsWithStatus(window, missingIds)
}

// Analog, aber gezielt für eine per Mehrfachauswahl übergebene Liste, statt
// immer gleich die ganze Bibliothek nach fehlenden Covern zu durchsuchen.
export async function fetchCoverArtForSelected(window: BrowserWindow, ids: string[]): Promise<void> {
  if (!canFetchCoverArt()) {
    window.webContents.send(
      'status:message',
      'Kein SteamGridDB-Key hinterlegt. Über "…" → "SteamGridDB-Key…" eintragen.'
    )
    return
  }
  if (ids.length === 0) return

  await fetchCoverArtForIdsWithStatus(window, ids)
}

// Letzte Rettung, wenn es in der Datenbank schlicht kein passendes Bild gibt:
// ein selbst gewähltes Bild als Cover setzen. Das Bild wird über nativeImage
// eingelesen und als PNG neu geschrieben — es landet also nie eine unbesehene
// Fremddatei im Cache.
export async function pickCustomCover(window: BrowserWindow, entryId: string): Promise<Entry[]> {
  const entries = getStore().get('entries')
  const entry = entries.find((e) => e.id === entryId)
  if (!entry) {
    throw new Error('Eintrag wurde nicht gefunden.')
  }

  const result = await dialog.showOpenDialog(window, {
    title: 'Cover-Bild auswählen',
    properties: ['openFile'],
    filters: [{ name: 'Bilder', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return entries

  const newHash = await setCustomIcon(entryId, result.filePaths[0])
  if (!newHash) {
    throw new Error('Das Bild konnte nicht gelesen werden.')
  }

  const oldHash = entry.coverHash
  const latest = getStore().get('entries')
  const updated = latest.map((e) => (e.id === entryId ? { ...e, coverHash: newHash } : e))
  setEntries(updated)

  // Altes Bild nur löschen, wenn es wirklich nirgends mehr verwendet wird —
  // dieselbe Datei kann auch als Icon oder Hintergrundbild eines anderen
  // Eintrags dienen.
  const stillUsed = updated.some(
    (e) => e.coverHash === oldHash || e.iconHash === oldHash || e.heroHash === oldHash
  )
  if (oldHash && !stillUsed) {
    await removeCachedIcon(oldHash)
  }

  return updated
}

export function registerCoverArtHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('coverArt:get', () => getApiKey())

  ipcMain.handle('coverArt:set', (_event, key: string) => {
    setApiKey(key)
  })

  ipcMain.handle('coverArt:fetch', (_event, entryId: string, searchName?: string) =>
    fetchCoverArt(entryId, searchName)
  )

  ipcMain.handle('coverArt:pickCustom', (_event, entryId: string) => {
    const window = getWindow()
    if (!window) {
      throw new Error('Kein Fenster verfügbar.')
    }
    return pickCustomCover(window, entryId)
  })
  ipcMain.handle('coverArt:hasProxy', () => hasProxyConfigured())
  ipcMain.handle('coverArt:fetchAllMissing', async () => {
    const window = getWindow()
    if (!window) return
    await fetchMissingCoverArtForAll(window)
  })
  ipcMain.handle('coverArt:fetchForSelected', async (_event, ids: string[]) => {
    const window = getWindow()
    if (!window) return
    await fetchCoverArtForSelected(window, ids)
  })
}
