import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ConfigStore, configStore } from '../store'
import { DEFAULT_SETTINGS } from '../../shared/types'
import electronStore from 'electron-store'

// Mock electron-store
vi.mock('electron-store', () => {
  return {
    default: vi.fn().mockImplementation((options) => {
      let store: Record<string, any> = {};
      if (options?.defaults) {
        store = JSON.parse(JSON.stringify(options.defaults));
      }
      return {
        get: vi.fn((key: string) => store[key]),
        set: vi.fn((key: string, value: any) => {
          store[key] = value;
        }),
        clear: vi.fn(() => {
          store = {};
        })
      };
    })
  };
});

describe('ConfigStore', () => {
  beforeEach(() => {
    configStore.clear();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const Store = electronStore as any;
      Store.mockClear();

      new ConfigStore();

      expect(Store).toHaveBeenCalledWith(expect.objectContaining({
        name: 'ocr-app-config',
        encryptionKey: 'ocr-app-secret-key'
      }));
    });

    it('should initialize with provided encryption key', () => {
      const Store = electronStore as any;
      Store.mockClear();

      new ConfigStore({ encryptionKey: 'custom-key' });

      expect(Store).toHaveBeenCalledWith(expect.objectContaining({
        encryptionKey: 'custom-key'
      }));
    });
  });

  describe('getSettings', () => {
    it('should return default settings initially', () => {
      const settings = configStore.getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should fall back to defaults if properties are missing', () => {
      // Direct manipulate store to simulate missing data
      const storeInstance = new ConfigStore();
      (storeInstance as any).store.set('settings', { concurrency: 99 });
      
      const settings = storeInstance.getSettings();
      expect(settings.concurrency).toBe(99);
      expect(settings.textin).toEqual(DEFAULT_SETTINGS.textin);
      expect(settings.llm).toEqual(DEFAULT_SETTINGS.llm);
      expect(settings.chunkThreshold).toBe(DEFAULT_SETTINGS.chunkThreshold);
    });

    it('should return defaults if settings is falsy', () => {
      const storeInstance = new ConfigStore();
      (storeInstance as any).store.get = vi.fn().mockReturnValue(null);
      
      const settings = storeInstance.getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('setSettings', () => {
    it('should partially update settings', () => {
      configStore.setSettings({
        concurrency: 5
      });
      
      const settings = configStore.getSettings();
      expect(settings.concurrency).toBe(5);
      // Other settings should remain at default
      expect(settings.textin).toEqual(DEFAULT_SETTINGS.textin);
      expect(settings.llm).toEqual(DEFAULT_SETTINGS.llm);
      expect(settings.chunkThreshold).toBe(DEFAULT_SETTINGS.chunkThreshold);
    });

    it('should update nested settings', () => {
      configStore.setSettings({
        textin: {
          ...DEFAULT_SETTINGS.textin,
          appId: 'test-app-id',
          secretCode: 'test-secret'
        }
      });
      
      const settings = configStore.getSettings();
      expect(settings.textin.appId).toBe('test-app-id');
      expect(settings.textin.secretCode).toBe('test-secret');
      expect(settings.textin.baseUrl).toBe(DEFAULT_SETTINGS.textin.baseUrl);
    });

    it('should deeply merge partial nested settings', () => {
      configStore.setSettings({
        llm: {
          ...DEFAULT_SETTINGS.llm,
          baseUrl: 'http://localhost:11434',
        }
      });
      
      const settings = configStore.getSettings();
      expect(settings.llm.baseUrl).toBe('http://localhost:11434');
      // Should preserve other properties
      expect(settings.llm.model).toBe(DEFAULT_SETTINGS.llm.model);
      expect(settings.llm.apiKey).toBe(DEFAULT_SETTINGS.llm.apiKey);
    });
  });

  describe('clear', () => {
    it('should clear all settings and restore defaults', () => {
      configStore.setSettings({
        concurrency: 10,
        textin: {
          appId: 'foo',
          secretCode: 'bar',
          baseUrl: 'baz'
        }
      });
      
      configStore.clear();
      const settings = configStore.getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });
});
