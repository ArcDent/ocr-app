import { describe, it, expect } from 'vitest'
import type { DocType } from '../types'

describe('DocType', () => {
  it('should accept all valid doc type values', () => {
    const valid: DocType[] = ['dialogue', 'kv', 'list', 'prose', 'mixed', 'unknown']
    expect(valid).toHaveLength(6)
  })
})
