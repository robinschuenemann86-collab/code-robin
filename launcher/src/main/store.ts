import Store from 'electron-store'
import { z } from 'zod'
import { app, dialog } from 'electron'
import { copyFileSync, existsSync } from 'fs'
import { join } from 'path'

const EntrySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  path: z.string().min(1),
  iconHash: z.string().nullable(),
  category: z.string(),
  addedAt: z.number(),
  // Nur gesetzt für per Scanner importierte Steam-Spiele. Diese werden über
  // steam://rungameid/<id> gestartet, nicht direkt über einen Programmpfad.
  steamAppId: z.string().nullable().default(null)
})

const CategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1)
})

const StoreDataSchema = z.object({
  version: z.literal(1),
  entries: z.array(EntrySchema),
  categories: z.array(CategorySchema),
  sessions: z.array(z.unknown()),
  settings: z.record(z.string(), z.unknown())
})

export type Entry = z.infer<typeof EntrySchema>
export type Category = z.infer<typeof CategorySchema>
export type StoreData = z.infer<typeof StoreDataSchema>

const defaults: StoreData = {
  version: 1,
  entries: [],
  categories: [],
  sessions: [],
  settings: {}
}

let store: Store<StoreData>

// Legt bei einer kaputten Datei ein Backup an und startet mit leeren Daten neu,
// statt den App-Start zu verhindern.
export function initStore(): Store<StoreData> {
  const configFile = join(app.getPath('userData'), 'config.json')

  try {
    store = new Store<StoreData>({ defaults, clearInvalidConfig: false })
    const parsed = StoreDataSchema.safeParse(store.store)
    if (!parsed.success) {
      throw new Error(parsed.error.message)
    }
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

  return store
}

export function getStore(): Store<StoreData> {
  return store
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

export function setCategories(categories: Category[]): void {
  const draft = { ...store.store, categories }
  const parsed = StoreDataSchema.safeParse(draft)
  if (!parsed.success) {
    throw new Error(`Ungültige Kategoriedaten: ${parsed.error.message}`)
  }
  store.set('categories', categories)
}
