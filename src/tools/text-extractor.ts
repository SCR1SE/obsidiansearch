import type { App, TFile } from 'obsidian'

export interface TextExtractorApi {
  extractText: (file: TFile) => Promise<string>
  canFileBeExtracted: (filePath: string) => boolean
  isInCache: (file: TFile) => Promise<boolean>
}

export function getTextExtractor(app: App): TextExtractorApi | null {
  return (app as any).plugins?.plugins?.['text-extractor']?.api ?? null
}
