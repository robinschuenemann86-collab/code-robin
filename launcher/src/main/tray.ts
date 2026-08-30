import { app, BrowserWindow, globalShortcut, Menu, nativeImage, Notification, Tray } from 'electron'
import icon from '../../resources/icon.png?asset'
import { getStore } from './store'
import { launchEntry } from './entries'
import { getMostRecentlyPlayedEntryId } from './stats'

const HOTKEY = 'CommandOrControl+Alt+L'
const PLAY_LAST_HOTKEY = 'CommandOrControl+Alt+P'

// Läuft auch, wenn das Fenster versteckt im Tray liegt — deshalb Feedback per
// System-Benachrichtigung statt über die Statuszeile im (unsichtbaren) Fenster.
async function playMostRecentlyPlayed(): Promise<void> {
  const entryId = getMostRecentlyPlayedEntryId()
  const entry = entryId ? getStore().get('entries').find((e) => e.id === entryId) : null

  if (!entry) {
    new Notification({
      title: 'MR Launch',
      body: 'Noch kein zuletzt gespieltes Programm vorhanden.'
    }).show()
    return
  }

  try {
    await launchEntry(entry.id)
    new Notification({ title: 'MR Launch', body: `„${entry.name}“ wird gestartet …` }).show()
  } catch (error) {
    new Notification({
      title: 'MR Launch',
      body: `Start fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`
    }).show()
  }
}

let tray: Tray | null = null

const BASE_TOOLTIP = `MR Launch (${HOTKEY.replace('CommandOrControl', 'Strg')} · zuletzt gespielt: ${PLAY_LAST_HOTKEY.replace('CommandOrControl', 'Strg')})`

// Zeigt an, welches Programm gerade läuft, solange eine Sitzung getrackt
// wird (siehe entries.ts/playtime.ts) — sonst der normale Tooltip mit den
// Tastenkombinationen.
export function setTrayRunningEntry(name: string | null): void {
  tray?.setToolTip(name ? `MR Launch — Läuft: ${name}` : BASE_TOOLTIP)
}

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
  tray.setToolTip(BASE_TOOLTIP)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Öffnen', click: showWindow },
      { label: 'Zuletzt gespielt starten', click: () => void playMostRecentlyPlayed() },
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

  globalShortcut.register(PLAY_LAST_HOTKEY, () => {
    void playMostRecentlyPlayed()
  })
}

export function unregisterHotkey(): void {
  globalShortcut.unregisterAll()
}
