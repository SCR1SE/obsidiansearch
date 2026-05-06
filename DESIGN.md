# DESIGN.md — obsidian-property-search

## Context

The goal is a single Obsidian plugin that merges two capabilities currently split across community plugins:
1. **Frontmatter property display in search results** (patterned after Another Quick Switcher)
2. **PDF content search via Text Extractor** (patterned after Omnisearch)

The user wants a unified search modal where Markdown files and PDFs are searched in the same index, and each result shows configurable frontmatter properties beneath the filename. The plugin is built from scratch using patterns learned from the reference plugins — not by copying code verbatim (Omnisearch is GPL-3.0; AQS has its own license).

---

## Architecture Overview

```
src/
  main.ts               ← Plugin entry: load settings, init engine, register commands
  settings.ts           ← PluginSettings interface + DEFAULT_SETTINGS + SettingsTab
  search/
    engine.ts           ← MiniSearch wrapper: configure, add/remove/search documents
    indexer.ts          ← Vault crawl, markdown+PDF processing, change tracking
    cache.ts            ← Serialize/deserialize index to JSON file via vault adapter
    types.ts            ← IndexedDocument, SearchResult, ResultItem interfaces
  ui/
    search-modal.ts     ← SuggestModal subclass: input, getSuggestions, renderSuggestion
    suggestion-renderer.ts ← DOM factory: build title row, property row, path row
  tools/
    text-extractor.ts   ← TextExtractorApi interface + getTextExtractor() helper
    utils.ts            ← isFilePDF, normalizePath, stripMarkdown helpers
manifest.json
package.json
tsconfig.json
esbuild.config.mjs
styles.css
```

---

## Libraries

| Library | Version | Reason |
|---------|---------|--------|
| `minisearch` | ^7.x | MIT license; BM25 full-text search with field boosting; same choice as Omnisearch |
| `obsidian` | latest | Obsidian type declarations (dev dependency) |
| `esbuild` | ^0.21 | Plugin bundler (matches community plugin convention) |
| `typescript` | ^5.x | Strict mode |

No Svelte, no Dexie. DOM manipulation is vanilla TypeScript; persistence is a plain JSON file.

---

## Data Schema

### `IndexedDocument` (stored in MiniSearch)
```typescript
type IndexedDocument = {
  path: string           // unique ID
  basename: string       // filename without extension
  content: string        // full text (markdown body or PDF extracted text)
  aliases: string        // space-joined aliases from frontmatter
  tags: string           // space-joined tags
  headings: string       // space-joined h1/h2/h3 headings
  mtime: number          // file modification time (for staleness detection)
  type: 'markdown' | 'pdf'
}
```

### MiniSearch configuration
- `idField: 'path'`
- `fields: ['basename', 'content', 'aliases', 'tags', 'headings']`
- `storeFields: ['basename', 'mtime', 'type']`
- `searchOptions.boost: { basename: 5, aliases: 3, headings: 2, tags: 2, content: 1 }`
- `processTerm`: lowercase + remove diacritics
- `fuzzy`: 0 for ≤3 chars, 0.1 for 4–5 chars, 0.2 for 6+ chars

### `ResultItem` (passed to `renderSuggestion`)
```typescript
type ResultItem = {
  score: number
  path: string
  basename: string
  type: 'markdown' | 'pdf'
  frontmatter: Record<string, unknown> | null  // live from MetadataCache, not stored in index
  matchedContent: string   // short excerpt around first match
}
```

Frontmatter is **not** stored in the index — it is fetched live from `app.metadataCache` at render time. This avoids stale property data without needing to reindex on frontmatter edits, and keeps the index lean.

---

## Settings

```typescript
interface PluginSettings {
  propertiesToDisplay: string[]   // e.g. ["status", "type", "author"]
  indexPdfs: boolean              // default true
  excludeFolders: string[]        // folder prefix patterns to skip
  maxResults: number              // default 50
  showContentSnippet: boolean     // show matched excerpt below result
}
```

---

## Indexing & Persistence

### Initial indexing flow
1. `onload()` → workspace.onLayoutReady → `buildContentStore()` → `cache.load(engine)`
2. If cache loaded: `reconcileWithVault()` → reindex stale/new files only → `cache.save()`
3. If no cache: `indexer.indexAll()` → `cache.save()`

### Incremental updates (vault events)
- `vault.on('create')` → index new file immediately
- `vault.on('modify')` → add to dirty-set; flush when modal opens
- `vault.on('delete')` → remove from index immediately
- `vault.on('rename')` → remove old path, add new path

### Cache file format
```json
{
  "version": 1,
  "appId": "vault-name",
  "index": { /* MiniSearch.toJSON() output */ }
}
```
Location: `.obsidian/plugins/obsidian-property-search/index-cache.json`

---

## Text Extractor Integration

Plugin ID: `text-extractor`

```typescript
export type TextExtractorApi = {
  extractText: (file: TFile) => Promise<string>
  canFileBeExtracted: (filePath: string) => boolean
  isInCache: (file: TFile) => Promise<boolean>
}

export function getTextExtractor(app: App): TextExtractorApi | null {
  return (app as any).plugins?.plugins?.['text-extractor']?.api ?? null
}
```

---

## Search Modal

Extends Obsidian's `SuggestModal<ResultItem>`.

### DOM structure per result
```
div.property-search-result
  div.property-search-result__title
    span[icon]       ← 📄 markdown / 📕 PDF
    span.title       ← basename
    span.ps-badge    ← ".pdf" for PDFs
  div.property-search-result__path
    span             ← directory path (dimmed)
  div.property-search-result__properties   ← only if properties configured and present
    div.property-search-result__prop  (×N)
      span.ps-prop-key    ← "key:"
      span.ps-prop-value  ← value
  div.property-search-result__snippet      ← only if showContentSnippet enabled
    span             ← short matched excerpt
```

---

## License

- MiniSearch: MIT
- Obsidian API types: MIT
- No code copied from Omnisearch (GPL-3.0) or AQS
- This plugin: **MIT**
