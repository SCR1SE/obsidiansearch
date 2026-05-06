import { App, PluginSettingTab, Setting } from 'obsidian'
import type PropertySearchPlugin from './main'

export interface PluginSettings {
  propertiesToDisplay: string[]
  indexPdfs: boolean
  excludeFolders: string[]
  maxResults: number
  showContentSnippet: boolean
}

export const DEFAULT_SETTINGS: PluginSettings = {
  propertiesToDisplay: [],
  indexPdfs: true,
  excludeFolders: [],
  maxResults: 50,
  showContentSnippet: true,
}

export class PropertySearchSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: PropertySearchPlugin) {
    super(app, plugin)
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    containerEl.createEl('h2', { text: 'Property Search' })

    // Text Extractor availability notice
    const hasTextExtractor = !!(this.app as any).plugins?.plugins?.['text-extractor']?.api
    if (!hasTextExtractor) {
      const notice = containerEl.createDiv({ cls: 'setting-item' })
      const noticeDesc = notice.createDiv({ cls: 'setting-item-description' })
      noticeDesc.innerHTML =
        '⚠️ <strong>Text Extractor</strong> plugin is not installed or enabled. ' +
        'PDF content search is unavailable; PDFs will be indexed by filename only. ' +
        'Install <a href="obsidian://show-plugin?id=text-extractor">Text Extractor</a> to enable PDF content search.'
    }

    new Setting(containerEl)
      .setName('Properties to display')
      .setDesc(
        'Frontmatter property keys to show beneath each result (one per line). ' +
        'Example: status, type, author'
      )
      .addTextArea((ta) => {
        ta.setPlaceholder('status\ntype\nauthor')
          .setValue(this.plugin.settings.propertiesToDisplay.join('\n'))
          .onChange(async (value) => {
            this.plugin.settings.propertiesToDisplay = value
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
            await this.plugin.saveSettings()
          })
        ta.inputEl.rows = 5
        ta.inputEl.style.width = '100%'
      })

    new Setting(containerEl)
      .setName('Index PDFs')
      .setDesc('Index PDF content via Text Extractor (requires Text Extractor plugin).')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.indexPdfs).onChange(async (value) => {
          this.plugin.settings.indexPdfs = value
          await this.plugin.saveSettings()
        })
      )

    new Setting(containerEl)
      .setName('Show content snippet')
      .setDesc('Show a short excerpt of matched content beneath each result.')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.showContentSnippet).onChange(async (value) => {
          this.plugin.settings.showContentSnippet = value
          await this.plugin.saveSettings()
        })
      )

    new Setting(containerEl)
      .setName('Maximum results')
      .setDesc('Maximum number of search results to display.')
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.maxResults))
          .onChange(async (value) => {
            const n = parseInt(value, 10)
            if (!isNaN(n) && n > 0) {
              this.plugin.settings.maxResults = n
              await this.plugin.saveSettings()
            }
          })
      )

    new Setting(containerEl)
      .setName('Exclude folders')
      .setDesc('Folder path prefixes to skip when indexing (one per line). Example: Templates, Archive')
      .addTextArea((ta) => {
        ta.setPlaceholder('Templates\nArchive')
          .setValue(this.plugin.settings.excludeFolders.join('\n'))
          .onChange(async (value) => {
            this.plugin.settings.excludeFolders = value
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
            await this.plugin.saveSettings()
          })
        ta.inputEl.rows = 4
        ta.inputEl.style.width = '100%'
      })

    new Setting(containerEl)
      .setName('Reindex vault')
      .setDesc('Clears the index cache and rebuilds from scratch. Use if search results seem stale.')
      .addButton((btn) =>
        btn
          .setButtonText('Reindex now')
          .setCta()
          .onClick(async () => {
            btn.setButtonText('Indexing…').setDisabled(true)
            await this.plugin.reindex()
            btn.setButtonText('Done!').setDisabled(false)
            setTimeout(() => btn.setButtonText('Reindex now'), 2000)
          })
      )
  }
}
