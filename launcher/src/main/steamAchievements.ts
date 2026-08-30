import { ipcMain } from 'electron'
import { getStore, setSettings } from './store'
import { ensureRemoteImageCached } from './icons'

const API_BASE = 'https://api.steampowered.com'

interface SteamCredentials {
  apiKey: string
  steamId: string
}

export function getSteamCredentials(): SteamCredentials | null {
  const settings = getStore().get('settings')
  const apiKey = typeof settings.steamApiKey === 'string' ? settings.steamApiKey.trim() : ''
  const steamId = typeof settings.steamId === 'string' ? settings.steamId.trim() : ''
  return apiKey && steamId ? { apiKey, steamId } : null
}

export function setSteamCredentials(apiKey: string, steamId: string): void {
  setSettings({
    ...getStore().get('settings'),
    steamApiKey: apiKey.trim(),
    steamId: steamId.trim()
  })
}

export function canFetchSteamAchievements(): boolean {
  return getSteamCredentials() !== null
}

export interface SteamAchievement {
  apiName: string
  name: string
  description: string
  iconHash: string | null
  achieved: boolean
  unlockTime: number | null
}

interface SchemaAchievement {
  name: string
  displayName: string
  description?: string
  icon: string
  icongray: string
}

interface PlayerAchievement {
  apiname: string
  achieved: number
  unlocktime: number
}

// Zwei getrennte, voneinander unabhängige Steam-Web-API-Aufrufe: das Schema
// (Namen/Beschreibungen/Icons, spielunabhängig vom Nutzer) und der
// Spielerfortschritt (welche davon dieser Nutzer schon hat). Beide werden
// über apiname zusammengeführt, da nur GetSchemaForGame die Anzeige-Texte kennt.
export async function fetchSteamAchievements(appId: string): Promise<SteamAchievement[]> {
  const credentials = getSteamCredentials()
  if (!credentials) {
    throw new Error('Keine Steam-Zugangsdaten hinterlegt. Über "…" → "Steam-Erfolge…" eintragen.')
  }

  let schemaResponse: Response
  let playerResponse: Response
  try {
    ;[schemaResponse, playerResponse] = await Promise.all([
      fetch(
        `${API_BASE}/ISteamUserStats/GetSchemaForGame/v2/?key=${encodeURIComponent(credentials.apiKey)}&appid=${appId}&l=german`
      ),
      fetch(
        `${API_BASE}/ISteamUserStats/GetPlayerAchievements/v1/?appid=${appId}&key=${encodeURIComponent(credentials.apiKey)}&steamid=${encodeURIComponent(credentials.steamId)}&l=german`
      )
    ])
  } catch (error) {
    throw new Error(
      `Verbindung zu Steam fehlgeschlagen (${error instanceof Error ? error.message : String(error)}).`
    )
  }

  if (schemaResponse.status === 403 || playerResponse.status === 403) {
    throw new Error('Steam-API-Key ist ungültig.')
  }
  if (!schemaResponse.ok || !playerResponse.ok) {
    throw new Error('Steam antwortete mit einem Fehler.')
  }

  const schemaBody = (await schemaResponse.json()) as {
    game?: { availableGameStats?: { achievements?: SchemaAchievement[] } }
  }
  const playerBody = (await playerResponse.json()) as {
    playerstats?: { success: boolean; error?: string; achievements?: PlayerAchievement[] }
  }

  const schemaAchievements = schemaBody.game?.availableGameStats?.achievements ?? []
  if (schemaAchievements.length === 0) {
    return []
  }
  if (!playerBody.playerstats?.success) {
    throw new Error(playerBody.playerstats?.error ?? 'Erfolge konnten nicht geladen werden.')
  }

  const playerMap = new Map((playerBody.playerstats.achievements ?? []).map((a) => [a.apiname, a]))

  const achievements: SteamAchievement[] = await Promise.all(
    schemaAchievements.map(async (schema) => {
      const player = playerMap.get(schema.name)
      const iconUrl = player?.achieved ? schema.icon : schema.icongray
      return {
        apiName: schema.name,
        name: schema.displayName,
        description: schema.description ?? '',
        iconHash: await ensureRemoteImageCached(iconUrl),
        achieved: player?.achieved === 1,
        unlockTime: player?.unlocktime ? player.unlocktime * 1000 : null
      }
    })
  )

  // Freigeschaltete zuerst (neueste zuerst) — der interessante Teil steht
  // damit oben, statt in der von Steam vorgegebenen Schema-Reihenfolge
  // zwischen gesperrten Erfolgen zu verschwinden.
  return achievements.sort((a, b) => {
    if (a.achieved !== b.achieved) return a.achieved ? -1 : 1
    return (b.unlockTime ?? 0) - (a.unlockTime ?? 0)
  })
}

export function registerSteamAchievementsHandlers(): void {
  ipcMain.handle('steamAchievements:get', () => getSteamCredentials())

  ipcMain.handle('steamAchievements:set', (_event, apiKey: string, steamId: string) => {
    setSteamCredentials(apiKey, steamId)
  })

  ipcMain.handle('steamAchievements:fetch', (_event, appId: string) =>
    fetchSteamAchievements(appId)
  )
}
