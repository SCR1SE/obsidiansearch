import { App, MarkdownView, Notice, SuggestModal } from 'obsidian'
import type { HeadingItem } from '../search/types'

export class HeadingsInFileModal extends SuggestModal<HeadingItem> {
  private headings: HeadingItem[] = []

  constructor(app: App) {
    super(app)
    this.setPlaceholder('Search headings in current file…')
    this.setInstructions([
      { command: '↑↓', purpose: 'navigate' },
      { command: '↵', purpose: 'jump to heading' },
      { command: 'esc', purpose: 'dismiss' },
    ])

    const file = app.workspace.getActiveFile()
    if (!file) {
      new Notice('No active file.')
      return
    }
    const cache = app.metadataCache.getFileCache(file)
    this.headings = (cache?.headings ?? []).map((h) => ({
      file,
      heading: h.heading,
      level: h.level,
      line: h.position.start.line,
    }))
  }

  getSuggestions(query: string): HeadingItem[] {
    const q = query.trim().toLowerCase()
    if (!q) return this.headings
    return this.headings.filter((h) => h.heading.toLowerCase().includes(q))
  }

  renderSuggestion(item: HeadingItem, el: HTMLElement): void {
    const root = el.createDiv({ cls: 'property-search-result' })
    const titleRow = root.createDiv({ cls: 'property-search-result__title' })
    // Indent heading by level visually
    titleRow.style.paddingLeft = `${(item.level - 1) * 12}px`
    titleRow.createSpan({ text: '#'.repeat(item.level) + ' ', cls: 'ps-heading-level' })
    titleRow.createSpan({ text: item.heading })
  }

  onChooseSuggestion(item: HeadingItem): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView)
    if (!view) {
      // Fall back to openLinkText if no active editor
      this.app.workspace.openLinkText(`${item.file.path}#${item.heading}`, '', false)
      return
    }
    const editor = view.editor
    editor.setCursor({ line: item.line, ch: 0 })
    editor.scrollIntoView(
      { from: { line: item.line, ch: 0 }, to: { line: item.line, ch: 0 } },
      true
    )
    // Move focus back to editor
    view.editor.focus()
  }
}
