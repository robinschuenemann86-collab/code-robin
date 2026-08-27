import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initStore } from './store'
import { registerEntryHandlers } from './entries'
import { registerTagHandlers } from './tags'
import { registerScannerHandlers } from './scanner'
import { registerStatsHandlers } from './stats'
import { closeDanglingSessions } from './playtime'
import { registerIconProtocolScheme, registerIconProtocolHandler } from './iconProtocol'
import { registerUpdaterHandlers } from './updater'
import { registerTray, unregisterHotkey } from './tray'
import { registerFullscreenHandlers, forwardFullscreenEvents } from './fullscreen'
import { registerContextMenuHandlers } from './contextMenu'
import { registerAppMenuHandlers } from './appMenu'
import { loadWindowBounds, saveWindowBounds } from './windowBounds'
import { registerCoverArtHandlers } from './coverArt'
import { registerSavedViewHandlers } from './savedViews'

registerIconProtocolScheme()

let mainWindow: BrowserWindow | null = null
let isQuitting = false

// Ohne das startet ein zweiter Aufruf (z. B. Autostart plus manueller
// Doppelklick auf die Verknüpfung) ein zweites Fenster samt zweitem Tray-Icon
// und einer zweiten, mit der ersten konkurrierenden Registrierung der
// globalen Hotkeys. app.exit() beendet diese zweite Instanz sofort, noch
// bevor app.whenReady() unten überhaupt auflöst.
if (!app.requestSingleInstanceLock()) {
  app.exit(0)
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
}

function createWindow(): void {
  const bounds = loadWindowBounds()

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (bounds.isMaximized) {
      mainWindow?.maximize()
    }
    // Beim automatischen Start mit Windows bleibt das Fenster versteckt im
    // Tray, statt sich jedes Mal beim Hochfahren aufzudrängen.
    if (!app.getLoginItemSettings().wasOpenedAtLogin) {
      mainWindow?.show()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Fenster-X minimiert in den Tray statt die App zu beenden — wirklich
  // beendet wird nur über "Beenden" im Tray-Menü (setzt isQuitting). Größe/
  // Position werden in jedem Fall gesichert, bevor das Fenster verschwindet.
  mainWindow.on('close', (event) => {
    if (mainWindow) saveWindowBounds(mainWindow)
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  forwardFullscreenEvents(mainWindow)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('de.robinschuenemann.mrlauncher')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIconProtocolHandler()
  initStore()
  closeDanglingSessions()
  registerEntryHandlers(() => mainWindow)
  registerTagHandlers()
  registerScannerHandlers(() => mainWindow)
  registerStatsHandlers()
  registerUpdaterHandlers(() => mainWindow)
  registerTray(() => mainWindow)
  registerFullscreenHandlers(() => mainWindow)
  registerContextMenuHandlers(() => mainWindow)
  registerAppMenuHandlers(() => mainWindow)
  registerCoverArtHandlers()
  registerSavedViewHandlers()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
  unregisterHotkey()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
