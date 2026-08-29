import { protocol } from 'electron'
import { promises as fs } from 'fs'
import { iconFilePath } from './icons'

export function registerIconProtocolScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'launcher-icon',
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
    }
  ])
}

// Liefert gecachte Icons an den Renderer aus, ohne dass dieser echte Dateipfade kennt.
export function registerIconProtocolHandler(): void {
  protocol.handle('launcher-icon', async (request) => {
    const hash = new URL(request.url).hostname
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      return new Response(null, { status: 400 })
    }
    try {
      const data = await fs.readFile(iconFilePath(hash))
      // Ohne diesen Header würde der Renderer beim Auslesen der
      // Bild-Pixeldaten (siehe colorExtraction.ts) einen Security-Fehler
      // wegen "getainteter" Canvas bekommen — unbedenklich, da rein lokal
      // gecachte Bilder ausgeliefert werden.
      return new Response(data, {
        headers: { 'content-type': 'image/png', 'access-control-allow-origin': '*' }
      })
    } catch {
      return new Response(null, { status: 404 })
    }
  })
}
