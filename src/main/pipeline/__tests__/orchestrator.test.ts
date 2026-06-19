import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Orchestrator } from '../orchestrator'
import { TextInClient } from '../../ocr/textin-client'
import { LlmClient } from '../../llm/llm-client'
import * as uuid from 'uuid'

vi.mock('../../ocr/textin-client')
vi.mock('../../llm/llm-client')
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234')
}))
vi.mock('../../llm/chunking', () => ({
  splitIntoChunks: (text: string, _threshold: number) => [text.substring(0, text.length/2), text.substring(text.length/2)]
}))
vi.mock('../../llm/placeholder-guard', () => ({
  assertNoPlaceholder: (text: string) => !text.includes('PLACEHOLDER_WARNING')
}))

describe('Orchestrator', () => {
  let mockTextIn: any
  let mockLlm: any
  let orchestrator: Orchestrator

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset uuid.v4 to default implementation after clearAllMocks
    vi.mocked(uuid.v4).mockReturnValue('mock-uuid-1234')

    mockTextIn = new TextInClient({ appId: 'appId', secretCode: 'secret', baseUrl: 'http://api' }) as any
    mockLlm = new LlmClient({ baseUrl: 'http://api', apiKey: 'key', model: 'model' }) as any
    
    mockTextIn.recognizeFile = vi.fn().mockResolvedValue('raw ocr text')
    mockTextIn.isRecoverableError = vi.fn().mockReturnValue(false)
    
    mockLlm.callLlm = vi.fn().mockResolvedValue('<thoughts>thoughts</thoughts><result>structured text</result>')
    mockLlm.extractResult = vi.fn().mockReturnValue('structured text')
    mockLlm.extractThoughts = vi.fn().mockReturnValue('thoughts')
    mockLlm.isRecoverableError = vi.fn().mockReturnValue(false)

    orchestrator = new Orchestrator(mockTextIn, mockLlm, { concurrency: 2, chunkThreshold: 100 })
  })

  it('should process a job successfully', async () => {
    const onProgress = vi.fn()
    const stats = await orchestrator.startBatch(['/path/file1.pdf'], 'faithful', onProgress)
    
    expect(stats).toEqual({ total: 1, success: 1, failed: 0 })
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'queued' }))
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'ocr' }))
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'structuring' }))
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'summarizing' }))
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'done' }))
    
    const result = orchestrator.getResult('mock-uuid-1234')
    expect(result).toBeDefined()
    expect(result?.rawText).toBe('raw ocr text')
    expect(result?.structuredText).toBe('structured text')
    expect(result?.summary).toBe('structured text')
    expect(result?.hasPlaceholderWarning).toBe(false)
  })

  it('should isolate failures', async () => {
    const onProgress = vi.fn()
    let uuidCounter = 0
    vi.mocked(uuid.v4).mockImplementation(() => `mock-uuid-${++uuidCounter}`)

    mockTextIn.recognizeFile
      .mockRejectedValueOnce(new Error('Fatal error'))
      .mockResolvedValueOnce('success text')

    const stats = await orchestrator.startBatch(['/file1.pdf', '/file2.pdf'], 'faithful', onProgress)
    
    expect(stats).toEqual({ total: 2, success: 1, failed: 1 })
    expect(orchestrator.getJobStatus('mock-uuid-1')?.stage).toBe('error')
    expect(orchestrator.getJobStatus('mock-uuid-1')?.error).toBe('Fatal error')
    expect(orchestrator.getJobStatus('mock-uuid-2')?.stage).toBe('done')
  })

  it('should retry recoverable errors', async () => {
    const onProgress = vi.fn()
    mockTextIn.isRecoverableError.mockReturnValueOnce(true)
    mockTextIn.recognizeFile
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce('recovered text')

    const stats = await orchestrator.startBatch(['/file1.pdf'], 'faithful', onProgress)
    expect(stats.success).toBe(1)
    expect(mockTextIn.recognizeFile).toHaveBeenCalledTimes(2)
  })

  it('should not retry unrecoverable errors', async () => {
    const onProgress = vi.fn()
    mockTextIn.isRecoverableError.mockReturnValueOnce(false)
    mockTextIn.recognizeFile.mockRejectedValueOnce(new Error('Bad credentials'))

    const stats = await orchestrator.startBatch(['/file1.pdf'], 'faithful', onProgress)
    expect(stats.failed).toBe(1)
    expect(mockTextIn.recognizeFile).toHaveBeenCalledTimes(1)
  })

  it('should handle cancellation mid-process', async () => {
    const onProgress = vi.fn()
    mockTextIn.recognizeFile.mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve('slow text'), 50)
    }))

    const batchPromise = orchestrator.startBatch(['/file1.pdf'], 'faithful', onProgress)
    orchestrator.cancel()
    
    const stats = await batchPromise
    expect(stats.failed).toBe(1)
    expect(orchestrator.getJobStatus('mock-uuid-1234')?.stage).toBe('error')
    expect(orchestrator.getJobStatus('mock-uuid-1234')?.error).toBe('Cancelled')
  })

  it('should detect placeholders', async () => {
    const onProgress = vi.fn()
    mockLlm.extractResult.mockReturnValueOnce('text PLACEHOLDER_WARNING text')
    
    await orchestrator.startBatch(['/file1.pdf'], 'faithful', onProgress)
    const result = orchestrator.getResult('mock-uuid-1234')
    expect(result?.hasPlaceholderWarning).toBe(true)
  })

  it('should split long text into chunks', async () => {
    const onProgress = vi.fn()
    const longText = 'A'.repeat(150)
    mockTextIn.recognizeFile.mockResolvedValue(longText)
    mockLlm.extractResult.mockReturnValue('structured chunk')

    await orchestrator.startBatch(['/file1.pdf'], 'faithful', onProgress)
    expect(mockLlm.callLlm).toHaveBeenCalledTimes(3) // 2 chunks + 1 summary
    const result = orchestrator.getResult('mock-uuid-1234')
    expect(result?.structuredText).toBe('structured chunk\n\nstructured chunk')
  })

  it('should enforce concurrency limits', async () => {
    const onProgress = vi.fn()
    let uuidCounter = 0
    vi.mocked(uuid.v4).mockImplementation(() => `mock-uuid-${++uuidCounter}`)

    let activeTasks = 0
    let maxTasks = 0
    mockTextIn.recognizeFile.mockImplementation(() => {
      activeTasks++
      maxTasks = Math.max(maxTasks, activeTasks)
      return new Promise(resolve => {
        setTimeout(() => {
          activeTasks--
          resolve('done')
        }, 10)
      })
    })

    await orchestrator.startBatch(['/f1', '/f2', '/f3', '/f4'], 'faithful', onProgress)
    expect(maxTasks).toBeLessThanOrEqual(2)
  })
})
