import * as fs from 'fs/promises'
import * as path from 'path'
import * as StoreModule from 'electron-store'
import { JobResult, HistoryItem } from '../../shared/types'

const Store = (StoreModule as any).default || StoreModule

const MAX_HISTORY_ITEMS = 100

export class HistoryManager {
  private store: any
  private ocrResultsDir: string

  constructor(userDataPath: string) {
    this.ocrResultsDir = path.join(userDataPath, 'ocr-results')
    this.store = new Store({
      name: 'ocr-history',
      defaults: { history: [] },
    })
  }

  async saveResult(result: JobResult): Promise<void> {
    const jobDir = path.join(this.ocrResultsDir, result.jobId)
    await fs.mkdir(jobDir, { recursive: true })

    const item: HistoryItem = {
      jobId: result.jobId,
      fileName: result.fileName,
      mode: result.mode,
      hasPlaceholderWarning: !!result.hasPlaceholderWarning,
      createdAt: result.createdAt,
      rawTextPath: '',
      structuredTextPath: '',
      summaryPath: '',
    }

    if (result.rawText) {
      const p = path.join(jobDir, 'raw.txt')
      await fs.writeFile(p, result.rawText, 'utf-8')
      item.rawTextPath = p
    }
    if (result.structuredText) {
      const p = path.join(jobDir, 'structured.md')
      await fs.writeFile(p, result.structuredText, 'utf-8')
      item.structuredTextPath = p
    }
    if (result.structuredThoughts) {
      const p = path.join(jobDir, 'structured-thoughts.txt')
      await fs.writeFile(p, result.structuredThoughts, 'utf-8')
      item.structuredThoughtsPath = p
    }
    if (result.summary) {
      const p = path.join(jobDir, 'summary.md')
      await fs.writeFile(p, result.summary, 'utf-8')
      item.summaryPath = p
    }
    if (result.summaryThoughts) {
      const p = path.join(jobDir, 'summary-thoughts.txt')
      await fs.writeFile(p, result.summaryThoughts, 'utf-8')
      item.summaryThoughtsPath = p
    }

    let history: HistoryItem[] = this.store.get('history', [])
    const existingIndex = history.findIndex((h) => h.jobId === result.jobId)
    if (existingIndex >= 0) {
      history[existingIndex] = item
    } else {
      history.push(item)
    }
    history.sort((a, b) => b.createdAt - a.createdAt)

    if (history.length > MAX_HISTORY_ITEMS) {
      const itemsToRemove = history.slice(MAX_HISTORY_ITEMS)
      history = history.slice(0, MAX_HISTORY_ITEMS)
      for (const itemToRemove of itemsToRemove) {
        try {
          await fs.rm(path.join(this.ocrResultsDir, itemToRemove.jobId), {
            recursive: true,
            force: true,
          })
        } catch (error) {
          console.error(`Failed to delete old job directory ${itemToRemove.jobId}:`, error)
        }
      }
    }

    this.store.set('history', history)
  }

  listHistory(): HistoryItem[] {
    const history: HistoryItem[] = this.store.get('history', [])
    return history.sort((a, b) => b.createdAt - a.createdAt)
  }

  private async readFileIfExists(filePath: string): Promise<string | undefined> {
    try {
      return await fs.readFile(filePath, 'utf-8')
    } catch {
      return undefined
    }
  }

  async getJob(jobId: string): Promise<JobResult | null> {
    const history: HistoryItem[] = this.store.get('history', [])
    const item = history.find((h) => h.jobId === jobId)
    if (!item) return null

    const rawText = item.rawTextPath ? await this.readFileIfExists(item.rawTextPath) : undefined
    const structuredText = item.structuredTextPath
      ? await this.readFileIfExists(item.structuredTextPath)
      : undefined
    const summary = item.summaryPath ? await this.readFileIfExists(item.summaryPath) : undefined

    // Data integrity: required fields must be readable and non-empty
    if (!rawText || !structuredText || !summary) {
      return null
    }

    const structuredThoughts = item.structuredThoughtsPath
      ? await this.readFileIfExists(item.structuredThoughtsPath)
      : undefined
    const summaryThoughts = item.summaryThoughtsPath
      ? await this.readFileIfExists(item.summaryThoughtsPath)
      : undefined

    return {
      jobId: item.jobId,
      fileName: item.fileName,
      rawText,
      structuredText,
      structuredThoughts,
      summary,
      summaryThoughts,
      mode: item.mode,
      hasPlaceholderWarning: item.hasPlaceholderWarning,
      createdAt: item.createdAt,
    }
  }

  async clearHistory(): Promise<void> {
    this.store.set('history', [])
    try {
      await fs.rm(this.ocrResultsDir, { recursive: true, force: true })
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to clear history directory:', error)
      }
    }
  }
}
