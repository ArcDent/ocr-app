import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LlmClient } from '../llm-client'
import type { LlmConfig } from '../llm-client'
import type { ChatMessage } from '../types'

describe('LlmClient', () => {
  const mockConfig: LlmConfig = {
    baseUrl: 'https://api.example.com',
    apiKey: 'test-api-key',
    model: 'gpt-4',
  }

  let client: LlmClient

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
    client = new LlmClient(mockConfig)
    global.fetch = vi.fn()
  })

  describe('callLlm', () => {
    const testMessages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: 'Hello' },
    ]

    it('should successfully call LLM API', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Hello! How can I help you?',
            },
          },
        ],
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      const result = await client.callLlm(testMessages)

      expect(result).toBe('Hello! How can I help you?')
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: testMessages,
            temperature: 0,
          }),
        })
      )
    })

    it('should include Authorization header', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'response' } }],
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      await client.callLlm(testMessages)

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      )
    })

    it('should send correct request body with temperature 0', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'response' } }],
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      await client.callLlm(testMessages)

      const callArgs = vi.mocked(fetch).mock.calls[0]
      const requestBody = JSON.parse(callArgs[1]?.body as string)

      expect(requestBody).toEqual({
        model: 'gpt-4',
        messages: testMessages,
        temperature: 0,
      })
    })

    it('should throw error for HTTP 500', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response)

      await expect(client.callLlm(testMessages)).rejects.toThrow(
        'LLM API returned HTTP 500'
      )
    })

    it('should throw error for HTTP 401', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
      } as Response)

      await expect(client.callLlm(testMessages)).rejects.toThrow(
        'LLM API returned HTTP 401'
      )
    })

    it('should throw error for HTTP 404', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
      } as Response)

      await expect(client.callLlm(testMessages)).rejects.toThrow(
        'LLM API returned HTTP 404'
      )
    })

    it('should throw error when choices array is missing', async () => {
      const mockResponse = {}

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      await expect(client.callLlm(testMessages)).rejects.toThrow(
        'Invalid API response: missing choices array'
      )
    })

    it('should throw error when choices array is empty', async () => {
      const mockResponse = {
        choices: [],
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      await expect(client.callLlm(testMessages)).rejects.toThrow(
        'Invalid API response: missing choices array'
      )
    })

    it('should throw error when message content is missing', async () => {
      const mockResponse = {
        choices: [
          {
            message: {},
          },
        ],
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      await expect(client.callLlm(testMessages)).rejects.toThrow(
        'Invalid API response: missing message content'
      )
    })

    it('should throw error when message content is not a string', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 123,
            },
          },
        ],
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      await expect(client.callLlm(testMessages)).rejects.toThrow(
        'Invalid API response: missing message content'
      )
    })

    it('should throw timeout error after 120 seconds', async () => {
      vi.useFakeTimers()

      vi.mocked(fetch).mockImplementation((url, init) =>
        mockFetchHanging(url, init)
      )

      const promise = client.callLlm(testMessages)
      promise.catch(() => {}) // mark handled to avoid unhandled rejection race

      await vi.advanceTimersByTimeAsync(120000)

      await expect(promise).rejects.toThrow('LLM API request timeout (120000ms)')

      vi.useRealTimers()
    })

    it('should use custom timeout when provided', async () => {
      vi.useFakeTimers()

      const customClient = new LlmClient(mockConfig, { timeout: 30000 })

      vi.mocked(fetch).mockImplementation((url, init) =>
        mockFetchHanging(url, init)
      )

      const promise = customClient.callLlm(testMessages)
      promise.catch(() => {}) // mark handled to avoid unhandled rejection race

      await vi.advanceTimersByTimeAsync(30000)

      await expect(promise).rejects.toThrow('LLM API request timeout (30000ms)')

      vi.useRealTimers()
    })

    it('should handle trailing slash in baseUrl', async () => {
      const clientWithSlash = new LlmClient({
        ...mockConfig,
        baseUrl: 'https://api.example.com/',
      })

      const mockResponse = {
        choices: [{ message: { content: 'response' } }],
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      await clientWithSlash.callLlm(testMessages)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/chat/completions',
        expect.any(Object)
      )
    })

    it('should propagate network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      await expect(client.callLlm(testMessages)).rejects.toThrow('Network error')
    })
  })

  describe('extractResult', () => {
    it('should extract content from <result> tags', () => {
      const response = '<result>Structured data here</result>'
      expect(client.extractResult(response)).toBe('Structured data here')
    })

    it('should extract multiline content from <result> tags', () => {
      const response = `<result>
Line 1
Line 2
Line 3
</result>`
      expect(client.extractResult(response)).toBe('Line 1\nLine 2\nLine 3')
    })

    it('should handle <result> tags with surrounding text', () => {
      const response =
        'Some intro text\n<result>Extracted content</result>\nSome outro text'
      expect(client.extractResult(response)).toBe('Extracted content')
    })

    it('should trim whitespace from extracted result', () => {
      const response = '<result>  \n  Content with spaces  \n  </result>'
      expect(client.extractResult(response)).toBe('Content with spaces')
    })

    it('should return full response when <result> tags are missing', () => {
      const response = 'No tags here, just plain text'
      expect(client.extractResult(response)).toBe('No tags here, just plain text')
    })

    it('should return trimmed full response when tags are missing', () => {
      const response = '  No tags here  '
      expect(client.extractResult(response)).toBe('No tags here')
    })

    it('should handle empty <result> tags', () => {
      const response = '<result></result>'
      expect(client.extractResult(response)).toBe('')
    })

    it('should handle <result> tags with only whitespace', () => {
      const response = '<result>   \n   </result>'
      expect(client.extractResult(response)).toBe('')
    })

    it('should only extract first <result> if multiple exist', () => {
      const response = '<result>First</result> middle <result>Second</result>'
      expect(client.extractResult(response)).toBe('First')
    })

    it('should strip markdown heading markers', () => {
      const resp = '<result>### 标题\n正文</result>'
      expect(client.extractResult(resp)).toBe('标题\n正文')
    })

    it('should strip blockquote markers', () => {
      const resp = '<result>> 引用内容</result>'
      expect(client.extractResult(resp)).toBe('引用内容')
    })

    it('should remove horizontal rule lines', () => {
      const resp = '<result>上文\n---\n下文</result>'
      expect(client.extractResult(resp)).toBe('上文\n下文')
    })

    it('should unwrap bold markers', () => {
      const resp = '<result>**重点** 内容</result>'
      expect(client.extractResult(resp)).toBe('重点 内容')
    })

    it('should unwrap italic markers', () => {
      const resp = '<result>这是 *斜体* 词</result>'
      expect(client.extractResult(resp)).toBe('这是 斜体 词')
    })

    it('should unwrap inline code backticks', () => {
      const resp = '<result>用 `code` 标记</result>'
      expect(client.extractResult(resp)).toBe('用 code 标记')
    })

    it('should preserve list dash prefix', () => {
      const resp = '<result>- 项目一\n- 项目二</result>'
      expect(client.extractResult(resp)).toBe('- 项目一\n- 项目二')
    })

    it('should preserve numbered list prefix', () => {
      const resp = '<result>1. 第一步\n2. 第二步</result>'
      expect(client.extractResult(resp)).toBe('1. 第一步\n2. 第二步')
    })

    it('should preserve 【】 brackets', () => {
      const resp = '<result>【数据盘点】\n探索广度：1337 首</result>'
      expect(client.extractResult(resp)).toBe('【数据盘点】\n探索广度：1337 首')
    })

    it('should preserve full-width colon in kv', () => {
      const resp = '<result>探索广度：1337 首</result>'
      expect(client.extractResult(resp)).toBe('探索广度：1337 首')
    })

    it('should not strip inline standalone asterisk', () => {
      const resp = '<result>5 * 3 = 15</result>'
      expect(client.extractResult(resp)).toBe('5 * 3 = 15')
    })

    it('should clean markdown and keep placeholder detectable', () => {
      const resp = '<result>**标题**\n- 内容[待补充]</result>'
      expect(client.extractResult(resp)).toBe('标题\n- 内容[待补充]')
    })
  })

  describe('extractThoughts', () => {
    it('should extract content from <thoughts> tags', () => {
      const response = '<thoughts>Thinking process here</thoughts>'
      expect(client.extractThoughts(response)).toBe('Thinking process here')
    })

    it('should extract multiline content from <thoughts> tags', () => {
      const response = `<thoughts>
Step 1: analyze
Step 2: decide
Step 3: conclude
</thoughts>`
      expect(client.extractThoughts(response)).toBe(
        'Step 1: analyze\nStep 2: decide\nStep 3: conclude'
      )
    })

    it('should handle <thoughts> tags with surrounding text', () => {
      const response =
        'Some intro\n<thoughts>Internal reasoning</thoughts>\nSome outro'
      expect(client.extractThoughts(response)).toBe('Internal reasoning')
    })

    it('should trim whitespace from extracted thoughts', () => {
      const response = '<thoughts>  \n  Thoughts with spaces  \n  </thoughts>'
      expect(client.extractThoughts(response)).toBe('Thoughts with spaces')
    })

    it('should return undefined when <thoughts> tags are missing', () => {
      const response = 'No thoughts tags here'
      expect(client.extractThoughts(response)).toBeUndefined()
    })

    it('should handle empty <thoughts> tags', () => {
      const response = '<thoughts></thoughts>'
      expect(client.extractThoughts(response)).toBe('')
    })

    it('should handle <thoughts> tags with only whitespace', () => {
      const response = '<thoughts>   \n   </thoughts>'
      expect(client.extractThoughts(response)).toBe('')
    })

    it('should only extract first <thoughts> if multiple exist', () => {
      const response = '<thoughts>First</thoughts> middle <thoughts>Second</thoughts>'
      expect(client.extractThoughts(response)).toBe('First')
    })

    it('should work independently of <result> tags', () => {
      const response =
        '<thoughts>Thinking</thoughts>\n<result>Result</result>'
      expect(client.extractThoughts(response)).toBe('Thinking')
    })
  })

  describe('extractType', () => {
    it('should extract dialogue type', () => {
      expect(client.extractType('<type>dialogue</type>')).toBe('dialogue')
    })
    it('should extract kv type', () => {
      expect(client.extractType('<type>kv</type>')).toBe('kv')
    })
    it('should extract list type', () => {
      expect(client.extractType('<type>list</type>')).toBe('list')
    })
    it('should extract prose type', () => {
      expect(client.extractType('<type>prose</type>')).toBe('prose')
    })
    it('should extract mixed type', () => {
      expect(client.extractType('<type>mixed</type>')).toBe('mixed')
    })
    it('should extract type from response with other tags', () => {
      const resp = '<thoughts>分析</thoughts><type>kv</type><result>发票：1</result>'
      expect(client.extractType(resp)).toBe('kv')
    })
    it('should trim whitespace around type value', () => {
      expect(client.extractType('<type>  kv  </type>')).toBe('kv')
    })
    it('should return unknown when type tag missing', () => {
      expect(client.extractType('<thoughts>x</thoughts><result>y</result>')).toBe('unknown')
    })
    it('should return unknown when type value invalid', () => {
      expect(client.extractType('<type>table</type>')).toBe('unknown')
    })
    it('should return unknown for empty type tag', () => {
      expect(client.extractType('<type></type>')).toBe('unknown')
    })
    it('should only extract first type tag if multiple', () => {
      expect(client.extractType('<type>kv</type><type>prose</type>')).toBe('kv')
    })
  })

  describe('testConnection', () => {
    it('should return success when connection works', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'test response' } }],
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      const result = await client.testConnection()

      expect(result).toEqual({
        success: true,
        message: 'LLM API connection successful',
      })
    })

    it('should send test message during connection test', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'test response' } }],
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      await client.testConnection()

      const callArgs = vi.mocked(fetch).mock.calls[0]
      const requestBody = JSON.parse(callArgs[1]?.body as string)

      expect(requestBody.messages).toEqual([{ role: 'user', content: 'test' }])
    })

    it('should return failure for HTTP error', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response)

      const result = await client.testConnection()

      expect(result).toEqual({
        success: false,
        message: 'LLM API returned HTTP 500',
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

    it('should return failure for authentication error', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
      } as Response)

      const result = await client.testConnection()

      expect(result).toEqual({
        success: false,
        message: 'LLM API returned HTTP 401',
      })
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
      const error500 = new Error('LLM API returned HTTP 500')
      const error503 = new Error('LLM API returned HTTP 503')
      const error599 = new Error('LLM API returned HTTP 599')

      expect(client.isRecoverableError(error500)).toBe(true)
      expect(client.isRecoverableError(error503)).toBe(true)
      expect(client.isRecoverableError(error599)).toBe(true)
    })

    it('should return false for 4xx HTTP errors', () => {
      const error400 = new Error('LLM API returned HTTP 400')
      const error401 = new Error('LLM API returned HTTP 401')
      const error404 = new Error('LLM API returned HTTP 404')
      const error499 = new Error('LLM API returned HTTP 499')

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
