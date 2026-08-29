export interface AchievementContext {
  entryCount: number
  totalPlayedMs: number
  totalLaunches: number
  streakDays: number
  favoriteCount: number
  tagCount: number
}

export interface Achievement {
  id: string
  name: string
  description: string
  check: (ctx: AchievementContext) => boolean
}

const HOUR_MS = 3_600_000

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-entry',
    name: 'Erster Eintrag',
    description: 'Ein Programm hinzugefügt',
    check: (c) => c.entryCount >= 1
  },
  {
    id: 'ten-entries',
    name: 'Sammler',
    description: '10 Programme in der Bibliothek',
    check: (c) => c.entryCount >= 10
  },
  {
    id: 'fifty-entries',
    name: 'Bibliothekar',
    description: '50 Programme in der Bibliothek',
    check: (c) => c.entryCount >= 50
  },
  {
    id: 'first-tag',
    name: 'Ordnungsliebend',
    description: 'Den ersten Tag angelegt',
    check: (c) => c.tagCount >= 1
  },
  {
    id: 'five-favorites',
    name: 'Geschmackssicher',
    description: '5 Favoriten markiert',
    check: (c) => c.favoriteCount >= 5
  },
  {
    id: 'ten-hours',
    name: 'Warmgespielt',
    description: '10 Stunden Spielzeit insgesamt',
    check: (c) => c.totalPlayedMs >= 10 * HOUR_MS
  },
  {
    id: 'hundred-hours',
    name: 'Vielspieler',
    description: '100 Stunden Spielzeit insgesamt',
    check: (c) => c.totalPlayedMs >= 100 * HOUR_MS
  },
  {
    id: 'fifty-launches',
    name: 'Vielstarter',
    description: '50 Programmstarts insgesamt',
    check: (c) => c.totalLaunches >= 50
  },
  {
    id: 'week-streak',
    name: 'Dranbleiber',
    description: '7 Tage in Folge etwas gestartet',
    check: (c) => c.streakDays >= 7
  },
  {
    id: 'month-streak',
    name: 'Eisern',
    description: '30 Tage in Folge etwas gestartet',
    check: (c) => c.streakDays >= 30
  }
]

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
