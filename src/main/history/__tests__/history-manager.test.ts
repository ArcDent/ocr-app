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
