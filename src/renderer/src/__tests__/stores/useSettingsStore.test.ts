import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { IPC_CHANNELS, AppSettings, DEFAULT_SETTINGS } from '../../../../shared/types'

describe('useSettingsStore', () => {
  let mockInvoke: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke = vi.fn()
    ;(globalThis as any).window = {
      api: { invoke: mockInvoke, on: vi.fn() },
    }
  })

  afterEach(() => {
    delete (globalThis as any).window
  })

  const sampleSettings: AppSettings = {
    ...DEFAULT_SETTINGS,
    textin: { ...DEFAULT_SETTINGS.textin, appId: 'app-1', secretCode: 'secret-1' },
    llm: { ...DEFAULT_SETTINGS.llm, apiKey: 'key-1', model: 'gpt-4', baseUrl: 'https://api.x.com/v1' },
  }

  it('testOcrConnection persists settings via SETTINGS_SET before testing', async () => {
    mockInvoke
      .mockResolvedValueOnce(undefined) // SETTINGS_SET
      .mockResolvedValueOnce({ success: true, message: 'ok' }) // SETTINGS_TEST_OCR

    const result = await useSettingsStore.getState().testOcrConnection(sampleSettings)

    expect(mockInvoke).toHaveBeenNthCalledWith(1, IPC_CHANNELS.SETTINGS_SET, sampleSettings)
    expect(mockInvoke).toHaveBeenNthCalledWith(2, IPC_CHANNELS.SETTINGS_TEST_OCR, undefined)
    expect(result).toEqual({ success: true, message: 'ok' })
  })

  it('testOcrConnection returns failure when SETTINGS_SET throws', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('save failed'))

    const result = await useSettingsStore.getState().testOcrConnection(sampleSettings)

    expect(result.success).toBe(false)
    expect(result.message).toContain('save failed')
    expect(mockInvoke).toHaveBeenCalledTimes(1)
  })

  it('testLlmConnection persists settings before testing', async () => {
    mockInvoke
      .mockResolvedValueOnce(undefined) // SETTINGS_SET
      .mockResolvedValueOnce({ success: true, message: 'ok' }) // SETTINGS_TEST_LLM

    const result = await useSettingsStore.getState().testLlmConnection(sampleSettings)

    expect(mockInvoke).toHaveBeenNthCalledWith(1, IPC_CHANNELS.SETTINGS_SET, sampleSettings)
    expect(mockInvoke).toHaveBeenNthCalledWith(2, IPC_CHANNELS.SETTINGS_TEST_LLM, undefined)
    expect(result).toEqual({ success: true, message: 'ok' })
  })

  it('testOcrConnection returns failure when test itself fails', async () => {
    mockInvoke
      .mockResolvedValueOnce(undefined) // SETTINGS_SET ok
      .mockResolvedValueOnce({ success: false, message: 'bad key' }) // SETTINGS_TEST_OCR

    const result = await useSettingsStore.getState().testOcrConnection(sampleSettings)

    expect(result).toEqual({ success: false, message: 'bad key' })
  })
})
