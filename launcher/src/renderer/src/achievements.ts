export interface AchievementContext {
  entryCount: number
  totalPlayedMs: number
  totalLaunches: number
  streakDays: number
  favoriteCount: number
  tagCount: number
  distinctPlatformCount: number
}

export interface Achievement {
  id: string
  name: string
  description: string
  emoji: string
  check: (ctx: AchievementContext) => boolean
  // Für den Fortschrittsbalken bei noch gesperrten Erfolgen — optional, da
  // sich nicht jeder Erfolg sinnvoll als "X von Y" darstellen lässt.
  progress?: (ctx: AchievementContext) => { current: number; target: number }
}

const HOUR_MS = 3_600_000

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-entry',
    name: 'Erster Eintrag',
    description: 'Ein Programm hinzugefügt',
    emoji: '🎮',
    check: (c) => c.entryCount >= 1,
    progress: (c) => ({ current: c.entryCount, target: 1 })
  },
  {
    id: 'ten-entries',
    name: 'Sammler',
    description: '10 Programme in der Bibliothek',
    emoji: '📦',
    check: (c) => c.entryCount >= 10,
    progress: (c) => ({ current: c.entryCount, target: 10 })
  },
  {
    id: 'fifty-entries',
    name: 'Bibliothekar',
    description: '50 Programme in der Bibliothek',
    emoji: '📚',
    check: (c) => c.entryCount >= 50,
    progress: (c) => ({ current: c.entryCount, target: 50 })
  },
  {
    id: 'first-tag',
    name: 'Ordnungsliebend',
    description: 'Den ersten Tag angelegt',
    emoji: '🏷️',
    check: (c) => c.tagCount >= 1,
    progress: (c) => ({ current: c.tagCount, target: 1 })
  },
  {
    id: 'five-favorites',
    name: 'Geschmackssicher',
    description: '5 Favoriten markiert',
    emoji: '⭐',
    check: (c) => c.favoriteCount >= 5,
    progress: (c) => ({ current: c.favoriteCount, target: 5 })
  },
  {
    id: 'ten-hours',
    name: 'Warmgespielt',
    description: '10 Stunden Spielzeit insgesamt',
    emoji: '🔥',
    check: (c) => c.totalPlayedMs >= 10 * HOUR_MS,
    progress: (c) => ({ current: Math.round(c.totalPlayedMs / HOUR_MS), target: 10 })
  },
  {
    id: 'hundred-hours',
    name: 'Vielspieler',
    description: '100 Stunden Spielzeit insgesamt',
    emoji: '🏆',
    check: (c) => c.totalPlayedMs >= 100 * HOUR_MS,
    progress: (c) => ({ current: Math.round(c.totalPlayedMs / HOUR_MS), target: 100 })
  },
  {
    id: 'fifty-launches',
    name: 'Vielstarter',
    description: '50 Programmstarts insgesamt',
    emoji: '🚀',
    check: (c) => c.totalLaunches >= 50,
    progress: (c) => ({ current: c.totalLaunches, target: 50 })
  },
  {
    id: 'week-streak',
    name: 'Dranbleiber',
    description: '7 Tage in Folge etwas gestartet',
    emoji: '📅',
    check: (c) => c.streakDays >= 7,
    progress: (c) => ({ current: c.streakDays, target: 7 })
  },
  {
    id: 'month-streak',
    name: 'Eisern',
    description: '30 Tage in Folge etwas gestartet',
    emoji: '💪',
    check: (c) => c.streakDays >= 30,
    progress: (c) => ({ current: c.streakDays, target: 30 })
  },
  {
    id: 'multitalent',
    name: 'Multitalent',
    description: 'Programme aus mindestens 2 verschiedenen Quellen (z. B. Steam + Epic)',
    emoji: '🧩',
    check: (c) => c.distinctPlatformCount >= 2,
    progress: (c) => ({ current: c.distinctPlatformCount, target: 2 })
  }
]

// Zählt, aus wie vielen unterschiedlichen Quellen die Bibliothek Programme
// enthält — anhand der jeweils gespeicherten Plattform-Kennung, da Entry
// selbst keine "source" mitführt (die kennt nur der Scanner).
export function distinctPlatformCount(
  entries: { steamAppId: string | null; epicAppName: string | null; battlenetCode: string | null; ubisoftId: string | null }[]
): number {
  const platforms = new Set<string>()
  for (const entry of entries) {
    if (entry.steamAppId) platforms.add('steam')
    if (entry.epicAppName) platforms.add('epic')
    if (entry.battlenetCode) platforms.add('battlenet')
    if (entry.ubisoftId) platforms.add('ubisoft')
  }
  return platforms.size
}

export function unlockedAchievements(ctx: AchievementContext): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.check(ctx))
}

const SEEN_KEY = 'seenAchievementIds'

export function loadSeenAchievementIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

export function saveSeenAchievementIds(ids: Set<string>): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]))
  } catch {
    // Nicht kritisch — dann werden Erfolge beim nächsten Mal ggf. erneut gemeldet.
  }
}
