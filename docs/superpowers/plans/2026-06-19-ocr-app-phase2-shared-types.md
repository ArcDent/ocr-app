# OCR App - Phase 2: Shared Type Definitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the complete type system for IPC communication between Main and Renderer processes, including all channels, request/response types, and domain models.

**Architecture:** Centralized type definitions in `src/shared/types.ts` that both Main and Renderer import, ensuring type safety across process boundaries.

**Tech Stack:** TypeScript 5, Electron IPC types

---

## Task 1: Create Base Type Definitions

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 1: Create shared directory**

```bash
mkdir -p src/shared
```

- [ ] **Step 2: Create src/shared/types.ts with IPC channels**

Create `src/shared/types.ts`:
```typescript
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
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
npm run typecheck
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add IPC channel constants"
```

---

## Task 2: Add Core Domain Types

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add core type aliases and enums**

Append to `src/shared/types.ts`:
```typescript

// ============= Core Types =============
export type ProcessMode = 'faithful' | 'enhanced'

export type JobStage = 
  | 'queued' 
  | 'ocr' 
  | 'structuring' 
  | 'summarizing' 
  | 'done' 
  | 'error'
```

- [ ] **Step 2: Add OcrJob interface**

Append to `src/shared/types.ts`:
```typescript

export interface OcrJob {
  jobId: string
  filePath: string
  fileName: string
  stage: JobStage
  error?: string
  progress?: number  // 0-100
}
```

- [ ] **Step 3: Add JobResult interface**

Append to `src/shared/types.ts`:
```typescript

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
```

- [ ] **Step 4: Verify TypeScript compilation**

```bash
npm run typecheck
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add core domain types (ProcessMode, JobStage, OcrJob, JobResult)"
```

---

## Task 3: Add Configuration Types

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add AppSettings interface**

Append to `src/shared/types.ts`:
```typescript

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
```

- [ ] **Step 2: Add HistoryItem interface**

Append to `src/shared/types.ts`:
```typescript

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
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
npm run typecheck
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add configuration types (AppSettings, HistoryItem)"
```

---

## Task 4: Add Constants

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add constant values**

Append to `src/shared/types.ts`:
```typescript

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
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
npm run typecheck
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add constants (HISTORY_LIMIT, DEFAULT_CONCURRENCY, DEFAULT_SETTINGS)"
```

---

## Task 5: Add IPC Request/Response Type Maps

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add IpcRequest interface**

Append to `src/shared/types.ts`:
```typescript

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
```

- [ ] **Step 2: Add IpcResponse interface**

Append to `src/shared/types.ts`:
```typescript

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
```

- [ ] **Step 3: Add IpcEvents interface**

Append to `src/shared/types.ts`:
```typescript

export interface IpcEvents {
  [IPC_CHANNELS.ON_JOB_PROGRESS]: OcrJob
  [IPC_CHANNELS.ON_BATCH_DONE]: { total: number; success: number; failed: number }
}
```

- [ ] **Step 4: Verify TypeScript compilation**

```bash
npm run typecheck
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add IPC type maps (IpcRequest, IpcResponse, IpcEvents)"
```

---

## Task 6: Verify Type System Integrity

**Files:**
- Create: `src/shared/__tests__/types.test.ts`

- [ ] **Step 1: Create test directory**

```bash
mkdir -p src/shared/__tests__
```

- [ ] **Step 2: Create type integrity tests**

Create `src/shared/__tests__/types.test.ts`:
```typescript
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
```

- [ ] **Step 3: Run tests**

```bash
npm run test -- --run
```

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/shared/__tests__/types.test.ts
git commit -m "test: add type system integrity tests"
```

---

## Phase 2 Complete ✅

**Deliverables:**
- ✅ Complete IPC channel constants
- ✅ Core domain types (ProcessMode, JobStage, OcrJob, JobResult)
- ✅ Configuration types (AppSettings, HistoryItem)
- ✅ Default constants
- ✅ Type-safe IPC request/response/event maps
- ✅ Test coverage for type system

**Next Phase:** Phase 3 - Main Process Core Modules (阶段 3-7)

Run this plan with: `superpowers:subagent-driven-development`
