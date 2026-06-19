import * as StoreModule from 'electron-store'
import type { AppSettings } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/types'

// Handle default export properly whether it's ESM or CJS
const Store = (StoreModule as any).default || StoreModule

export class ConfigStore {
  private store: any // Type as any to avoid type check errors with electron-store versions

  constructor(options?: { encryptionKey?: string }) {
    this.store = new Store({
      name: 'ocr-app-config',
      encryptionKey: options?.encryptionKey || 'ocr-app-secret-key',
      defaults: { version: '1.0.0', settings: DEFAULT_SETTINGS }
    })
  }

  getSettings(): AppSettings {
    const settings = this.store.get('settings') as AppSettings | undefined;
    if (!settings) {
      return DEFAULT_SETTINGS;
    }

    // Deep merge to ensure all nested properties exist, falling back to defaults
    return {
      textin: {
        ...DEFAULT_SETTINGS.textin,
        ...(settings.textin || {})
      },
      llm: {
        ...DEFAULT_SETTINGS.llm,
        ...(settings.llm || {})
      },
      concurrency: settings.concurrency ?? DEFAULT_SETTINGS.concurrency,
      chunkThreshold: settings.chunkThreshold ?? DEFAULT_SETTINGS.chunkThreshold
    };
  }

  setSettings(partial: Partial<AppSettings>): void {
    const currentSettings = this.getSettings();

    // Deep merge for nested objects like textin, llm
    const newSettings: AppSettings = {
      ...currentSettings,
      ...partial,
    };

    // Handle nested object merging explicitly
    if (partial.textin && currentSettings.textin) {
      newSettings.textin = { ...currentSettings.textin, ...partial.textin };
    }
    if (partial.llm && currentSettings.llm) {
      newSettings.llm = { ...currentSettings.llm, ...partial.llm };
    }

    this.store.set('settings', newSettings);
  }

  clear(): void {
    this.store.clear();
    // Re-initialize with defaults
    this.store.set('version', '1.0.0');
    this.store.set('settings', DEFAULT_SETTINGS);
  }
}

export const configStore = new ConfigStore()
