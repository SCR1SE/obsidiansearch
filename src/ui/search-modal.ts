import { App, SuggestModal } from 'obsidian'
import type { ResultItem } from '../search/types'
import type { SearchEngine } from '../search/engine'
import type { Indexer } from '../search/indexer'
import type { PluginSettings } from '../settings'
import { buildResultEl } from './suggestion-renderer'

export class PropertySearchModal extends SuggestModal<ResultItem> {
  constructor(
    app: App,
    private engine: SearchEngine,
    private indexer: Indexer,
    private settings: PluginSettings,
    private contentStore: Map<string, string>
  ) {
    super(app)
    this.setPlaceholder('Search vault…')
    this.setInstructions([
      { command: '↑↓', purpose: 'navigate' },
      { command: '↵', purpose: 'open' },
      { command: 'esc', purpose: 'dismiss' },
    ])
  }

  async getSuggestions(query: string): Promise<ResultItem[]> {
    await this.indexer.flushDirty()

    if (!query.trim()) return []

    const results = this.engine.search(query, this.settings, this.contentStore)

    return results.map((r) => {
      const file = this.app.vault.getAbstractFileByPath(r.path)
      let frontmatter: Record<string, unknown> | null = null
      if (file && 'stat' in file) {
        const meta = this.app.metadataCache.getFileCache(file as any)
        frontmatter = meta?.frontmatter ?? null
      }
      return { ...r, frontmatter }
    })
  }

  renderSuggestion(item: ResultItem, el: HTMLElement): void {
    buildResultEl(item, this.settings, el)
  }

  onChooseSuggestion(item: ResultItem): void {
    this.app.workspace.openLinkText(item.path, '', false)
  }
}
