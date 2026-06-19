import { assertNoPlaceholder } from '../placeholder-guard'

describe('placeholder-guard', () => {
  describe('assertNoPlaceholder', () => {
    it('should return clean=true for normal text without placeholders', () => {
      const result = assertNoPlaceholder('This is a normal text with no placeholders.')
      expect(result).toEqual({
        clean: true,
        hits: []
      })
    })

    it('should detect [待补充] placeholder', () => {
      const result = assertNoPlaceholder('Some text [待补充] more text')
      expect(result).toEqual({
        clean: false,
        hits: ['[待补充]']
      })
    })

    it('should detect [待填] placeholder', () => {
      const result = assertNoPlaceholder('Some text [待填] more text')
      expect(result).toEqual({
        clean: false,
        hits: ['[待填]']
      })
    })

    it('should detect [TODO] placeholder', () => {
      const result = assertNoPlaceholder('Some text [TODO] more text')
      expect(result).toEqual({
        clean: false,
        hits: ['[TODO]']
      })
    })

    it('should detect [xxx] placeholder', () => {
      const result = assertNoPlaceholder('Some text [xxx] more text')
      expect(result).toEqual({
        clean: false,
        hits: ['[xxx]']
      })
    })

    it('should detect [此处...省略] pattern', () => {
      const result = assertNoPlaceholder('Some text [此处省略部分内容] more text')
      expect(result).toEqual({
        clean: false,
        hits: ['[此处省略部分内容]']
      })
    })

    it('should detect ellipsis with Chinese characters (……)', () => {
      const result = assertNoPlaceholder('Some text …… more text')
      expect(result).toEqual({
        clean: false,
        hits: ['……']
      })
    })

    it('should detect three or more dots (...)', () => {
      const result = assertNoPlaceholder('Some text ... more text')
      expect(result).toEqual({
        clean: false,
        hits: ['...']
      })
    })

    it('should detect four or more dots (....)', () => {
      const result = assertNoPlaceholder('Some text .... more text')
      expect(result).toEqual({
        clean: false,
        hits: ['....']
      })
    })

    it('should detect multiple different placeholders', () => {
      const result = assertNoPlaceholder('Text [待补充] more [TODO] and ...')
      expect(result.clean).toBe(false)
      expect(result.hits).toHaveLength(3)
      expect(result.hits).toContain('[待补充]')
      expect(result.hits).toContain('[TODO]')
      expect(result.hits).toContain('...')
    })

    it('should deduplicate same placeholders', () => {
      const result = assertNoPlaceholder('Text [待补充] more [待补充] and [待补充]')
      expect(result).toEqual({
        clean: false,
        hits: ['[待补充]']
      })
    })

    it('should handle empty text', () => {
      const result = assertNoPlaceholder('')
      expect(result).toEqual({
        clean: true,
        hits: []
      })
    })

    it('should handle whitespace-only text', () => {
      const result = assertNoPlaceholder('   \n\t  ')
      expect(result).toEqual({
        clean: true,
        hits: []
      })
    })

    it('should be case-insensitive for TODO', () => {
      const result1 = assertNoPlaceholder('[todo]')
      const result2 = assertNoPlaceholder('[Todo]')
      const result3 = assertNoPlaceholder('[tOdO]')

      expect(result1.clean).toBe(false)
      expect(result2.clean).toBe(false)
      expect(result3.clean).toBe(false)
    })

    it('should not match two dots (..)', () => {
      const result = assertNoPlaceholder('Some text.. more text')
      expect(result).toEqual({
        clean: true,
        hits: []
      })
    })

    it('should not match single Chinese ellipsis (…)', () => {
      const result = assertNoPlaceholder('Some text… more text')
      expect(result).toEqual({
        clean: true,
        hits: []
      })
    })

    it('should match legitimate bracket content as non-placeholder', () => {
      const result = assertNoPlaceholder('[注意]这是重要内容 [说明]这是解释')
      expect(result).toEqual({
        clean: true,
        hits: []
      })
    })

    it('should detect complex mixed placeholders', () => {
      const text = `
        第一段文字 [待补充] 继续
        第二段 [TODO] 内容
        第三段 [此处省略详细说明] 继续
        第四段 …… 结束
        第五段 .... 完毕
      `
      const result = assertNoPlaceholder(text)
      expect(result.clean).toBe(false)
      expect(result.hits.length).toBeGreaterThan(0)
      expect(result.hits).toContain('[待补充]')
      expect(result.hits).toContain('[TODO]')
    })
  })
})
