import type { ChatMessage, DocType } from './types'

/**
 * LLM API configuration
 */
export interface LlmConfig {
  baseUrl: string
  apiKey: string
  model: string
}

/**
 * Connection test result
 */
export interface ConnectionTestResult {
  success: boolean
  message: string
}

/**
 * OpenAI-compatible chat completion response
 */
interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

/**
 * LLM Client for OpenAI-compatible chat completion APIs
 * Handles authentication, message formatting, and response parsing
 */
export class LlmClient {
  private static readonly DEFAULT_TIMEOUT = 120000 // 120s

  private readonly config: LlmConfig
  private readonly timeout: number

  constructor(config: LlmConfig, options?: { timeout?: number }) {
    this.config = config
    this.timeout = options?.timeout ?? LlmClient.DEFAULT_TIMEOUT
  }

  /**
   * Build HTTP headers for LLM API authentication
   */
  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
    }
  }

  /**
   * Call LLM chat completion API
   * @param messages - Chat messages to send
   * @returns Raw response text from the assistant
   * @throws Error if HTTP request fails or API returns error
   */
  async callLlm(messages: ChatMessage[]): Promise<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const url = `${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`

      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: 0,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`LLM API returned HTTP ${response.status}`)
      }

      const payload = (await response.json()) as ChatCompletionResponse

      if (
        !payload.choices ||
        !Array.isArray(payload.choices) ||
        payload.choices.length === 0
      ) {
        throw new Error('Invalid API response: missing choices array')
      }

      const content = payload.choices[0]?.message?.content
      if (typeof content !== 'string') {
        throw new Error('Invalid API response: missing message content')
      }

      return content
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`LLM API request timeout (${this.timeout}ms)`)
      }

      throw error
    }
  }

  /**
   * Extract structured result from LLM response and strip Markdown markers.
   * Order: extract <result> -> remove XML comments -> strip Markdown (rules
   * per spec 自审修订点 2). Preserves list dashes, numbered prefixes,
   * 【】, full-width colons, and inline standalone asterisks.
   * Falls back to full response if <result> tags missing.
   * @param rawResponse - Raw response text from LLM
   * @returns Extracted result text without LLM comments or Markdown markers
   */
  extractResult(rawResponse: string): string {
    const match = rawResponse.match(/<result>([\s\S]*?)<\/result>/)
    let content: string
    if (match && match[1] !== undefined) {
      content = match[1]
    } else {
      content = rawResponse
    }
    // Remove XML-style comments
    content = content.replace(/<!--[\s\S]*?-->/g, '')
    // Strip Markdown markers (order-sensitive)
    content = stripMarkdown(content)
    return content.trim()
  }

  /**
   * Extract thinking process from LLM response
   * Looks for <thoughts>...</thoughts> tags and returns the content inside
   * Returns undefined if tags are missing
   * @param rawResponse - Raw response text from LLM
   * @returns Extracted thoughts text, or undefined if not found
   */
  extractThoughts(rawResponse: string): string | undefined {
    const match = rawResponse.match(/<thoughts>([\s\S]*?)<\/thoughts>/)
    if (match && match[1] !== undefined) {
      return match[1].trim()
    }
    return undefined
  }

  /**
   * Extract document type from LLM response.
   * Looks for <type>...</type> tag and validates against known DocType values.
   * @param rawResponse - Raw response text from LLM
   * @returns Validated DocType, or 'unknown' if tag missing or value invalid
   */
  extractType(rawResponse: string): DocType {
    const match = rawResponse.match(/<type>\s*([a-z]+)\s*<\/type>/)
    if (match && match[1] !== undefined) {
      const value = match[1]
      const valid: DocType[] = ['dialogue', 'kv', 'list', 'prose', 'mixed']
      if (valid.includes(value as DocType)) {
        return value as DocType
      }
    }
    return 'unknown'
  }

  /**
   * Test connection to LLM API
   * Sends a minimal test request to verify authentication and connectivity
   * @returns Connection test result with success flag and message
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // Send minimal test message
      const testMessages: ChatMessage[] = [
        { role: 'user', content: 'test' },
      ]

      await this.callLlm(testMessages)

      return {
        success: true,
        message: 'LLM API connection successful',
      }
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          message: error.message,
        }
      }
      return {
        success: false,
        message: 'Unknown connection error',
      }
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

    // Network and HTTP errors
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      const message = error.message

      // Network errors
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
    }

    // Default: not recoverable
    return false
  }
}

/**
 * Strip Markdown markers from text while preserving plain-text formatting
 * (list dashes, numbered prefixes, 【】, full-width colons, inline
 * standalone asterisks). Order-sensitive. Per spec 自审修订点 2.
 */
function stripMarkdown(text: string): string {
  return text
    // 1. Horizontal rule lines (---/***/___ on their own line, eat trailing newline)
    .replace(/^[ \t]*[-*_]{3,}[ \t]*\n?/gm, '')
    // 2. Heading markers at line start (#..# + space)
    .replace(/^#{1,6}\s+/gm, '')
    // 3. Blockquote markers at line start
    .replace(/^>\s?/gm, '')
    // 4. Bold **xxx** -> xxx
    .replace(/\*\*(.+?)\*\*/g, '$1')
    // 5. Italic *xxx* -> xxx (avoid eating ** already handled above;
    //    require non-space adjacent to * to skip standalone math asterisks)
    .replace(/(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, '$1')
    // 6. Inline code `xxx` -> xxx
    .replace(/`(.+?)`/g, '$1')
    // Collapse 3+ blank lines left by removed rule lines into single blank line
    .replace(/\n{3,}/g, '\n\n')
}
