import { dialog, type BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { getStore, parseStoreData, replaceStoreData, type Entry } from './store'

export async function exportBackup(window: BrowserWindow): Promise<void> {
  const result = await dialog.showSaveDialog(window, {
    title: 'Daten sichern',
    defaultPath: `mr-launch-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return

  await writeFile(result.filePath, JSON.stringify(getStore().store, null, 2), 'utf-8')
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

  let data
  try {
    const raw = JSON.parse(await readFile(result.filePaths[0], 'utf-8'))
    data = parseStoreData(raw)
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

  replaceStoreData(data)
  return data.entries
}
