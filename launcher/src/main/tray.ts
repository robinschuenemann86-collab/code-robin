import { app, BrowserWindow, globalShortcut, Menu, nativeImage, Tray } from 'electron'
import icon from '../../resources/icon.png?asset'

const HOTKEY = 'CommandOrControl+Alt+L'

let tray: Tray | null = null

// Auf einem eigenen nativeImage-Resize statt einer zweiten Icon-Datei, damit
// wir nicht für jede Zielgröße (Tray, Fenster, Installer) eine eigene Datei
// pflegen müssen — Electron bringt das Skalieren schon mit.
export function registerTray(getWindow: () => BrowserWindow | null): void {
  function showWindow(): void {
    const window = getWindow()
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }

  const trayIcon = nativeImage.createFromPath(icon).resize({ width: 16, height: 16 })
  tray = new Tray(trayIcon)
  tray.setToolTip(`MR Launch (${HOTKEY.replace('CommandOrControl', 'Strg')})`)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Öffnen', click: showWindow },
      { type: 'separator' },
      { label: 'Beenden', click: () => app.quit() }
    ])
  )
  tray.on('click', showWindow)

  globalShortcut.register(HOTKEY, () => {
    const window = getWindow()
    if (!window) return
    if (window.isVisible() && window.isFocused()) {
      window.hide()
    } else {
      showWindow()
    }
  })
}

export function unregisterHotkey(): void {
  globalShortcut.unregisterAll()
}
