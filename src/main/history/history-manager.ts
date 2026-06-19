import * as fs from 'fs/promises';
import * as path from 'path';
import * as StoreModule from 'electron-store';
import { HistoryItem, JobResult } from './types';

// Handle default export properly whether it's ESM or CJS
const Store = (StoreModule as any).default || StoreModule;

export class HistoryManager {
  private store: any;
  private ocrResultsDir: string;
  private readonly MAX_HISTORY_ITEMS = 100;

  constructor(userDataPath: string) {
    this.ocrResultsDir = path.join(userDataPath, 'ocr-results');
    this.store = new Store({
      name: 'ocr-history',
      defaults: { history: [] }
    });
  }

  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  async saveResult(result: JobResult): Promise<void> {
    await this.ensureDir(this.ocrResultsDir);

    const jobDir = path.join(this.ocrResultsDir, result.jobId);
    await this.ensureDir(jobDir);

    const historyItem: HistoryItem = {
      jobId: result.jobId,
      timestamp: result.timestamp,
      fileName: result.fileName,
      fileSize: result.fileSize,
      status: result.status,
      errorMessage: result.errorMessage,
      processingTimeMs: result.processingTimeMs,
      hasRawOutput: !!result.rawOutput,
      hasStructuredOutput: !!result.structuredOutput,
      hasSummaryOutput: !!result.summaryOutput,
      files: {}
    };

    if (result.rawOutput) {
      await fs.writeFile(path.join(jobDir, 'raw.txt'), result.rawOutput, 'utf-8');
      historyItem.files!.raw = 'raw.txt';
    }
    
    if (result.structuredOutput) {
      await fs.writeFile(path.join(jobDir, 'structured.md'), result.structuredOutput, 'utf-8');
      historyItem.files!.structured = 'structured.md';
    }

    if (result.summaryOutput) {
      await fs.writeFile(path.join(jobDir, 'summary.md'), result.summaryOutput, 'utf-8');
      historyItem.files!.summary = 'summary.md';
    }

    if (result.structuredThoughts) {
      await fs.writeFile(path.join(jobDir, 'structured-thoughts.txt'), result.structuredThoughts, 'utf-8');
      historyItem.files!.structuredThoughts = 'structured-thoughts.txt';
    }

    if (result.summaryThoughts) {
      await fs.writeFile(path.join(jobDir, 'summary-thoughts.txt'), result.summaryThoughts, 'utf-8');
      historyItem.files!.summaryThoughts = 'summary-thoughts.txt';
    }

    let history: HistoryItem[] = this.store.get('history', []);
    
    const existingIndex = history.findIndex(h => h.jobId === result.jobId);
    if (existingIndex >= 0) {
      history[existingIndex] = historyItem;
    } else {
      history.push(historyItem);
    }

    history.sort((a, b) => b.timestamp - a.timestamp);

    if (history.length > this.MAX_HISTORY_ITEMS) {
      const itemsToRemove = history.slice(this.MAX_HISTORY_ITEMS);
      history = history.slice(0, this.MAX_HISTORY_ITEMS);
      
      for (const item of itemsToRemove) {
        try {
          const dirToRemove = path.join(this.ocrResultsDir, item.jobId);
          await fs.rm(dirToRemove, { recursive: true, force: true });
        } catch (error) {
          console.error(`Failed to delete old job directory ${item.jobId}:`, error);
        }
      }
    }

    this.store.set('history', history);
  }

  listHistory(): HistoryItem[] {
    const history: HistoryItem[] = this.store.get('history', []);
    return history.sort((a, b) => b.timestamp - a.timestamp);
  }

  private async readFileIfExists(jobDir: string, fileName?: string): Promise<string | undefined> {
    if (!fileName) return undefined;
    try {
      const filePath = path.join(jobDir, fileName);
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return undefined;
    }
  }

  async getResult(jobId: string): Promise<JobResult | null> {
    const history: HistoryItem[] = this.store.get('history', []);
    const item = history.find(h => h.jobId === jobId);
    
    if (!item) return null;

    const jobDir = path.join(this.ocrResultsDir, jobId);
    
    const result: JobResult = {
      jobId: item.jobId,
      fileName: item.fileName,
      fileSize: item.fileSize,
      status: item.status,
      errorMessage: item.errorMessage,
      timestamp: item.timestamp,
      processingTimeMs: item.processingTimeMs
    };

    if (item.files) {
      result.rawOutput = await this.readFileIfExists(jobDir, item.files.raw);
      result.structuredOutput = await this.readFileIfExists(jobDir, item.files.structured);
      result.summaryOutput = await this.readFileIfExists(jobDir, item.files.summary);
      result.structuredThoughts = await this.readFileIfExists(jobDir, item.files.structuredThoughts);
      result.summaryThoughts = await this.readFileIfExists(jobDir, item.files.summaryThoughts);
    }

    return result;
  }

  async clearHistory(): Promise<void> {
    this.store.set('history', []);
    
    try {
      await fs.rm(this.ocrResultsDir, { recursive: true, force: true });
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to clear history directory:', error);
      }
    }
  }
}
