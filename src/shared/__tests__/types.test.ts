import { describe, it, expect } from 'vitest'
import {
  IPC_CHANNELS,
  ProcessMode,
  JobStage,
  OcrJob,
  JobResult,
  AppSettings,
  HistoryItem,
  IpcRequest,
  IpcResponse,
  IpcEvents,
  HISTORY_LIMIT,
  DEFAULT_CONCURRENCY,
  DEFAULT_CHUNK_THRESHOLD,
  DEFAULT_SETTINGS,
} from '../types'

describe('IPC_CHANNELS', () => {
  it('should have all required channels', () => {
    expect(IPC_CHANNELS.SETTINGS_GET).toBe('settings:get')
    expect(IPC_CHANNELS.SETTINGS_SET).toBe('settings:set')
    expect(IPC_CHANNELS.OCR_START_BATCH).toBe('ocr:start-batch')
    expect(IPC_CHANNELS.ON_JOB_PROGRESS).toBe('on:job-progress')
  })

  it('should have unique channel values', () => {
    const values = Object.values(IPC_CHANNELS)
    const uniqueValues = new Set(values)
    expect(uniqueValues.size).toBe(values.length)
  })
})

describe('ProcessMode', () => {
  it('should allow faithful and enhanced', () => {
    const faithful: ProcessMode = 'faithful'
    const enhanced: ProcessMode = 'enhanced'
    expect(faithful).toBe('faithful')
    expect(enhanced).toBe('enhanced')
  })
})

describe('JobStage', () => {
  it('should have all stages', () => {
    const stages: JobStage[] = ['queued', 'ocr', 'structuring', 'summarizing', 'done', 'error']
    stages.forEach(stage => {
      const s: JobStage = stage
      expect(s).toBe(stage)
    })
  })
})

describe('Constants', () => {
  it('should have correct default values', () => {
    expect(HISTORY_LIMIT).toBe(100)
    expect(DEFAULT_CONCURRENCY).toBe(3)
    expect(DEFAULT_CHUNK_THRESHOLD).toBe(12000)
  })

  it('should have valid DEFAULT_SETTINGS', () => {
    expect(DEFAULT_SETTINGS.textin.baseUrl).toBe('https://api.textin.com')
    expect(DEFAULT_SETTINGS.llm.model).toBe('gpt-4')
    expect(DEFAULT_SETTINGS.concurrency).toBe(3)
    expect(DEFAULT_SETTINGS.chunkThreshold).toBe(12000)
  })
})

describe('Type Interfaces', () => {
  it('should create valid OcrJob', () => {
    const job: OcrJob = {
      jobId: 'test-123',
      filePath: '/path/to/file.jpg',
      fileName: 'file.jpg',
      stage: 'queued',
    }
    expect(job.jobId).toBe('test-123')
  })

  it('should create valid JobResult', () => {
    const result: JobResult = {
      jobId: 'test-123',
      fileName: 'file.jpg',
      rawText: 'raw',
      structuredText: 'structured',
      summary: 'summary',
      mode: 'faithful',
      createdAt: Date.now(),
    }
    expect(result.mode).toBe('faithful')
  })

  it('should create valid AppSettings', () => {
    const settings: AppSettings = {
      textin: {
        appId: 'app-id',
        secretCode: 'secret',
        baseUrl: 'https://api.textin.com',
      },
      llm: {
        baseUrl: 'https://api.openai.com',
        apiKey: 'key',
        model: 'gpt-4',
      },
      concurrency: 3,
      chunkThreshold: 12000,
    }
    expect(settings.concurrency).toBe(3)
  })

  it('should create valid HistoryItem', () => {
    const item: HistoryItem = {
      jobId: 'test-123',
      fileName: 'file.jpg',
      mode: 'enhanced',
      hasPlaceholderWarning: false,
      createdAt: Date.now(),
      rawTextPath: '/path/raw.txt',
      structuredTextPath: '/path/structured.md',
      summaryPath: '/path/summary.md',
    }
    expect(item.mode).toBe('enhanced')
  })
})

describe('IPC Type Maps', () => {
  it('should have type-safe IpcRequest mapping', () => {
    // TypeScript compile-time check
    const requestTypes: IpcRequest = {} as IpcRequest
    expect(typeof requestTypes).toBe('object')
  })

  it('should have type-safe IpcResponse mapping', () => {
    const responseTypes: IpcResponse = {} as IpcResponse
    expect(typeof responseTypes).toBe('object')
  })

  it('should have type-safe IpcEvents mapping', () => {
    const eventTypes: IpcEvents = {} as IpcEvents
    expect(typeof eventTypes).toBe('object')
  })
})