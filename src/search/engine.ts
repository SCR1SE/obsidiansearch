import MiniSearch, { type Options as MiniSearchOptions, type AsPlainObject } from 'minisearch'
import type { IndexedDocument, SearchResult } from './types'
import { normalizeTerm, extractSnippet } from '../tools/utils'
import type { SearchSettings } from '../settings'

function buildOptions(): MiniSearchOptions<IndexedDocument> {
  return {
    idField: 'path',
    fields: ['basename', 'content', 'aliases', 'tags', 'headings'],
    storeFields: ['basename', 'mtime', 'type'],
    processTerm: normalizeTerm,
  }
}

export class SearchEngine {
  private mini: MiniSearch<IndexedDocument>

  constructor() {
    this.mini = new MiniSearch<IndexedDocument>(buildOptions())
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

  search(
    query: string,
    searchSettings: SearchSettings,
    contentDocs: Map<string, string>
  ): SearchResult[] {
    if (!query.trim()) return []

    const terms = query.trim().split(/\s+/).filter(Boolean)
    const isMultiWord = terms.length > 1
    const combineWith = (searchSettings.requireAllTerms && isMultiWord) ? 'AND' : 'OR'

    const fuzzyFn = searchSettings.fuzzyEnabled
      ? (term: string) => {
          if (term.length <= 3) return false
          if (term.length <= 5) return 0.1
          return 0.2
        }
      : false

    // Pass 1: prefix search on name/meta fields only (fast, low noise)
    const nameBoost: Record<string, number> = {
      basename: searchSettings.boostFilename,
      aliases: 3,
      headings: 2,
      tags: 2,
    }
    const nameResults = this.mini.search(query, {
      fields: ['basename', 'headings', 'aliases', 'tags'],
      prefix: searchSettings.prefixSearchEnabled,
      fuzzy: fuzzyFn,
      combineWith,
      boost: nameBoost,
    })

    // Pass 2: exact/fuzzy on content (no prefix to avoid noise)
    const contentResults = this.mini.search(query, {
      fields: ['content'],
      prefix: false,
      fuzzy: fuzzyFn,
      combineWith,
      boost: { content: 1 },
    })

    // Merge: keep best score per path
    const byPath = new Map<string, { id: unknown; score: number; basename: string; type: string; mtime: number }>()
    for (const r of [...nameResults, ...contentResults]) {
      const existing = byPath.get(r.id as string)
      if (!existing || r.score > existing.score) {
        byPath.set(r.id as string, r as any)
      }
    }

    let merged = [...byPath.values()].sort((a, b) => b.score - a.score)

    // Recency boost: bump recently modified files
    if (searchSettings.boostRecent) {
      const now = Date.now()
      const day = 86_400_000
      merged = merged.map((r) => {
        const ageDays = (now - (r.mtime as number)) / day
        const boost = ageDays < 7 ? 0.5 : ageDays < 30 ? 0.2 : 0
        return { ...r, score: r.score * (1 + boost) }
      }).sort((a, b) => b.score - a.score)
    }

    // Score threshold: drop results too far below top score
    if (merged.length > 0 && searchSettings.scoreThresholdPercent > 0) {
      const topScore = merged[0].score
      const minScore = topScore * (searchSettings.scoreThresholdPercent / 100)
      merged = merged.filter((r) => r.score >= minScore)
    }

    const queryWords = terms
    return merged.slice(0, searchSettings.maxResults).map((r) => {
      const content = contentDocs.get(r.id as string) ?? ''
      return {
        score: r.score,
        path: r.id as string,
        basename: r.basename as string,
        type: r.type as 'markdown' | 'pdf',
        matchedContent: extractSnippet(content, queryWords),
      }
    })
  }

  toJSON(): AsPlainObject {
    return this.mini.toJSON()
  }

  loadFromJSON(data: AsPlainObject): void {
    this.mini = MiniSearch.loadJS<IndexedDocument>(data, buildOptions())
  }

  clear(): void {
    this.mini = new MiniSearch<IndexedDocument>(buildOptions())
  }

  get documentCount(): number {
    return this.mini.documentCount
  }
}
