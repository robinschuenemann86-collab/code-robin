export interface Entry {
  id: string
  name: string
  path: string
  iconHash: string | null
  tags: string[]
  addedAt: number
  favorite: boolean
}

export interface Tag {
  id: string
  name: string
}

export type ViewMode = 'grid' | 'list'

export interface Candidate {
  key: string
  name: string
  source: 'registry' | 'steam' | 'epic'
  path: string
  steamAppId: string | null
  epicAppName: string | null
  expectedProcessName: string | null
  iconHash: string | null
  alreadyImported: boolean
  likelyRelevant: boolean
}

export interface EntryStats {
  entryId: string
  totalPlayedMs: number
  lastPlayedAt: number | null
}
