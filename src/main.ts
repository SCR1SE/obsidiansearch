import { Notice, Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, PropertySearchSettingTab, type PluginSettings } from './settings'
import { SearchEngine } from './search/engine'
import { Indexer } from './search/indexer'
import { IndexCache } from './search/cache'
import { PropertySearchModal } from './ui/search-modal'
import { HeadingsModal } from './ui/headings-modal'
import { HeadingsInFileModal } from './ui/headings-infile-modal'
import { BasesModal } from './ui/bases-modal'
import { BookmarksModal } from './ui/bookmarks-modal'
import { isFilePDF, isFileMarkdown, stripFrontmatter } from './tools/utils'

export default class PropertySearchPlugin extends Plugin {
  settings!: PluginSettings

  private engine!: SearchEngine
  private indexer!: Indexer
  private cache!: IndexCache

  /** In-memory document content store for snippet extraction. */
  private contentStore = new Map<string, string>()

  async onload(): Promise<void> {
    await this.loadSettings()

    this.engine = new SearchEngine()
    this.indexer = new Indexer(this.app, this.engine, this.settings)
    this.cache = new IndexCache(this.app, this.manifest.id)

    this.addSettingTab(new PropertySearchSettingTab(this.app, this))

    // ── Commands ─────────────────────────────────────────────────────────────

    this.addCommand({
      id: 'open-search',
      name: 'Open vault search',
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'o' }],
      callback: () => {
        new PropertySearchModal(this.app, this.engine, this.indexer, this.settings, this.contentStore).open()
      },
    })

    this.addCommand({
      id: 'search-headings',
      name: 'Search headings (vault)',
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'h' }],
      callback: () => {
        new HeadingsModal(this.app).open()
      },
    })

    this.addCommand({
      id: 'search-headings-infile',
      name: 'Search headings (current file)',
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'j' }],
      editorCallback: (_editor, _view) => {
        new HeadingsInFileModal(this.app).open()
      },
    })

    this.addCommand({
      id: 'search-bases',
      name: 'Search Bases files',
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'b' }],
      callback: () => {
        new BasesModal(this.app).open()
      },
    })

    this.addCommand({
      id: 'search-bookmarks',
      name: 'Search bookmarks',
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'k' }],
      callback: () => {
        new BookmarksModal(this.app).open()
      },
    })

    this.addCommand({
      id: 'reindex-vault',
      name: 'Reindex vault',
      callback: () => this.reindex(),
    })

    // ── Vault event listeners ────────────────────────────────────────────────

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
          this.persistContent(file as any)
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

    this.app.workspace.onLayoutReady(() => this.initIndex())
  }

  async onunload(): Promise<void> {
    // Plugin.unload handles event deregistration
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings)
  }

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
      await this.reconcileWithVault()
      await this.cache.save(this.engine)
    } else {
      await this.indexer.indexAll()
      await this.cache.save(this.engine)
    }
  }

  private async reconcileWithVault(): Promise<void> {
    const files = this.app.vault.getFiles().filter((f) => this.indexer.isIndexable(f.path))
    const vaultMtimes = new Map(files.map((f) => [f.path, f.stat.mtime]))

    const toAdd = files.filter((f) => !this.contentStore.has(f.path))
    for (const f of toAdd) {
      await this.indexer.indexFile(f)
      await this.persistContent(f)
    }

    for (const path of [...this.contentStore.keys()]) {
      if (!vaultMtimes.has(path)) {
        this.indexer.removeFile(path)
        this.contentStore.delete(path)
      }
    }
  }

  private async buildContentStore(): Promise<void> {
    const files = this.app.vault.getFiles().filter((f) => this.indexer.isIndexable(f.path))
    for (const file of files) {
      await this.persistContent(file)
    }
  }

  private async persistContent(file: any): Promise<void> {
    try {
      if (isFileMarkdown(file.path)) {
        const raw = await this.app.vault.cachedRead(file)
        this.contentStore.set(file.path, stripFrontmatter(raw))
      } else if (isFilePDF(file.path)) {
        const existing = this.contentStore.get(file.path)
        if (!existing) this.contentStore.set(file.path, '')
      }
    } catch {
      // Skip unreadable files silently
    }
  }
}
