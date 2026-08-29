import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { ipcMain } from 'electron'
import { getStore } from './store'
import { findSteamPath } from './scanner'
import { ensureScreenshotCached } from './icons'

const MAX_SCREENSHOTS = 12

// Steam legt Screenshots pro Nutzerkonto ab, nicht pro Bibliothek — es kann
// mehrere Konto-Ordner unter userdata geben (z. B. bei mehreren Accounts auf
// demselben PC), deshalb werden alle passenden durchsucht statt nur einer.
function findSteamScreenshotDirs(steamPath: string, appId: string): string[] {
  const userdataDir = join(steamPath, 'userdata')
  if (!existsSync(userdataDir)) return []

  let steamIds: string[]
  try {
    steamIds = readdirSync(userdataDir)
  } catch {
    return []
  }

  const dirs: string[] = []
  for (const steamId of steamIds) {
    const dir = join(userdataDir, steamId, '760', 'remote', appId, 'screenshots')
    if (existsSync(dir)) dirs.push(dir)
  }
  return dirs
}

// Nur für Steam-Titel möglich — andere Quellen (direkte Programme, Epic,
// Battle.net, Ubisoft, EA, GOG) haben keinen einheitlichen Screenshot-Ordner.
export async function getScreenshotsForEntry(entryId: string): Promise<string[]> {
  const entry = getStore()
    .get('entries')
    .find((e) => e.id === entryId)
  if (!entry?.steamAppId) return []

  const steamPath = await findSteamPath()
  if (!steamPath) return []

  const dirs = findSteamScreenshotDirs(steamPath, entry.steamAppId)
  const files: { path: string; mtime: number }[] = []
  for (const dir of dirs) {
    let names: string[]
    try {
      names = readdirSync(dir)
    } catch {
      continue
    }
    for (const name of names) {
      if (!/\.(jpg|jpeg|png)$/i.test(name)) continue
      const full = join(dir, name)
      try {
        files.push({ path: full, mtime: statSync(full).mtimeMs })
      } catch {
        continue
      }
    }
  }
  files.sort((a, b) => b.mtime - a.mtime)

  const hashes: string[] = []
  for (const file of files.slice(0, MAX_SCREENSHOTS)) {
    const hash = await ensureScreenshotCached(file.path)
    if (hash) hashes.push(hash)
  }
  return hashes
}

export function registerScreenshotHandlers(): void {
  ipcMain.handle('screenshots:getForEntry', (_event, entryId: string) =>
    getScreenshotsForEntry(entryId)
  )
}
