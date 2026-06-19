/**
 * Result of placeholder detection
 */
export interface PlaceholderCheckResult {
  /** True if no placeholders found */
  clean: boolean
  /** List of unique placeholder matches found */
  hits: string[]
}

/**
 * Detects common placeholder patterns in Chinese OCR structured text
 *
 * Checks for:
 * - Bracket placeholders: [待补充], [待填], [TODO], [xxx]
 * - Ellipsis patterns: [此处...省略], ……, ...
 *
 * @param text - Text to check for placeholders
 * @returns Check result with clean flag and list of found placeholders
 */
export function assertNoPlaceholder(text: string): PlaceholderCheckResult {
  const patterns = [
    // Bracket-based placeholders
    /\[待补充\]/g,
    /\[待填\]/g,
    /\[TODO\]/gi, // case-insensitive
    /\[xxx\]/gi,  // case-insensitive
    /\[此处[^[\]]*省略[^[\]]*\]/g, // [此处...省略] patterns

    // Ellipsis patterns
    /…{2,}/g,      // Chinese ellipsis (2 or more)
    /\.{3,}/g      // Western ellipsis (3 or more dots)
  ]

  const hits = new Set<string>()

  for (const pattern of patterns) {
    const matches = text.match(pattern)
    if (matches) {
      matches.forEach(match => hits.add(match))
    }
  }

  const uniqueHits = Array.from(hits)

  return {
    clean: uniqueHits.length === 0,
    hits: uniqueHits
  }
}
