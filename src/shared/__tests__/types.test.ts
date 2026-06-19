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
    expect(IPC_CHANNELS.SETTINGS_TEST_OCR).toBe('settings:test-ocr')
    expect(IPC_CHANNELS.SETTINGS_TEST_LLM).toBe('settings:test-llm')
    expect(IPC_CHANNELS.OCR_PICK_FILES).toBe('ocr:pick-files')
    expect(IPC_CHANNELS.OCR_START_BATCH).toBe('ocr:start-batch')
    expect(IPC_CHANNELS.OCR_CANCEL).toBe('ocr:cancel')
    expect(IPC_CHANNELS.OCR_GET_RESULT).toBe('ocr:get-result')
    expect(IPC_CHANNELS.EXPORT_BATCH).toBe('export:batch')
    expect(IPC_CHANNELS.HISTORY_LIST).toBe('history:list')
    expect(IPC_CHANNELS.HISTORY_GET).toBe('history:get')
    expect(IPC_CHANNELS.HISTORY_CLEAR).toBe('history:clear')
    expect(IPC_CHANNELS.ON_JOB_PROGRESS).toBe('on:job-progress')
    expect(IPC_CHANNELS.ON_BATCH_DONE).toBe('on:batch-done')
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
    expect(DEFAULT_SETTINGS.textin.appId).toBe('')
    expect(DEFAULT_SETTINGS.textin.secretCode).toBe('')
    expect(DEFAULT_SETTINGS.textin.baseUrl).toBe('https://api.textin.com')
    expect(DEFAULT_SETTINGS.llm.baseUrl).toBe('')
    expect(DEFAULT_SETTINGS.llm.apiKey).toBe('')
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
      progress: 50,
      error: 'test error',
    }
    expect(job.jobId).toBe('test-123')
    expect(job.progress).toBe(50)
    expect(job.error).toBe('test error')
  })

  it('should create valid JobResult', () => {
    const result: JobResult = {
      jobId: 'test-123',
      fileName: 'file.jpg',
      rawText: 'raw',
      structuredText: 'structured',
      structuredThoughts: 'structured thoughts',
      summary: 'summary',
      summaryThoughts: 'summary thoughts',
      mode: 'faithful',
      hasPlaceholderWarning: true,
      createdAt: Date.now(),
    }
    expect(result.mode).toBe('faithful')
    expect(result.structuredThoughts).toBe('structured thoughts')
    expect(result.summaryThoughts).toBe('summary thoughts')
    expect(result.hasPlaceholderWarning).toBe(true)
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
      structuredThoughtsPath: '/path/structured-thoughts.md',
      summaryPath: '/path/summary.md',
      summaryThoughtsPath: '/path/summary-thoughts.md',
    }
    expect(item.mode).toBe('enhanced')
    expect(item.structuredThoughtsPath).toBe('/path/structured-thoughts.md')
    expect(item.summaryThoughtsPath).toBe('/path/summary-thoughts.md')
  })
})

describe('IPC Type Maps', () => {
  it('should have type-safe IpcRequest mapping', () => {
    const getSettings: IpcRequest['settings:get'] = {} as unknown as void
    const setSettings: IpcRequest['settings:set'] = { textin: { appId: '', secretCode: '', baseUrl: '' }, llm: { baseUrl: '', apiKey: '', model: '' }, concurrency: 3, chunkThreshold: 12000 }
    
    expect(getSettings).toBeUndefined()
    expect(setSettings.concurrency).toBe(3)
  })

  it('should have type-safe IpcResponse mapping', () => {
    const getSettingsResponse: IpcResponse['settings:get'] = { textin: { appId: '', secretCode: '', baseUrl: '' }, llm: { baseUrl: '', apiKey: '', model: '' }, concurrency: 3, chunkThreshold: 12000 }
    const setSettingsResponse: IpcResponse['settings:set'] = undefined as unknown as void

    expect(getSettingsResponse.concurrency).toBe(3)
    expect(setSettingsResponse).toBeUndefined()
  })

  it('should have type-safe IpcEvents mapping', () => {
    const onJobProgress: IpcEvents['on:job-progress'] = { jobId: '123', filePath: 'test.jpg', fileName: 'test.jpg', stage: 'queued' }
    const onBatchDone: IpcEvents['on:batch-done'] = { total: 5, success: 4, failed: 1 }

    expect(onJobProgress.jobId).toBe('123')
    expect(onBatchDone.total).toBe(5)
    expect(onBatchDone.success).toBe(4)
    expect(onBatchDone.failed).toBe(1)
  })
})
