import { App, SuggestModal, TFile } from 'obsidian'
import type { HeadingItem } from '../search/types'

export class HeadingsModal extends SuggestModal<HeadingItem> {
  private allHeadings: HeadingItem[] = []

  constructor(app: App) {
    super(app)
    this.setPlaceholder('Search headings across vault…')
    this.setInstructions([
      { command: '↑↓', purpose: 'navigate' },
      { command: '↵', purpose: 'jump to heading' },
      { command: 'esc', purpose: 'dismiss' },
    ])
    this.allHeadings = this.collectHeadings()
  }

  private collectHeadings(): HeadingItem[] {
    const items: HeadingItem[] = []
    for (const file of this.app.vault.getMarkdownFiles()) {
      const cache = this.app.metadataCache.getFileCache(file)
      for (const h of cache?.headings ?? []) {
        items.push({
          file,
          heading: h.heading,
          level: h.level,
          line: h.position.start.line,
        })
      }
    }
    return items
  }

  getSuggestions(query: string): HeadingItem[] {
    const q = query.trim().toLowerCase()
    if (!q) return this.allHeadings.slice(0, 50)
    return this.allHeadings.filter(
      (h) =>
        h.heading.toLowerCase().includes(q) ||
        h.file.basename.toLowerCase().includes(q)
    )
  }

  renderSuggestion(item: HeadingItem, el: HTMLElement): void {
    const root = el.createDiv({ cls: 'property-search-result' })

    const titleRow = root.createDiv({ cls: 'property-search-result__title' })
    titleRow.createSpan({ text: '#'.repeat(item.level) + ' ', cls: 'ps-heading-level' })
    titleRow.createSpan({ text: item.heading })

    root.createDiv({
      cls: 'property-search-result__path',
      text: item.file.path,
    })
  }

  onChooseSuggestion(item: HeadingItem): void {
    this.app.workspace.openLinkText(
      `${item.file.path}#${item.heading}`,
      '',
      false
    )
  }
}
