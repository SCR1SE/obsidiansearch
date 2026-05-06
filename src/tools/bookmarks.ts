import type { App } from 'obsidian'
import type { BookmarkItem, BookmarkType } from '../search/types'

interface RawBookmark {
  type: BookmarkType
  title?: string
  path?: string
  subpath?: string
  url?: string
  items?: RawBookmark[]
}

function flatten(items: RawBookmark[], out: BookmarkItem[]): void {
  for (const item of items) {
    if (item.type === 'group') {
      if (item.items) flatten(item.items, out)
      continue
    }
    out.push({
      type: item.type,
      title: item.title ?? item.path ?? item.url ?? '(untitled)',
      path: item.path ?? '',
      subpath: item.subpath,
      url: item.url,
    })
  }
}

export function getBookmarks(app: App): BookmarkItem[] {
  const plugin = (app as any).internalPlugins?.plugins?.['bookmarks']
  const items: RawBookmark[] = plugin?.instance?.items ?? []
  const out: BookmarkItem[] = []
  flatten(items, out)
  return out
}

export function openBookmark(app: App, item: BookmarkItem): void {
  if (item.type === 'url' && item.url) {
    window.open(item.url, '_blank')
    return
  }
  if (item.type === 'search' && item.path) {
    // Open the Obsidian search with the saved query
    const searchPlugin = (app as any).internalPlugins?.plugins?.['global-search']
    if (searchPlugin?.instance) {
      searchPlugin.instance.openGlobalSearch(item.path)
    }
    return
  }
  if (item.path) {
    const target = item.subpath ? `${item.path}#${item.subpath}` : item.path
    app.workspace.openLinkText(target, '', false)
  }
}
