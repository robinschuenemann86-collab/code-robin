export interface Entry {
  id: string
  name: string
  path: string
  iconHash: string | null
  category: string
  addedAt: number
}

export interface Category {
  id: string
  name: string
}

export type ViewMode = 'grid' | 'list'

export interface Candidate {
  key: string
  name: string
  source: 'registry' | 'steam'
  path: string
  steamAppId: string | null
  iconHash: string | null
  alreadyImported: boolean
  likelyRelevant: boolean
}
