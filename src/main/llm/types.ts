export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Document type detected by LLM for structured output formatting.
 * - dialogue: chat/interview/customer service transcripts
 * - kv: invoices/reports/IDs/meter readings (key-value)
 * - list: todos/enumerations/steps
 * - prose: articles/notes/report body (paragraphs)
 * - mixed: multiple content types in one document (block layout with 【】)
 * - unknown: <type> tag missing or value invalid
 */
export type DocType = 'dialogue' | 'kv' | 'list' | 'prose' | 'mixed' | 'unknown'
