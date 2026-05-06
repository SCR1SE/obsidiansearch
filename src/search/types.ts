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
