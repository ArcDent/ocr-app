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
