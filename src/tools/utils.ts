export function isFilePDF(path: string): boolean {
  return path.toLowerCase().endsWith('.pdf')
}

export function isFileMarkdown(path: string): boolean {
  return path.toLowerCase().endsWith('.md')
}

/** Remove YAML frontmatter block from markdown content. */
export function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content
  const end = content.indexOf('\n---', 3)
  if (end === -1) return content
  return content.slice(end + 4).trimStart()
}

/** Flatten a frontmatter value (array or scalar) to a displayable string. */
export function frontmatterValueToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map(String).join(', ')
  return String(value)
}

/** Remove diacritics and lowercase a string for consistent search terms. */
export function normalizeTerm(term: string): string {
  return term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Extract a short snippet from content around the first occurrence of any query word. */
export function extractSnippet(content: string, queryWords: string[], maxLength = 120): string {
  if (!content) return ''
  const lower = content.toLowerCase()
  let bestIndex = -1
  for (const word of queryWords) {
    const idx = lower.indexOf(word.toLowerCase())
    if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
      bestIndex = idx
    }
  }
  if (bestIndex === -1) return content.slice(0, maxLength)
  const start = Math.max(0, bestIndex - 30)
  const raw = content.slice(start, start + maxLength)
  return (start > 0 ? '…' : '') + raw + (start + maxLength < content.length ? '…' : '')
}
