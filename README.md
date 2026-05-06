# Property Search — Obsidian Plugin

A unified search modal that combines:
- **Frontmatter property display** — configurable property keys shown beneath each result
- **PDF content search** — PDFs indexed and searchable when [Text Extractor](https://github.com/scambier/obsidian-text-extractor) is installed

---

## Installation

1. Copy the plugin folder to `.obsidian/plugins/obsidian-property-search/`
2. Enable "Property Search" in Obsidian → Settings → Community plugins

Or build from source:
```bash
npm install
npm run build
```

---

## Usage

Open the search modal via:
- Command palette → **Property Search: Open vault search**
- (Optional) Assign a hotkey in Settings → Hotkeys → "Property Search: Open vault search"

Type any query to search file names, content, tags, headings, and aliases simultaneously. Select a result to open the file.

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Properties to display** | *(empty)* | Frontmatter keys to show under each result (one per line) |
| **Index PDFs** | On | Index PDF content via Text Extractor (requires Text Extractor plugin) |
| **Show content snippet** | On | Show a short matched-content excerpt under each result |
| **Maximum results** | 50 | Cap on how many results the modal shows |
| **Exclude folders** | *(empty)* | Folder prefixes to skip during indexing (one per line) |

### Reindexing

The index is cached between Obsidian sessions. If results seem stale, use **Settings → Property Search → Reindex now** or the command **Property Search: Reindex vault**.

---

## PDF Search

PDF content search requires the [Text Extractor](https://github.com/scambier/obsidian-text-extractor) plugin. If it is not installed, PDFs are still indexed and searchable **by filename**, but their content is not searched. A warning is displayed in settings when Text Extractor is absent.

---

## Design Notes

- Search engine: [MiniSearch](https://github.com/lucaong/minisearch) (MIT licence)
- Index persistence: JSON file at `.obsidian/plugins/obsidian-property-search/index-cache.json`
- Frontmatter properties are read **live** from Obsidian's MetadataCache at render time — not stored in the index — so property changes are always current without reindexing
- No Svelte or other UI frameworks; pure TypeScript + Obsidian API
- Licence: MIT

---

## DESIGN.md

See [DESIGN.md](DESIGN.md) for the full architectural design document produced during Phase 1.
