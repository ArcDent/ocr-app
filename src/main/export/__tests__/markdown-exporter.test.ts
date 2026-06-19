import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import * as path from 'path'
import { exportBatch } from '../markdown-exporter'
import type { JobResult } from '../../../shared/types'

// Mock fs module
vi.mock('fs', () => {
  return {
    promises: {
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      access: vi.fn()
    }
  }
})

describe('markdown-exporter', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementation: directory creation succeeds, access fails (file doesn't exist)
    vi.mocked(fs.mkdir).mockResolvedValue(undefined)
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'))
    vi.mocked(fs.writeFile).mockResolvedValue(undefined)

    // Mock Date for stable tests
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
    fileSize: 1024,
    status: 'completed',
    stage: 'done',
    progress: 100,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    mode: 'faithful',
    content: `Structured content for ${id}`,
    summary: `Summary for ${id}`
  })

  it('should create output directory if it does not exist', async () => {
    const results = [createMockResult('1')]

    await exportBatch(results, outputDir)

    expect(fs.mkdir).toHaveBeenCalledWith(outputDir, { recursive: true })
  })

  it('should throw if directory creation fails', async () => {
    vi.mocked(fs.mkdir).mockRejectedValueOnce(new Error('Permission denied'))

    const results = [createMockResult('1')]

    await expect(exportBatch(results, outputDir)).rejects.toThrow('Failed to create output directory')
  })

  it('should handle empty results array', async () => {
    const result = await exportBatch([], outputDir)

    expect(result).toEqual({ success: 0, failed: 0 })
    expect(fs.writeFile).not.toHaveBeenCalled()
  })

  it('should skip invalid results', async () => {
    const validResult = createMockResult('1')

    const invalidNoId = createMockResult('')
    const invalidNoContent = createMockResult('2')
    invalidNoContent.content = ''
    const invalidNoSummary = createMockResult('3')
    invalidNoSummary.summary = ''

    const results = [invalidNoId, invalidNoContent, invalidNoSummary, validResult]

    const result = await exportBatch(results, outputDir)

    expect(result).toEqual({ success: 1, failed: 3 })
    // 1 for the valid file + 1 for index.md
    expect(fs.writeFile).toHaveBeenCalledTimes(2)
  })

  it('should format single markdown file correctly', async () => {
    const mockResult = createMockResult('1', 'my-doc.pdf')
    const results = [mockResult]

    await exportBatch(results, outputDir)

    const expectedFilePath = path.join(outputDir, 'my-doc.md')
    const expectedContent = `# my-doc\n\n## 摘要\nSummary for 1\n\n## 正文\nStructured content for 1\n`

    expect(fs.writeFile).toHaveBeenCalledWith(expectedFilePath, expectedContent, 'utf8')
  })

  it('should generate index.md with correct format and links', async () => {
    const results = [
      createMockResult('1', 'doc-a.pdf'),
      createMockResult('2', 'doc-b.pdf')
    ]

    // Add multiline summary to test line extraction
    results[1].summary = 'First line summary\nSecond line\nThird line'

    await exportBatch(results, outputDir)

    const expectedIndexPath = path.join(outputDir, 'index.md')
    const expectedIndexContent = `# OCR 批量导出 - 2023-10-15\n\n- [doc-a](doc-a.md): Summary for 1\n- [doc-b](doc-b.md): First line summary\n`

    expect(fs.writeFile).toHaveBeenCalledWith(expectedIndexPath, expectedIndexContent, 'utf8')
  })

  it('should use jobId if fileName is not provided', async () => {
    const mockResult = createMockResult('abc-123')
    mockResult.fileName = ''
    const results = [mockResult]

    await exportBatch(results, outputDir)

    const expectedFilePath = path.join(outputDir, 'job-abc-123.md')
    expect(fs.writeFile).toHaveBeenCalledWith(expectedFilePath, expect.any(String), 'utf8')
  })

  it('should handle file name conflicts by appending counter', async () => {
    const results = [
      createMockResult('1', 'conflict.pdf'),
      createMockResult('2', 'conflict.pdf'),
      createMockResult('3', 'conflict.pdf')
    ]

    // Mock access to fail only on specific files to simulate conflicts
    let accessCalls = 0
    vi.mocked(fs.access).mockImplementation(async (filePath) => {
      accessCalls++
      const baseName = path.basename(filePath.toString())

      // For the first file, it doesn't exist
      if (accessCalls === 1 && baseName === 'conflict.md') throw new Error('ENOENT')

      // For the second file, conflict.md exists, but conflict-1.md doesn't
      if (accessCalls === 2 && baseName === 'conflict.md') return undefined // exists
      if (accessCalls === 3 && baseName === 'conflict-1.md') throw new Error('ENOENT') // doesn't exist

      // For the third file, conflict.md and conflict-1.md exist, conflict-2.md doesn't
      if (accessCalls === 4 && baseName === 'conflict.md') return undefined // exists
      if (accessCalls === 5 && baseName === 'conflict-1.md') return undefined // exists
      if (accessCalls === 6 && baseName === 'conflict-2.md') throw new Error('ENOENT') // doesn't exist

      throw new Error('Unexpected call')
    })

    const result = await exportBatch(results, outputDir)

    expect(result).toEqual({ success: 3, failed: 0 })

    // Should write 3 document files + 1 index file
    expect(fs.writeFile).toHaveBeenCalledTimes(4)

    // Check file names
    expect(fs.writeFile).toHaveBeenCalledWith(path.join(outputDir, 'conflict.md'), expect.stringContaining('# conflict\n'), 'utf8')
    expect(fs.writeFile).toHaveBeenCalledWith(path.join(outputDir, 'conflict-1.md'), expect.stringContaining('# conflict-1\n'), 'utf8')
    expect(fs.writeFile).toHaveBeenCalledWith(path.join(outputDir, 'conflict-2.md'), expect.stringContaining('# conflict-2\n'), 'utf8')

    // Check index file
    const indexPath = path.join(outputDir, 'index.md')
    expect(fs.writeFile).toHaveBeenCalledWith(
      indexPath,
      expect.stringContaining('- [conflict](conflict.md)'),
      'utf8'
    )
    expect(fs.writeFile).toHaveBeenCalledWith(
      indexPath,
      expect.stringContaining('- [conflict-1](conflict-1.md)'),
      'utf8'
    )
    expect(fs.writeFile).toHaveBeenCalledWith(
      indexPath,
      expect.stringContaining('- [conflict-2](conflict-2.md)'),
      'utf8'
    )
  })

  it('should continue if writing a single file fails', async () => {
    const results = [
      createMockResult('1', 'success.pdf'),
      createMockResult('2', 'fail.pdf'),
      createMockResult('3', 'success2.pdf')
    ]

    vi.mocked(fs.writeFile).mockImplementation(async (filePath) => {
      if (filePath.toString().includes('fail.md')) {
        throw new Error('Write error')
      }
      return undefined
    })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await exportBatch(results, outputDir)

    expect(result).toEqual({ success: 2, failed: 1 })
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to export result 2'), expect.any(Error))

    // 2 success files + 1 failed attempt + 1 index.md
    expect(fs.writeFile).toHaveBeenCalledTimes(4)

    consoleSpy.mockRestore()
  })

  it('should gracefully handle index.md generation failure', async () => {
    const results = [createMockResult('1')]

    vi.mocked(fs.writeFile).mockImplementation(async (filePath) => {
      if (filePath.toString().includes('index.md')) {
        throw new Error('Index write error')
      }
      return undefined
    })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await exportBatch(results, outputDir)

    // Overall result is still success: 1 since the file was exported
    expect(result).toEqual({ success: 1, failed: 0 })
    expect(consoleSpy).toHaveBeenCalledWith('Failed to generate index.md:', expect.any(Error))

    consoleSpy.mockRestore()
  })
})
