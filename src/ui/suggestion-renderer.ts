import type { ResultItem } from '../search/types'
import type { PluginSettings } from '../settings'
import { frontmatterValueToString } from '../tools/utils'

export function buildResultEl(item: ResultItem, settings: PluginSettings, el: HTMLElement): void {
  const root = el.createDiv({ cls: 'property-search-result' })

  // Title row: icon + basename + optional .pdf badge
  const titleRow = root.createDiv({ cls: 'property-search-result__title' })
  const icon = titleRow.createSpan()
  icon.textContent = item.type === 'pdf' ? '📕' : '📄'
  titleRow.createSpan({ text: item.basename })
  if (item.type === 'pdf') {
    titleRow.createSpan({ cls: 'ps-badge', text: '.pdf' })
  }

  // Path row
  const dir = item.path.includes('/')
    ? item.path.slice(0, item.path.lastIndexOf('/'))
    : ''
  if (dir) {
    root.createDiv({ cls: 'property-search-result__path', text: dir })
  }

  // Property rows (only keys that have a value)
  if (settings.propertiesToDisplay.length > 0 && item.frontmatter) {
    const propsRow = root.createDiv({ cls: 'property-search-result__properties' })
    let anyShown = false
    for (const key of settings.propertiesToDisplay) {
      const raw = item.frontmatter[key]
      if (raw === null || raw === undefined) continue
      const value = frontmatterValueToString(raw)
      if (!value) continue
      const propEl = propsRow.createDiv({ cls: 'property-search-result__prop' })
      propEl.createSpan({ cls: 'ps-prop-key', text: key + ':' })
      propEl.createSpan({ cls: 'ps-prop-value', text: value })
      anyShown = true
    }
    if (!anyShown) propsRow.remove()
  }

  // Content snippet (PDFs or when enabled globally)
  if (settings.showContentSnippet && item.matchedContent) {
    root.createDiv({ cls: 'property-search-result__snippet', text: item.matchedContent })
  }
}
