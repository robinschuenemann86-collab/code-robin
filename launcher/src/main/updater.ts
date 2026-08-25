import { ipcMain, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'

export type UpdaterStatus =
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

export function registerUpdaterHandlers(getWindow: () => BrowserWindow | null): void {
  function send(status: UpdaterStatus): void {
    getWindow()?.webContents.send('updater:status', status)
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => send({ state: 'available', version: info.version }))
  autoUpdater.on('update-not-available', () => send({ state: 'not-available' }))
  autoUpdater.on('download-progress', (progress) =>
    send({ state: 'downloading', percent: Math.round(progress.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => send({ state: 'downloaded', version: info.version }))
  autoUpdater.on('error', (error) =>
    send({ state: 'error', message: error instanceof Error ? error.message : String(error) })
  )

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall()
  })

  // Kein Update-Check in der Entwicklung: es gibt keine Releases, aus denen
  // electron-updater lesen könnte, das würde nur eine Fehlermeldung erzeugen.
  if (!is.dev) {
    autoUpdater.checkForUpdates().catch((error) => {
      send({ state: 'error', message: error instanceof Error ? error.message : String(error) })
    })
  }
}
