import { app, nativeImage } from 'electron'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, promises as fs } from 'fs'
import { join } from 'path'

function iconsDir(): string {
  const dir = join(app.getPath('userData'), 'icons')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function hashPath(targetPath: string): string {
  return createHash('sha256').update(targetPath).digest('hex')
}

export function iconFilePath(hash: string): string {
  return join(iconsDir(), `${hash}.png`)
}

// Extrahiert das Icon einer Datei und legt es unter dem Hash ihres Pfades ab.
// Bei erneutem Hinzufügen desselben Pfades wird der Cache wiederverwendet.
export async function ensureIconCached(targetPath: string): Promise<string | null> {
  const hash = hashPath(targetPath)
  const file = iconFilePath(hash)

  if (existsSync(file)) {
    return hash
  }

  try {
    const image = await app.getFileIcon(targetPath, { size: 'large' })
    await fs.writeFile(file, image.toPNG())
    return hash
  } catch {
    return null
  }
}

// Steam-Spiele haben keine ausführbare Datei zum Auslesen — Steam legt eigene
// Icon-Dateien im Cache ab. Best-effort: mehrere bekannte Ablageorte probieren,
// bei Misserfolg bleibt es beim Platzhalter-Icon in der Oberfläche.
export async function ensureSteamIconCached(
  appId: string,
  steamPath: string
): Promise<string | null> {
  const hash = hashPath(`steam:${appId}`)
  const file = iconFilePath(hash)

  if (existsSync(file)) {
    return hash
  }

  const candidates = [
    join(steamPath, 'appcache', 'librarycache', `${appId}_icon.jpg`),
    join(steamPath, 'appcache', 'librarycache', appId, 'icon.jpg'),
    join(steamPath, 'steam', 'games', `${appId}.ico`)
  ]

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    try {
      const image = nativeImage.createFromPath(candidate)
      if (image.isEmpty()) continue
      await fs.writeFile(file, image.toPNG())
      return hash
    } catch {
      continue
    }
  }

  return null
}

export async function removeCachedIcon(hash: string): Promise<void> {
  const file = iconFilePath(hash)
  try {
    await fs.unlink(file)
  } catch {
    // Datei existierte bereits nicht — nichts zu tun.
  }
}
