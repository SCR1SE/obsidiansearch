import MiniSearch, { type Options as MiniSearchOptions, type AsPlainObject } from 'minisearch'
import type { IndexedDocument, SearchResult } from './types'
import { normalizeTerm, extractSnippet } from '../tools/utils'

const MINISEARCH_OPTIONS: MiniSearchOptions<IndexedDocument> = {
  idField: 'path',
  fields: ['basename', 'content', 'aliases', 'tags', 'headings'],
  storeFields: ['basename', 'mtime', 'type'],
  processTerm: normalizeTerm,
  searchOptions: {
    boost: { basename: 5, aliases: 3, headings: 2, tags: 2, content: 1 },
    prefix: true,
    fuzzy: (term) => {
      if (term.length <= 3) return false
      if (term.length <= 5) return 0.1
      return 0.2
    },
  },
}

export class SearchEngine {
  private mini: MiniSearch<IndexedDocument>

  constructor() {
    this.mini = new MiniSearch<IndexedDocument>(MINISEARCH_OPTIONS)
  }

  has(path: string): boolean {
    return this.mini.has(path)
  }

  add(doc: IndexedDocument): void {
    if (this.mini.has(doc.path)) {
      this.mini.replace(doc)
    } else {
      this.mini.add(doc)
    }
  }

  addAll(docs: IndexedDocument[]): void {
    const toAdd = docs.filter((d) => !this.mini.has(d.path))
    const toReplace = docs.filter((d) => this.mini.has(d.path))
    if (toAdd.length) this.mini.addAll(toAdd)
    for (const d of toReplace) this.mini.replace(d)
  }

  remove(path: string): void {
    if (this.mini.has(path)) {
      this.mini.discard(path)
    }
  }

  search(query: string, maxResults: number, contentDocs: Map<string, string>): SearchResult[] {
    if (!query.trim()) return []
    const queryWords = query.trim().toLowerCase().split(/\s+/)
    const raw = this.mini.search(query)
    return raw.slice(0, maxResults).map((r) => {
      const content = contentDocs.get(r.id as string) ?? ''
      return {
        score: r.score,
        path: r.id as string,
        basename: (r as any).basename as string,
        type: (r as any).type as 'markdown' | 'pdf',
        matchedContent: extractSnippet(content, queryWords),
      }
    })
  }

  toJSON(): AsPlainObject {
    return this.mini.toJSON()
  }

  loadFromJSON(data: AsPlainObject): void {
    this.mini = MiniSearch.loadJS<IndexedDocument>(data, MINISEARCH_OPTIONS)
  }

  clear(): void {
    this.mini = new MiniSearch<IndexedDocument>(MINISEARCH_OPTIONS)
  }

  get documentCount(): number {
    return this.mini.documentCount
  }
}
