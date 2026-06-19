import * as fs from 'node:fs/promises'
import type {
  TextInConfig,
  TextInApiResponse,
  ConnectionTestResult,
} from './types'

/**
 * TextIn OCR API Client
 * Handles authentication, file upload, and response parsing
 */
export class TextInClient {
  private static readonly DEFAULT_RECOGNIZE_TIMEOUT = 60000
  private static readonly DEFAULT_TEST_TIMEOUT = 10000

  private readonly config: TextInConfig
  private readonly recognizeTimeout: number
  private readonly testTimeout: number

  constructor(
    config: TextInConfig,
    options?: { recognizeTimeout?: number; testTimeout?: number }
  ) {
    this.config = config
    this.recognizeTimeout =
      options?.recognizeTimeout ?? TextInClient.DEFAULT_RECOGNIZE_TIMEOUT
    this.testTimeout =
      options?.testTimeout ?? TextInClient.DEFAULT_TEST_TIMEOUT
  }

  /**
   * Build HTTP headers for TextIn API authentication
   */
  private buildHeaders(): Record<string, string> {
    return {
      'x-ti-app-id': this.config.appId,
      'x-ti-secret-code': this.config.secretCode,
      'content-type': 'application/octet-stream',
    }
  }

  /**
   * Recognize text from a file using TextIn API
   * @param filePath - Absolute path to the file
   * @returns Concatenated text from all pages
   * @throws Error if HTTP request fails or TextIn API returns non-200 code
   */
  async recognizeFile(filePath: string): Promise<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.recognizeTimeout)

    try {
      // Read file buffer
      const fileBuffer = await fs.readFile(filePath)

      // Build API URL
      const url = `${this.config.baseUrl.replace(/\/$/, '')}/ai/service/v2/recognize/multipage`

      // Call TextIn API with 60s timeout
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: fileBuffer as unknown as BodyInit,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Check HTTP status
      if (!response.ok) {
        throw new Error(`TextIn API returned HTTP ${response.status}`)
      }

      // Parse response
      const payload = (await response.json()) as TextInApiResponse

      // Validate response structure
      if (!payload.result || !Array.isArray(payload.result.pages)) {
        throw new Error('Invalid API response: missing result.pages array')
      }

      // Check API-level code
      if (typeof payload.code !== 'number' || payload.code !== 200) {
        throw new Error(
          `TextIn API error: code=${payload.code ?? 'unknown'}, message=${payload.message ?? 'unknown error'}`
        )
      }

      // Extract and concatenate text from all pages
      const lines = (payload.result?.pages ?? [])
        .flatMap((page) => page.lines ?? [])
        .map((line) => line.text?.trim() ?? '')
        .filter(Boolean)

      return lines.join('\n')
    } catch (error) {
      clearTimeout(timeoutId)

      // Re-throw with better error message for timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `TextIn API request timeout (${this.recognizeTimeout}ms)`
        )
      }

      // Re-throw all other errors as-is
      throw error
    }
  }

  /**
   * Test connection to TextIn API
   * @returns Connection test result with success flag and message
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.testTimeout)

    try {
      // Use a minimal test: send empty buffer
      const url = `${this.config.baseUrl.replace(/\/$/, '')}/ai/service/v2/recognize/multipage`

      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: new Uint8Array(0),
        signal: controller.signal,
      })

      // Even if the API returns an error for empty content,
      // a 4xx response means we successfully connected and authenticated
      if (response.status >= 200 && response.status < 500) {
        return {
          success: true,
          message: 'TextIn API connection successful',
        }
      }

      return {
        success: false,
        message: `TextIn API returned HTTP ${response.status}`,
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            message: 'Connection timeout',
          }
        }
        return {
          success: false,
          message: error.message,
        }
      }
      return {
        success: false,
        message: 'Unknown connection error',
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Determine if an error is recoverable (should retry)
   * Recoverable: timeout, network errors, 5xx server errors
   * Not recoverable: 4xx client errors, authentication failures
   * @param error - The error to check (accepts unknown type for maximum flexibility)
   * @returns true if the error is recoverable and the operation should be retried, false otherwise
   */
  isRecoverableError(error: unknown): error is Error {
    // Timeout errors
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'AbortError'
    ) {
      return true
    }

    // Network errors
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      const message = error.message
      if (
        message.includes('fetch') ||
        message.includes('network') ||
        message.includes('ECONNREFUSED') ||
        message.includes('ETIMEDOUT')
      ) {
        return true
      }

      // HTTP status-based errors
      if (message.includes('HTTP')) {
        const statusMatch = message.match(/HTTP (\d{3})/)
        if (statusMatch) {
          const status = parseInt(statusMatch[1], 10)
          // 5xx = server errors (recoverable)
          // 4xx = client errors (not recoverable)
          return status >= 500 && status < 600
        }
      }

      // API-level errors
      if (message.includes('TextIn API error')) {
        const codeMatch = message.match(/code=(\d+)/)
        if (codeMatch) {
          const code = parseInt(codeMatch[1], 10)
          // Similar logic: 5xx recoverable, 4xx not
          return code >= 500 && code < 600
        }
      }
    }

    // Default: not recoverable
    return false
  }
}
