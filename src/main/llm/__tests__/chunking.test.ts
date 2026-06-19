import { describe, it, expect, vi, beforeEach } from 'vitest'
import { splitIntoChunks, structureText, summarize } from '../chunking'
import type { LlmClient } from '../llm-client'
import type { ProcessMode } from '../../../shared/types'

describe('splitIntoChunks', () => {
  it('should return original text if within threshold', () => {
    const text = 'Short text'
    const result = splitIntoChunks(text, 100)
    expect(result).toEqual([text])
  })

  it('should return original text if exactly at threshold', () => {
    const text = 'a'.repeat(100)
    const result = splitIntoChunks(text, 100)
    expect(result).toEqual([text])
  })

  it('should split by paragraph boundaries when exceeding threshold', () => {
    const text = 'a'.repeat(50) + '\n\n' + 'b'.repeat(50) + '\n\n' + 'c'.repeat(50)
    const result = splitIntoChunks(text, 100)

    // Should split into chunks respecting paragraph boundaries
    expect(result.length).toBeGreaterThan(1)
    // Each chunk should be under threshold (unless single paragraph exceeds)
    result.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(150) // 50 chars + \n\n + 50 chars
    })
  })

  it('should preserve paragraph integrity', () => {
    const para1 = 'First paragraph with some text'
    const para2 = 'Second paragraph with more text'
    const para3 = 'Third paragraph with even more text'
    const text = `${para1}\n\n${para2}\n\n${para3}`

    const result = splitIntoChunks(text, 60)

    // Each chunk should contain complete paragraphs
    result.forEach((chunk) => {
      expect(chunk).not.toMatch(/\n\n.*\n\n/) // No chunk should be cut mid-paragraph
    })
  })

  it('should handle single paragraph exceeding threshold', () => {
    const longParagraph = 'a'.repeat(150)
    const result = splitIntoChunks(longParagraph, 100)

    // Should return the paragraph as-is since it cannot be split
    expect(result).toEqual([longParagraph])
  })

  it('should handle multiple newlines as paragraph separator', () => {
    const text = 'Para 1\n\n\nPara 2\n\n\n\nPara 3'
    const result = splitIntoChunks(text, 20)

    expect(result.length).toBeGreaterThan(1)
  })

  it('should handle empty text', () => {
    const result = splitIntoChunks('', 100)
    expect(result).toEqual([''])
  })

  it('should accumulate paragraphs until threshold', () => {
    const para1 = 'a'.repeat(30)
    const para2 = 'b'.repeat(30)
    const para3 = 'c'.repeat(30)
    const text = `${para1}\n\n${para2}\n\n${para3}`

    const result = splitIntoChunks(text, 65)

    // First chunk should contain para1 + para2 (30 + 2 + 30 = 62)
    // Second chunk should contain para3
    expect(result.length).toBe(2)
    expect(result[0]).toContain(para1)
    expect(result[0]).toContain(para2)
    expect(result[1]).toContain(para3)
  })
})

describe('structureText', () => {
  let mockClient: LlmClient

  beforeEach(() => {
    mockClient = {
      callLlm: vi.fn(),
      extractResult: vi.fn(),
      extractThoughts: vi.fn(),
      extractType: vi.fn(),
    } as unknown as LlmClient
  })

  it('should make single call when text is within threshold', async () => {
    const rawText = 'Short OCR text'
    const mode: ProcessMode = 'faithful'
    const mockResponse = '<thoughts>Analysis</thoughts><result>Structured text</result>'

    vi.mocked(mockClient.callLlm).mockResolvedValue(mockResponse)
    vi.mocked(mockClient.extractResult).mockReturnValue('Structured text')
    vi.mocked(mockClient.extractThoughts).mockReturnValue('Analysis')

    const result = await structureText(rawText, mode, 100, mockClient)

    expect(mockClient.callLlm).toHaveBeenCalledTimes(1)
    expect(result.text).toBe('Structured text')
    expect(result.thoughts).toBe('Analysis')
  })

  it('should make multiple calls and concatenate when exceeding threshold', async () => {
    const rawText = 'a'.repeat(60) + '\n\n' + 'b'.repeat(60)
    const mode: ProcessMode = 'enhanced'

    vi.mocked(mockClient.callLlm)
      .mockResolvedValueOnce('<thoughts>Chunk 1 analysis</thoughts><result>Structured chunk 1</result>')
      .mockResolvedValueOnce('<thoughts>Chunk 2 analysis</thoughts><result>Structured chunk 2</result>')

    vi.mocked(mockClient.extractResult)
      .mockReturnValueOnce('Structured chunk 1')
      .mockReturnValueOnce('Structured chunk 2')

    vi.mocked(mockClient.extractThoughts)
      .mockReturnValueOnce('Chunk 1 analysis')
      .mockReturnValueOnce('Chunk 2 analysis')

    const result = await structureText(rawText, mode, 100, mockClient)

    expect(mockClient.callLlm).toHaveBeenCalledTimes(2)
    expect(result.text).toBe('Structured chunk 1\n\nStructured chunk 2')
    expect(result.thoughts).toBe('Chunk 1 analysis\n\n--- Chunk Boundary ---\n\nChunk 2 analysis')
  })

  it('should handle chunks without thoughts', async () => {
    const rawText = 'a'.repeat(60) + '\n\n' + 'b'.repeat(60)
    const mode: ProcessMode = 'faithful'

    vi.mocked(mockClient.callLlm)
      .mockResolvedValueOnce('<result>Structured chunk 1</result>')
      .mockResolvedValueOnce('<result>Structured chunk 2</result>')

    vi.mocked(mockClient.extractResult)
      .mockReturnValueOnce('Structured chunk 1')
      .mockReturnValueOnce('Structured chunk 2')

    vi.mocked(mockClient.extractThoughts)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined)

    const result = await structureText(rawText, mode, 100, mockClient)

    expect(result.text).toBe('Structured chunk 1\n\nStructured chunk 2')
    expect(result.thoughts).toBeUndefined()
  })

  it('should handle partial thoughts in chunks', async () => {
    const rawText = 'a'.repeat(60) + '\n\n' + 'b'.repeat(60) + '\n\n' + 'c'.repeat(60)
    const mode: ProcessMode = 'faithful'

    vi.mocked(mockClient.callLlm)
      .mockResolvedValueOnce('<thoughts>Chunk 1 thoughts</thoughts><result>Result 1</result>')
      .mockResolvedValueOnce('<result>Result 2</result>')
      .mockResolvedValueOnce('<thoughts>Chunk 3 thoughts</thoughts><result>Result 3</result>')

    vi.mocked(mockClient.extractResult)
      .mockReturnValueOnce('Result 1')
      .mockReturnValueOnce('Result 2')
      .mockReturnValueOnce('Result 3')

    vi.mocked(mockClient.extractThoughts)
      .mockReturnValueOnce('Chunk 1 thoughts')
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('Chunk 3 thoughts')

    const result = await structureText(rawText, mode, 100, mockClient)

    expect(result.thoughts).toBe('Chunk 1 thoughts\n\n--- Chunk Boundary ---\n\nChunk 3 thoughts')
  })

  it('should pass correct mode to prompt builder', async () => {
    const rawText = 'Test text'
    const mode: ProcessMode = 'enhanced'

    vi.mocked(mockClient.callLlm).mockResolvedValue('<result>Structured</result>')
    vi.mocked(mockClient.extractResult).mockReturnValue('Structured')
    vi.mocked(mockClient.extractThoughts).mockReturnValue(undefined)

    await structureText(rawText, mode, 100, mockClient)

    const callArgs = vi.mocked(mockClient.callLlm).mock.calls[0][0]
    // Verify system prompt contains enhanced mode fidelity rules
    expect(callArgs[0].content).toContain('高置信度')
  })

  it('should return type from extractType for single chunk', async () => {
    const rawText = 'Short OCR text'
    const mode: ProcessMode = 'faithful'
    vi.mocked(mockClient.callLlm).mockResolvedValue('<type>kv</type><result>x</result>')
    vi.mocked(mockClient.extractResult).mockReturnValue('x')
    vi.mocked(mockClient.extractThoughts).mockReturnValue(undefined)
    vi.mocked(mockClient.extractType).mockReturnValue('kv')

    const result = await structureText(rawText, mode, 100, mockClient)
    expect(result.type).toBe('kv')
  })

  it('should aggregate same type across chunks to that type', async () => {
    const rawText = 'a'.repeat(60) + '\n\n' + 'b'.repeat(60)
    const mode: ProcessMode = 'faithful'
    vi.mocked(mockClient.callLlm)
      .mockResolvedValueOnce('<type>kv</type><result>1</result>')
      .mockResolvedValueOnce('<type>kv</type><result>2</result>')
    vi.mocked(mockClient.extractResult).mockReturnValueOnce('1').mockReturnValueOnce('2')
    vi.mocked(mockClient.extractThoughts).mockReturnValue(undefined)
    vi.mocked(mockClient.extractType).mockReturnValueOnce('kv').mockReturnValueOnce('kv')

    const result = await structureText(rawText, mode, 100, mockClient)
    expect(result.type).toBe('kv')
  })

  it('should aggregate different types across chunks to mixed', async () => {
    const rawText = 'a'.repeat(60) + '\n\n' + 'b'.repeat(60)
    const mode: ProcessMode = 'faithful'
    vi.mocked(mockClient.callLlm)
      .mockResolvedValueOnce('<type>kv</type><result>1</result>')
      .mockResolvedValueOnce('<type>prose</type><result>2</result>')
    vi.mocked(mockClient.extractResult).mockReturnValueOnce('1').mockReturnValueOnce('2')
    vi.mocked(mockClient.extractThoughts).mockReturnValue(undefined)
    vi.mocked(mockClient.extractType).mockReturnValueOnce('kv').mockReturnValueOnce('prose')

    const result = await structureText(rawText, mode, 100, mockClient)
    expect(result.type).toBe('mixed')
  })

  it('should aggregate to mixed when any chunk type is unknown', async () => {
    const rawText = 'a'.repeat(60) + '\n\n' + 'b'.repeat(60)
    const mode: ProcessMode = 'faithful'
    vi.mocked(mockClient.callLlm)
      .mockResolvedValueOnce('<type>kv</type><result>1</result>')
      .mockResolvedValueOnce('<result>2</result>')
    vi.mocked(mockClient.extractResult).mockReturnValueOnce('1').mockReturnValueOnce('2')
    vi.mocked(mockClient.extractThoughts).mockReturnValue(undefined)
    vi.mocked(mockClient.extractType).mockReturnValueOnce('kv').mockReturnValueOnce('unknown')

    const result = await structureText(rawText, mode, 100, mockClient)
    expect(result.type).toBe('mixed')
  })
})

describe('summarize', () => {
  let mockClient: LlmClient

  beforeEach(() => {
    mockClient = {
      callLlm: vi.fn(),
      extractResult: vi.fn(),
      extractThoughts: vi.fn(),
      extractType: vi.fn(),
    } as unknown as LlmClient
  })

  it('should make single call when text is within threshold', async () => {
    const structuredText = 'Short structured document'
    const mockResponse = '<thoughts>Summary thoughts</thoughts><result>Summary text</result>'

    vi.mocked(mockClient.callLlm).mockResolvedValue(mockResponse)
    vi.mocked(mockClient.extractResult).mockReturnValue('Summary text')
    vi.mocked(mockClient.extractThoughts).mockReturnValue('Summary thoughts')

    const result = await summarize(structuredText, 100, mockClient)

    expect(mockClient.callLlm).toHaveBeenCalledTimes(1)
    expect(result.text).toBe('Summary text')
    expect(result.thoughts).toBe('Summary thoughts')
  })

  it('should use map-reduce when exceeding threshold', async () => {
    const structuredText = 'a'.repeat(60) + '\n\n' + 'b'.repeat(60)

    // Map phase: 2 chunk summaries
    vi.mocked(mockClient.callLlm)
      .mockResolvedValueOnce('<thoughts>Map 1</thoughts><result>Summary 1</result>')
      .mockResolvedValueOnce('<thoughts>Map 2</thoughts><result>Summary 2</result>')
      // Reduce phase: final summary
      .mockResolvedValueOnce('<thoughts>Reduce</thoughts><result>Final summary</result>')

    vi.mocked(mockClient.extractResult)
      .mockReturnValueOnce('Summary 1')
      .mockReturnValueOnce('Summary 2')
      .mockReturnValueOnce('Final summary')

    vi.mocked(mockClient.extractThoughts)
      .mockReturnValueOnce('Map 1')
      .mockReturnValueOnce('Map 2')
      .mockReturnValueOnce('Reduce')

    const result = await summarize(structuredText, 100, mockClient)

    expect(mockClient.callLlm).toHaveBeenCalledTimes(3) // 2 map + 1 reduce
    expect(result.text).toBe('Final summary')
    expect(result.thoughts).toContain('=== Map Phase ===')
    expect(result.thoughts).toContain('Map 1')
    expect(result.thoughts).toContain('Map 2')
    expect(result.thoughts).toContain('=== Reduce Phase ===')
    expect(result.thoughts).toContain('Reduce')
  })

  it('should handle map-reduce without thoughts', async () => {
    const structuredText = 'a'.repeat(60) + '\n\n' + 'b'.repeat(60)

    vi.mocked(mockClient.callLlm)
      .mockResolvedValueOnce('<result>Summary 1</result>')
      .mockResolvedValueOnce('<result>Summary 2</result>')
      .mockResolvedValueOnce('<result>Final summary</result>')

    vi.mocked(mockClient.extractResult)
      .mockReturnValueOnce('Summary 1')
      .mockReturnValueOnce('Summary 2')
      .mockReturnValueOnce('Final summary')

    vi.mocked(mockClient.extractThoughts)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined)

    const result = await summarize(structuredText, 100, mockClient)

    expect(result.text).toBe('Final summary')
    expect(result.thoughts).toBeUndefined()
  })

  it('should handle partial thoughts in map-reduce', async () => {
    const structuredText = 'a'.repeat(60) + '\n\n' + 'b'.repeat(60)

    vi.mocked(mockClient.callLlm)
      .mockResolvedValueOnce('<thoughts>Map 1</thoughts><result>Summary 1</result>')
      .mockResolvedValueOnce('<result>Summary 2</result>')
      .mockResolvedValueOnce('<result>Final summary</result>')

    vi.mocked(mockClient.extractResult)
      .mockReturnValueOnce('Summary 1')
      .mockReturnValueOnce('Summary 2')
      .mockReturnValueOnce('Final summary')

    vi.mocked(mockClient.extractThoughts)
      .mockReturnValueOnce('Map 1')
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined)

    const result = await summarize(structuredText, 100, mockClient)

    expect(result.thoughts).toContain('=== Map Phase ===')
    expect(result.thoughts).toContain('Map 1')
    expect(result.thoughts).not.toContain('=== Reduce Phase ===')
  })

  it('should concatenate chunk summaries correctly in reduce phase', async () => {
    const structuredText = 'a'.repeat(60) + '\n\n' + 'b'.repeat(60)

    vi.mocked(mockClient.callLlm)
      .mockResolvedValueOnce('<result>Summary A</result>')
      .mockResolvedValueOnce('<result>Summary B</result>')
      .mockResolvedValueOnce('<result>Final</result>')

    vi.mocked(mockClient.extractResult)
      .mockReturnValueOnce('Summary A')
      .mockReturnValueOnce('Summary B')
      .mockReturnValueOnce('Final')

    vi.mocked(mockClient.extractThoughts).mockReturnValue(undefined)

    await summarize(structuredText, 100, mockClient)

    // Check that reduce phase received concatenated summaries
    const reduceCallArgs = vi.mocked(mockClient.callLlm).mock.calls[2][0]
    expect(reduceCallArgs[1].content).toContain('Summary A\n\nSummary B')
  })

  it('should handle three chunks in map-reduce', async () => {
    const structuredText = 'a'.repeat(60) + '\n\n' + 'b'.repeat(60) + '\n\n' + 'c'.repeat(60)

    vi.mocked(mockClient.callLlm)
      .mockResolvedValueOnce('<result>S1</result>')
      .mockResolvedValueOnce('<result>S2</result>')
      .mockResolvedValueOnce('<result>S3</result>')
      .mockResolvedValueOnce('<result>Final</result>')

    vi.mocked(mockClient.extractResult)
      .mockReturnValueOnce('S1')
      .mockReturnValueOnce('S2')
      .mockReturnValueOnce('S3')
      .mockReturnValueOnce('Final')

    vi.mocked(mockClient.extractThoughts).mockReturnValue(undefined)

    const result = await summarize(structuredText, 100, mockClient)

    expect(mockClient.callLlm).toHaveBeenCalledTimes(4) // 3 map + 1 reduce
    expect(result.text).toBe('Final')
  })

  it('should always return type prose', async () => {
    const structuredText = 'Short structured document'
    vi.mocked(mockClient.callLlm).mockResolvedValue('<result>summary</result>')
    vi.mocked(mockClient.extractResult).mockReturnValue('summary')
    vi.mocked(mockClient.extractThoughts).mockReturnValue(undefined)

    const result = await summarize(structuredText, 100, mockClient)
    expect(result.type).toBe('prose')
  })

  it('should return type prose even in map-reduce', async () => {
    const structuredText = 'a'.repeat(60) + '\n\n' + 'b'.repeat(60)
    vi.mocked(mockClient.callLlm)
      .mockResolvedValueOnce('<result>S1</result>')
      .mockResolvedValueOnce('<result>S2</result>')
      .mockResolvedValueOnce('<result>Final</result>')
    vi.mocked(mockClient.extractResult).mockReturnValueOnce('S1').mockReturnValueOnce('S2').mockReturnValueOnce('Final')
    vi.mocked(mockClient.extractThoughts).mockReturnValue(undefined)

    const result = await summarize(structuredText, 100, mockClient)
    expect(result.type).toBe('prose')
  })
})
