import { App, PluginSettingTab, Setting } from 'obsidian'
import type PropertySearchPlugin from './main'

/** Settings that directly drive search engine behaviour (passed to engine.search). */
export interface SearchSettings {
  maxResults: number
  requireAllTerms: boolean
  scoreThresholdPercent: number
  fuzzyEnabled: boolean
  prefixSearchEnabled: boolean
  boostFilename: number
  boostRecent: boolean
}

export interface PluginSettings extends SearchSettings {
  // Display
  propertiesToDisplay: string[]
  showContentSnippet: boolean
  showPath: boolean
  showIcons: boolean

  // Index
  indexPdfs: boolean
  additionalExtensions: string[]
  excludeFolders: string[]
}

export const DEFAULT_SETTINGS: PluginSettings = {
  // Search
  maxResults: 50,
  requireAllTerms: true,
  scoreThresholdPercent: 10,
  fuzzyEnabled: true,
  prefixSearchEnabled: true,
  boostFilename: 5,
  boostRecent: false,

  // Display
  propertiesToDisplay: [],
  showContentSnippet: true,
  showPath: true,
  showIcons: true,

  // Index
  indexPdfs: true,
  additionalExtensions: [],
  excludeFolders: [],
}

export class PropertySearchSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: PropertySearchPlugin) {
    super(app, plugin)
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    containerEl.createEl('h2', { text: 'Property Search' })

    // ── Text Extractor notice ────────────────────────────────────────────────
    const hasTextExtractor = !!(this.app as any).plugins?.plugins?.['text-extractor']?.api
    if (!hasTextExtractor) {
      const box = containerEl.createDiv({ cls: 'callout' })
      box.style.cssText = 'background:var(--background-modifier-error-hover);padding:8px 12px;border-radius:6px;margin-bottom:8px;font-size:0.9em;'
      box.innerHTML =
        '⚠️ <strong>Text Extractor</strong> is not installed or enabled. ' +
        'PDF content search is unavailable; PDFs will be indexed by filename only.'
    }

    // ── Display ──────────────────────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'Display' })

    new Setting(containerEl)
      .setName('Properties to display')
      .setDesc('Frontmatter property keys shown beneath each result (one per line). Example: status, type, author')
      .addTextArea((ta) => {
        ta.setPlaceholder('status\ntype\nauthor')
          .setValue(this.plugin.settings.propertiesToDisplay.join('\n'))
          .onChange(async (value) => {
            this.plugin.settings.propertiesToDisplay = value.split('\n').map((s) => s.trim()).filter(Boolean)
            await this.plugin.saveSettings()
          })
        ta.inputEl.rows = 5
        ta.inputEl.style.width = '100%'
      })

    new Setting(containerEl)
      .setName('Show path')
      .setDesc('Show the folder path beneath each result title.')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.showPath).onChange(async (v) => {
          this.plugin.settings.showPath = v
          await this.plugin.saveSettings()
        })
      )

    new Setting(containerEl)
      .setName('Show icons')
      .setDesc('Show file-type icons (📄 / 📕) next to result titles.')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.showIcons).onChange(async (v) => {
          this.plugin.settings.showIcons = v
          await this.plugin.saveSettings()
        })
      )

    new Setting(containerEl)
      .setName('Show content snippet')
      .setDesc('Show a short excerpt of matched content beneath each result.')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.showContentSnippet).onChange(async (v) => {
          this.plugin.settings.showContentSnippet = v
          await this.plugin.saveSettings()
        })
      )

    // ── Search quality ───────────────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'Search quality' })

    new Setting(containerEl)
      .setName('Require all terms')
      .setDesc('When the query has multiple words, every word must appear somewhere in the file (AND mode). Disable to show files matching any word (OR mode, more results).')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.requireAllTerms).onChange(async (v) => {
          this.plugin.settings.requireAllTerms = v
          await this.plugin.saveSettings()
        })
      )

    new Setting(containerEl)
      .setName('Score threshold (%)')
      .setDesc('Hide results whose score is below this percentage of the top result. 0 = show all, 20 = only results within 5× of the best match. Default: 10.')
      .addSlider((s) =>
        s.setLimits(0, 50, 1)
          .setValue(this.plugin.settings.scoreThresholdPercent)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.scoreThresholdPercent = v
            await this.plugin.saveSettings()
          })
      )

    new Setting(containerEl)
      .setName('Filename boost')
      .setDesc('How much to boost matches on the file name versus content (1–10). Higher = filename matches rank much higher than body matches.')
      .addSlider((s) =>
        s.setLimits(1, 10, 1)
          .setValue(this.plugin.settings.boostFilename)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.boostFilename = v
            await this.plugin.saveSettings()
          })
      )

    new Setting(containerEl)
      .setName('Fuzzy matching')
      .setDesc('Allow minor typos in queries (e.g. "noteboook" matches "notebook"). Disable for exact-only matching.')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.fuzzyEnabled).onChange(async (v) => {
          this.plugin.settings.fuzzyEnabled = v
          await this.plugin.saveSettings()
        })
      )

    new Setting(containerEl)
      .setName('Prefix matching')
      .setDesc('Match file names that start with your query (e.g. "pro" matches "project"). Applied to filename, headings, and tags only — not body content.')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.prefixSearchEnabled).onChange(async (v) => {
          this.plugin.settings.prefixSearchEnabled = v
          await this.plugin.saveSettings()
        })
      )

    new Setting(containerEl)
      .setName('Boost recent files')
      .setDesc('Give a small score bonus to files modified in the last 7 days (large) or 30 days (small).')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.boostRecent).onChange(async (v) => {
          this.plugin.settings.boostRecent = v
          await this.plugin.saveSettings()
        })
      )

    new Setting(containerEl)
      .setName('Maximum results')
      .setDesc('Cap on how many results the modal shows.')
      .addText((text) =>
        text.setValue(String(this.plugin.settings.maxResults)).onChange(async (value) => {
          const n = parseInt(value, 10)
          if (!isNaN(n) && n > 0) {
            this.plugin.settings.maxResults = n
            await this.plugin.saveSettings()
          }
        })
      )

    // ── Indexing ─────────────────────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'Indexing' })

    new Setting(containerEl)
      .setName('Index PDFs')
      .setDesc('Index PDF content via Text Extractor (requires the Text Extractor plugin).')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.indexPdfs).onChange(async (v) => {
          this.plugin.settings.indexPdfs = v
          await this.plugin.saveSettings()
        })
      )

    new Setting(containerEl)
      .setName('Additional file extensions')
      .setDesc('Extra extensions to index as plain text (one per line, without the dot). Example: txt, canvas')
      .addTextArea((ta) => {
        ta.setPlaceholder('txt\ncanvas')
          .setValue(this.plugin.settings.additionalExtensions.join('\n'))
          .onChange(async (value) => {
            this.plugin.settings.additionalExtensions = value.split('\n').map((s) => s.trim().replace(/^\./, '')).filter(Boolean)
            await this.plugin.saveSettings()
          })
        ta.inputEl.rows = 3
        ta.inputEl.style.width = '100%'
      })

    new Setting(containerEl)
      .setName('Exclude folders')
      .setDesc('Folder path prefixes to skip during indexing (one per line). Example: Templates, Archive/Old')
      .addTextArea((ta) => {
        ta.setPlaceholder('Templates\nArchive')
          .setValue(this.plugin.settings.excludeFolders.join('\n'))
          .onChange(async (value) => {
            this.plugin.settings.excludeFolders = value.split('\n').map((s) => s.trim()).filter(Boolean)
            await this.plugin.saveSettings()
          })
        ta.inputEl.rows = 4
        ta.inputEl.style.width = '100%'
      })

    // ── Maintenance ──────────────────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'Maintenance' })

    new Setting(containerEl)
      .setName('Reindex vault')
      .setDesc('Clears the index cache and rebuilds from scratch. Use if search results seem stale.')
      .addButton((btn) =>
        btn.setButtonText('Reindex now').setCta().onClick(async () => {
          btn.setButtonText('Indexing…').setDisabled(true)
          await this.plugin.reindex()
          btn.setButtonText('Done!').setDisabled(false)
          setTimeout(() => btn.setButtonText('Reindex now'), 2000)
        })
      )
  }
}
