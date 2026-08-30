import { ipcMain, type BrowserWindow } from 'electron'
import { getStore, setEntries, setSettings, type Entry } from './store'
import { namesLikelyMatch } from './coverArt'

interface IgdbCredentials {
  clientId: string
  clientSecret: string
}

export function getIgdbCredentials(): IgdbCredentials | null {
  const settings = getStore().get('settings')
  const clientId = typeof settings.igdbClientId === 'string' ? settings.igdbClientId.trim() : ''
  const clientSecret =
    typeof settings.igdbClientSecret === 'string' ? settings.igdbClientSecret.trim() : ''
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

export function setIgdbCredentials(clientId: string, clientSecret: string): void {
  setSettings({
    ...getStore().get('settings'),
    igdbClientId: clientId.trim(),
    igdbClientSecret: clientSecret.trim()
  })
}

export function canFetchMetadata(): boolean {
  return getIgdbCredentials() !== null
}

let cachedToken: { value: string; expiresAt: number; clientId: string } | null = null

// IGDB nutzt Twitchs OAuth-Unterbau für den Zugriffstoken (client_credentials-
// Flow) — der Token wird im Speicher zwischengehalten und kurz vor Ablauf neu
// geholt, statt bei jeder Anfrage neu angefragt zu werden. An die Client-ID
// gebunden, damit ein Wechsel der Zugangsdaten nicht den alten Token weiterverwendet.
async function getAccessToken(credentials: IgdbCredentials): Promise<string> {
  if (
    cachedToken &&
    cachedToken.clientId === credentials.clientId &&
    cachedToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedToken.value
  }
  const response = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(credentials.clientId)}&client_secret=${encodeURIComponent(credentials.clientSecret)}&grant_type=client_credentials`,
    { method: 'POST' }
  )
  if (!response.ok) {
    throw new Error('Twitch-Zugangsdaten sind ungültig.')
  }
  const body = (await response.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
    clientId: credentials.clientId
  }
  return body.access_token
}

interface IgdbGame {
  name: string
  summary?: string
  genres?: { name: string }[]
  involved_companies?: { company: { name: string }; developer: boolean }[]
  first_release_date?: number
}

async function searchIgdbGame(name: string, credentials: IgdbCredentials): Promise<IgdbGame | null> {
  const token = await getAccessToken(credentials)
  const response = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': credentials.clientId,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain'
    },
    body: `search "${name.replace(/"/g, '')}"; fields name,summary,genres.name,involved_companies.company.name,involved_companies.developer,first_release_date; limit 5;`
  })
  if (response.status === 401) {
    throw new Error('IGDB-Zugangsdaten sind ungültig.')
  }
  if (!response.ok) {
    throw new Error(`IGDB antwortete mit Fehler ${response.status}.`)
  }
  const results = (await response.json()) as IgdbGame[]
  return results.find((candidate) => namesLikelyMatch(name, candidate.name)) ?? null
}

export async function fetchMetadata(entryId: string): Promise<Entry[]> {
  const credentials = getIgdbCredentials()
  if (!credentials) {
    throw new Error('Keine IGDB-Zugangsdaten hinterlegt. Über "…" → "IGDB-Metadaten…" eintragen.')
  }
  const entry = getStore()
    .get('entries')
    .find((e) => e.id === entryId)
  if (!entry) {
    throw new Error('Eintrag wurde nicht gefunden.')
  }

  // fetch() wirft bei einem reinen Netzwerkproblem eine technische
  // "fetch failed"-Meldung ohne HTTP-Status — hier in eine verständliche
  // Meldung übersetzen, statt sie roh durchzureichen.
  let game: IgdbGame | null
  try {
    game = await searchIgdbGame(entry.name, credentials)
  } catch (error) {
    throw new Error(
      `Verbindung zu IGDB fehlgeschlagen (${error instanceof Error ? error.message : String(error)}).`
    )
  }
  if (!game) {
    throw new Error(`Kein IGDB-Eintrag für "${entry.name}" gefunden.`)
  }

  const developer =
    game.involved_companies?.find((c) => c.developer)?.company.name ??
    game.involved_companies?.[0]?.company.name ??
    null
  const genre = game.genres?.[0]?.name ?? null
  const releaseYear = game.first_release_date
    ? new Date(game.first_release_date * 1000).getUTCFullYear()
    : null
  const description = game.summary?.trim() || null

  // Erst jetzt, nach dem langsamen Netzwerk-Aufruf, den aktuellsten Stand
  // lesen und schreiben — sonst überschreiben sich mehrere gleichzeitig
  // angestoßene Abrufe gegenseitig.
  const latest = getStore().get('entries')
  const updated = latest.map((e) =>
    e.id === entryId ? { ...e, description, genre, developer, releaseYear } : e
  )
  setEntries(updated)
  return updated
}

// Läuft nach dem Hinzufügen neuer Einträge automatisch im Hintergrund, analog
// zu fetchCoverArtForNewEntries — bleibt ganz ohne Wirkung, solange keine
// IGDB-Zugangsdaten hinterlegt sind (siehe canFetchMetadata).
export async function fetchMetadataForNewEntries(
  entryIds: string[],
  onUpdate: (entries: Entry[]) => void
): Promise<void> {
  if (!canFetchMetadata()) return
  for (const entryId of entryIds) {
    try {
      onUpdate(await fetchMetadata(entryId))
    } catch {
      // Kein Treffer, kein Netzwerk, ungültige Zugangsdaten etc. — beim
      // automatischen Nachladen einfach überspringen statt eine Fehlermeldung zu zeigen.
    }
  }
}

async function fetchMetadataForIdsWithStatus(window: BrowserWindow, ids: string[]): Promise<void> {
  window.webContents.send('status:message', `Suche Metadaten für ${ids.length} Programme …`)
  const before = new Map(
    getStore()
      .get('entries')
      .filter((entry) => ids.includes(entry.id))
      .map((entry) => [entry.id, entry.description])
  )

  await fetchMetadataForNewEntries(ids, (entries) =>
    window.webContents.send('entries:changed', entries)
  )

  const found = getStore()
    .get('entries')
    .filter((entry) => before.has(entry.id) && entry.description !== before.get(entry.id)).length
  window.webContents.send('status:message', `Metadaten für ${found} von ${ids.length} Programmen gefunden.`)
}

export async function fetchMissingMetadataForAll(window: BrowserWindow): Promise<void> {
  if (!canFetchMetadata()) {
    window.webContents.send(
      'status:message',
      'Keine IGDB-Zugangsdaten hinterlegt. Über "…" → "IGDB-Metadaten…" eintragen.'
    )
    return
  }

  const missingIds = getStore()
    .get('entries')
    .filter((entry) => !entry.description)
    .map((entry) => entry.id)
  if (missingIds.length === 0) {
    window.webContents.send('status:message', 'Alle Programme haben bereits Metadaten.')
    return
  }

  await fetchMetadataForIdsWithStatus(window, missingIds)
}

export function registerMetadataHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('metadata:get', () => getIgdbCredentials())

  ipcMain.handle('metadata:set', (_event, clientId: string, clientSecret: string) => {
    setIgdbCredentials(clientId, clientSecret)
  })

  ipcMain.handle('metadata:fetch', (_event, entryId: string) => fetchMetadata(entryId))

  ipcMain.handle('metadata:fetchAllMissing', async () => {
    const window = getWindow()
    if (!window) return
    await fetchMissingMetadataForAll(window)
  })
}
