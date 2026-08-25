import { ipcMain, type BrowserWindow } from 'electron'

export function registerFullscreenHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('window:setFullscreen', (_event, value: boolean) => {
    getWindow()?.setFullScreen(value)
  })
}

// Meldet Vollbild-Wechsel an den Renderer zurück, damit dessen Zustand auch
// dann stimmt, wenn das Fenster nicht über unseren eigenen Button in oder aus
// dem Vollbild geht (z. B. über einen Windows-Shortcut).
export function forwardFullscreenEvents(window: BrowserWindow): void {
  window.on('enter-full-screen', () => window.webContents.send('window:fullscreenChanged', true))
  window.on('leave-full-screen', () => window.webContents.send('window:fullscreenChanged', false))
}
