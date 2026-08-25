import { screen, type BrowserWindow } from 'electron'
import { getStore, setSettings } from './store'

interface WindowBounds {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized?: boolean
}

const DEFAULT_BOUNDS: WindowBounds = { width: 900, height: 670 }

// Eine gespeicherte Position kann von einem Monitor stammen, der jetzt nicht
// mehr angeschlossen ist — dann lieber die Standardposition (Windows setzt
// sie automatisch mittig) statt eines Fensters außerhalb des sichtbaren Bereichs.
function isOnScreen(bounds: WindowBounds): boolean {
  if (bounds.x === undefined || bounds.y === undefined) return false
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  return screen.getAllDisplays().some((display) => {
    const { x, y, width, height } = display.workArea
    return centerX >= x && centerX <= x + width && centerY >= y && centerY <= y + height
  })
}

export function loadWindowBounds(): WindowBounds {
  const saved = getStore().get('settings').windowBounds as WindowBounds | undefined
  if (!saved || typeof saved.width !== 'number' || typeof saved.height !== 'number') {
    return DEFAULT_BOUNDS
  }
  if (!isOnScreen(saved)) {
    return { width: saved.width, height: saved.height, isMaximized: saved.isMaximized }
  }
  return saved
}

export function saveWindowBounds(window: BrowserWindow): void {
  const isMaximized = window.isMaximized()
  const bounds = isMaximized ? window.getNormalBounds() : window.getBounds()
  setSettings({ ...getStore().get('settings'), windowBounds: { ...bounds, isMaximized } })
}
