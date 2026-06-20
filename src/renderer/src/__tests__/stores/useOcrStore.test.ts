import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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

  it('exportBatch returns four-field result on success', async () => {
    useOcrStore.setState({
      results: {
        j1: {
          jobId: 'j1',
          fileName: 'f.pdf',
          rawText: 'r',
          structuredText: 's',
          summary: 'sum',
          mode: 'faithful',
          createdAt: 0,
        },
      },
    })
    mockInvoke.mockResolvedValue({ success: true, exportedCount: 1, failedCount: 0 })

    const result = await useOcrStore.getState().exportBatch('/out')

    expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.EXPORT_BATCH, {
      jobIds: ['j1'],
      outputDir: '/out',
    })
    expect(result).toEqual({ success: true, exportedCount: 1, failedCount: 0 })
  })

  it('exportBatch returns error message when invoke throws', async () => {
    useOcrStore.setState({
      results: {
        j1: {
          jobId: 'j1',
          fileName: 'f.pdf',
          rawText: 'r',
          structuredText: 's',
          summary: 'sum',
          mode: 'faithful',
          createdAt: 0,
        },
      },
    })
    mockInvoke.mockRejectedValue(new Error('ipc boom'))

    const result = await useOcrStore.getState().exportBatch('/out')

    expect(result).toEqual({ success: false, exportedCount: 0, failedCount: 0, error: 'ipc boom' })
  })

  it('exportBatch returns empty failure when no results', async () => {
    const result = await useOcrStore.getState().exportBatch('/out')
    expect(result).toEqual({ success: false, exportedCount: 0, failedCount: 0 })
    expect(mockInvoke).not.toHaveBeenCalled()
  })
})
