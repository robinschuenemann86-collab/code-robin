import Store from 'electron-store'
import { z } from 'zod'
import { app, dialog } from 'electron'
import { copyFileSync, existsSync } from 'fs'
import { basename, join } from 'path'

const EntrySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  path: z.string().min(1),
  iconHash: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  addedAt: z.number(),
  // Nur gesetzt für per Scanner importierte Steam-Spiele. Diese werden über
  // steam://rungameid/<id> gestartet, nicht direkt über einen Programmpfad.
  steamAppId: z.string().nullable().default(null),
  // Analog für Epic-Games-Titel: com.epicgames.launcher://apps/<id>?action=launch
  epicAppName: z.string().nullable().default(null),
  favorite: z.boolean().default(false),
  // Prozessname (z. B. "Game.exe"), auf den beim Spielzeit-Tracking gepollt wird.
  // Ohne diesen Wert kann keine Spielzeit erfasst werden (siehe playtime.ts).
  expectedProcessName: z.string().nullable().default(null)
})

const TagSchema = z.object({
  id: z.string(),
  name: z.string().min(1)
})

const SessionSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  startedAt: z.number(),
  endedAt: z.number().nullable()
})

const StoreDataSchema = z.object({
  version: z.literal(2),
  entries: z.array(EntrySchema),
  tags: z.array(TagSchema),
  sessions: z.array(SessionSchema),
  settings: z.record(z.string(), z.unknown())
})

export type Entry = z.infer<typeof EntrySchema>
export type Tag = z.infer<typeof TagSchema>
export type Session = z.infer<typeof SessionSchema>
export type StoreData = z.infer<typeof StoreDataSchema>

const defaults: StoreData = {
  version: 2,
  entries: [],
  tags: [],
  sessions: [],
  settings: {}
}

// Stand vor Tags: Einträge hatten ein einzelnes `category`-Feld, Kategorien
// lagen unter dem Schlüssel `categories`. Wird nur einmal beim ersten Start
// nach dem Update durchlaufen (danach steht schon version: 2 in der Datei).
function migrateToV2(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw.version === 2) return raw

  const oldTags = Array.isArray(raw.categories) ? raw.categories : []
  const oldEntries = Array.isArray(raw.entries) ? raw.entries : []

  return {
    ...raw,
    version: 2,
    tags: oldTags,
    entries: oldEntries.map((entry: Record<string, unknown>) => {
      const { category, ...rest } = entry
      return { ...rest, tags: typeof category === 'string' && category ? [category] : [] }
    })
  }
}

// Wandelt rohe (evtl. veraltete oder aus einer Sicherung stammende) Daten in
// einen gültigen, aktuellen Datenbestand um. Wirft, wenn das auch nach der
// Migration nicht gelingt — von initStore() und vom Backup-Import genutzt.
export function parseStoreData(raw: unknown): StoreData {
  const migrated = migrateToV2(raw as Record<string, unknown>)
  const parsed = StoreDataSchema.safeParse(migrated)
  if (!parsed.success) {
    throw new Error(parsed.error.message)
  }
  return parsed.data
}

let store: Store<StoreData>

// Legt bei einer kaputten Datei ein Backup an und startet mit leeren Daten neu,
// statt den App-Start zu verhindern.
export function initStore(): Store<StoreData> {
  const configFile = join(app.getPath('userData'), 'config.json')

  try {
    store = new Store<StoreData>({ defaults, clearInvalidConfig: false })
    // Setzt die komplette Datei neu (nicht nur einzelne Schlüssel), damit
    // Altlasten wie ein verwaistes `categories`-Feld nach der Migration
    // wirklich verschwinden statt liegen zu bleiben.
    store.store = parseStoreData(store.store)
  } catch (error) {
    if (existsSync(configFile)) {
      copyFileSync(configFile, `${configFile}.broken-${Date.now()}.bak`)
    }
    store = new Store<StoreData>({ defaults, clearInvalidConfig: true })
    store.clear()
    store.set(defaults)
    dialog.showErrorBox(
      'Datendatei zurückgesetzt',
      'Die gespeicherten Daten waren beschädigt und wurden durch eine leere Liste ersetzt. ' +
        'Ein Backup der alten Datei liegt im selben Ordner.\n\n' +
        `Fehler: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  backfillExpectedProcessNames()

  return store
}

// Einträge aus Ständen vor der Spielzeit-Erfassung kennen expectedProcessName
// noch nicht. Für direkt gestartete Programme (kein Steam/Epic) lässt sich das
// gefahrlos aus dem gespeicherten Pfad nachtragen.
function backfillExpectedProcessNames(): void {
  const entries = store.get('entries')
  const needsBackfill = entries.some(
    (e) => !e.expectedProcessName && !e.steamAppId && !e.epicAppName
  )
  if (!needsBackfill) return

  setEntries(
    entries.map((e) =>
      !e.expectedProcessName && !e.steamAppId && !e.epicAppName
        ? { ...e, expectedProcessName: basename(e.path) }
        : e
    )
  )
}

export function getStore(): Store<StoreData> {
  return store
}

// Ersetzt die komplette Datei (z. B. beim Wiederherstellen einer Sicherung),
// statt einzelne Schlüssel zusammenzuführen.
export function replaceStoreData(data: StoreData): void {
  store.store = data
}

// Schreibt nur, wenn das Ergebnis dem Schema entspricht — verhindert eine kaputte Datei.
// Persistiert parsed.data (nicht den rohen Entwurf), damit fehlende, aber mit
// .default() versehene Felder älterer Einträge beim nächsten Schreiben ergänzt werden.
export function setEntries(entries: Entry[]): void {
  const draft = { ...store.store, entries }
  const parsed = StoreDataSchema.safeParse(draft)
  if (!parsed.success) {
    throw new Error(`Ungültige Eintragsdaten: ${parsed.error.message}`)
  }
  store.set('entries', parsed.data.entries)
}

export function setTags(tags: Tag[]): void {
  const draft = { ...store.store, tags }
  const parsed = StoreDataSchema.safeParse(draft)
  if (!parsed.success) {
    throw new Error(`Ungültige Tag-Daten: ${parsed.error.message}`)
  }
  store.set('tags', tags)
}

export function setSessions(sessions: Session[]): void {
  const draft = { ...store.store, sessions }
  const parsed = StoreDataSchema.safeParse(draft)
  if (!parsed.success) {
    throw new Error(`Ungültige Sitzungsdaten: ${parsed.error.message}`)
  }
  store.set('sessions', sessions)
}
