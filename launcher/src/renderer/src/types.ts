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
  xboxAumid: string | null
  favorite: boolean
  rating: number
  order: number
  launchArgs: string | null
  preLaunchCommand: string | null
  postLaunchCommand: string | null
  emulatorPath: string | null
  description: string | null
  genre: string | null
  developer: string | null
  releaseYear: number | null
  videoId: string | null
  hidden: boolean
  notes: string | null
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
  missingOnly: boolean
  missingCoverOnly: boolean
  recentOnly: boolean
  neverPlayedOnly: boolean
}

export interface Candidate {
  key: string
  name: string
  source: 'registry' | 'steam' | 'epic' | 'battlenet' | 'ubisoft' | 'ea' | 'gog' | 'xbox'
  path: string
  steamAppId: string | null
  epicAppName: string | null
  battlenetCode: string | null
  ubisoftId: string | null
  xboxAumid: string | null
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
  playedLastWeekMs: number
  totalLaunches: number
  recentSessions: { entryId: string; endedAt: number; durationMs: number }[]
  weeklyGoalMinutes: number | null
  breakReminderMinutes: number | null
}

export interface SmartSuggestion {
  entryId: string
  playCountOnThisWeekday: number
}

export interface SyncResult {
  ok: boolean
  message: string
}

export interface WrappedData {
  year: number
  totalPlayedMs: number
  topGame: { entryId: string; totalPlayedMs: number } | null
  wildestDay: { date: number; totalPlayedMs: number } | null
  longestSession: { entryId: string; durationMs: number } | null
  gamesAdded: number
  totalLaunches: number
}
