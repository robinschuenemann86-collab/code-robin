import { app, dialog, type BrowserWindow } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { readdir, readFile, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { getStore, parseStoreData, replaceStoreData, type Entry, type StoreData } from './store'
import { iconFilePath } from './icons'

interface BackupFile {
  data: StoreData
  // hash -> Base64-PNG. Ohne das zeigt eine Sicherung nach dem Wiederherstellen
  // (z. B. auf einem anderen PC oder nach geleertem Cache-Ordner) nur noch
  // Platzhalter, obwohl iconHash/coverHash in den Einträgen selbst intakt sind.
  icons: Record<string, string>
}

function collectReferencedHashes(entries: Entry[]): Set<string> {
  const hashes = new Set<string>()
  for (const entry of entries) {
    if (entry.iconHash) hashes.add(entry.iconHash)
    if (entry.coverHash) hashes.add(entry.coverHash)
  }
  return hashes
}

async function buildBackupFile(): Promise<BackupFile> {
  const data = getStore().store
  const icons: Record<string, string> = {}
  for (const hash of collectReferencedHashes(data.entries)) {
    try {
      icons[hash] = (await readFile(iconFilePath(hash))).toString('base64')
    } catch {
      // Datei bereits weg (z. B. manuell gelöscht) — ohne Bild sichern statt abzubrechen.
    }
  }
  return { data, icons }
}

export async function exportBackup(window: BrowserWindow): Promise<void> {
  const result = await dialog.showSaveDialog(window, {
    title: 'Daten sichern',
    defaultPath: `mr-launch-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return

  await writeFile(result.filePath, JSON.stringify(await buildBackupFile()), 'utf-8')
  dialog.showMessageBox(window, {
    type: 'info',
    message: 'Daten wurden gesichert.',
    detail: result.filePath
  })
}

const AUTO_BACKUP_KEEP = 5

function autoBackupDir(): string {
  const dir = join(app.getPath('userData'), 'auto-backups')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

// Läuft still im Hintergrund vor jedem eingespielten Update (siehe
// updater.ts) — kein Dialog, keine Nutzerinteraktion, nur ein zusätzliches
// Sicherheitsnetz. Behält nur die letzten AUTO_BACKUP_KEEP Stände, damit sich
// das nicht unbegrenzt aufsummiert.
export async function autoBackupBeforeUpdate(): Promise<void> {
  try {
    const dir = autoBackupDir()
    const file = join(dir, `auto-backup-${Date.now()}.json`)
    await writeFile(file, JSON.stringify(await buildBackupFile()), 'utf-8')

    const files = (await readdir(dir)).filter((name) => name.startsWith('auto-backup-')).sort()
    const excess = files.slice(0, Math.max(0, files.length - AUTO_BACKUP_KEEP))
    await Promise.all(excess.map((name) => unlink(join(dir, name)).catch(() => {})))
  } catch {
    // Automatisches Backup ist ein Bonus, kein Update-Blocker — ein
    // fehlgeschlagener Versuch darf das eigentliche Update nicht verhindern.
  }
}

// Gibt die neue Eintragsliste zurück, damit der Aufrufer die UI aktualisieren
// kann — oder null, wenn nichts wiederhergestellt wurde (abgebrochen, oder
// der Nutzer hat das Ersetzen an der Sicherheitsabfrage abgelehnt).
export async function importBackup(window: BrowserWindow): Promise<Entry[] | null> {
  const result = await dialog.showOpenDialog(window, {
    title: 'Daten wiederherstellen',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null

  let parsed: BackupFile
  try {
    const raw = JSON.parse(await readFile(result.filePaths[0], 'utf-8'))
    // Sicherungen von vor der Bild-Mitsicherung haben die Store-Daten direkt
    // auf oberster Ebene, ohne "data"/"icons"-Hülle — beides bleibt lesbar.
    const isWrapped = raw && typeof raw === 'object' && 'data' in raw && 'icons' in raw
    const data = parseStoreData(isWrapped ? raw.data : raw)
    const icons = isWrapped && raw.icons && typeof raw.icons === 'object' ? raw.icons : {}
    parsed = { data, icons }
  } catch (error) {
    dialog.showErrorBox(
      'Datei ungültig',
      `Diese Datei enthält keine gültige MR-Launch-Sicherung.\n\nFehler: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    return null
  }

  const confirmed = await dialog.showMessageBox(window, {
    type: 'warning',
    buttons: ['Abbrechen', 'Ersetzen'],
    defaultId: 0,
    cancelId: 0,
    message: 'Alle aktuellen Daten werden durch die Sicherung ersetzt.',
    detail:
      'Programme, deren Pfad auf diesem Rechner nicht existiert (z. B. von einem anderen ' +
      'PC übernommen), lassen sich erst nach dem manuellen Neu-Hinzufügen wieder starten.'
  })
  if (confirmed.response !== 1) return null

  for (const [hash, base64] of Object.entries(parsed.icons)) {
    if (typeof base64 !== 'string') continue
    try {
      await writeFile(iconFilePath(hash), Buffer.from(base64, 'base64'))
    } catch {
      // Cache-Ordner nicht schreibbar o. Ä. — das eine Bild fehlt dann einfach.
    }
  }

  replaceStoreData(parsed.data)
  return parsed.data.entries
}
