import { ipcMain, Menu, type BrowserWindow } from 'electron'
import { exportBackup, importBackup } from './backup'

export function registerAppMenuHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.on('appMenu:show', () => {
    const window = getWindow()
    if (!window) return

    const menu = Menu.buildFromTemplate([
      { label: 'Daten sichern…', click: () => exportBackup(window) },
      {
        label: 'Daten wiederherstellen…',
        click: async () => {
          const entries = await importBackup(window)
          if (entries) window.webContents.send('entries:changed', entries)
        }
      }
    ])
    menu.popup({ window })
  })
}
