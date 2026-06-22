import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Orchestrator } from '../orchestrator'
import { TextInClient } from '../../ocr/textin-client'
import { LlmClient } from '../../llm/llm-client'
import { structureText, summarize } from '../../llm/chunking'
import { randomUUID } from 'crypto'

vi.mock('../../ocr/textin-client')
vi.mock('../../llm/llm-client')
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => '00000000-0000-1000-8000-000000000001')
}))
vi.mock('../../llm/chunking', () => ({
  splitIntoChunks: (text: string, _t: number) => [text],
  structureText: vi.fn(async (_raw: string, _mode: string, _th: number, _llm: unknown) =>
    ({ text: 'structured text', thoughts: 'thoughts', type: 'kv' })),
  summarize: vi.fn(async (_text: string, _th: number, _llm: unknown) =>
    ({ text: 'summary text', thoughts: 'summary thoughts', type: 'prose' })),
}))

describe('Orchestrator', () => {
  let mockTextIn: any
  let mockLlm: any
  let orchestrator: Orchestrator

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset randomUUID to default implementation after clearAllMocks
    vi.mocked(randomUUID).mockReturnValue('00000000-0000-1000-8000-000000000001')

    mockTextIn = new TextInClient({ appId: 'appId', secretCode: 'secret', baseUrl: 'http://api' }) as any
    mockLlm = new LlmClient({ baseUrl: 'http://api', apiKey: 'key', model: 'model' }) as any

    mockTextIn.recognizeFile = vi.fn().mockResolvedValue('raw ocr text')
    mockTextIn.isRecoverableError = vi.fn().mockReturnValue(false)

    mockLlm.callLlm = vi.fn()
    mockLlm.extractResult = vi.fn()
    mockLlm.extractThoughts = vi.fn()
    mockLlm.isRecoverableError = vi.fn().mockReturnValue(false)

    vi.mocked(structureText).mockResolvedValue({ text: 'structured text', thoughts: 'thoughts', type: 'kv' })
    vi.mocked(summarize).mockResolvedValue({ text: 'summary text', thoughts: 'summary thoughts', type: 'prose' })

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

    const result = orchestrator.getResult('00000000-0000-1000-8000-000000000001')
    expect(result).toBeDefined()
    expect(result?.rawText).toBe('raw ocr text')
    expect(result?.structuredText).toBe('structured text')
    expect(result?.summary).toBe('summary text')
    expect(result?.hasPlaceholderWarning).toBe(false)
  })

  it('should isolate failures', async () => {
    const onProgress = vi.fn()
    let uuidCounter = 0
    vi.mocked(randomUUID).mockImplementation(() => `00000000-0000-1000-8000-${String(++uuidCounter).padStart(12, '0')}`)

    mockTextIn.recognizeFile
      .mockRejectedValueOnce(new Error('Fatal error'))
      .mockResolvedValueOnce('success text')

    const stats = await orchestrator.startBatch(['/file1.pdf', '/file2.pdf'], 'faithful', onProgress)

    expect(stats).toEqual({ total: 2, success: 1, failed: 1 })
    expect(orchestrator.getJobStatus('00000000-0000-1000-8000-000000000001')?.stage).toBe('error')
    expect(orchestrator.getJobStatus('00000000-0000-1000-8000-000000000001')?.error).toBe('Fatal error')
    expect(orchestrator.getJobStatus('00000000-0000-1000-8000-000000000002')?.stage).toBe('done')
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
    expect(orchestrator.getJobStatus('00000000-0000-1000-8000-000000000001')?.stage).toBe('error')
    expect(orchestrator.getJobStatus('00000000-0000-1000-8000-000000000001')?.error).toBe('Cancelled')
  })

  it('should detect placeholders', async () => {
    const onProgress = vi.fn()
    vi.mocked(structureText).mockResolvedValue({ text: 'text [待补充] more', thoughts: undefined, type: 'kv' })

    await orchestrator.startBatch(['/file1.pdf'], 'faithful', onProgress)
    const result = orchestrator.getResult('00000000-0000-1000-8000-000000000001')
    expect(result?.hasPlaceholderWarning).toBe(true)
  })

  it('should delegate structuring to structureText with mode and threshold', async () => {
    const onProgress = vi.fn()
    const longText = 'A'.repeat(150)
    mockTextIn.recognizeFile.mockResolvedValue(longText)
    vi.mocked(structureText).mockResolvedValue({ text: 'structured', thoughts: undefined, type: 'prose' })
    vi.mocked(summarize).mockResolvedValue({ text: 'summary', thoughts: undefined, type: 'prose' })

    await orchestrator.startBatch(['/file1.pdf'], 'enhanced', onProgress)
    expect(structureText).toHaveBeenCalledWith(longText, 'enhanced', 100, mockLlm)
    expect(summarize).toHaveBeenCalledWith('structured', 100, mockLlm)
  })

  it('should retry structureText on recoverable LLM error', async () => {
    const onProgress = vi.fn()
    mockLlm.isRecoverableError.mockReturnValue(true)
    vi.mocked(structureText)
      .mockRejectedValueOnce(new Error('LLM network timeout'))
      .mockResolvedValueOnce({ text: 'structured', thoughts: undefined, type: 'kv' })
    vi.mocked(summarize).mockResolvedValue({ text: 'summary', thoughts: undefined, type: 'prose' })

    const stats = await orchestrator.startBatch(['/file1.pdf'], 'faithful', onProgress)
    expect(stats.success).toBe(1)
    expect(structureText).toHaveBeenCalledTimes(2)
  })

  it('should enforce concurrency limits', async () => {
    const onProgress = vi.fn()
    let uuidCounter = 0
    vi.mocked(randomUUID).mockImplementation(() => `00000000-0000-1000-8000-${String(++uuidCounter).padStart(12, '0')}`)

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

  it('getJobs returns snapshot of current batch jobs', async () => {
    const onProgress = vi.fn()
    let uuidCounter = 0
    vi.mocked(randomUUID).mockImplementation(() => `00000000-0000-1000-8000-${String(++uuidCounter).padStart(12, '0')}`)

    await orchestrator.startBatch(['/f1.pdf', '/f2.pdf'], 'faithful', onProgress)
    const jobs = orchestrator.getJobs()
    expect(jobs).toHaveLength(2)
    expect(jobs.map((j) => j.fileName).sort()).toEqual(['f1.pdf', 'f2.pdf'])
  })
})
