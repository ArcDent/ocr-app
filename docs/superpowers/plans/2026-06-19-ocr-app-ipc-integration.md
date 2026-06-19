# ocr-app IPC 集成与类型对齐 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `npm run dev` 跑通设置/批量/导出/历史全链路，并把 history、export、orchestrator 三模块对齐到 2026-06-17 spec 的 `shared/types.ts` 契约。

**Architecture:** 方案 C 混合切——先做类型契约层对齐（重写 history-manager、markdown-exporter，修 orchestrator 的 placeholder 调用，单测验证不回归），再做接线层（新建 ipc-handlers.ts 并在 index.ts 注册，renderer 去 temp ID 改用 backend 发的 jobId）。

**Tech Stack:** Electron 28, TypeScript 5.9, vitest 1.6, electron-store, uuid, React 18, zustand。

**上游 spec:** `docs/superpowers/specs/2026-06-19-ocr-app-ipc-integration-design.md`

**运行测试命令:** `npm test -- --run`（在 WSL 原生终端，非 Windows UNC 路径）

---

## 文件结构

**类型契约层（阶段 1）：**
- `src/shared/types.ts` — 补 `HistoryItem` interface
- `src/main/history/types.ts` — **删除**（自造类型）
- `src/main/history/history-manager.ts` — 按 spec 重写（用 shared 类型 + 五份落盘）
- `src/main/history/__tests__/history-manager.test.ts` — 重写测试为 spec 字段
- `src/main/export/markdown-exporter.ts` — 按 spec 重写（`structuredText`/`summary`）
- `src/main/export/__tests__/markdown-exporter.test.ts` — 重写 createMockResult 为 spec 字段
- `src/main/pipeline/orchestrator.ts` — 修 `assertNoPlaceholder().clean`；新增 `getJobs()`

**接线层（阶段 2）：**
- `src/main/ipc-handlers.ts` — **新建**，全部 IPC 通道
- `src/main/__tests__/ipc-handlers.test.ts` — **新建**，逐通道测试
- `src/main/index.ts` — 调 `registerIpcHandlers()`
- `src/renderer/src/stores/useOcrStore.ts` — 去 temp ID，加 `pendingFiles`
- `src/renderer/src/__tests__/stores/useOcrStore.test.ts` — **新建**
- `src/renderer/src/components/FileQueueList.tsx` — 扩展 props 加 `pendingFiles`
- `src/renderer/src/__tests__/components/FileQueueList.test.tsx` — 适配新 props
- `src/renderer/src/App.tsx` — 传 `pendingFiles`，start 按钮 disabled 基于 pendingFiles

---

## 阶段 1：类型契约层对齐

### Task 1: shared/types.ts 补 HistoryItem

**Files:**
- Modify: `src/shared/types.ts`（在 `HistoryItem` 位置追加，当前无此 interface）

- [ ] **Step 1: 在 shared/types.ts 追加 HistoryItem interface**

在 `src/shared/types.ts` 的 `JobResult` interface 之后（约第 59 行后）追加：

```ts
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

- [ ] **Step 2: 验证 typecheck**

Run: `npx tsc --noEmit`（或 Windows 端 `node ./node_modules/typescript/bin/tsc --noEmit`）
Expected: 无新增错误（`HistoryItem` 未被使用不报错）

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add HistoryItem interface to shared types"
```

---

### Task 2: 重写 history-manager.ts 用 shared 类型 + spec 落盘

**Files:**
- Modify: `src/main/history/history-manager.ts`（整体重写）
- Delete: `src/main/history/types.ts`

- [ ] **Step 1: 重写 history-manager.ts**

用以下完整内容替换 `src/main/history/history-manager.ts`：

```ts
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
```

- [ ] **Step 2: 删除 history/types.ts**

```bash
git rm src/main/history/types.ts
```

- [ ] **Step 3: 验证 typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误（history-manager 已改用 shared 类型）

- [ ] **Step 4: Commit（测试在 Task 3 重写，此处先提交实现）**

```bash
git add src/main/history/history-manager.ts
git commit -m "refactor: rewrite history-manager to use shared types and spec disk layout"
```

---

### Task 3: 重写 history-manager.test.ts 为 spec 字段

**Files:**
- Modify: `src/main/history/__tests__/history-manager.test.ts`（整体重写）

- [ ] **Step 1: 重写测试文件**

用以下完整内容替换 `src/main/history/__tests__/history-manager.test.ts`：

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import { HistoryManager } from '../history-manager'
import { JobResult } from '../../../shared/types'

const mockStoreGet = vi.fn()
const mockStoreSet = vi.fn()

vi.mock('electron-store', () => ({
  default: vi.fn().mockImplementation(() => ({
    get: mockStoreGet,
    set: mockStoreSet,
  })),
}))

vi.mock('fs/promises', () => ({
  access: vi.fn(),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
  rm: vi.fn().mockResolvedValue(undefined),
}))

describe('HistoryManager', () => {
  let manager: HistoryManager
  const userDataPath = '/mock/userData'

  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreGet.mockReturnValue([])
    manager = new HistoryManager(userDataPath)
  })

  const makeResult = (overrides: Partial<JobResult> = {}): JobResult => ({
    jobId: 'job-1',
    fileName: 'test.pdf',
    rawText: 'raw text',
    structuredText: '# structured',
    summary: '# summary',
    mode: 'faithful',
    hasPlaceholderWarning: false,
    createdAt: 1000,
    ...overrides,
  })

  describe('saveResult', () => {
    it('writes five files and stores HistoryItem with absolute paths', async () => {
      const result = makeResult({
        structuredThoughts: 's-thoughts',
        summaryThoughts: 'sum-thoughts',
      })

      await manager.saveResult(result)

      const jobDir = path.join(userDataPath, 'ocr-results', 'job-1')
      expect(fs.mkdir).toHaveBeenCalledWith(jobDir, { recursive: true })
      expect(fs.writeFile).toHaveBeenCalledWith(path.join(jobDir, 'raw.txt'), 'raw text', 'utf-8')
      expect(fs.writeFile).toHaveBeenCalledWith(path.join(jobDir, 'structured.md'), '# structured', 'utf-8')
      expect(fs.writeFile).toHaveBeenCalledWith(path.join(jobDir, 'summary.md'), '# summary', 'utf-8')
      expect(fs.writeFile).toHaveBeenCalledWith(path.join(jobDir, 'structured-thoughts.txt'), 's-thoughts', 'utf-8')
      expect(fs.writeFile).toHaveBeenCalledWith(path.join(jobDir, 'summary-thoughts.txt'), 'sum-thoughts', 'utf-8')

      expect(mockStoreSet).toHaveBeenCalledWith(
        'history',
        expect.arrayContaining([
          expect.objectContaining({
            jobId: 'job-1',
            fileName: 'test.pdf',
            mode: 'faithful',
            rawTextPath: path.join(jobDir, 'raw.txt'),
            structuredTextPath: path.join(jobDir, 'structured.md'),
            summaryPath: path.join(jobDir, 'summary.md'),
            structuredThoughtsPath: path.join(jobDir, 'structured-thoughts.txt'),
            summaryThoughtsPath: path.join(jobDir, 'summary-thoughts.txt'),
          }),
        ])
      )
    })

    it('omits optional files when fields missing', async () => {
      const result = makeResult({ structuredThoughts: undefined, summaryThoughts: undefined })

      await manager.saveResult(result)

      const jobDir = path.join(userDataPath, 'ocr-results', 'job-1')
      expect(fs.writeFile).toHaveBeenCalledWith(path.join(jobDir, 'raw.txt'), 'raw text', 'utf-8')
      expect(fs.writeFile).not.toHaveBeenCalledWith(
        path.join(jobDir, 'structured-thoughts.txt'),
        expect.anything(),
        expect.anything()
      )
      expect(fs.writeFile).not.toHaveBeenCalledWith(
        path.join(jobDir, 'summary-thoughts.txt'),
        expect.anything(),
        expect.anything()
      )

      const saved = mockStoreSet.mock.calls[0][1][0]
      expect(saved.structuredThoughtsPath).toBeUndefined()
      expect(saved.summaryThoughtsPath).toBeUndefined()
    })

    it('limits to 100 items and deletes oldest directory', async () => {
      const existing = Array.from({ length: 100 }, (_, i) => ({
        jobId: `job-${i}`,
        fileName: 'x.pdf',
        mode: 'faithful' as const,
        hasPlaceholderWarning: false,
        createdAt: i,
        rawTextPath: `/p/raw.txt`,
        structuredTextPath: `/p/structured.md`,
        summaryPath: `/p/summary.md`,
      }))
      mockStoreGet.mockReturnValue(existing)

      await manager.saveResult(makeResult({ jobId: 'job-new', createdAt: 1000 }))

      const saved = mockStoreSet.mock.calls[0][1]
      expect(saved.length).toBe(100)
      expect(saved[0].jobId).toBe('job-new')
      expect(saved.find((h: any) => h.jobId === 'job-0')).toBeUndefined()
      expect(fs.rm).toHaveBeenCalledWith(
        path.join(userDataPath, 'ocr-results', 'job-0'),
        { recursive: true, force: true }
      )
    })

    it('updates existing job when same ID saved again', async () => {
      mockStoreGet.mockReturnValue([
        {
          jobId: 'job-1',
          fileName: 'old.pdf',
          mode: 'faithful',
          hasPlaceholderWarning: false,
          createdAt: 500,
          rawTextPath: '/p/raw.txt',
          structuredTextPath: '/p/structured.md',
          summaryPath: '/p/summary.md',
        },
      ])

      await manager.saveResult(makeResult({ jobId: 'job-1', fileName: 'new.pdf', createdAt: 2000 }))

      const saved = mockStoreSet.mock.calls[0][1]
      expect(saved.length).toBe(1)
      expect(saved[0].fileName).toBe('new.pdf')
      expect(saved[0].createdAt).toBe(2000)
    })
  })

  describe('listHistory', () => {
    it('returns history sorted by createdAt descending', () => {
      mockStoreGet.mockReturnValue([
        { jobId: 'a', createdAt: 100, mode: 'faithful' },
        { jobId: 'c', createdAt: 300, mode: 'faithful' },
        { jobId: 'b', createdAt: 200, mode: 'faithful' },
      ])

      const result = manager.listHistory()

      expect(result.map((h) => h.jobId)).toEqual(['c', 'b', 'a'])
    })
  })

  describe('getJob', () => {
    it('returns null when job not found', async () => {
      mockStoreGet.mockReturnValue([])
      const result = await manager.getJob('nope')
      expect(result).toBeNull()
    })

    it('returns null when a required file is missing (data corruption)', async () => {
      mockStoreGet.mockReturnValue([
        {
          jobId: 'job-1',
          fileName: 'test.pdf',
          mode: 'faithful',
          hasPlaceholderWarning: false,
          createdAt: 1000,
          rawTextPath: '/mock/raw.txt',
          structuredTextPath: '/mock/structured.md',
          summaryPath: '/mock/summary.md',
        },
      ])
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'))

      const result = await manager.getJob('job-1')
      expect(result).toBeNull()
    })

    it('assembles JobResult from disk files', async () => {
      mockStoreGet.mockReturnValue([
        {
          jobId: 'job-1',
          fileName: 'test.pdf',
          mode: 'enhanced',
          hasPlaceholderWarning: true,
          createdAt: 1000,
          rawTextPath: '/mock/raw.txt',
          structuredTextPath: '/mock/structured.md',
          summaryPath: '/mock/summary.md',
          structuredThoughtsPath: '/mock/s-thoughts.txt',
        },
      ])
      vi.mocked(fs.readFile).mockImplementation(async (filePath: any) => {
        if (filePath.endsWith('raw.txt')) return 'raw'
        if (filePath.endsWith('structured.md')) return 'structured'
        if (filePath.endsWith('summary.md')) return 'summary'
        if (filePath.endsWith('s-thoughts.txt')) return 's-thoughts'
        throw new Error('ENOENT')
      })

      const result = await manager.getJob('job-1')

      expect(result).toEqual({
        jobId: 'job-1',
        fileName: 'test.pdf',
        rawText: 'raw',
        structuredText: 'structured',
        structuredThoughts: 's-thoughts',
        summary: 'summary',
        summaryThoughts: undefined,
        mode: 'enhanced',
        hasPlaceholderWarning: true,
        createdAt: 1000,
      })
    })
  })

  describe('clearHistory', () => {
    it('clears store and removes results directory', async () => {
      await manager.clearHistory()

      expect(mockStoreSet).toHaveBeenCalledWith('history', [])
      expect(fs.rm).toHaveBeenCalledWith(
        path.join(userDataPath, 'ocr-results'),
        { recursive: true, force: true }
      )
    })
  })
})
```

- [ ] **Step 2: 运行测试**

Run: `npm test -- --run src/main/history/__tests__/history-manager.test.ts`
Expected: 所有 HistoryManager 测试通过

- [ ] **Step 3: Commit**

```bash
git add src/main/history/__tests__/history-manager.test.ts
git commit -m "test: rewrite history-manager tests for spec JobResult fields"
```

---

### Task 4: 重写 markdown-exporter.ts 用 spec 字段

**Files:**
- Modify: `src/main/export/markdown-exporter.ts`（整体重写）

- [ ] **Step 1: 重写 markdown-exporter.ts**

用以下完整内容替换 `src/main/export/markdown-exporter.ts`：

```ts
import { promises as fs } from 'fs'
import * as path from 'path'
import { JobResult } from '../../shared/types'

export async function exportBatch(
  results: JobResult[],
  outputDir: string
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0
  const generatedFiles: { name: string; summary: string; relativePath: string }[] = []

  try {
    await fs.mkdir(outputDir, { recursive: true })
  } catch (error) {
    throw new Error(`Failed to create output directory: ${error}`)
  }

  for (const result of results) {
    try {
      if (!result.jobId || !result.structuredText?.trim() || !result.summary?.trim()) {
        failed++
        continue
      }

      const baseName = result.fileName || `job-${result.jobId}`
      const baseNameWithoutExt = baseName.replace(/\.[^/.]+$/, '')
      let fileName = `${baseNameWithoutExt}.md`
      let filePath = path.join(outputDir, fileName)

      let counter = 1
      while (true) {
        try {
          await fs.access(filePath)
          fileName = `${baseNameWithoutExt}-${counter}.md`
          filePath = path.join(outputDir, fileName)
          counter++
        } catch {
          break
        }
      }

      const content = `# ${fileName.replace(/\.md$/, '')}\n\n## 摘要\n${result.summary}\n\n## 正文\n${result.structuredText}\n`

      await fs.writeFile(filePath, content, 'utf8')

      generatedFiles.push({
        name: fileName.replace(/\.md$/, ''),
        summary: result.summary,
        relativePath: fileName,
      })

      success++
    } catch (error) {
      console.error(`Failed to export result ${result.jobId}:`, error)
      failed++
    }
  }

  if (success > 0) {
    try {
      const dateStr = new Date().toISOString().split('T')[0]
      let indexContent = `# OCR 批量导出 - ${dateStr}\n\n`
      for (const file of generatedFiles) {
        const firstLineSummary = file.summary.split('\n')[0].trim()
        indexContent += `- [${file.name}](${file.relativePath}): ${firstLineSummary}\n`
      }
      await fs.writeFile(path.join(outputDir, 'index.md'), indexContent, 'utf8')
    } catch (error) {
      console.error('Failed to generate index.md:', error)
    }
  }

  return { success, failed }
}
```

- [ ] **Step 2: 验证 typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit（测试在 Task 5 重写）**

```bash
git add src/main/export/markdown-exporter.ts
git commit -m "refactor: rewrite markdown-exporter to use spec JobResult fields"
```

---

### Task 5: 重写 markdown-exporter.test.ts 为 spec 字段

**Files:**
- Modify: `src/main/export/__tests__/markdown-exporter.test.ts`（整体重写）

- [ ] **Step 1: 重写测试文件**

用以下完整内容替换 `src/main/export/__tests__/markdown-exporter.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import * as path from 'path'
import { exportBatch } from '../markdown-exporter'
import type { JobResult } from '../../../shared/types'

vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
  },
}))

describe('markdown-exporter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fs.mkdir).mockResolvedValue(undefined)
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'))
    vi.mocked(fs.writeFile).mockResolvedValue(undefined)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-10-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const outputDir = '/tmp/export-dir'

  const createMockResult = (id: string, name?: string): JobResult => ({
    jobId: id,
    fileName: name || `test-${id}.pdf`,
    rawText: `raw ${id}`,
    structuredText: `Structured content for ${id}`,
    summary: `Summary for ${id}`,
    mode: 'faithful',
    hasPlaceholderWarning: false,
    createdAt: Date.now(),
  })

  it('creates output directory if it does not exist', async () => {
    await exportBatch([createMockResult('1')], outputDir)
    expect(fs.mkdir).toHaveBeenCalledWith(outputDir, { recursive: true })
  })

  it('throws if directory creation fails', async () => {
    vi.mocked(fs.mkdir).mockRejectedValueOnce(new Error('Permission denied'))
    await expect(exportBatch([createMockResult('1')], outputDir)).rejects.toThrow(
      'Failed to create output directory'
    )
  })

  it('handles empty results array', async () => {
    const result = await exportBatch([], outputDir)
    expect(result).toEqual({ success: 0, failed: 0 })
    expect(fs.writeFile).not.toHaveBeenCalled()
  })

  it('skips invalid results (missing structuredText or summary)', async () => {
    const valid = createMockResult('1')
    const noStructured = createMockResult('2')
    noStructured.structuredText = ''
    const noSummary = createMockResult('3')
    noSummary.summary = ''

    const result = await exportBatch([noStructured, noSummary, valid], outputDir)
    expect(result).toEqual({ success: 1, failed: 2 })
    // 1 doc + 1 index
    expect(fs.writeFile).toHaveBeenCalledTimes(2)
  })

  it('formats single markdown file with 摘要 and 正文 from spec fields', async () => {
    const mockResult = createMockResult('1', 'my-doc.pdf')
    await exportBatch([mockResult], outputDir)

    const expectedPath = path.join(outputDir, 'my-doc.md')
    const expectedContent = `# my-doc\n\n## 摘要\nSummary for 1\n\n## 正文\nStructured content for 1\n`
    expect(fs.writeFile).toHaveBeenCalledWith(expectedPath, expectedContent, 'utf8')
  })

  it('generates index.md with links and first-line summaries', async () => {
    const results = [createMockResult('1', 'doc-a.pdf'), createMockResult('2', 'doc-b.pdf')]
    results[1].summary = 'First line summary\nSecond line'

    await exportBatch(results, outputDir)

    const expectedIndex = `# OCR 批量导出 - 2023-10-15\n\n- [doc-a](doc-a.md): Summary for 1\n- [doc-b](doc-b.md): First line summary\n`
    expect(fs.writeFile).toHaveBeenCalledWith(path.join(outputDir, 'index.md'), expectedIndex, 'utf8')
  })

  it('uses jobId when fileName not provided', async () => {
    const r = createMockResult('abc-123')
    r.fileName = ''
    await exportBatch([r], outputDir)
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join(outputDir, 'job-abc-123.md'),
      expect.any(String),
      'utf8'
    )
  })

  it('handles file name conflicts by appending counter', async () => {
    const results = [
      createMockResult('1', 'conflict.pdf'),
      createMockResult('2', 'conflict.pdf'),
      createMockResult('3', 'conflict.pdf'),
    ]

    let accessCalls = 0
    vi.mocked(fs.access).mockImplementation(async (filePath) => {
      accessCalls++
      const base = path.basename(filePath.toString())
      if (accessCalls === 1 && base === 'conflict.md') throw new Error('ENOENT')
      if (accessCalls === 2 && base === 'conflict.md') return undefined
      if (accessCalls === 3 && base === 'conflict-1.md') throw new Error('ENOENT')
      if (accessCalls === 4 && base === 'conflict.md') return undefined
      if (accessCalls === 5 && base === 'conflict-1.md') return undefined
      if (accessCalls === 6 && base === 'conflict-2.md') throw new Error('ENOENT')
      throw new Error('Unexpected')
    })

    const result = await exportBatch(results, outputDir)
    expect(result).toEqual({ success: 3, failed: 0 })
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join(outputDir, 'conflict.md'),
      expect.stringContaining('# conflict\n'),
      'utf8'
    )
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join(outputDir, 'conflict-1.md'),
      expect.stringContaining('# conflict-1\n'),
      'utf8'
    )
    expect(fs.writeFile).toHaveBeenCalledWith(
      path.join(outputDir, 'conflict-2.md'),
      expect.stringContaining('# conflict-2\n'),
      'utf8'
    )
  })

  it('continues if writing a single file fails', async () => {
    const results = [
      createMockResult('1', 'success.pdf'),
      createMockResult('2', 'fail.pdf'),
      createMockResult('3', 'success2.pdf'),
    ]

    vi.mocked(fs.writeFile).mockImplementation(async (filePath) => {
      if (filePath.toString().includes('fail.md')) throw new Error('Write error')
      return undefined
    })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await exportBatch(results, outputDir)
    expect(result).toEqual({ success: 2, failed: 1 })
    // 2 success docs + 1 failed attempt + 1 index = 4
    expect(fs.writeFile).toHaveBeenCalledTimes(4)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to export result 2'),
      expect.any(Error)
    )
    consoleSpy.mockRestore()
  })

  it('gracefully handles index.md generation failure', async () => {
    vi.mocked(fs.writeFile).mockImplementation(async (filePath) => {
      if (filePath.toString().includes('index.md')) throw new Error('Index write error')
      return undefined
    })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await exportBatch([createMockResult('1')], outputDir)
    expect(result).toEqual({ success: 1, failed: 0 })
    expect(consoleSpy).toHaveBeenCalledWith('Failed to generate index.md:', expect.any(Error))
    consoleSpy.mockRestore()
  })
})
```

- [ ] **Step 2: 运行测试**

Run: `npm test -- --run src/main/export/__tests__/markdown-exporter.test.ts`
Expected: 所有 markdown-exporter 测试通过

- [ ] **Step 3: Commit**

```bash
git add src/main/export/__tests__/markdown-exporter.test.ts
git commit -m "test: rewrite markdown-exporter tests for spec JobResult fields"
```

---

### Task 6: 修 orchestrator.ts 的 assertNoPlaceholder 调用并新增 getJobs

**Files:**
- Modify: `src/main/pipeline/orchestrator.ts:110` 和新增 `getJobs` 方法

- [ ] **Step 1: 修 assertNoPlaceholder 调用**

在 `src/main/pipeline/orchestrator.ts` 第 110 行：

```ts
// 改前
const hasPlaceholderWarning = !assertNoPlaceholder(structuredResult.text)
// 改后
const hasPlaceholderWarning = !assertNoPlaceholder(structuredResult.text).clean
```

- [ ] **Step 2: 新增 getJobs 方法**

在 `src/main/pipeline/orchestrator.ts` 的 `getResult` 方法之后（约第 87 行后）插入：

```ts
  public getJobs(): OcrJob[] {
    return Array.from(this.jobs.values())
  }
```

- [ ] **Step 3: 修 orchestrator 测试的 placeholder 用例**

在 `src/main/pipeline/__tests__/orchestrator.test.ts`，移除 placeholder-guard 的 mock，改用真实实现。把第 14-16 行的：

```ts
vi.mock('../../llm/placeholder-guard', () => ({
  assertNoPlaceholder: (text: string) => !text.includes('PLACEHOLDER_WARNING')
}))
```

删除。然后修改 `should detect placeholders` 测试（约第 114-121 行）：

```ts
    it('should detect placeholders', async () => {
      const onProgress = vi.fn()
      mockLlm.extractResult.mockReturnValueOnce('text [待补充] more text')

      await orchestrator.startBatch(['/file1.pdf'], 'faithful', onProgress)
      const result = orchestrator.getResult('mock-uuid-1234')
      expect(result?.hasPlaceholderWarning).toBe(true)
    })
```

- [ ] **Step 4: 新增 getJobs 测试**

在 `src/main/pipeline/__tests__/orchestrator.test.ts` 末尾 `should enforce concurrency limits` 测试之后追加：

```ts
  it('getJobs returns snapshot of current batch jobs', async () => {
    const onProgress = vi.fn()
    await orchestrator.startBatch(['/f1.pdf', '/f2.pdf'], 'faithful', onProgress)
    const jobs = orchestrator.getJobs()
    expect(jobs).toHaveLength(2)
    expect(jobs.map((j) => j.fileName).sort()).toEqual(['f1.pdf', 'f2.pdf'])
  })
```

- [ ] **Step 5: 运行 orchestrator 测试**

Run: `npm test -- --run src/main/pipeline/__tests__/orchestrator.test.ts`
Expected: 所有 Orchestrator 测试通过（含 placeholder 真实检测、getJobs）

- [ ] **Step 6: Commit**

```bash
git add src/main/pipeline/orchestrator.ts src/main/pipeline/__tests__/orchestrator.test.ts
git commit -m "fix: use assertNoPlaceholder().clean and add getJobs to orchestrator"
```

---

### Task 7: 阶段 1 全量验证

- [ ] **Step 1: 运行全部测试**

Run: `npm test -- --run`
Expected: 全部通过，0 failed，0 unhandled rejection（之前已修的 4 个超时测试 unhandled 也应仍正常）

- [ ] **Step 2: 若有失败，修复后重新运行直到全绿**

- [ ] **Step 3: typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 不提交（无新改动），进入阶段 2**

---

## 阶段 2：接线层

### Task 8: 新建 ipc-handlers.ts

**Files:**
- Create: `src/main/ipc-handlers.ts`

- [ ] **Step 1: 创建 ipc-handlers.ts**

写入 `src/main/ipc-handlers.ts`：

```ts
import { ipcMain, dialog, app, IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS, type IpcRequest, type IpcResponse, AppSettings } from '../shared/types'
import { configStore } from './store'
import { TextInClient } from './ocr/textin-client'
import { LlmClient } from './llm/llm-client'
import { Orchestrator } from './pipeline/orchestrator'
import { HistoryManager } from './history/history-manager'
import { exportBatch } from './export/markdown-exporter'

let historyManager: HistoryManager | null = null
let currentOrchestrator: Orchestrator | null = null

export function registerIpcHandlers() {
  if (!historyManager) {
    historyManager = new HistoryManager(app.getPath('userData'))
  }

  // SETTINGS
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (): IpcResponse['settings:get'] => {
    return configStore.getSettings()
  })

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET,
    (_, data: IpcRequest['settings:set']): IpcResponse['settings:set'] => {
      configStore.setSettings(data)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_TEST_OCR,
    async (): Promise<IpcResponse['settings:test-ocr']> => {
      const settings = configStore.getSettings()
      if (!settings.textin.appId || !settings.textin.secretCode) {
        return { success: false, message: 'OCR API keys not configured' }
      }
      try {
        const client = new TextInClient(settings.textin)
        return await client.testConnection()
      } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_TEST_LLM,
    async (): Promise<IpcResponse['settings:test-llm']> => {
      const settings = configStore.getSettings()
      if (!settings.llm.apiKey) {
        return { success: false, message: 'LLM API key not configured' }
      }
      try {
        const client = new LlmClient(settings.llm)
        return await client.testConnection()
      } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  // OCR_PICK_FILES
  ipcMain.handle(
    IPC_CHANNELS.OCR_PICK_FILES,
    async (_, data: IpcRequest['ocr:pick-files']): Promise<IpcResponse['ocr:pick-files']> => {
      const properties: ('openFile' | 'openDirectory' | 'multiSelections')[] =
        data.type === 'directory' ? ['openDirectory'] : ['openFile', 'multiSelections']
      const filters =
        data.type === 'files'
          ? [{ name: 'Images & PDFs', extensions: ['jpg', 'jpeg', 'png', 'pdf'] }]
          : []

      const result = await dialog.showOpenDialog({ properties, filters })
      if (result.canceled) return []
      return result.filePaths
    }
  )

  // OCR_START_BATCH
  ipcMain.handle(
    IPC_CHANNELS.OCR_START_BATCH,
    async (event: IpcMainInvokeEvent, data: IpcRequest['ocr:start-batch']): Promise<IpcResponse['ocr:start-batch']> => {
      const settings = configStore.getSettings()
      const missing: string[] = []
      if (!settings.textin.appId) missing.push('TextIn appId')
      if (!settings.textin.secretCode) missing.push('TextIn secretCode')
      if (!settings.llm.apiKey) missing.push('LLM apiKey')
      if (!settings.llm.model) missing.push('LLM model')
      if (!settings.llm.baseUrl) missing.push('LLM baseUrl')
      if (missing.length > 0) {
        throw new Error(`配置缺失：${missing.join('、')}，请先在设置中填写`)
      }

      const textin = new TextInClient(settings.textin)
      const llm = new LlmClient(settings.llm)
      currentOrchestrator = new Orchestrator(textin, llm, {
        concurrency: settings.concurrency,
        chunkThreshold: settings.chunkThreshold,
      })

      const onProgress = (job: any) => {
        event.sender.send(IPC_CHANNELS.ON_JOB_PROGRESS, job)
      }

      try {
        const stats = await currentOrchestrator.startBatch(data.paths, data.mode, onProgress)

        // Save completed results to history
        if (historyManager) {
          for (const job of currentOrchestrator.getJobs()) {
            if (job.stage === 'done') {
              const result = currentOrchestrator.getResult(job.jobId)
              if (result) {
                try {
                  await historyManager.saveResult(result)
                } catch (error) {
                  console.error(`Failed to save history for ${job.jobId}:`, error)
                }
              }
            }
          }
        }

        event.sender.send(IPC_CHANNELS.ON_BATCH_DONE, stats)
      } finally {
        currentOrchestrator = null
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.OCR_CANCEL, async (): Promise<IpcResponse['ocr:cancel']> => {
    if (currentOrchestrator) {
      currentOrchestrator.cancel()
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.OCR_GET_RESULT,
    async (_, data: IpcRequest['ocr:get-result']): Promise<IpcResponse['ocr:get-result']> => {
      const inMemory = currentOrchestrator?.getResult(data.jobId)
      if (inMemory) return inMemory
      if (historyManager) {
        return await historyManager.getJob(data.jobId)
      }
      return null
    }
  )

  // EXPORT
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_BATCH,
    async (_, data: IpcRequest['export:batch']): Promise<IpcResponse['export:batch']> => {
      if (!historyManager) return { success: false, exportedCount: 0 }
      const results = await Promise.all(data.jobIds.map((id) => historyManager!.getJob(id)))
      const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null)
      if (validResults.length === 0) {
        return { success: false, exportedCount: 0 }
      }
      try {
        const { success } = await exportBatch(validResults, data.outputDir)
        return { success: success > 0, exportedCount: success }
      } catch (error) {
        console.error('Export error:', error)
        return { success: false, exportedCount: 0 }
      }
    }
  )

  // HISTORY
  ipcMain.handle(IPC_CHANNELS.HISTORY_LIST, async (): Promise<IpcResponse['history:list']> => {
    return historyManager?.listHistory() || []
  })

  ipcMain.handle(
    IPC_CHANNELS.HISTORY_GET,
    async (_, data: IpcRequest['history:get']): Promise<IpcResponse['history:get']> => {
      if (!historyManager) return null
      return await historyManager.getJob(data.jobId)
    }
  )

  ipcMain.handle(IPC_CHANNELS.HISTORY_CLEAR, async (): Promise<IpcResponse['history:clear']> => {
    if (historyManager) {
      await historyManager.clearHistory()
    }
  })
}
```

- [ ] **Step 2: 验证 typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误（注意 `IpcResponse['settings:get']` 等索引类型来自 shared/types 的 `IpcResponse` interface）

- [ ] **Step 3: Commit（测试在 Task 9）**

```bash
git add src/main/ipc-handlers.ts
git commit -m "feat: add ipc-handlers with all IPC channels and history persistence"
```

---

### Task 9: 新建 ipc-handlers.test.ts

**Files:**
- Create: `src/main/__tests__/ipc-handlers.test.ts`

- [ ] **Step 1: 创建测试文件**

写入 `src/main/__tests__/ipc-handlers.test.ts`：

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock electron
const mockHandle = vi.fn()
const mockSend = vi.fn()
vi.mock('electron', () => ({
  ipcMain: { handle: mockHandle },
  dialog: { showOpenDialog: vi.fn() },
  app: { getPath: vi.fn().mockReturnValue('/mock/userData') },
  IpcMainInvokeEvent: {},
}))

// Mock modules
vi.mock('../store', () => ({
  configStore: {
    getSettings: vi.fn(),
    setSettings: vi.fn(),
  },
}))

vi.mock('../ocr/textin-client', () => ({
  TextInClient: vi.fn().mockImplementation(() => ({
    testConnection: vi.fn(),
    recognizeFile: vi.fn(),
    isRecoverableError: vi.fn(),
  })),
}))

vi.mock('../llm/llm-client', () => ({
  LlmClient: vi.fn().mockImplementation(() => ({
    testConnection: vi.fn(),
    callLlm: vi.fn(),
    extractResult: vi.fn(),
    extractThoughts: vi.fn(),
    isRecoverableError: vi.fn(),
  })),
}))

vi.mock('../history/history-manager', () => ({
  HistoryManager: vi.fn().mockImplementation(() => ({
    saveResult: vi.fn(),
    listHistory: vi.fn().mockReturnValue([]),
    getJob: vi.fn().mockResolvedValue(null),
    clearHistory: vi.fn(),
  })),
}))

vi.mock('../export/markdown-exporter', () => ({
  exportBatch: vi.fn(),
}))

import { registerIpcHandlers } from '../ipc-handlers'
import { configStore } from '../store'
import { TextInClient } from '../ocr/textin-client'
import { LlmClient } from '../llm/llm-client'
import { exportBatch } from '../export/markdown-exporter'
import { IPC_CHANNELS } from '../../shared/types'

describe('registerIpcHandlers', () => {
  let handlers: Record<string, (event: any, data?: any) => any>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = {}
    mockHandle.mockImplementation((channel: string, handler: any) => {
      handlers[channel] = handler
    })
    registerIpcHandlers()
  })

  const baseSettings = {
    textin: { appId: 'a', secretCode: 's', baseUrl: 'http://t' },
    llm: { baseUrl: 'http://l', apiKey: 'k', model: 'm' },
    concurrency: 3,
    chunkThreshold: 12000,
  }

  describe('SETTINGS_GET', () => {
    it('returns configStore.getSettings()', async () => {
      ;(configStore.getSettings as any).mockReturnValue(baseSettings)
      const result = await handlers[IPC_CHANNELS.SETTINGS_GET]({ sender: mockSend })
      expect(result).toEqual(baseSettings)
    })
  })

  describe('SETTINGS_SET', () => {
    it('calls configStore.setSettings', async () => {
      await handlers[IPC_CHANNELS.SETTINGS_SET]({}, baseSettings)
      expect(configStore.setSettings).toHaveBeenCalledWith(baseSettings)
    })
  })

  describe('SETTINGS_TEST_OCR', () => {
    it('returns failure when appId missing', async () => {
      ;(configStore.getSettings as any).mockReturnValue({
        ...baseSettings,
        textin: { appId: '', secretCode: 's', baseUrl: 'http://t' },
      })
      const result = await handlers[IPC_CHANNELS.SETTINGS_TEST_OCR]({ sender: mockSend })
      expect(result).toEqual({ success: false, message: 'OCR API keys not configured' })
    })

    it('calls TextInClient.testConnection when configured', async () => {
      ;(configStore.getSettings as any).mockReturnValue(baseSettings)
      const testConn = vi.fn().mockResolvedValue({ success: true, message: 'ok' })
      ;(TextInClient as any).mockImplementation(() => ({ testConnection: testConn }))

      const result = await handlers[IPC_CHANNELS.SETTINGS_TEST_OCR]({ sender: mockSend })
      expect(result).toEqual({ success: true, message: 'ok' })
    })
  })

  describe('SETTINGS_TEST_LLM', () => {
    it('returns failure when apiKey missing', async () => {
      ;(configStore.getSettings as any).mockReturnValue({
        ...baseSettings,
        llm: { baseUrl: 'http://l', apiKey: '', model: 'm' },
      })
      const result = await handlers[IPC_CHANNELS.SETTINGS_TEST_LLM]({ sender: mockSend })
      expect(result).toEqual({ success: false, message: 'LLM API key not configured' })
    })
  })

  describe('OCR_START_BATCH', () => {
    it('throws when config missing', async () => {
      ;(configStore.getSettings as any).mockReturnValue({
        ...baseSettings,
        llm: { baseUrl: '', apiKey: '', model: '' },
      })
      await expect(
        handlers[IPC_CHANNELS.OCR_START_BATCH]({ sender: mockSend }, { paths: ['/f.pdf'], mode: 'faithful' })
      ).rejects.toThrow('配置缺失')
    })

    it('sends ON_BATCH_DONE after batch and saves done jobs to history', async () => {
      ;(configStore.getSettings as any).mockReturnValue(baseSettings)
      const getJobs = vi.fn().mockReturnValue([
        { jobId: 'j1', fileName: 'f.pdf', stage: 'done' },
        { jobId: 'j2', fileName: 'g.pdf', stage: 'error' },
      ])
      const getResult = vi.fn().mockReturnValue({ jobId: 'j1', fileName: 'f.pdf' })
      const startBatch = vi.fn().mockResolvedValue({ total: 2, success: 1, failed: 1 })
      const Orchestrator = require('../pipeline/orchestrator').Orchestrator
      vi.mock('../pipeline/orchestrator', () => ({
        Orchestrator: vi.fn().mockImplementation(() => ({
          startBatch,
          getJobs,
          getResult,
          cancel: vi.fn(),
        })),
      }))
      // Re-register with new mock
      handlers = {}
      mockHandle.mockImplementation((channel: string, handler: any) => {
        handlers[channel] = handler
      })
      registerIpcHandlers()

      const { HistoryManager } = require('../history/history-manager')
      const historyInstance = new HistoryManager()

      await handlers[IPC_CHANNELS.OCR_START_BATCH](
        { sender: mockSend },
        { paths: ['/f.pdf', '/g.pdf'], mode: 'faithful' }
      )

      expect(startBatch).toHaveBeenCalled()
      expect(historyInstance.saveResult).toHaveBeenCalledWith({ jobId: 'j1', fileName: 'f.pdf' })
      expect(mockSend).toHaveBeenCalledWith(IPC_CHANNELS.ON_BATCH_DONE, {
        total: 2,
        success: 1,
        failed: 1,
      })
    })
  })

  describe('OCR_GET_RESULT', () => {
    it('returns null when neither memory nor history has the job', async () => {
      const result = await handlers[IPC_CHANNELS.OCR_GET_RESULT]({}, { jobId: 'none' })
      expect(result).toBeNull()
    })
  })

  describe('EXPORT_BATCH', () => {
    it('returns failure when no valid results', async () => {
      const { HistoryManager } = require('../history/history-manager')
      ;(HistoryManager as any).mockImplementation(() => ({
        getJob: vi.fn().mockResolvedValue(null),
        saveResult: vi.fn(),
        listHistory: vi.fn().mockReturnValue([]),
        clearHistory: vi.fn(),
      }))
      handlers = {}
      mockHandle.mockImplementation((channel: string, handler: any) => {
        handlers[channel] = handler
      })
      registerIpcHandlers()

      const result = await handlers[IPC_CHANNELS.EXPORT_BATCH]({}, { jobIds: ['x'], outputDir: '/out' })
      expect(result).toEqual({ success: false, exportedCount: 0 })
    })

    it('calls exportBatch with results from history', async () => {
      const fakeResult = { jobId: 'j1', fileName: 'f.pdf', structuredText: 's', summary: 'sum' }
      const { HistoryManager } = require('../history/history-manager')
      ;(HistoryManager as any).mockImplementation(() => ({
        getJob: vi.fn().mockResolvedValue(fakeResult),
        saveResult: vi.fn(),
        listHistory: vi.fn().mockReturnValue([]),
        clearHistory: vi.fn(),
      }))
      ;(exportBatch as any).mockResolvedValue({ success: 1, failed: 0 })
      handlers = {}
      mockHandle.mockImplementation((channel: string, handler: any) => {
        handlers[channel] = handler
      })
      registerIpcHandlers()

      const result = await handlers[IPC_CHANNELS.EXPORT_BATCH]({}, { jobIds: ['j1'], outputDir: '/out' })
      expect(exportBatch).toHaveBeenCalledWith([fakeResult], '/out')
      expect(result).toEqual({ success: true, exportedCount: 1 })
    })
  })

  describe('HISTORY_LIST', () => {
    it('returns listHistory result', async () => {
      const { HistoryManager } = require('../history/history-manager')
      ;(HistoryManager as any).mockImplementation(() => ({
        listHistory: vi.fn().mockReturnValue([{ jobId: 'j1' }]),
        getJob: vi.fn(),
        saveResult: vi.fn(),
        clearHistory: vi.fn(),
      }))
      handlers = {}
      mockHandle.mockImplementation((channel: string, handler: any) => {
        handlers[channel] = handler
      })
      registerIpcHandlers()

      const result = await handlers[IPC_CHANNELS.HISTORY_LIST]({ sender: mockSend })
      expect(result).toEqual([{ jobId: 'j1' }])
    })
  })
})
```

- [ ] **Step 2: 运行测试**

Run: `npm test -- --run src/main/__tests__/ipc-handlers.test.ts`
Expected: 所有 registerIpcHandlers 测试通过

注意：此测试用了 `vi.mock` 动态重置技巧（重注册 handlers）。若 `vi.mock` 工厂在 `beforeEach` 后无法改变实现，改用 `vi.doMock` 或将 Orchestrator mock 提到顶层。若失败，调整 mock 策略——关键是验证 `OCR_START_BATCH` 调 `startBatch` + `saveResult` + `send(ON_BATCH_DONE)`，以及 `EXPORT_BATCH` 从 `historyManager.getJob` 取结果传给 `exportBatch`。

- [ ] **Step 3: Commit**

```bash
git add src/main/__tests__/ipc-handlers.test.ts
git commit -m "test: add ipc-handlers tests for all channels"
```

---

### Task 10: index.ts 注册 IPC handlers

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: 修改 index.ts**

在 `src/main/index.ts` 顶部 import 区追加（第 2 行后）：

```ts
import { registerIpcHandlers } from './ipc-handlers'
```

把第 29 行 `app.whenReady().then(createWindow)` 改为：

```ts
app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
})
```

- [ ] **Step 2: 验证 typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: register IPC handlers in main process entry"
```

---

### Task 11: useOcrStore 去 temp ID，加 pendingFiles

**Files:**
- Modify: `src/renderer/src/stores/useOcrStore.ts`

- [ ] **Step 1: 修改 useOcrStore.ts**

整体替换 `src/renderer/src/stores/useOcrStore.ts` 为：

```ts
import { create } from 'zustand'
import { IPC_CHANNELS, JobResult, OcrJob, ProcessMode } from '../../../shared/types'

interface PendingFile {
  path: string
  fileName: string
}

interface OcrState {
  jobs: Record<string, OcrJob>
  results: Record<string, JobResult>
  pendingFiles: PendingFile[]
  isProcessing: boolean
  mode: ProcessMode
  selectedJobId: string | null

  setMode: (mode: ProcessMode) => void
  selectJob: (jobId: string | null) => void

  pickFiles: (type: 'files' | 'directory') => Promise<void>
  startBatch: () => Promise<void>
  cancelBatch: () => Promise<void>
  fetchResult: (jobId: string) => Promise<void>
  exportBatch: (outputDir: string) => Promise<{ success: boolean; exportedCount: number }>
  clearJobs: () => void

  handleJobProgress: (job: OcrJob) => void
  handleBatchDone: (stats: { total: number; success: number; failed: number }) => void
}

export const useOcrStore = create<OcrState>((set, get) => {
  if (typeof window !== 'undefined' && (window as any).api) {
    ;(window as any).api.on(IPC_CHANNELS.ON_JOB_PROGRESS, (_event: any, job: OcrJob) => {
      get().handleJobProgress(job)
      if (job.stage === 'done') {
        get().fetchResult(job.jobId)
      }
    })

    ;(window as any).api.on(IPC_CHANNELS.ON_BATCH_DONE, (_event: any, stats: any) => {
      get().handleBatchDone(stats)
    })
  }

  return {
    jobs: {},
    results: {},
    pendingFiles: [],
    isProcessing: false,
    mode: 'faithful',
    selectedJobId: null,

    setMode: (mode) => set({ mode }),

    selectJob: (jobId) => set({ selectedJobId: jobId }),

    pickFiles: async (type) => {
      if (get().isProcessing) return
      try {
        const paths = await (window as any).api.invoke(IPC_CHANNELS.OCR_PICK_FILES, { type })
        if (paths && paths.length > 0) {
          const newPending: PendingFile[] = paths.map((p: string) => ({
            path: p,
            fileName: p.split(/[\\/]/).pop() || 'Unknown File',
          }))
          set({ pendingFiles: [...get().pendingFiles, ...newPending] })
        }
      } catch (err) {
        console.error('Failed to pick files:', err)
      }
    },

    startBatch: async () => {
      const state = get()
      if (state.isProcessing) return
      const paths = state.pendingFiles.map((f) => f.path)
      if (paths.length === 0) return

      set({ isProcessing: true, pendingFiles: [] })

      try {
        await (window as any).api.invoke(IPC_CHANNELS.OCR_START_BATCH, {
          paths,
          mode: state.mode,
        })
      } catch (err) {
        console.error('Failed to start batch:', err)
        set({ isProcessing: false })
      }
    },

    cancelBatch: async () => {
      if (!get().isProcessing) return
      try {
        await (window as any).api.invoke(IPC_CHANNELS.OCR_CANCEL, undefined)
      } catch (err) {
        console.error('Failed to cancel batch:', err)
      }
    },

    fetchResult: async (jobId) => {
      try {
        const result = await (window as any).api.invoke(IPC_CHANNELS.OCR_GET_RESULT, { jobId })
        if (result) {
          set((state) => ({ results: { ...state.results, [jobId]: result } }))
        }
      } catch (err) {
        console.error(`Failed to fetch result for job ${jobId}:`, err)
      }
    },

    exportBatch: async (outputDir) => {
      const jobIds = Object.keys(get().results)
      if (jobIds.length === 0) return { success: false, exportedCount: 0 }
      try {
        return await (window as any).api.invoke(IPC_CHANNELS.EXPORT_BATCH, { jobIds, outputDir })
      } catch (err) {
        console.error('Failed to export batch:', err)
        return { success: false, exportedCount: 0 }
      }
    },

    clearJobs: () => {
      if (get().isProcessing) return
      set({ jobs: {}, results: {}, pendingFiles: [], selectedJobId: null })
    },

    handleJobProgress: (job) => {
      set((state) => ({
        jobs: { ...state.jobs, [job.jobId]: job },
      }))
    },

    handleBatchDone: () => {
      set({ isProcessing: false })
    },
  }
})
```

- [ ] **Step 2: 验证 typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit（测试在 Task 12）**

```bash
git add src/renderer/src/stores/useOcrStore.ts
git commit -m "refactor: remove temp ID, add pendingFiles to useOcrStore"
```

---

### Task 12: 新建 useOcrStore.test.ts

**Files:**
- Create: `src/renderer/src/__tests__/stores/useOcrStore.test.ts`

- [ ] **Step 1: 创建测试文件**

写入 `src/renderer/src/__tests__/stores/useOcrStore.test.ts`：

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useOcrStore } from '../../stores/useOcrStore'
import { IPC_CHANNELS, OcrJob } from '../../../../shared/types'

describe('useOcrStore', () => {
  let mockInvoke: ReturnType<typeof vi.fn>
  let mockOn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke = vi.fn()
    mockOn = vi.fn()
    ;(globalThis as any).window = {
      api: { invoke: mockInvoke, on: mockOn },
    }
    useOcrStore.setState({
      jobs: {},
      results: {},
      pendingFiles: [],
      isProcessing: false,
      mode: 'faithful',
      selectedJobId: null,
    })
  })

  afterEach(() => {
    delete (globalThis as any).window
  })

  import { afterEach } from 'vitest'

  it('pickFiles populates pendingFiles and does not create jobs', async () => {
    mockInvoke.mockResolvedValue(['/path/a.pdf', '/path/b.pdf'])
    await useOcrStore.getState().pickFiles('files')

    const state = useOcrStore.getState()
    expect(state.pendingFiles).toEqual([
      { path: '/path/a.pdf', fileName: 'a.pdf' },
      { path: '/path/b.pdf', fileName: 'b.pdf' },
    ])
    expect(Object.keys(state.jobs)).toHaveLength(0)
    expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.OCR_PICK_FILES, { type: 'files' })
  })

  it('startBatch sends pendingFiles paths and clears pendingFiles', async () => {
    useOcrStore.setState({
      pendingFiles: [
        { path: '/x.pdf', fileName: 'x.pdf' },
        { path: '/y.pdf', fileName: 'y.pdf' },
      ],
    })
    mockInvoke.mockResolvedValue(undefined)

    await useOcrStore.getState().startBatch()

    expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.OCR_START_BATCH, {
      paths: ['/x.pdf', '/y.pdf'],
      mode: 'faithful',
    })
    expect(useOcrStore.getState().pendingFiles).toEqual([])
    expect(useOcrStore.getState().isProcessing).toBe(true)
  })

  it('handleJobProgress builds job by jobId directly (no temp replacement)', () => {
    const job: OcrJob = {
      jobId: 'real-uuid-1',
      filePath: '/x.pdf',
      fileName: 'x.pdf',
      stage: 'ocr',
    }
    useOcrStore.getState().handleJobProgress(job)

    expect(useOcrStore.getState().jobs['real-uuid-1']).toEqual(job)
  })

  it('startBatch does nothing when no pendingFiles', async () => {
    await useOcrStore.getState().startBatch()
    expect(mockInvoke).not.toHaveBeenCalledWith(IPC_CHANNELS.OCR_START_BATCH, expect.anything())
  })
})
```

注意：`import { afterEach }` 应移到文件顶部与其他 import 合并。最终文件顶部 import 为：

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useOcrStore } from '../../stores/useOcrStore'
import { IPC_CHANNELS, OcrJob } from '../../../../shared/types'
```

- [ ] **Step 2: 运行测试**

Run: `npm test -- --run src/renderer/src/__tests__/stores/useOcrStore.test.ts`
Expected: 所有 useOcrStore 测试通过

注意：`useOcrStore` 初始化时若 `window.api` 存在会注册 `on` 监听。测试设 `window.api` 后首次 import 已执行过监听注册；后续 setState 不重注册。若 `mockOn` 未被调用属正常（模块已在首 import 时注册）。重点断言 `pickFiles`/`startBatch`/`handleJobProgress` 行为。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/__tests__/stores/useOcrStore.test.ts
git commit -m "test: add useOcrStore tests for pendingFiles and temp ID removal"
```

---

### Task 13: FileQueueList 扩展 pendingFiles props

**Files:**
- Modify: `src/renderer/src/components/FileQueueList.tsx`
- Modify: `src/renderer/src/__tests__/components/FileQueueList.test.tsx`

- [ ] **Step 1: 修改 FileQueueList.tsx**

把 `src/renderer/src/components/FileQueueList.tsx` 整体替换为：

```tsx
import { Check, FileText, Loader2, XCircle, Clock } from 'lucide-react'
import { JobStage, OcrJob } from '../../../shared/types'

interface PendingFile {
  path: string
  fileName: string
}

interface FileQueueListProps {
  jobs: OcrJob[]
  pendingFiles: PendingFile[]
  selectedJobId: string | null
  onSelectJob: (jobId: string) => void
  onClear: () => void
  isProcessing: boolean
}

export function FileQueueList({ jobs, pendingFiles, selectedJobId, onSelectJob, onClear, isProcessing }: FileQueueListProps) {
  const totalCount = jobs.length + pendingFiles.length

  if (totalCount === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 text-center border-r border-gray-200">
        <FileText className="w-12 h-12 mb-4 text-gray-300" />
        <p>No files queued</p>
        <p className="text-sm mt-2 text-gray-400">Select files or a directory to begin</p>
      </div>
    )
  }

  const renderStageIcon = (stage: JobStage) => {
    switch (stage) {
      case 'queued':
        return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
      case 'ocr':
      case 'structuring':
      case 'summarizing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case 'done':
        return <Check className="w-4 h-4 text-green-500" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
    }
  }

  const renderStageText = (job: OcrJob) => {
    if (job.stage === 'error') return <span className="text-red-500 truncate" title={job.error}>{job.error || 'Error'}</span>
    if (job.stage === 'done') return <span className="text-green-500">Complete</span>

    const stageNames = {
      queued: 'Queued',
      ocr: 'Extracting text...',
      structuring: 'Formatting...',
      summarizing: 'Summarizing...'
    }

    const text = stageNames[job.stage] || job.stage
    if (job.progress !== undefined && job.progress > 0) {
      return <span>{text} ({Math.round(job.progress)}%)</span>
    }

    return <span>{text}</span>
  }

  return (
    <div className="flex flex-col h-full border-r border-gray-200 bg-gray-50">
      <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-white">
        <h2 className="font-semibold text-gray-700">Queue ({totalCount})</h2>
        {!isProcessing && totalCount > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-gray-500 hover:text-red-500 px-2 py-1 rounded"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-gray-100">
          {pendingFiles.map((file, idx) => (
            <li
              key={`pending-${idx}-${file.path}`}
              className="p-3 bg-white"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0">
                  <Clock className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate" title={file.fileName}>
                    {file.fileName}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Pending</p>
                </div>
              </div>
            </li>
          ))}
          {jobs.map((job) => (
            <li
              key={job.jobId}
              onClick={() => onSelectJob(job.jobId)}
              className={`p-3 cursor-pointer hover:bg-blue-50 transition-colors ${
                selectedJobId === job.jobId ? 'bg-blue-100' : 'bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0">
                  {renderStageIcon(job.stage)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate" title={job.fileName}>
                    {job.fileName}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {renderStageText(job)}
                  </p>
                  {isProcessing && job.progress !== undefined && (
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 修改 FileQueueList.test.tsx 适配新 props**

在 `src/renderer/src/__tests__/components/FileQueueList.test.tsx`，每个 `render(<FileQueueList .../>)` 调用都加 `pendingFiles={[]}`。具体地，把 5 处 `<FileQueueList` 的 props 里补一行 `pendingFiles={[]}`。

例如第一个测试变为：

```tsx
    render(
      <FileQueueList
        jobs={[]}
        pendingFiles={[]}
        selectedJobId={null}
        onSelectJob={mockOnSelectJob}
        onClear={mockOnClear}
        isProcessing={false}
      />
    )
```

对其余 4 个 `render` 调用同样加 `pendingFiles={[]}`（jobs 分别为 `mockJobs`）。

另外新增一个 pendingFiles 测试，在文件末尾 `})` 前追加：

```tsx
  it('renders pending files without jobId and not clickable', () => {
    render(
      <FileQueueList
        jobs={[]}
        pendingFiles={[
          { path: '/a.pdf', fileName: 'a.pdf' },
          { path: '/b.pdf', fileName: 'b.pdf' },
        ]}
        selectedJobId={null}
        onSelectJob={mockOnSelectJob}
        onClear={mockOnClear}
        isProcessing={false}
      />
    )
    expect(screen.getByText('Queue (2)')).toBeInTheDocument()
    expect(screen.getByText('a.pdf')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    // Clicking pending file name should NOT call onSelectJob
    fireEvent.click(screen.getByText('a.pdf'))
    expect(mockOnSelectJob).not.toHaveBeenCalled()
  })
```

- [ ] **Step 3: 运行测试**

Run: `npm test -- --run src/renderer/src/__tests__/components/FileQueueList.test.tsx`
Expected: 所有 FileQueueList 测试通过（含新 pendingFiles 用例）

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/FileQueueList.tsx src/renderer/src/__tests__/components/FileQueueList.test.tsx
git commit -m "feat: add pendingFiles support to FileQueueList"
```

---

### Task 14: App.tsx 传 pendingFiles 并修 start 按钮 disabled 逻辑

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: 修改 App.tsx**

在 `src/renderer/src/App.tsx` 第 18-31 行的解构中，把 `jobs,` 后面追加 `pendingFiles,`：

```tsx
  const {
    jobs,
    pendingFiles,
    results,
    isProcessing,
    mode,
    selectedJobId,
    setMode,
    selectJob,
    pickFiles,
    startBatch,
    cancelBatch,
    clearJobs,
    exportBatch
  } = useOcrStore()
```

把第 41 行 `const jobList = Object.values(jobs)` 后面追加：

```tsx
  const jobList = Object.values(jobs)
  const hasQueuedFiles = jobList.length > 0 || pendingFiles.length > 0
```

把第 149 行 Start Processing 按钮的 `disabled={jobList.length === 0}` 改为：

```tsx
                disabled={!hasQueuedFiles}
```

把第 168-174 行的 `<FileQueueList` 调用加 `pendingFiles={pendingFiles}`：

```tsx
            <FileQueueList
              jobs={jobList}
              pendingFiles={pendingFiles}
              selectedJobId={selectedJobId}
              onSelectJob={selectJob}
              onClear={clearJobs}
              isProcessing={isProcessing}
            />
```

- [ ] **Step 2: 验证 typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: wire pendingFiles to FileQueueList and start button"
```

---

### Task 15: 阶段 2 全量验证

- [ ] **Step 1: 运行全部测试**

Run: `npm test -- --run`
Expected: 全部通过，0 failed，0 unhandled rejection

- [ ] **Step 2: typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: dev 端到端验证**

Run: `npm run dev`（在 WSL 原生终端）
Expected:
- 应用启动，**不再报 `No handler registered for 'settings:get'`**
- 设置弹窗打开 → 各字段填充默认值
- 填写 TextIn appId/secretCode + LLM baseUrl/apiKey/model → 保存 → 重开一致
- 点测试连接 → toast 返回结果
- 选文件 → 左侧列表显示 pendingFiles（Pending 标记）
- 开始处理 → pendingFiles 清空 → 收到 queued 进度 → job 列表建立 → 各 stage 推进 → 完成后 ON_BATCH_DONE
- 点 job → 右侧详情显示 rawText/structuredText/summary
- 导出 → 落盘 .md + index.md（注意：当前 `exportBatch('')` 传空 outputDir 会在 mkdir 失败，这是 App.tsx 已有问题，不在本计划范围；记录为后续改进项）
- 历史页（若 UI 存在）→ 列表 + 详情

- [ ] **Step 4: 若 dev 报错，记录错误并修复**

- [ ] **Step 5: 更新 AGENTS.md 记录本次完成**

更新 `AGENTS.md` 的"最近操作"追加本计划完成情况，"进行中"改为"IPC 集成完成，待真实 API 联调"。

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md with IPC integration completion"
```

---

## 自审记录

计划写完后对照 spec 自审，已修正：
- §5.1 `OCR_START_BATCH` 存历史的 jobId 映射：通过 `orchestrator.getJobs()` 暴露 job 列表，ipc 遍历 `stage==='done'` 取 `getResult` 存历史（Task 8 + Task 6 的 getJobs）。
- `historyManager` 在 `registerIpcHandlers` 开头初始化，保证 handler 调用时已就绪（Task 8）。
- `getJob` 数据损坏返回 null（Task 2 + Task 3 测试覆盖）。
- `pendingFiles` 字段名统一（Task 11、13、14）。
- pendingFiles 项不可选中（Task 13 测试覆盖）。
- 配置缺失 `throw` 让 invoke reject（Task 8 + Task 9 测试覆盖）。
- FileQueueList props 扩展（Task 13）+ App.tsx 接线（Task 14）+ start 按钮 disabled 基于 hasQueuedFiles（Task 14）。
- useOcrStore 单测新建（Task 12）。

已知遗留（不在本计划范围）：
- `App.tsx` `exportBatch('')` 传空 outputDir——导出会 mkdir 失败。需后续加目录选择 IPC 或让用户输入路径。本计划不修，因 spec 未定义导出目录选择 UI。
- `useHistoryStore` 未实现——历史页 UI 若需 zustand store 可后续。
- worktree 残留文件清理另议。
