import { App, SuggestModal, TFile } from 'obsidian'

export class BasesModal extends SuggestModal<TFile> {
  private bases: TFile[]

  constructor(app: App) {
    super(app)
    this.setPlaceholder('Search Bases files…')
    this.setInstructions([
      { command: '↑↓', purpose: 'navigate' },
      { command: '↵', purpose: 'open base' },
      { command: 'esc', purpose: 'dismiss' },
    ])
    this.bases = app.vault.getFiles().filter((f) => f.extension === 'base')
  }

  getSuggestions(query: string): TFile[] {
    const q = query.trim().toLowerCase()
    if (!q) return this.bases
    return this.bases.filter(
      (f) =>
        f.basename.toLowerCase().includes(q) ||
        f.path.toLowerCase().includes(q)
    )
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    const root = el.createDiv({ cls: 'property-search-result' })

    const titleRow = root.createDiv({ cls: 'property-search-result__title' })
    titleRow.createSpan({ text: '🗃️ ' })
    titleRow.createSpan({ text: file.basename })
    titleRow.createSpan({ cls: 'ps-badge', text: '.base' })

    const dir = file.path.includes('/')
      ? file.path.slice(0, file.path.lastIndexOf('/'))
      : ''
    if (dir) {
      root.createDiv({ cls: 'property-search-result__path', text: dir })
    }
  }

  onChooseSuggestion(file: TFile): void {
    this.app.workspace.openLinkText(file.path, '', false)
  }
}
