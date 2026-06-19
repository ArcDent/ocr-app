import { create } from 'zustand'
import { AppSettings, DEFAULT_SETTINGS, IPC_CHANNELS } from '../../../shared/types'

interface SettingsState {
  settings: AppSettings
  isLoaded: boolean
  isLoading: boolean
  error: string | null

  // Actions
  loadSettings: () => Promise<void>
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>
  saveSettings: (newSettings: AppSettings) => Promise<void>
  testOcrConnection: () => Promise<{ success: boolean; message: string }>
  testLlmConnection: () => Promise<{ success: boolean; message: string }>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoaded: false,
  isLoading: false,
  error: null,

  loadSettings: async () => {
    set({ isLoading: true, error: null })
    try {
      // @ts-ignore
      const settings = await window.api.invoke(IPC_CHANNELS.SETTINGS_GET, undefined)
      set({ settings, isLoaded: true, isLoading: false })
    } catch (err) {
      console.error('Failed to load settings:', err)
      set({ error: (err as Error).message, isLoading: false })
    }
  },

  updateSettings: async (newSettings) => {
    set({ isLoading: true, error: null })
    try {
      const mergedSettings = { ...get().settings, ...newSettings }
      // @ts-ignore
      await window.api.invoke(IPC_CHANNELS.SETTINGS_SET, mergedSettings)
      set({ settings: mergedSettings, isLoading: false })
    } catch (err) {
      console.error('Failed to update settings:', err)
      set({ error: (err as Error).message, isLoading: false })
    }
  },

  saveSettings: async (newSettings) => {
    set({ isLoading: true, error: null })
    try {
      // @ts-ignore
      await window.api.invoke(IPC_CHANNELS.SETTINGS_SET, newSettings)
      set({ settings: newSettings, isLoading: false })
    } catch (err) {
      console.error('Failed to save settings:', err)
      set({ error: (err as Error).message, isLoading: false })
    }
  },

  testOcrConnection: async () => {
    try {
      // @ts-ignore
      return await window.api.invoke(IPC_CHANNELS.SETTINGS_TEST_OCR, undefined)
    } catch (err) {
      return { success: false, message: (err as Error).message }
    }
  },

  testLlmConnection: async () => {
    try {
      // @ts-ignore
      return await window.api.invoke(IPC_CHANNELS.SETTINGS_TEST_LLM, undefined)
    } catch (err) {
      return { success: false, message: (err as Error).message }
    }
  }
}))
