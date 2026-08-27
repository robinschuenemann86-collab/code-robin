import { app, ipcMain, Menu, type BrowserWindow } from 'electron'
import { exportBackup, importBackup } from './backup'
import { fetchMissingCoverArtForAll } from './coverArt'

export function registerAppMenuHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.on('appMenu:show', () => {
    const window = getWindow()
    if (!window) return

    const menu = Menu.buildFromTemplate([
      {
        label: 'Bei Windows-Start öffnen',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (menuItem) => app.setLoginItemSettings({ openAtLogin: menuItem.checked })
      },
      { type: 'separator' },
      { label: 'Daten sichern…', click: () => exportBackup(window) },
      {
        label: 'Daten wiederherstellen…',
        click: async () => {
          const entries = await importBackup(window)
          if (entries) window.webContents.send('entries:changed', entries)
        }
      },
      { type: 'separator' },
      {
        label: 'SteamGridDB-Key…',
        click: () => window.webContents.send('coverArt:openKeyDialog')
      },
      {
        label: 'Fehlende Cover-Art nachladen',
        click: () => void fetchMissingCoverArtForAll(window)
      }
    ])
    menu.popup({ window })
  })
}
