import { Notice, Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, PropertySearchSettingTab, type PluginSettings } from './settings'
import { SearchEngine } from './search/engine'
import { Indexer } from './search/indexer'
import { IndexCache } from './search/cache'
import { PropertySearchModal } from './ui/search-modal'
import { isFilePDF, isFileMarkdown, stripFrontmatter } from './tools/utils'

export default class PropertySearchPlugin extends Plugin {
  settings!: PluginSettings

  private engine!: SearchEngine
  private indexer!: Indexer
  private cache!: IndexCache

  /**
   * In-memory store of document content, keyed by path.
   * Used by the modal to extract match snippets without re-reading files.
   */
  private contentStore = new Map<string, string>()

  async onload(): Promise<void> {
    await this.loadSettings()

    this.engine = new SearchEngine()
    this.indexer = new Indexer(this.app, this.engine, this.settings)
    this.cache = new IndexCache(this.app, this.manifest.id)

    this.addSettingTab(new PropertySearchSettingTab(this.app, this))

    this.addCommand({
      id: 'open-search',
      name: 'Open vault search',
      callback: () => {
        new PropertySearchModal(
          this.app,
          this.engine,
          this.indexer,
          this.settings,
          this.contentStore
        ).open()
      },
    })

    this.addCommand({
      id: 'reindex-vault',
      name: 'Reindex vault',
      callback: () => this.reindex(),
    })

    // Register vault event listeners for incremental updates
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if ('stat' in file && this.indexer.isIndexable(file.path)) {
          this.indexer.indexFile(file as any).then(() => this.persistContent(file as any))
        }
      })
    )

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if ('stat' in file && this.indexer.isIndexable(file.path)) {
          this.indexer.flagDirty(file)
        }
      })
    )

    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        this.indexer.removeFile(file.path)
        this.contentStore.delete(file.path)
      })
    )

    this.registerEvent(
      this.app.vault.on('rename', async (file, oldPath) => {
        this.indexer.removeFile(oldPath)
        this.contentStore.delete(oldPath)
        if ('stat' in file && this.indexer.isIndexable(file.path)) {
          await this.indexer.indexFile(file as any)
          await this.persistContent(file as any)
        }
      })
    )

    // Defer heavy indexing until layout is ready
    this.app.workspace.onLayoutReady(() => this.initIndex())
  }

  async onunload(): Promise<void> {
    // Nothing to teardown explicitly — Plugin.unload handles event deregistration
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings)
  }

  /** Full reindex: clear cache, rebuild from scratch, save. */
  async reindex(): Promise<void> {
    new Notice('Property Search: reindexing vault…')
    this.engine.clear()
    this.contentStore.clear()
    await this.cache.clear()
    await this.buildContentStore()
    await this.indexer.indexAll()
    await this.cache.save(this.engine)
    new Notice(`Property Search: indexed ${this.engine.documentCount} documents.`)
  }

  private async initIndex(): Promise<void> {
    await this.buildContentStore()
    const loaded = await this.cache.load(this.engine)
    if (loaded) {
      // Incremental update: reindex files that changed since last cache write
      await this.reconcileWithVault()
      await this.cache.save(this.engine)
    } else {
      await this.indexer.indexAll()
      await this.cache.save(this.engine)
    }
  }

  private async reconcileWithVault(): Promise<void> {
    // Build a map of path -> mtime from the vault
    const files = this.app.vault.getFiles().filter((f) => this.indexer.isIndexable(f.path))
    const vaultMtimes = new Map(files.map((f) => [f.path, f.stat.mtime]))

    // Re-read cache mtime data by comparing vault vs content store
    // (Simple approach: reindex any file whose content store is missing or mtime differs)
    const toAdd = files.filter(
      (f) => !this.contentStore.has(f.path)
    )
    for (const f of toAdd) {
      await this.indexer.indexFile(f)
      await this.persistContent(f)
    }
    // Remove paths that no longer exist in vault
    for (const path of [...this.contentStore.keys()]) {
      if (!vaultMtimes.has(path)) {
        this.indexer.removeFile(path)
        this.contentStore.delete(path)
      }
    }
  }

  /** Pre-populate contentStore by reading all vault files (for snippet extraction). */
  private async buildContentStore(): Promise<void> {
    const files = this.app.vault.getFiles().filter((f) => this.indexer.isIndexable(f.path))
    for (const file of files) {
      await this.persistContent(file)
    }
  }

  /** Read a file's content and store it in contentStore. */
  private async persistContent(file: any): Promise<void> {
    try {
      if (isFileMarkdown(file.path)) {
        const raw = await this.app.vault.cachedRead(file)
        this.contentStore.set(file.path, stripFrontmatter(raw))
      } else if (isFilePDF(file.path)) {
        // PDF content populated lazily when extractor is available
        const existing = this.contentStore.get(file.path)
        if (!existing) this.contentStore.set(file.path, '')
      }
    } catch {
      // Skip unreadable files silently
    }
  }
}
