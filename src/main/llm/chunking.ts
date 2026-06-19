import type { ProcessMode } from '../../shared/types'
import type { LlmClient } from './llm-client'
import { buildStructurePrompt, buildSummaryPrompt } from './prompts'

/**
 * Split text into chunks by paragraph boundaries
 * @param text - The text to split
 * @param threshold - Maximum characters per chunk
 * @returns Array of text chunks, each <= threshold (unless a single paragraph exceeds threshold)
 *
 * @remarks
 * - If text is within threshold, returns [text] without splitting
 * - Splits by paragraph boundaries (\n\n) to preserve semantic units
 * - Each chunk respects threshold unless a single paragraph is too large
 * - Preserves paragraph integrity (no mid-paragraph cuts)
 */
export function splitIntoChunks(text: string, threshold: number): string[] {
  // No need to split if within threshold
  if (text.length <= threshold) {
    return [text]
  }

  const paragraphs = text.split(/\n\n+/)
  const chunks: string[] = []
  let currentChunk = ''

  for (const paragraph of paragraphs) {
    // If adding this paragraph exceeds threshold, finalize current chunk
    if (currentChunk && currentChunk.length + paragraph.length + 2 > threshold) {
      chunks.push(currentChunk)
      currentChunk = paragraph
    } else {
      // Add paragraph to current chunk
      if (currentChunk) {
        currentChunk += '\n\n' + paragraph
      } else {
        currentChunk = paragraph
      }
    }
  }

  // Add remaining chunk
  if (currentChunk) {
    chunks.push(currentChunk)
  }

  return chunks.length > 0 ? chunks : [text]
}

/**
 * Structure OCR text with automatic chunking if needed
 * @param rawText - Raw OCR text to structure
 * @param mode - Processing mode: 'faithful' (strict) or 'enhanced' (with OCR error correction)
 * @param threshold - Character threshold for chunking
 * @param llmClient - LLM client for API calls
 * @returns Structured text with optional thoughts
 *
 * @remarks
 * - If text <= threshold, makes single LLM call
 * - If text > threshold, splits into chunks and processes each separately
 * - Concatenates thoughts from all chunks with separator
 * - Final text is direct concatenation of all chunk results
 */
export async function structureText(
  rawText: string,
  mode: ProcessMode,
  threshold: number,
  llmClient: LlmClient
): Promise<{ text: string; thoughts?: string }> {
  const chunks = splitIntoChunks(rawText, threshold)

  // Single chunk case - direct call
  if (chunks.length === 1) {
    const messages = buildStructurePrompt(chunks[0], mode)
    const response = await llmClient.callLlm(messages)
    const text = llmClient.extractResult(response)
    const thoughts = llmClient.extractThoughts(response)
    return { text, thoughts }
  }

  // Multiple chunks case - process each and concatenate
  const results: Array<{ text: string; thoughts?: string }> = []

  for (const chunk of chunks) {
    const messages = buildStructurePrompt(chunk, mode)
    const response = await llmClient.callLlm(messages)
    const text = llmClient.extractResult(response)
    const thoughts = llmClient.extractThoughts(response)
    results.push({ text, thoughts })
  }

  // Concatenate all results
  const finalText = results.map((r) => r.text).join('\n\n')
  const allThoughts = results
    .map((r) => r.thoughts)
    .filter((t): t is string => t !== undefined)

  const finalThoughts =
    allThoughts.length > 0
      ? allThoughts.join('\n\n--- Chunk Boundary ---\n\n')
      : undefined

  return { text: finalText, thoughts: finalThoughts }
}

/**
 * Summarize structured text with map-reduce if needed
 * @param structuredText - Structured document text to summarize
 * @param threshold - Character threshold for chunking
 * @param llmClient - LLM client for API calls
 * @returns Summary with optional thoughts
 *
 * @remarks
 * - If text <= threshold, makes single summary call
 * - If text > threshold, uses map-reduce:
 *   1. Map: Split into chunks and summarize each
 *   2. Reduce: Concatenate chunk summaries and summarize the result
 * - Preserves thoughts from both map and reduce phases
 */
export async function summarize(
  structuredText: string,
  threshold: number,
  llmClient: LlmClient
): Promise<{ text: string; thoughts?: string }> {
  const chunks = splitIntoChunks(structuredText, threshold)

  // Single chunk case - direct summary
  if (chunks.length === 1) {
    const messages = buildSummaryPrompt(chunks[0])
    const response = await llmClient.callLlm(messages)
    const text = llmClient.extractResult(response)
    const thoughts = llmClient.extractThoughts(response)
    return { text, thoughts }
  }

  // Map phase: Summarize each chunk
  const chunkSummaries: Array<{ text: string; thoughts?: string }> = []

  for (const chunk of chunks) {
    const messages = buildSummaryPrompt(chunk)
    const response = await llmClient.callLlm(messages)
    const text = llmClient.extractResult(response)
    const thoughts = llmClient.extractThoughts(response)
    chunkSummaries.push({ text, thoughts })
  }

  // Reduce phase: Summarize the chunk summaries
  const concatenatedSummaries = chunkSummaries.map((s) => s.text).join('\n\n')
  const reduceMessages = buildSummaryPrompt(concatenatedSummaries)
  const reduceResponse = await llmClient.callLlm(reduceMessages)
  const finalText = llmClient.extractResult(reduceResponse)
  const reduceThoughts = llmClient.extractThoughts(reduceResponse)

  // Combine thoughts from map and reduce phases
  const mapThoughts = chunkSummaries
    .map((s) => s.thoughts)
    .filter((t): t is string => t !== undefined)

  const allThoughts: string[] = []
  if (mapThoughts.length > 0) {
    allThoughts.push(
      '=== Map Phase ===\n' + mapThoughts.join('\n\n--- Chunk ---\n\n')
    )
  }
  if (reduceThoughts) {
    allThoughts.push('=== Reduce Phase ===\n' + reduceThoughts)
  }

  const finalThoughts = allThoughts.length > 0 ? allThoughts.join('\n\n') : undefined

  return { text: finalText, thoughts: finalThoughts }
}
