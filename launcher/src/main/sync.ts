import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { getStore, setEntries, setSettings, setTags, type Entry, type Tag } from './store'

// Derselbe Worker wie für den Cover-Art-Proxy (siehe coverArt.ts) — bewusst
// keine zweite Umgebungsvariable, um die Einrichtung nicht zu verkomplizieren.
const SYNC_BASE_URL = process.env.METADATA_PROXY_URL || null

interface SyncEntry {
  matchKey: string
  favorite: boolean
  rating: number
  tagNames: string[]
}

interface SyncPayload {
  updatedAt: number
  tags: { name: string; color: string | null }[]
  entries: SyncEntry[]
}

// Stabiler Schlüssel über PCs hinweg: Store-interne ids sind pro Rechner neu
// vergeben, aber eine Steam-/Epic-/Battle.net-/Ubisoft-Kennung oder der Name
// bleiben gleich. Bewusst kein automatisches Anlegen neuer Einträge daraus —
// nur bereits auf beiden PCs vorhandene Programme werden angereichert.
function matchKeyFor(entry: Entry): string {
  if (entry.steamAppId) return `steam:${entry.steamAppId}`
  if (entry.epicAppName) return `epic:${entry.epicAppName}`
  if (entry.battlenetCode) return `battlenet:${entry.battlenetCode}`
  if (entry.ubisoftId) return `ubisoft:${entry.ubisoftId}`
  return `name:${entry.name.trim().toLowerCase()}`
}

export function getSyncCode(): string | null {
  const value = getStore().get('settings').syncCode
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function setSyncCode(code: string | null): void {
  setSettings({ ...getStore().get('settings'), syncCode: code })
}

function buildPayload(): SyncPayload {
  const entries = getStore().get('entries')
  const tags = getStore().get('tags')
  const tagNameById = new Map(tags.map((t) => [t.id, t.name]))

  return {
    updatedAt: Date.now(),
    tags: tags.map((t) => ({ name: t.name, color: t.color })),
    entries: entries.map((entry) => ({
      matchKey: matchKeyFor(entry),
      favorite: entry.favorite,
      rating: entry.rating,
      tagNames: entry.tags.map((id) => tagNameById.get(id)).filter((n): n is string => !!n)
    }))
  }
}

// Führt entfernte Daten additiv über die lokalen: Favorit wird nie entfernt,
// nur gesetzt; Bewertung nimmt den höheren Wert; Tags werden vereinigt statt
// ersetzt. So kann ein Abgleich nie versehentlich etwas löschen, das ein PC
// bereits kennt — nur "aufwerten".
function applyPayload(remote: SyncPayload): { entries: Entry[]; tags: Tag[] } {
  let tags = getStore().get('tags')
  const tagIdByName = new Map(tags.map((t) => [t.name.toLowerCase(), t.id]))

  for (const remoteTag of remote.tags) {
    const key = remoteTag.name.toLowerCase()
    if (tagIdByName.has(key)) continue
    const newTag: Tag = {
      id: randomUUID(),
      name: remoteTag.name,
      color: remoteTag.color
    }
    tags = [...tags, newTag]
    tagIdByName.set(key, newTag.id)
  }

  const localEntries = getStore().get('entries')

  // Ohne Plattform-Kennung (Steam/Epic/Battle.net/Ubisoft) ist der Name der
  // einzige Anhaltspunkt — teilen sich lokal mehrere Einträge denselben
  // Namen, ist nicht eindeutig, wem entfernte Daten gehören. Für solche
  // mehrdeutigen Schlüssel lieber gar nicht mergen, statt sie versehentlich
  // dem falschen Programm zuzuordnen.
  const localKeyCounts = new Map<string, number>()
  for (const entry of localEntries) {
    const key = matchKeyFor(entry)
    localKeyCounts.set(key, (localKeyCounts.get(key) ?? 0) + 1)
  }

  const remoteByMatchKey = new Map(remote.entries.map((e) => [e.matchKey, e]))
  const entries = localEntries.map((entry) => {
    const key = matchKeyFor(entry)
    if ((localKeyCounts.get(key) ?? 0) > 1) return entry
    const remoteEntry = remoteByMatchKey.get(key)
    if (!remoteEntry) return entry

    const remoteTagIds = remoteEntry.tagNames
      .map((name) => tagIdByName.get(name.toLowerCase()))
      .filter((id): id is string => !!id)

    return {
      ...entry,
      favorite: entry.favorite || remoteEntry.favorite,
      rating: Math.max(entry.rating, remoteEntry.rating),
      tags: [...new Set([...entry.tags, ...remoteTagIds])]
    }
  })

  return { entries, tags }
}

export interface SyncResult {
  ok: boolean
  message: string
  entries?: Entry[]
  tags?: Tag[]
}

export async function syncNow(): Promise<SyncResult> {
  if (!SYNC_BASE_URL) {
    return { ok: false, message: 'Kein Cover-Art-Proxy eingerichtet — der Abgleich braucht denselben Dienst.' }
  }
  const code = getSyncCode()
  if (!code) {
    return { ok: false, message: 'Bitte zuerst einen Abgleich-Code eintragen.' }
  }

  try {
    const getResponse = await fetch(`${SYNC_BASE_URL}/sync/${code}`)
    if (!getResponse.ok) {
      return { ok: false, message: `Abruf fehlgeschlagen (${getResponse.status}).` }
    }
    const remote = (await getResponse.json()) as SyncPayload | null

    let entries = getStore().get('entries')
    let tags = getStore().get('tags')
    if (remote) {
      const merged = applyPayload(remote)
      entries = merged.entries
      tags = merged.tags
      setTags(tags)
      setEntries(entries)
    }

    const payload = buildPayload()
    const postResponse = await fetch(`${SYNC_BASE_URL}/sync/${code}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!postResponse.ok) {
      return { ok: false, message: `Hochladen fehlgeschlagen (${postResponse.status}).`, entries, tags }
    }

    return { ok: true, message: 'Abgeglichen.', entries, tags }
  } catch (error) {
    return {
      ok: false,
      message: `Abgleich fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

export function registerSyncHandlers(): void {
  ipcMain.handle('sync:getCode', () => getSyncCode())
  ipcMain.handle('sync:setCode', (_event, code: string | null) => setSyncCode(code))
  ipcMain.handle('sync:now', () => syncNow())
}
