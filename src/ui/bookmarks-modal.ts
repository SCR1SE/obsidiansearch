import { App, Notice, SuggestModal } from 'obsidian'
import type { BookmarkItem } from '../search/types'
import { getBookmarks, openBookmark } from '../tools/bookmarks'

const TYPE_ICON: Record<string, string> = {
  file: '📄',
  folder: '📁',
  heading: '🔖',
  block: '⬛',
  search: '🔍',
  graph: '🕸️',
  url: '🌐',
}

export class BookmarksModal extends SuggestModal<BookmarkItem> {
  private items: BookmarkItem[]

  constructor(app: App) {
    super(app)
    this.setPlaceholder('Search bookmarks…')
    this.setInstructions([
      { command: '↑↓', purpose: 'navigate' },
      { command: '↵', purpose: 'open' },
      { command: 'esc', purpose: 'dismiss' },
    ])

    this.items = getBookmarks(app)
    if (this.items.length === 0) {
      new Notice('No bookmarks found. Add bookmarks via the Bookmarks core plugin.')
    }
  }

  getSuggestions(query: string): BookmarkItem[] {
    const q = query.trim().toLowerCase()
    if (!q) return this.items
    return this.items.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.path.toLowerCase().includes(q) ||
        (b.subpath ?? '').toLowerCase().includes(q)
    )
  }

  renderSuggestion(item: BookmarkItem, el: HTMLElement): void {
    const root = el.createDiv({ cls: 'property-search-result' })

    const titleRow = root.createDiv({ cls: 'property-search-result__title' })
    titleRow.createSpan({ text: (TYPE_ICON[item.type] ?? '🔖') + ' ' })
    titleRow.createSpan({ text: item.title })
    titleRow.createSpan({ cls: 'ps-badge', text: item.type })

    if (item.subpath) {
      root.createDiv({
        cls: 'property-search-result__path',
        text: item.path + ' › ' + item.subpath,
      })
    } else if (item.path) {
      root.createDiv({ cls: 'property-search-result__path', text: item.path })
    } else if (item.url) {
      root.createDiv({ cls: 'property-search-result__path', text: item.url })
    }
  }

  onChooseSuggestion(item: BookmarkItem): void {
    openBookmark(this.app, item)
  }
}
