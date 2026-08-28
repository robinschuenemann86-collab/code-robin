export interface Entry {
  id: string
  name: string
  path: string
  iconHash: string | null
  coverHash: string | null
  heroHash: string | null
  tags: string[]
  addedAt: number
  steamAppId: string | null
  epicAppName: string | null
  battlenetCode: string | null
  ubisoftId: string | null
  favorite: boolean
  rating: number
  order: number
  launchArgs: string | null
}

export interface Tag {
  id: string
  name: string
  color: string | null
}

export type ViewMode = 'grid' | 'list'

export type SortMode = 'name' | 'recent' | 'playtime' | 'added' | 'custom' | 'rating'

export type TagFilterMode = 'and' | 'or'

export interface SavedView {
  id: string
  name: string
  selectedTagIds: string[]
  tagFilterMode: TagFilterMode
  unsortedOnly: boolean
  sortMode: SortMode
  searchQuery: string
  favoritesOnly: boolean
}

export interface Candidate {
  key: string
  name: string
  source: 'registry' | 'steam' | 'epic' | 'battlenet' | 'ubisoft' | 'ea' | 'gog'
  path: string
  steamAppId: string | null
  epicAppName: string | null
  battlenetCode: string | null
  ubisoftId: string | null
  expectedProcessName: string | null
  iconHash: string | null
  alreadyImported: boolean
  likelyRelevant: boolean
}

export interface ScanResult {
  candidates: Candidate[]
  skipped: string[]
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
  weeklyGoalMinutes: number | null
}
