import { App, Notice, SuggestModal, TFile } from 'obsidian'
import type { ResultItem } from '../search/types'
import type { SearchEngine } from '../search/engine'
import type { Indexer } from '../search/indexer'
import type { PluginSettings } from '../settings'
import { buildResultEl } from './suggestion-renderer'

type OpenMode = 'default' | 'tab' | 'split' | 'background'

export class PropertySearchModal extends SuggestModal<ResultItem> {
  /** Session-level excerpt toggle (Mod+G), independent of persisted setting. */
  private showSnippets: boolean

  constructor(
    app: App,
    private engine: SearchEngine,
    private indexer: Indexer,
    private settings: PluginSettings,
    private contentStore: Map<string, string>
  ) {
    super(app)
    this.showSnippets = settings.showContentSnippet
    this.setPlaceholder('Search vault…')
    this.setInstructions([
      { command: '↑↓',      purpose: 'navigate' },
      { command: '↵',        purpose: 'open' },
      { command: '⌘↵',      purpose: 'open in new tab' },
      { command: '⌘⌥↵',    purpose: 'open in split' },
      { command: '⌘O',      purpose: 'open in background' },
      { command: '⇧↵',      purpose: 'create note' },
      { command: '⌘⇧↵',    purpose: 'create in new tab' },
      { command: '⌥↵',      purpose: 'insert link' },
      { command: '⌘G',      purpose: 'toggle excerpts' },
      { command: 'esc',      purpose: 'close' },
    ])
    this.registerModalKeys()
  }

  private registerModalKeys(): void {
    // Open in new tab
    this.scope.register(['Mod'], 'Enter', (evt) => {
      evt.preventDefault()
      const item = this.getSelected()
      if (item) this.openItem(item, 'tab')
      this.close()
      return false
    })

    // Open in split
    this.scope.register(['Mod', 'Alt'], 'Enter', (evt) => {
      evt.preventDefault()
      const item = this.getSelected()
      if (item) this.openItem(item, 'split')
      this.close()
      return false
    })

    // Open in background (keep modal open so user can open more)
    this.scope.register(['Mod'], 'o', (evt) => {
      evt.preventDefault()
      const item = this.getSelected()
      if (item) this.openItem(item, 'background')
      return false
    })

    // Create note from query text
    this.scope.register(['Shift'], 'Enter', (evt) => {
      evt.preventDefault()
      this.createNote('default')
      return false
    })

    // Create note in new tab
    this.scope.register(['Mod', 'Shift'], 'Enter', (evt) => {
      evt.preventDefault()
      this.createNote('tab')
      return false
    })

    // Insert [[link]] at cursor
    this.scope.register(['Alt'], 'Enter', (evt) => {
      evt.preventDefault()
      const item = this.getSelected()
      if (item) this.insertLink(item)
      this.close()
      return false
    })

    // Toggle excerpts for this session
    this.scope.register(['Mod'], 'g', (evt) => {
      evt.preventDefault()
      this.showSnippets = !this.showSnippets
      // Re-run the current query so renderSuggestion is called again
      ;(this as any).updateSuggestions?.()
      return false
    })
  }

  /** Access the internal Chooser to read the currently highlighted item. */
  private getSelected(): ResultItem | null {
    const chooser = (this as any).chooser
    if (!chooser) return null
    const items: ResultItem[] | undefined = chooser.values
    const idx: number | undefined = chooser.selectedItem
    return (items && idx != null) ? (items[idx] ?? null) : null
  }

  private openItem(item: ResultItem, mode: OpenMode): void {
    const file = this.app.vault.getAbstractFileByPath(item.path)
    if (!(file instanceof TFile)) {
      new Notice(`File not found: ${item.path}`)
      return
    }

    if (mode === 'background') {
      const leaf = this.app.workspace.getLeaf('tab')
      leaf.openFile(file, { active: false })
      return
    }

    const pane = mode === 'tab' ? 'tab' : mode === 'split' ? 'split' : false
    this.app.workspace.openLinkText(item.path, '', pane as any)
  }

  private async createNote(openMode: 'default' | 'tab'): Promise<void> {
    const query = this.inputEl.value.trim()
    if (!query) {
      new Notice('Type a name for the new note first.')
      return
    }
    try {
      const file = await (this.app.fileManager as any).createNewMarkdownFile(
        this.app.vault.getRoot(),
        query
      )
      this.close()
      if (openMode === 'tab') {
        const leaf = this.app.workspace.getLeaf('tab')
        await leaf.openFile(file, { active: true })
      } else {
        const leaf = this.app.workspace.getMostRecentLeaf()
        await leaf?.openFile(file, { active: true })
      }
    } catch (e) {
      new Notice(`Could not create note: ${(e as Error).message}`)
    }
  }

  private insertLink(item: ResultItem): void {
    const editor = this.app.workspace.activeEditor?.editor
    if (!editor) {
      new Notice('No active editor to insert a link into.')
      return
    }
    // Use wikilink format; include alias if file has a display title
    editor.replaceSelection(`[[${item.basename}]]`)
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
    // Use session showSnippets so Mod+G toggle takes effect immediately
    buildResultEl(item, { ...this.settings, showContentSnippet: this.showSnippets }, el)
  }

  onChooseSuggestion(item: ResultItem): void {
    // Plain Enter — open in current pane (default)
    this.openItem(item, 'default')
  }
}
