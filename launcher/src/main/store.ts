import Store from 'electron-store'
import { z } from 'zod'
import { app, dialog } from 'electron'
import { copyFileSync, existsSync, readFileSync } from 'fs'
import { basename, join } from 'path'

const EntrySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  path: z.string().min(1),
  iconHash: z.string().nullable(),
  // Große Boxart von SteamGridDB, unabhängig vom kleinen iconHash — siehe
  // coverArt.ts. Nicht gesetzt, solange niemand sie geladen hat.
  coverHash: z.string().nullable().default(null),
  // Breites Hero-Banner von SteamGridDB (wie die Kopfgrafik einer Store-Seite),
  // unabhängig vom Hochformat-coverHash — siehe coverArt.ts.
  heroHash: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  addedAt: z.number(),
  // Nur gesetzt für per Scanner importierte Steam-Spiele. Diese werden über
  // steam://rungameid/<id> gestartet, nicht direkt über einen Programmpfad.
  steamAppId: z.string().nullable().default(null),
  // Analog für Epic-Games-Titel: com.epicgames.launcher://apps/<id>?action=launch
  epicAppName: z.string().nullable().default(null),
  // Analog für Battle.net-Titel: battlenet://<code>. Der Code kommt direkt aus
  // Battle.net.config, nicht aus einer selbst gepflegten Zuordnungstabelle.
  battlenetCode: z.string().nullable().default(null),
  // Analog für Ubisoft-Connect-Titel: uplay://launch/<id>/0. Die id kommt aus
  // dem Registry-Schlüssel HKLM\...\Ubisoft\Launcher\Installs\<id>.
  ubisoftId: z.string().nullable().default(null),
  favorite: z.boolean().default(false),
  // Prozessname (z. B. "Game.exe"), auf den beim Spielzeit-Tracking gepollt wird.
  // Ohne diesen Wert kann keine Spielzeit erfasst werden (siehe playtime.ts).
  expectedProcessName: z.string().nullable().default(null),
  // Position für die manuelle Sortierung per Drag & Drop (siehe entries.ts
  // moveEntry). 0 bedeutet "noch nie zugewiesen" und wird beim ersten Start
  // nachträglich anhand von addedAt vergeben (siehe backfillOrder).
  order: z.number().default(0),
  // Kommandozeilen-Parameter, die beim direkten Start (nicht bei Steam/Epic/
  // Battle.net) an das Programm übergeben werden. Als Text statt Array
  // gespeichert, weil der Nutzer sie so eintippt — siehe entries.ts parseArgs.
  launchArgs: z.string().nullable().default(null)
})

const TagSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  // Feste Wahl statt Freitext-Farbe, damit es zur kuratierten Palette passt
  // (siehe DOT_COLORS in Sidebar.tsx). null = automatisch nach Position
  // durchrotieren, wie bisher.
  color: z.string().nullable().default(null)
})

const SessionSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  startedAt: z.number(),
  endedAt: z.number().nullable()
})

// Aufsummierte Spielzeit/Startanzahl für Sitzungen, die wegen ihres Alters aus
// `sessions` entfernt wurden (siehe playtime.ts archiveOldSessions) — ohne das
// würden Gesamtspielzeit und Start-Zähler nach dem Archivieren zurückspringen.
const SessionArchiveEntrySchema = z.object({
  totalPlayedMs: z.number(),
  launchCount: z.number()
})

// Eine gespeicherte Kombination aus Tag-Filter, Sortierung und Suchtext, die
// man mit einem Klick wieder anwenden kann, statt sie jedes Mal neu zu setzen
// (nach dem Vorbild von GOG Galaxys anpassbaren Bibliotheks-Ansichten).
const SavedViewSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  selectedTagIds: z.array(z.string()).default([]),
  tagFilterMode: z.enum(['and', 'or']).default('and'),
  unsortedOnly: z.boolean().default(false),
  sortMode: z.enum(['name', 'recent', 'playtime', 'added', 'custom']),
  searchQuery: z.string(),
  favoritesOnly: z.boolean()
})

const StoreDataSchema = z.object({
  version: z.literal(2),
  entries: z.array(EntrySchema),
  tags: z.array(TagSchema),
  sessions: z.array(SessionSchema),
  settings: z.record(z.string(), z.unknown()),
  savedViews: z.array(SavedViewSchema).default([]),
  sessionArchive: z.record(z.string(), SessionArchiveEntrySchema).default({})
})

export type Entry = z.infer<typeof EntrySchema>
export type Tag = z.infer<typeof TagSchema>
export type Session = z.infer<typeof SessionSchema>
export type SavedView = z.infer<typeof SavedViewSchema>
export type SessionArchiveEntry = z.infer<typeof SessionArchiveEntrySchema>
export type StoreData = z.infer<typeof StoreDataSchema>

const defaults: StoreData = {
  version: 2,
  entries: [],
  tags: [],
  sessions: [],
  settings: {},
  savedViews: [],
  sessionArchive: {}
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

function configFilePath(): string {
  return join(app.getPath('userData'), 'config.json')
}

function rollingBackupPath(): string {
  return `${configFilePath()}.bak`
}

// Läuft vor jedem Schreibvorgang: die zuletzt bekannte gute Fassung als .bak
// beiseitelegen. Rein bestes Bemühen — ein fehlgeschlagenes Backup darf einen
// eigentlich gültigen Schreibvorgang nicht verhindern.
function backupBeforeWrite(): void {
  try {
    const configFile = configFilePath()
    if (existsSync(configFile)) {
      copyFileSync(configFile, rollingBackupPath())
    }
  } catch {
    // Nichts zu tun — der eigentliche Schreibvorgang läuft trotzdem weiter.
  }
}

// Legt bei einer kaputten Datei ein Backup an und startet mit leeren Daten neu,
// statt den App-Start zu verhindern. Vor dem kompletten Reset erst die
// rollierende .bak-Sicherung probieren — die ist meist nur eine Änderung
// älter und rettet damit fast immer den ganzen Bestand.
export function initStore(): Store<StoreData> {
  const configFile = configFilePath()

  try {
    store = new Store<StoreData>({ defaults, clearInvalidConfig: false })
    // Setzt die komplette Datei neu (nicht nur einzelne Schlüssel), damit
    // Altlasten wie ein verwaistes `categories`-Feld nach der Migration
    // wirklich verschwinden statt liegen zu bleiben.
    store.store = parseStoreData(store.store)
  } catch (error) {
    const recovered = tryRecoverFromBackup()
    if (existsSync(configFile)) {
      copyFileSync(configFile, `${configFile}.broken-${Date.now()}.bak`)
    }
    if (recovered) {
      store = new Store<StoreData>({ defaults, clearInvalidConfig: false })
      store.store = recovered
      dialog.showMessageBox({
        type: 'warning',
        message: 'Die zuletzt gespeicherten Daten waren beschädigt.',
        detail:
          'Eine minimal ältere, funktionierende Sicherung wurde stattdessen geladen. ' +
          'Die beschädigte Datei liegt zur Kontrolle im selben Ordner.'
      })
    } else {
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
  }

  backfillExpectedProcessNames()
  backfillOrder()

  return store
}

function tryRecoverFromBackup(): StoreData | null {
  try {
    const backupFile = rollingBackupPath()
    if (!existsSync(backupFile)) return null
    return parseStoreData(JSON.parse(readFileSync(backupFile, 'utf-8')))
  } catch {
    return null
  }
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

// Einträge aus Ständen vor der manuellen Sortierung kennen `order` noch
// nicht (Default 0). Reiht sie anhand von addedAt auf, statt sie alle auf
// dieselbe Position zu setzen.
function backfillOrder(): void {
  const entries = store.get('entries')
  const needsBackfill = entries.some((e) => e.order === 0)
  if (!needsBackfill) return

  const byAddedAt = [...entries].sort((a, b) => a.addedAt - b.addedAt)
  const orderById = new Map(byAddedAt.map((e, index) => [e.id, (index + 1) * 1000]))

  setEntries(entries.map((e) => ({ ...e, order: orderById.get(e.id) ?? e.order })))
}

export function getStore(): Store<StoreData> {
  return store
}

// Liefert eine Order-Position, die garantiert hinter allen bestehenden liegt —
// zum Anhängen neu erstellter Einträge ans Ende der manuellen Sortierung.
export function nextOrder(entries: Entry[]): number {
  return entries.reduce((max, e) => Math.max(max, e.order), 0) + 1000
}

// Ersetzt die komplette Datei (z. B. beim Wiederherstellen einer Sicherung),
// statt einzelne Schlüssel zusammenzuführen.
export function replaceStoreData(data: StoreData): void {
  backupBeforeWrite()
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
  backupBeforeWrite()
  store.set('entries', parsed.data.entries)
}

export function setTags(tags: Tag[]): void {
  const draft = { ...store.store, tags }
  const parsed = StoreDataSchema.safeParse(draft)
  if (!parsed.success) {
    throw new Error(`Ungültige Tag-Daten: ${parsed.error.message}`)
  }
  backupBeforeWrite()
  store.set('tags', tags)
}

export function setSessions(sessions: Session[]): void {
  const draft = { ...store.store, sessions }
  const parsed = StoreDataSchema.safeParse(draft)
  if (!parsed.success) {
    throw new Error(`Ungültige Sitzungsdaten: ${parsed.error.message}`)
  }
  backupBeforeWrite()
  store.set('sessions', sessions)
}

export function setSettings(settings: StoreData['settings']): void {
  const draft = { ...store.store, settings }
  const parsed = StoreDataSchema.safeParse(draft)
  if (!parsed.success) {
    throw new Error(`Ungültige Einstellungsdaten: ${parsed.error.message}`)
  }
  backupBeforeWrite()
  store.set('settings', settings)
}

export function setSessionArchive(sessionArchive: StoreData['sessionArchive']): void {
  const draft = { ...store.store, sessionArchive }
  const parsed = StoreDataSchema.safeParse(draft)
  if (!parsed.success) {
    throw new Error(`Ungültige Archiv-Daten: ${parsed.error.message}`)
  }
  backupBeforeWrite()
  store.set('sessionArchive', sessionArchive)
}

export function setSavedViews(savedViews: SavedView[]): void {
  const draft = { ...store.store, savedViews }
  const parsed = StoreDataSchema.safeParse(draft)
  if (!parsed.success) {
    throw new Error(`Ungültige Ansichts-Daten: ${parsed.error.message}`)
  }
  backupBeforeWrite()
  store.set('savedViews', savedViews)
}
