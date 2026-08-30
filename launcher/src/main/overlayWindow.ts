import { BrowserWindow, screen } from 'electron'
import { getStore, setSettings } from './store'

// Bewusst ohne eigenes Vite-Renderer-Ziel und ohne Preload: der Inhalt ist so
// trivial (Name + laufende Uhr + Schließen-Knopf) und komplett selbst
// verfasst, dass eine eingebettete data:-URL genügt statt eine zweite
// Build-Ausgabe aufzusetzen.
let overlayWindow: BrowserWindow | null = null

function overlayHtml(entryName: string, startedAt: number): string {
  const safeName = entryName.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`)
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
  body {
    font-family: ui-sans-serif, system-ui, sans-serif;
    -webkit-app-region: drag;
    display: flex; align-items: center; gap: 10px;
    height: 100vh; box-sizing: border-box; padding: 10px 14px;
    background: rgba(20, 16, 12, 0.88);
    border: 1px solid rgba(255, 176, 32, 0.35);
    border-radius: 12px;
    color: #f7efe6;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #34d399; flex-shrink: 0;
    animation: pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
  .text { min-width: 0; flex: 1; }
  .name { font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .time { font-size: 11px; color: #b3a08d; }
  .close { -webkit-app-region: no-drag; background: none; border: none; color: #b3a08d;
    cursor: pointer; font-size: 14px; padding: 2px 4px; line-height: 1; }
  .close:hover { color: #ffb020; }
</style>
</head>
<body>
  <span class="dot"></span>
  <span class="text">
    <div class="name">${safeName}</div>
    <div class="time" id="time">0:00</div>
  </span>
  <button class="close" onclick="window.close()" title="Ausblenden">×</button>
  <script>
    const startedAt = ${startedAt};
    function format(ms) {
      const totalSeconds = Math.floor(ms / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      const pad = (n) => String(n).padStart(2, '0');
      return h > 0 ? \`\${h}:\${pad(m)}:\${pad(s)}\` : \`\${m}:\${pad(s)}\`;
    }
    function tick() {
      document.getElementById('time').textContent = format(Date.now() - startedAt);
    }
    tick();
    setInterval(tick, 1000);
  </script>
</body>
</html>`
}

export function isOverlayEnabled(): boolean {
  return getStore().get('settings').overlayEnabled !== false
}

export function setOverlayEnabled(enabled: boolean): void {
  setSettings({ ...getStore().get('settings'), overlayEnabled: enabled })
  if (!enabled) hideOverlay()
}

function getSavedPosition(): { x: number; y: number } | null {
  const value = getStore().get('settings').overlayPosition
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { x?: unknown }).x === 'number' &&
    typeof (value as { y?: unknown }).y === 'number'
  ) {
    return value as { x: number; y: number }
  }
  return null
}

function saveSavedPosition(x: number, y: number): void {
  setSettings({ ...getStore().get('settings'), overlayPosition: { x, y } })
}

export function showOverlay(entryName: string, startedAt: number): void {
  if (!isOverlayEnabled()) return
  if (overlayWindow) {
    overlayWindow.close()
    overlayWindow = null
  }

  const display = screen.getPrimaryDisplay()
  const width = 220
  const height = 56
  // Merkt sich eine per Drag verschobene Position (siehe 'moved'-Listener
  // unten) — ohne gespeicherte Position wie bisher unten rechts.
  const saved = getSavedPosition()
  const x = saved?.x ?? display.workArea.x + display.workArea.width - width - 20
  const y = saved?.y ?? display.workArea.y + display.workArea.height - height - 20

  overlayWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    focusable: false,
    show: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(overlayHtml(entryName, startedAt))}`)

  // Auf die konkrete Fenster-Instanz aus diesem Aufruf greifen (nicht auf die
  // Modulvariable) — sonst könnte das verzögerte 'closed'-Event eines alten
  // Fensters die Referenz auf ein inzwischen neu erstelltes Fenster löschen,
  // falls z. B. kurz hintereinander zwei Programme gestartet werden.
  const thisWindow = overlayWindow
  thisWindow.on('moved', () => {
    const bounds = thisWindow.getBounds()
    saveSavedPosition(bounds.x, bounds.y)
  })

  thisWindow.on('closed', () => {
    if (overlayWindow === thisWindow) overlayWindow = null
  })
}

export function hideOverlay(): void {
  overlayWindow?.close()
  overlayWindow = null
}
