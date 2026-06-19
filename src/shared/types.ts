// ============= IPC Channel Constants =============
export const IPC_CHANNELS = {
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_TEST_OCR: 'settings:test-ocr',
  SETTINGS_TEST_LLM: 'settings:test-llm',

  // OCR Operations
  OCR_PICK_FILES: 'ocr:pick-files',
  OCR_START_BATCH: 'ocr:start-batch',
  OCR_CANCEL: 'ocr:cancel',
  OCR_GET_RESULT: 'ocr:get-result',

  // Export
  EXPORT_BATCH: 'export:batch',

  // History
  HISTORY_LIST: 'history:list',
  HISTORY_GET: 'history:get',
  HISTORY_CLEAR: 'history:clear',

  // Events (Main -> Renderer)
  ON_JOB_PROGRESS: 'on:job-progress',
  ON_BATCH_DONE: 'on:batch-done',
} as const

// ============= Core Types =============
export type ProcessMode = 'faithful' | 'enhanced'

export type JobStage =
  | 'queued'
  | 'ocr'
  | 'structuring'
  | 'summarizing'
  | 'done'
  | 'error'

export interface OcrJob {
  jobId: string
  filePath: string
  fileName: string
  stage: JobStage
  error?: string
  progress?: number  // 0-100
}

export interface JobResult {
  jobId: string
  fileName: string
  rawText: string
  structuredText: string
  structuredThoughts?: string
  summary: string
  summaryThoughts?: string
  mode: ProcessMode
  hasPlaceholderWarning?: boolean
  createdAt: number
}

export interface AppSettings {
  textin: {
    appId: string
    secretCode: string
    baseUrl: string
  }
  llm: {
    baseUrl: string
    apiKey: string
    model: string
  }
  concurrency: number
  chunkThreshold: number
}

export interface HistoryItem {
  jobId: string
  fileName: string
  mode: ProcessMode
  hasPlaceholderWarning: boolean
  createdAt: number
  rawTextPath: string
  structuredTextPath: string
  structuredThoughtsPath?: string
  summaryPath: string
  summaryThoughtsPath?: string
}

// ============= Constants =============
export const HISTORY_LIMIT = 100
export const DEFAULT_CONCURRENCY = 3
export const DEFAULT_CHUNK_THRESHOLD = 12000

export const DEFAULT_SETTINGS: AppSettings = {
  textin: {
    appId: '',
    secretCode: '',
    baseUrl: 'https://api.textin.com',
  },
  llm: {
    baseUrl: '',
    apiKey: '',
    model: 'gpt-4',
  },
  concurrency: DEFAULT_CONCURRENCY,
  chunkThreshold: DEFAULT_CHUNK_THRESHOLD,
}

// ============= IPC Request/Response Types =============
export interface IpcRequest {
  [IPC_CHANNELS.SETTINGS_GET]: void
  [IPC_CHANNELS.SETTINGS_SET]: AppSettings
  [IPC_CHANNELS.SETTINGS_TEST_OCR]: void
  [IPC_CHANNELS.SETTINGS_TEST_LLM]: void
  [IPC_CHANNELS.OCR_PICK_FILES]: { type: 'files' | 'directory' }
  [IPC_CHANNELS.OCR_START_BATCH]: { paths: string[]; mode: ProcessMode }
  [IPC_CHANNELS.OCR_CANCEL]: void
  [IPC_CHANNELS.OCR_GET_RESULT]: { jobId: string }
  [IPC_CHANNELS.EXPORT_BATCH]: { jobIds: string[]; outputDir: string }
  [IPC_CHANNELS.HISTORY_LIST]: void
  [IPC_CHANNELS.HISTORY_GET]: { jobId: string }
  [IPC_CHANNELS.HISTORY_CLEAR]: void
}

export interface IpcResponse {
  [IPC_CHANNELS.SETTINGS_GET]: AppSettings
  [IPC_CHANNELS.SETTINGS_SET]: void
  [IPC_CHANNELS.SETTINGS_TEST_OCR]: { success: boolean; message: string }
  [IPC_CHANNELS.SETTINGS_TEST_LLM]: { success: boolean; message: string }
  [IPC_CHANNELS.OCR_PICK_FILES]: string[]
  [IPC_CHANNELS.OCR_START_BATCH]: void
  [IPC_CHANNELS.OCR_CANCEL]: void
  [IPC_CHANNELS.OCR_GET_RESULT]: JobResult | null
  [IPC_CHANNELS.EXPORT_BATCH]: { success: boolean; exportedCount: number }
  [IPC_CHANNELS.HISTORY_LIST]: HistoryItem[]
  [IPC_CHANNELS.HISTORY_GET]: JobResult | null
  [IPC_CHANNELS.HISTORY_CLEAR]: void
}

export interface IpcEvents {
  [IPC_CHANNELS.ON_JOB_PROGRESS]: OcrJob
  [IPC_CHANNELS.ON_BATCH_DONE]: { total: number; success: number; failed: number }
}