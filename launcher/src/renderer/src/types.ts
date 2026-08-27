export interface Entry {
  id: string
  name: string
  path: string
  iconHash: string | null
  coverHash: string | null
  tags: string[]
  addedAt: number
  steamAppId: string | null
  epicAppName: string | null
  battlenetCode: string | null
  favorite: boolean
  order: number
  launchArgs: string | null
}

export interface Tag {
  id: string
  name: string
}

export type ViewMode = 'grid' | 'list'

export type SortMode = 'name' | 'recent' | 'playtime' | 'added' | 'custom'

export interface Candidate {
  key: string
  name: string
  source: 'registry' | 'steam' | 'epic' | 'battlenet'
  path: string
  steamAppId: string | null
  epicAppName: string | null
  battlenetCode: string | null
  expectedProcessName: string | null
  iconHash: string | null
  alreadyImported: boolean
  likelyRelevant: boolean
}

export interface EntryStats {
  entryId: string
  totalPlayedMs: number
  lastPlayedAt: number | null
  launchCount: number
}

export interface OverviewData {
  streakDays: number
  weekActivity: (boolean | null)[]
  playedThisWeekMs: number
  totalLaunches: number
  recentSessions: { entryId: string; endedAt: number; durationMs: number }[]
}
