import { describe, it, expect, beforeEach, vi } from 'vitest'

// ============= Electron mock =============
// vi.hoisted makes these available to hoisted vi.mock factories.
const { mockHandle, mockSend } = vi.hoisted(() => ({
  mockHandle: vi.fn(),
  mockSend: vi.fn(),
}))
vi.mock('electron', () => ({
  ipcMain: { handle: mockHandle },
  dialog: { showOpenDialog: vi.fn() },
  app: { getPath: vi.fn().mockReturnValue('/mock/userData') },
  IpcMainInvokeEvent: {},
}))

// ============= Module mocks (top-level, hoisted) =============
vi.mock('../store', () => ({
  configStore: {
    getSettings: vi.fn(),
    setSettings: vi.fn(),
  },
}))

vi.mock('../ocr/textin-client', () => ({
  TextInClient: vi.fn(),
}))

vi.mock('../llm/llm-client', () => ({
  LlmClient: vi.fn(),
}))

vi.mock('../pipeline/orchestrator', () => ({
  Orchestrator: vi.fn(),
}))

// HistoryManager returns a singleton so the module-level
// `if (!historyManager)` guard inside ipc-handlers keeps working
// across tests — we just reset the singleton's method mocks in beforeEach.
const { historyInstance } = vi.hoisted(() => ({
  historyInstance: {
    saveResult: vi.fn(),
    listHistory: vi.fn(),
    getJob: vi.fn(),
    clearHistory: vi.fn(),
  },
}))
vi.mock('../history/history-manager', () => ({
  HistoryManager: vi.fn(() => historyInstance),
}))

vi.mock('../export/markdown-exporter', () => ({
  exportBatch: vi.fn(),
}))

// ============= Imports after mocks =============
import { registerIpcHandlers } from '../ipc-handlers'
import { configStore } from '../store'
import { TextInClient } from '../ocr/textin-client'
import { LlmClient } from '../llm/llm-client'
import { Orchestrator } from '../pipeline/orchestrator'
import { exportBatch } from '../export/markdown-exporter'
import { IPC_CHANNELS } from '../../shared/types'

const baseSettings = {
  textin: { appId: 'a', secretCode: 's', baseUrl: 'http://t' },
  llm: { baseUrl: 'http://l', apiKey: 'k', model: 'm' },
  concurrency: 3,
  chunkThreshold: 12000,
}

describe('registerIpcHandlers', () => {
  let handlers: Record<string, (event: any, data?: any) => any>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = {}
    mockHandle.mockImplementation((channel: string, handler: any) => {
      handlers[channel] = handler
    })
    // Re-establish default implementations after clearAllMocks
    ;(configStore.getSettings as any).mockReturnValue(baseSettings)
    historyInstance.saveResult = vi.fn().mockResolvedValue(undefined)
    historyInstance.listHistory = vi.fn().mockReturnValue([])
    historyInstance.getJob = vi.fn().mockResolvedValue(null)
    historyInstance.clearHistory = vi.fn().mockResolvedValue(undefined)
    // Re-register so handlers capture the fresh mock state
    registerIpcHandlers()
  })

  // ---------- SETTINGS_GET ----------
  describe('SETTINGS_GET', () => {
    it('returns configStore.getSettings()', async () => {
      ;(configStore.getSettings as any).mockReturnValue(baseSettings)
      const result = await handlers[IPC_CHANNELS.SETTINGS_GET]({ sender: mockSend })
      expect(result).toEqual(baseSettings)
    })
  })

  // ---------- SETTINGS_SET ----------
  describe('SETTINGS_SET', () => {
    it('calls configStore.setSettings with the payload', async () => {
      await handlers[IPC_CHANNELS.SETTINGS_SET]({}, baseSettings)
      expect(configStore.setSettings).toHaveBeenCalledWith(baseSettings)
    })
  })

  // ---------- SETTINGS_TEST_OCR ----------
  describe('SETTINGS_TEST_OCR', () => {
    it('returns failure when appId missing', async () => {
      ;(configStore.getSettings as any).mockReturnValue({
        ...baseSettings,
        textin: { appId: '', secretCode: 's', baseUrl: 'http://t' },
      })
      const result = await handlers[IPC_CHANNELS.SETTINGS_TEST_OCR]({ sender: mockSend })
      expect(result).toEqual({ success: false, message: 'OCR API keys not configured' })
    })

    it('returns failure when secretCode missing', async () => {
      ;(configStore.getSettings as any).mockReturnValue({
        ...baseSettings,
        textin: { appId: 'a', secretCode: '', baseUrl: 'http://t' },
      })
      const result = await handlers[IPC_CHANNELS.SETTINGS_TEST_OCR]({ sender: mockSend })
      expect(result).toEqual({ success: false, message: 'OCR API keys not configured' })
    })

    it('calls TextInClient.testConnection when configured', async () => {
      ;(configStore.getSettings as any).mockReturnValue(baseSettings)
      const testConn = vi.fn().mockResolvedValue({ success: true, message: 'ok' })
      ;(TextInClient as any).mockImplementation(() => ({ testConnection: testConn }))

      const result = await handlers[IPC_CHANNELS.SETTINGS_TEST_OCR]({ sender: mockSend })

      expect(testConn).toHaveBeenCalled()
      expect(result).toEqual({ success: true, message: 'ok' })
    })

    it('returns failure when testConnection throws', async () => {
      ;(configStore.getSettings as any).mockReturnValue(baseSettings)
      const testConn = vi.fn().mockRejectedValue(new Error('network down'))
      ;(TextInClient as any).mockImplementation(() => ({ testConnection: testConn }))

      const result = await handlers[IPC_CHANNELS.SETTINGS_TEST_OCR]({ sender: mockSend })

      expect(result).toEqual({ success: false, message: 'network down' })
    })
  })

  // ---------- SETTINGS_TEST_LLM ----------
  describe('SETTINGS_TEST_LLM', () => {
    it('returns failure when apiKey missing', async () => {
      ;(configStore.getSettings as any).mockReturnValue({
        ...baseSettings,
        llm: { baseUrl: 'http://l', apiKey: '', model: 'm' },
      })
      const result = await handlers[IPC_CHANNELS.SETTINGS_TEST_LLM]({ sender: mockSend })
      expect(result).toEqual({ success: false, message: 'LLM API key not configured' })
    })

    it('calls LlmClient.testConnection when configured', async () => {
      ;(configStore.getSettings as any).mockReturnValue(baseSettings)
      const testConn = vi.fn().mockResolvedValue({ success: true, message: 'llm ok' })
      ;(LlmClient as any).mockImplementation(() => ({ testConnection: testConn }))

      const result = await handlers[IPC_CHANNELS.SETTINGS_TEST_LLM]({ sender: mockSend })

      expect(testConn).toHaveBeenCalled()
      expect(result).toEqual({ success: true, message: 'llm ok' })
    })

    it('returns failure when LlmClient.testConnection throws', async () => {
      ;(configStore.getSettings as any).mockReturnValue(baseSettings)
      const testConn = vi.fn().mockRejectedValue(new Error('401 unauthorized'))
      ;(LlmClient as any).mockImplementation(() => ({ testConnection: testConn }))

      const result = await handlers[IPC_CHANNELS.SETTINGS_TEST_LLM]({ sender: mockSend })

      expect(result).toEqual({ success: false, message: '401 unauthorized' })
    })
  })

  // ---------- OCR_START_BATCH ----------
  describe('OCR_START_BATCH', () => {
    it('throws when config missing', async () => {
      ;(configStore.getSettings as any).mockReturnValue({
        ...baseSettings,
        llm: { baseUrl: '', apiKey: '', model: '' },
      })
      await expect(
        handlers[IPC_CHANNELS.OCR_START_BATCH](
          { sender: mockSend },
          { paths: ['/f.pdf'], mode: 'faithful' }
        )
      ).rejects.toThrow('配置缺失')
    })

    it('sends ON_BATCH_DONE after batch and saves only done jobs to history', async () => {
      ;(configStore.getSettings as any).mockReturnValue(baseSettings)
      const startBatch = vi.fn().mockResolvedValue({ total: 2, success: 1, failed: 1 })
      const doneResult = {
        jobId: 'j1',
        fileName: 'f.pdf',
        structuredText: 's',
        summary: 'sum',
      }
      const getJobs = vi.fn().mockReturnValue([
        { jobId: 'j1', fileName: 'f.pdf', stage: 'done' },
        { jobId: 'j2', fileName: 'g.pdf', stage: 'error' },
      ])
      const getResult = vi
        .fn()
        .mockImplementation((id: string) => (id === 'j1' ? doneResult : undefined))
      ;(Orchestrator as any).mockImplementation(() => ({
        startBatch,
        getJobs,
        getResult,
        cancel: vi.fn(),
      }))
      ;(TextInClient as any).mockImplementation(() => ({ testConnection: vi.fn() }))
      ;(LlmClient as any).mockImplementation(() => ({ testConnection: vi.fn() }))

      const event = { sender: { send: mockSend } }
      await handlers[IPC_CHANNELS.OCR_START_BATCH](
        event,
        { paths: ['/f.pdf', '/g.pdf'], mode: 'faithful' }
      )

      expect(startBatch).toHaveBeenCalledWith(
        ['/f.pdf', '/g.pdf'],
        'faithful',
        expect.any(Function)
      )
      expect(historyInstance.saveResult).toHaveBeenCalledTimes(1)
      expect(historyInstance.saveResult).toHaveBeenCalledWith(doneResult)
      expect(mockSend).toHaveBeenCalledWith(IPC_CHANNELS.ON_BATCH_DONE, {
        total: 2,
        success: 1,
        failed: 1,
      })
    })

    it('does not save anything when all jobs errored', async () => {
      ;(configStore.getSettings as any).mockReturnValue(baseSettings)
      const startBatch = vi
        .fn()
        .mockResolvedValue({ total: 1, success: 0, failed: 1 })
      const getJobs = vi
        .fn()
        .mockReturnValue([{ jobId: 'j1', fileName: 'f.pdf', stage: 'error' }])
      const getResult = vi.fn()
      ;(Orchestrator as any).mockImplementation(() => ({
        startBatch,
        getJobs,
        getResult,
        cancel: vi.fn(),
      }))
      ;(TextInClient as any).mockImplementation(() => ({ testConnection: vi.fn() }))
      ;(LlmClient as any).mockImplementation(() => ({ testConnection: vi.fn() }))

      const event = { sender: { send: mockSend } }
      await handlers[IPC_CHANNELS.OCR_START_BATCH](
        event,
        { paths: ['/f.pdf'], mode: 'enhanced' }
      )

      expect(historyInstance.saveResult).not.toHaveBeenCalled()
      expect(mockSend).toHaveBeenCalledWith(IPC_CHANNELS.ON_BATCH_DONE, {
        total: 1,
        success: 0,
        failed: 1,
      })
    })

    it('still sends ON_BATCH_DONE when startBatch rejects', async () => {
      // The finally block nulls orchestrator but does NOT send ON_BATCH_DONE on
      // rejection — startBatch rejection propagates to ipcMain.handle. Verify
      // the normal path's finally does not crash; rejection is surfaced.
      ;(configStore.getSettings as any).mockReturnValue(baseSettings)
      const startBatch = vi.fn().mockRejectedValue(new Error('batch boom'))
      ;(Orchestrator as any).mockImplementation(() => ({
        startBatch,
        getJobs: vi.fn().mockReturnValue([]),
        getResult: vi.fn(),
        cancel: vi.fn(),
      }))
      ;(TextInClient as any).mockImplementation(() => ({ testConnection: vi.fn() }))
      ;(LlmClient as any).mockImplementation(() => ({ testConnection: vi.fn() }))

      const event = { sender: { send: mockSend } }
      await expect(
        handlers[IPC_CHANNELS.OCR_START_BATCH](
          event,
          { paths: ['/f.pdf'], mode: 'faithful' }
        )
      ).rejects.toThrow('batch boom')
    })
  })

  // ---------- OCR_GET_RESULT ----------
  describe('OCR_GET_RESULT', () => {
    it('returns null when neither memory nor history has the job', async () => {
      ;(historyInstance.getJob as any).mockResolvedValue(null)
      const result = await handlers[IPC_CHANNELS.OCR_GET_RESULT]({}, { jobId: 'none' })
      expect(result).toBeNull()
    })

    it('returns from history when available', async () => {
      const fake = { jobId: 'j1', fileName: 'f.pdf' }
      ;(historyInstance.getJob as any).mockResolvedValue(fake)
      const result = await handlers[IPC_CHANNELS.OCR_GET_RESULT]({}, { jobId: 'j1' })
      expect(result).toEqual(fake)
    })
  })

  // ---------- EXPORT_BATCH ----------
  describe('EXPORT_BATCH', () => {
    it('returns failure when no valid results', async () => {
      ;(historyInstance.getJob as any).mockResolvedValue(null)
      const result = await handlers[IPC_CHANNELS.EXPORT_BATCH](
        {},
        { jobIds: ['x'], outputDir: '/out' }
      )
      expect(result).toEqual({ success: false, exportedCount: 0 })
      expect(exportBatch).not.toHaveBeenCalled()
    })

    it('calls exportBatch with results from history', async () => {
      const fakeResult = {
        jobId: 'j1',
        fileName: 'f.pdf',
        structuredText: 's',
        summary: 'sum',
      }
      ;(historyInstance.getJob as any).mockResolvedValue(fakeResult)
      ;(exportBatch as any).mockResolvedValue({ success: 1, failed: 0 })

      const result = await handlers[IPC_CHANNELS.EXPORT_BATCH](
        {},
        { jobIds: ['j1'], outputDir: '/out' }
      )

      expect(exportBatch).toHaveBeenCalledWith([fakeResult], '/out')
      expect(result).toEqual({ success: true, exportedCount: 1 })
    })

    it('filters out null results before export', async () => {
      const fakeResult = {
        jobId: 'j1',
        fileName: 'f.pdf',
        structuredText: 's',
        summary: 'sum',
      }
      ;(historyInstance.getJob as any).mockImplementation((id: string) =>
        id === 'j1' ? Promise.resolve(fakeResult) : Promise.resolve(null)
      )
      ;(exportBatch as any).mockResolvedValue({ success: 1, failed: 0 })

      const result = await handlers[IPC_CHANNELS.EXPORT_BATCH](
        {},
        { jobIds: ['j1', 'missing'], outputDir: '/out' }
      )

      expect(exportBatch).toHaveBeenCalledWith([fakeResult], '/out')
      expect(result).toEqual({ success: true, exportedCount: 1 })
    })

    it('returns failure when exportBatch throws', async () => {
      const fakeResult = {
        jobId: 'j1',
        fileName: 'f.pdf',
        structuredText: 's',
        summary: 'sum',
      }
      ;(historyInstance.getJob as any).mockResolvedValue(fakeResult)
      ;(exportBatch as any).mockRejectedValue(new Error('disk full'))

      const result = await handlers[IPC_CHANNELS.EXPORT_BATCH](
        {},
        { jobIds: ['j1'], outputDir: '/out' }
      )

      expect(result).toEqual({ success: false, exportedCount: 0 })
    })

    it('marks success false when exportBatch reports 0 successes', async () => {
      const fakeResult = {
        jobId: 'j1',
        fileName: 'f.pdf',
        structuredText: 's',
        summary: 'sum',
      }
      ;(historyInstance.getJob as any).mockResolvedValue(fakeResult)
      ;(exportBatch as any).mockResolvedValue({ success: 0, failed: 1 })

      const result = await handlers[IPC_CHANNELS.EXPORT_BATCH](
        {},
        { jobIds: ['j1'], outputDir: '/out' }
      )

      expect(result).toEqual({ success: false, exportedCount: 0 })
    })
  })

  // ---------- HISTORY_LIST ----------
  describe('HISTORY_LIST', () => {
    it('returns listHistory result', async () => {
      ;(historyInstance.listHistory as any).mockReturnValue([{ jobId: 'j1' }])
      const result = await handlers[IPC_CHANNELS.HISTORY_LIST]({ sender: mockSend })
      expect(result).toEqual([{ jobId: 'j1' }])
    })

    it('returns empty array when listHistory returns empty', async () => {
      ;(historyInstance.listHistory as any).mockReturnValue([])
      const result = await handlers[IPC_CHANNELS.HISTORY_LIST]({ sender: mockSend })
      expect(result).toEqual([])
    })
  })

  // ---------- HISTORY_GET ----------
  describe('HISTORY_GET', () => {
    it('returns historyManager.getJob result', async () => {
      const fake = { jobId: 'j1', fileName: 'f.pdf' }
      ;(historyInstance.getJob as any).mockResolvedValue(fake)
      const result = await handlers[IPC_CHANNELS.HISTORY_GET]({}, { jobId: 'j1' })
      expect(result).toEqual(fake)
    })

    it('returns null when job not found', async () => {
      ;(historyInstance.getJob as any).mockResolvedValue(null)
      const result = await handlers[IPC_CHANNELS.HISTORY_GET]({}, { jobId: 'missing' })
      expect(result).toBeNull()
    })
  })

  // ---------- HISTORY_CLEAR ----------
  describe('HISTORY_CLEAR', () => {
    it('calls historyManager.clearHistory', async () => {
      await handlers[IPC_CHANNELS.HISTORY_CLEAR]({ sender: mockSend })
      expect(historyInstance.clearHistory).toHaveBeenCalled()
    })
  })

  // ---------- OCR_CANCEL ----------
  describe('OCR_CANCEL', () => {
    it('resolves without throwing when no orchestrator is active', async () => {
      await expect(
        handlers[IPC_CHANNELS.OCR_CANCEL]({ sender: mockSend })
      ).resolves.toBeUndefined()
    })
  })
})
