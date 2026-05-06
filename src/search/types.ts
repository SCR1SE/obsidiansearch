export type DocumentType = 'markdown' | 'pdf'

export interface IndexedDocument {
  path: string
  basename: string
  content: string
  aliases: string
  tags: string
  headings: string
  mtime: number
  type: DocumentType
}

export interface SearchResult {
  score: number
  path: string
  basename: string
  type: DocumentType
  matchedContent: string
}

export interface ResultItem {
  score: number
  path: string
  basename: string
  type: DocumentType
  frontmatter: Record<string, unknown> | null
  matchedContent: string
}

export interface HeadingItem {
  file: import('obsidian').TFile
  heading: string
  level: number
  line: number
}

export type BookmarkType = 'file' | 'folder' | 'heading' | 'block' | 'search' | 'graph' | 'url' | 'group'

export interface BookmarkItem {
  type: BookmarkType
  title: string
  path: string
  subpath?: string
  url?: string
}
