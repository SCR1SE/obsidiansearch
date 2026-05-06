import type { App } from 'obsidian'
import type { SearchEngine } from './engine'

const CACHE_VERSION = 1
const CACHE_FILENAME = 'index-cache.json'

interface CacheFile {
  version: number
  appId: string
  index: object
}

export class IndexCache {
  private cachePath: string

  constructor(private app: App, private pluginId: string) {
    this.cachePath = `${this.app.vault.configDir}/plugins/${this.pluginId}/${CACHE_FILENAME}`
  }

  async load(engine: SearchEngine): Promise<boolean> {
    try {
      const raw = await this.app.vault.adapter.read(this.cachePath)
      const data = JSON.parse(raw) as CacheFile
      if (data.version !== CACHE_VERSION) return false
      engine.loadFromJSON(data.index as any)
      return true
    } catch {
      return false
    }
  }

  async save(engine: SearchEngine): Promise<void> {
    const vaultName = this.app.vault.getName()
    const data: CacheFile = {
      version: CACHE_VERSION,
      appId: vaultName,
      index: engine.toJSON(),
    }
    await this.app.vault.adapter.write(this.cachePath, JSON.stringify(data))
  }

  async clear(): Promise<void> {
    try {
      await this.app.vault.adapter.remove(this.cachePath)
    } catch {
      // file didn't exist — that's fine
    }
  }
}
