import { dialog, type BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs/promises'
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

export async function exportBackup(window: BrowserWindow): Promise<void> {
  const result = await dialog.showSaveDialog(window, {
    title: 'Daten sichern',
    defaultPath: `mr-launch-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return

  const data = getStore().store
  const icons: Record<string, string> = {}
  for (const hash of collectReferencedHashes(data.entries)) {
    try {
      icons[hash] = (await readFile(iconFilePath(hash))).toString('base64')
    } catch {
      // Datei bereits weg (z. B. manuell gelöscht) — ohne Bild sichern statt abzubrechen.
    }
  }

  const backup: BackupFile = { data, icons }
  await writeFile(result.filePath, JSON.stringify(backup), 'utf-8')
  dialog.showMessageBox(window, {
    type: 'info',
    message: 'Daten wurden gesichert.',
    detail: result.filePath
  })
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
