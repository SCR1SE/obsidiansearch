import type { App, TAbstractFile, TFile } from 'obsidian'
import type { PluginSettings } from '../settings'
import type { IndexedDocument } from './types'
import type { SearchEngine } from './engine'
import { getTextExtractor } from '../tools/text-extractor'
import { isFilePDF, isFileMarkdown, stripFrontmatter } from '../tools/utils'

export class Indexer {
  private dirtyPaths = new Set<string>()

  constructor(private app: App, private engine: SearchEngine, private settings: PluginSettings) {}

  isIndexable(path: string): boolean {
    for (const folder of this.settings.excludeFolders) {
      if (path.startsWith(folder.endsWith('/') ? folder : folder + '/')) return false
    }
    return isFileMarkdown(path) || (this.settings.indexPdfs && isFilePDF(path))
  }

  flagDirty(file: TAbstractFile): void {
    this.dirtyPaths.add(file.path)
  }

  async flushDirty(): Promise<void> {
    if (this.dirtyPaths.size === 0) return
    const paths = [...this.dirtyPaths]
    this.dirtyPaths.clear()
    for (const path of paths) {
      const file = this.app.vault.getAbstractFileByPath(path)
      if (file && 'stat' in file) {
        await this.indexFile(file as TFile)
      }
    }
  }

  async indexFile(file: TFile): Promise<void> {
    if (!this.isIndexable(file.path)) return
    const doc = isFilePDF(file.path)
      ? await this.buildPdfDocument(file)
      : await this.buildMarkdownDocument(file)
    if (doc) this.engine.add(doc)
  }

  removeFile(path: string): void {
    this.engine.remove(path)
    this.dirtyPaths.delete(path)
  }

  async indexAll(onProgress?: (done: number, total: number) => void): Promise<void> {
    const files = this.app.vault.getFiles().filter((f) => this.isIndexable(f.path))
    const batch: IndexedDocument[] = []
    let done = 0
    for (const file of files) {
      const doc = isFilePDF(file.path)
        ? await this.buildPdfDocument(file)
        : await this.buildMarkdownDocument(file)
      if (doc) batch.push(doc)
      done++
      onProgress?.(done, files.length)
    }
    this.engine.addAll(batch)
  }

  /** Returns list of stale paths: indexed files whose mtime doesn't match disk. */
  getStalePathsFromVault(indexedMtimes: Map<string, number>): { add: TFile[]; remove: string[] } {
    const vaultFiles = new Map<string, TFile>()
    for (const f of this.app.vault.getFiles()) {
      if (this.isIndexable(f.path)) vaultFiles.set(f.path, f)
    }
    const add: TFile[] = []
    const remove: string[] = []
    for (const [path, mtime] of indexedMtimes) {
      if (!vaultFiles.has(path)) remove.push(path)
      else if (vaultFiles.get(path)!.stat.mtime !== mtime) add.push(vaultFiles.get(path)!)
    }
    for (const [path, file] of vaultFiles) {
      if (!indexedMtimes.has(path)) add.push(file)
    }
    return { add, remove }
  }

  private async buildMarkdownDocument(file: TFile): Promise<IndexedDocument | null> {
    try {
      const raw = await this.app.vault.cachedRead(file)
      const meta = this.app.metadataCache.getFileCache(file)
      const content = stripFrontmatter(raw)
      const aliases = (meta?.frontmatter?.aliases as string[] | string | undefined) ?? []
      const aliasStr = Array.isArray(aliases) ? aliases.join(' ') : String(aliases ?? '')
      const tags = [
        ...((meta?.tags ?? []).map((t) => t.tag.replace(/^#/, ''))),
        ...((meta?.frontmatter?.tags as string[] | undefined) ?? []),
      ].join(' ')
      const headings = (meta?.headings ?? []).map((h) => h.heading).join(' ')
      return {
        path: file.path,
        basename: file.basename,
        content,
        aliases: aliasStr,
        tags,
        headings,
        mtime: file.stat.mtime,
        type: 'markdown',
      }
    } catch {
      return null
    }
  }

  private async buildPdfDocument(file: TFile): Promise<IndexedDocument | null> {
    try {
      const extractor = getTextExtractor(this.app)
      let content = ''
      if (extractor && extractor.canFileBeExtracted(file.path) && this.settings.indexPdfs) {
        content = await extractor.extractText(file)
      }
      return {
        path: file.path,
        basename: file.basename,
        content,
        aliases: '',
        tags: '',
        headings: '',
        mtime: file.stat.mtime,
        type: 'pdf',
      }
    } catch {
      return null
    }
  }
}
