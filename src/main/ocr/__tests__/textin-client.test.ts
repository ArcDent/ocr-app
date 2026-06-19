import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TextInClient } from '../textin-client'
import type { TextInConfig, TextInApiResponse } from '../types'
import * as fs from 'node:fs/promises'

// Mock dependencies
vi.mock('node:fs/promises')

describe('TextInClient', () => {
  const mockConfig: TextInConfig = {
    appId: 'test-app-id',
    secretCode: 'test-secret',
    baseUrl: 'https://api.textin.com',
  }

  let client: TextInClient

  // Mock fetch that never resolves but rejects on AbortSignal
  const mockFetchHanging = (_url: any, init?: RequestInit) => {
    const p = new Promise<Response>((_resolve, reject) => {
      if (init?.signal) {
        if (init.signal.aborted) {
          const e = new Error('Aborted'); e.name = 'AbortError'; reject(e); return
        }
        init.signal.addEventListener('abort', () => {
          const e = new Error('Aborted'); e.name = 'AbortError'; reject(e)
        })
      }
    })
    return p
  }

  beforeEach(() => {
    vi.clearAllMocks()
    client = new TextInClient(mockConfig)
    global.fetch = vi.fn()
  })

  describe('recognizeFile', () => {
    const testFilePath = '/path/to/test.pdf'
    const mockFileBuffer = Buffer.from('mock file content')

    beforeEach(() => {
      vi.mocked(fs.readFile).mockResolvedValue(mockFileBuffer)
    })

    it('should successfully recognize single page file', async () => {
      const mockResponse: TextInApiResponse = {
        code: 200,
        message: 'success',
        result: {
          pages: [
            {
              lines: [
                { text: 'Line 1' },
                { text: 'Line 2' },
                { text: '  Line 3  ' },
              ],
            },
          ],
        },
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      const result = await client.recognizeFile(testFilePath)

      expect(result).toBe('Line 1\nLine 2\nLine 3')
      expect(fetch).toHaveBeenCalledWith(
        'https://api.textin.com/ai/service/v2/recognize/multipage',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'x-ti-app-id': 'test-app-id',
            'x-ti-secret-code': 'test-secret',
            'content-type': 'application/octet-stream',
          },
          body: mockFileBuffer,
        })
      )
    })

    it('should successfully concatenate multi-page results', async () => {
      const mockResponse: TextInApiResponse = {
        code: 200,
        message: 'success',
        result: {
          pages: [
            {
              lines: [{ text: 'Page 1 Line 1' }, { text: 'Page 1 Line 2' }],
            },
            {
              lines: [{ text: 'Page 2 Line 1' }, { text: 'Page 2 Line 2' }],
            },
            {
              lines: [{ text: 'Page 3 Line 1' }],
            },
          ],
        },
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      const result = await client.recognizeFile(testFilePath)

      expect(result).toBe(
        'Page 1 Line 1\nPage 1 Line 2\nPage 2 Line 1\nPage 2 Line 2\nPage 3 Line 1'
      )
    })

    it('should filter out empty lines', async () => {
      const mockResponse: TextInApiResponse = {
        code: 200,
        message: 'success',
        result: {
          pages: [
            {
              lines: [
                { text: 'Valid line' },
                { text: '' },
                { text: '   ' },
                { text: undefined },
                { text: 'Another valid line' },
              ],
            },
          ],
        },
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      const result = await client.recognizeFile(testFilePath)

      expect(result).toBe('Valid line\nAnother valid line')
    })

    it('should handle pages with missing lines array', async () => {
      const mockResponse: TextInApiResponse = {
        code: 200,
        message: 'success',
        result: {
          pages: [
            { lines: [{ text: 'Page 1' }] },
            { lines: undefined },
            { lines: [{ text: 'Page 3' }] },
          ],
        },
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      const result = await client.recognizeFile(testFilePath)

      expect(result).toBe('Page 1\nPage 3')
    })

    it('should throw error for HTTP non-200 status', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response)

      await expect(client.recognizeFile(testFilePath)).rejects.toThrow(
        'TextIn API returned HTTP 500'
      )
    })

    it('should throw error for HTTP 404', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
      } as Response)

      await expect(client.recognizeFile(testFilePath)).rejects.toThrow(
        'TextIn API returned HTTP 404'
      )
    })

    it('should throw error when TextIn code is not 200', async () => {
      const mockResponse: TextInApiResponse = {
        code: 400,
        message: 'Invalid request',
        result: {
          pages: [],
        },
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      await expect(client.recognizeFile(testFilePath)).rejects.toThrow(
        'TextIn API error: code=400, message=Invalid request'
      )
    })

    it('should throw error when TextIn code is missing', async () => {
      const mockResponse = {
        message: 'No code field',
        result: {
          pages: [],
        },
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      await expect(client.recognizeFile(testFilePath)).rejects.toThrow(
        'TextIn API error: code=unknown'
      )
    })

    it('should throw error when result.pages is missing', async () => {
      const mockResponse: TextInApiResponse = {
        code: 200,
        message: 'success',
        result: undefined,
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      await expect(client.recognizeFile(testFilePath)).rejects.toThrow(
        'Invalid API response: missing result.pages array'
      )
    })

    it('should throw error when result.pages is not an array', async () => {
      const mockResponse = {
        code: 200,
        message: 'success',
        result: {
          pages: 'not an array',
        },
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      await expect(client.recognizeFile(testFilePath)).rejects.toThrow(
        'Invalid API response: missing result.pages array'
      )
    })

    it('should throw timeout error after 60 seconds', async () => {
      vi.useFakeTimers()

      vi.mocked(fetch).mockImplementation((url, init) =>
        mockFetchHanging(url, init)
      )

      const promise = client.recognizeFile(testFilePath)
      promise.catch(() => {}) // mark handled to avoid unhandled rejection race

      // Fast-forward past the 60s timeout
      await vi.advanceTimersByTimeAsync(60000)

      await expect(promise).rejects.toThrow('TextIn API request timeout (60000ms)')

      vi.useRealTimers()
    })

    it('should use custom timeout when provided', async () => {
      vi.useFakeTimers()

      const customClient = new TextInClient(mockConfig, {
        recognizeTimeout: 30000,
      })

      vi.mocked(fetch).mockImplementation((url, init) =>
        mockFetchHanging(url, init)
      )

      const promise = customClient.recognizeFile(testFilePath)
      promise.catch(() => {}) // mark handled to avoid unhandled rejection race

      await vi.advanceTimersByTimeAsync(30000)

      await expect(promise).rejects.toThrow('TextIn API request timeout (30000ms)')

      vi.useRealTimers()
    })

    it('should handle trailing slash in baseUrl', async () => {
      const clientWithSlash = new TextInClient({
        ...mockConfig,
        baseUrl: 'https://api.textin.com/',
      })

      const mockResponse: TextInApiResponse = {
        code: 200,
        result: { pages: [] },
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      await clientWithSlash.recognizeFile(testFilePath)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.textin.com/ai/service/v2/recognize/multipage',
        expect.any(Object)
      )
    })

    it('should propagate fs.readFile errors', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'))

      await expect(client.recognizeFile(testFilePath)).rejects.toThrow(
        'File not found'
      )
    })
  })

  describe('testConnection', () => {
    it('should return success for 2xx response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
      } as Response)

      const result = await client.testConnection()

      expect(result).toEqual({
        success: true,
        message: 'TextIn API connection successful',
      })
      expect(fetch).toHaveBeenCalledWith(
        'https://api.textin.com/ai/service/v2/recognize/multipage',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'x-ti-app-id': 'test-app-id',
            'x-ti-secret-code': 'test-secret',
            'content-type': 'application/octet-stream',
          },
          body: expect.any(Uint8Array),
        })
      )
    })

    it('should return success for 4xx response (authentication worked)', async () => {
      vi.mocked(fetch).mockResolvedValue({
        status: 400,
      } as Response)

      const result = await client.testConnection()

      expect(result).toEqual({
        success: true,
        message: 'TextIn API connection successful',
      })
    })

    it('should return failure for 5xx response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        status: 500,
      } as Response)

      const result = await client.testConnection()

      expect(result).toEqual({
        success: false,
        message: 'TextIn API returned HTTP 500',
      })
    })

    it('should return failure for network error', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      const result = await client.testConnection()

      expect(result).toEqual({
        success: false,
        message: 'Network error',
      })
    })

    it('should return failure for timeout', async () => {
      vi.useFakeTimers()

      vi.mocked(fetch).mockImplementation((url, init) =>
        mockFetchHanging(url, init)
      )

      const promise = client.testConnection()

      await vi.advanceTimersByTimeAsync(10000)

      const result = await promise

      expect(result).toEqual({
        success: false,
        message: 'Connection timeout',
      })

      vi.useRealTimers()
    })

    it('should use custom test timeout when provided', async () => {
      vi.useFakeTimers()

      const customClient = new TextInClient(mockConfig, {
        testTimeout: 5000,
      })

      vi.mocked(fetch).mockImplementation((url, init) =>
        mockFetchHanging(url, init)
      )

      const promise = customClient.testConnection()

      await vi.advanceTimersByTimeAsync(5000)

      const result = await promise

      expect(result).toEqual({
        success: false,
        message: 'Connection timeout',
      })

      vi.useRealTimers()
    })

    it('should handle non-Error thrown values', async () => {
      vi.mocked(fetch).mockRejectedValue('string error')

      const result = await client.testConnection()

      expect(result).toEqual({
        success: false,
        message: 'Unknown connection error',
      })
    })
  })

  describe('isRecoverableError', () => {
    it('should return true for AbortError (timeout)', () => {
      const error = new Error('timeout')
      error.name = 'AbortError'

      expect(client.isRecoverableError(error)).toBe(true)
    })

    it('should return true for 5xx HTTP errors', () => {
      const error500 = new Error('TextIn API returned HTTP 500')
      const error503 = new Error('TextIn API returned HTTP 503')
      const error599 = new Error('TextIn API returned HTTP 599')

      expect(client.isRecoverableError(error500)).toBe(true)
      expect(client.isRecoverableError(error503)).toBe(true)
      expect(client.isRecoverableError(error599)).toBe(true)
    })

    it('should return false for 4xx HTTP errors', () => {
      const error400 = new Error('TextIn API returned HTTP 400')
      const error401 = new Error('TextIn API returned HTTP 401')
      const error404 = new Error('TextIn API returned HTTP 404')
      const error499 = new Error('TextIn API returned HTTP 499')

      expect(client.isRecoverableError(error400)).toBe(false)
      expect(client.isRecoverableError(error401)).toBe(false)
      expect(client.isRecoverableError(error404)).toBe(false)
      expect(client.isRecoverableError(error499)).toBe(false)
    })

    it('should return true for network errors', () => {
      const fetchError = new Error('fetch failed')
      const networkError = new Error('network timeout')
      const econnrefused = new Error('ECONNREFUSED')
      const etimedout = new Error('ETIMEDOUT')

      expect(client.isRecoverableError(fetchError)).toBe(true)
      expect(client.isRecoverableError(networkError)).toBe(true)
      expect(client.isRecoverableError(econnrefused)).toBe(true)
      expect(client.isRecoverableError(etimedout)).toBe(true)
    })

    it('should return true for 5xx TextIn API errors', () => {
      const error500 = new Error('TextIn API error: code=500, message=Server error')
      const error503 = new Error(
        'TextIn API error: code=503, message=Service unavailable'
      )

      expect(client.isRecoverableError(error500)).toBe(true)
      expect(client.isRecoverableError(error503)).toBe(true)
    })

    it('should return false for 4xx TextIn API errors', () => {
      const error400 = new Error('TextIn API error: code=400, message=Bad request')
      const error401 = new Error(
        'TextIn API error: code=401, message=Unauthorized'
      )

      expect(client.isRecoverableError(error400)).toBe(false)
      expect(client.isRecoverableError(error401)).toBe(false)
    })

    it('should return false for non-Error objects', () => {
      expect(client.isRecoverableError('string error')).toBe(false)
      expect(client.isRecoverableError(123)).toBe(false)
      expect(client.isRecoverableError(null)).toBe(false)
      expect(client.isRecoverableError(undefined)).toBe(false)
    })

    it('should return false for errors without recoverable patterns', () => {
      const genericError = new Error('Something went wrong')
      const parseError = new Error('Invalid JSON')

      expect(client.isRecoverableError(genericError)).toBe(false)
      expect(client.isRecoverableError(parseError)).toBe(false)
    })

    it('should return false for empty error message', () => {
      const emptyError = new Error('')

      expect(client.isRecoverableError(emptyError)).toBe(false)
    })
  })
})
