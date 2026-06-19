import { describe, it, expect } from 'vitest'
import {
  buildStructurePrompt,
  buildSummaryPrompt,
  TYPE_RULES,
  FIDELITY_RULES_FAITHFUL,
  FIDELITY_RULES_ENHANCED,
  FIDELITY_RULES_SUMMARY,
} from '../prompts'

describe('TYPE_RULES shared constant', () => {
  it('should be exported and contain all four type formats', () => {
    expect(TYPE_RULES).toContain('对话体')
    expect(TYPE_RULES).toContain('键值表')
    expect(TYPE_RULES).toContain('清单列表')
    expect(TYPE_RULES).toContain('纯段落散文')
    expect(TYPE_RULES).toContain('【】')
    expect(TYPE_RULES).toContain('dialogue')
    expect(TYPE_RULES).toContain('kv')
    expect(TYPE_RULES).toContain('list')
    expect(TYPE_RULES).toContain('prose')
    expect(TYPE_RULES).toContain('mixed')
  })

  it('should prohibit markdown markers', () => {
    expect(TYPE_RULES).toContain('禁止')
    expect(TYPE_RULES).toMatch(/#|星号|Markdown/)
  })
})

describe('FIDELITY_RULES constants', () => {
  it('should export faithful rules forbidding addition/guess', () => {
    expect(FIDELITY_RULES_FAITHFUL).toContain('R1')
    expect(FIDELITY_RULES_FAITHFUL).toContain('严禁')
    expect(FIDELITY_RULES_FAITHFUL).toContain('占位符')
    expect(FIDELITY_RULES_FAITHFUL).toContain('如实保留')
  })

  it('should export enhanced rules allowing conservative correction', () => {
    expect(FIDELITY_RULES_ENHANCED).toContain('高置信度')
    expect(FIDELITY_RULES_ENHANCED).toContain('保守')
    expect(FIDELITY_RULES_ENHANCED).toContain('占位符')
  })

  it('should export summary rules for 3-5 sentences', () => {
    expect(FIDELITY_RULES_SUMMARY).toContain('3')
    expect(FIDELITY_RULES_SUMMARY).toContain('5')
    expect(FIDELITY_RULES_SUMMARY).toContain('元话语')
  })
})

describe('Prompt Library', () => {
  describe('buildStructurePrompt', () => {
    const rawText = '这是测试文本\n包含多行内容'

    it('should embed TYPE_RULES in both modes', () => {
      const faithful = buildStructurePrompt(rawText, 'faithful')[0].content
      const enhanced = buildStructurePrompt(rawText, 'enhanced')[0].content
      expect(faithful).toContain('<TypeRules>')
      expect(faithful).toContain('对话体')
      expect(enhanced).toContain('<TypeRules>')
      expect(enhanced).toContain('键值表')
    })

    it('should embed faithful FidelityRules in faithful mode', () => {
      const sys = buildStructurePrompt(rawText, 'faithful')[0].content
      expect(sys).toContain('<FidelityRules>')
      expect(sys).toContain('如实保留')
      expect(sys).not.toContain('高置信度')
    })

    it('should embed enhanced FidelityRules in enhanced mode', () => {
      const sys = buildStructurePrompt(rawText, 'enhanced')[0].content
      expect(sys).toContain('高置信度')
      expect(sys).toContain('保守')
    })

    it('should require three-section output: type/thoughts/result', () => {
      const sys = buildStructurePrompt(rawText, 'faithful')[0].content
      expect(sys).toContain('<type>')
      expect(sys).toContain('<thoughts>')
      expect(sys).toContain('<result>')
      expect(sys).toContain('dialogue | kv | list | prose | mixed')
    })

    it('should include Procedure with STEP 1-4', () => {
      const sys = buildStructurePrompt(rawText, 'faithful')[0].content
      expect(sys).toContain('STEP 1')
      expect(sys).toContain('STEP 4')
    })

    it('should include STEP 3.5 only in enhanced mode', () => {
      const faithful = buildStructurePrompt(rawText, 'faithful')[0].content
      const enhanced = buildStructurePrompt(rawText, 'enhanced')[0].content
      expect(faithful).not.toContain('STEP 3.5')
      expect(enhanced).toContain('STEP 3.5')
    })

    it('should inject rawText wrapped with --- in user message', () => {
      const user = buildStructurePrompt(rawText, 'faithful')[1].content
      expect(user).toMatch(/^OCR 原始文本：\n---\n[\s\S]*\n---$/)
      expect(user).toContain(rawText)
    })

    it('should return 2 messages with system then user', () => {
      const messages = buildStructurePrompt(rawText, 'faithful')
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('system')
      expect(messages[1].role).toBe('user')
    })

    it('should differ only in system prompt between modes', () => {
      const f = buildStructurePrompt(rawText, 'faithful')
      const e = buildStructurePrompt(rawText, 'enhanced')
      expect(f[0].content).not.toBe(e[0].content)
      expect(f[1].content).toBe(e[1].content)
    })

    it('should handle empty rawText', () => {
      const messages = buildStructurePrompt('', 'faithful')
      expect(messages).toHaveLength(2)
      expect(messages[1].content).toContain('OCR 原始文本：')
    })
  })

  describe('buildSummaryPrompt', () => {
    const structuredText = '测试文档内容'

    it('should embed TYPE_RULES and summary FidelityRules', () => {
      const sys = buildSummaryPrompt(structuredText)[0].content
      expect(sys).toContain('<TypeRules>')
      expect(sys).toContain('<FidelityRules>')
      expect(sys).toContain('3')
      expect(sys).toContain('5')
    })

    it('should fix type to prose in output format', () => {
      const sys = buildSummaryPrompt(structuredText)[0].content
      expect(sys).toContain('<type>prose</type>')
    })

    it('should inject structuredText wrapped with ---', () => {
      const user = buildSummaryPrompt(structuredText)[1].content
      expect(user).toMatch(/^结构化文档：\n---\n[\s\S]*\n---$/)
      expect(user).toContain(structuredText)
    })

    it('should return 2 messages system then user', () => {
      const messages = buildSummaryPrompt(structuredText)
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('system')
      expect(messages[1].role).toBe('user')
    })

    it('should handle empty structuredText', () => {
      const messages = buildSummaryPrompt('')
      expect(messages).toHaveLength(2)
    })
  })

  describe('Edge Cases and Integration', () => {
    it('should handle very long text input', () => {
      const longText = 'A'.repeat(10000)
      const structureMessages = buildStructurePrompt(longText, 'faithful')
      const summaryMessages = buildSummaryPrompt(longText)

      expect(structureMessages[1].content).toContain(longText)
      expect(summaryMessages[1].content).toContain(longText)
    })

    it('should handle text with multiple newlines', () => {
      const textWithNewlines = '第一行\n\n\n第二行\n\n\n\n第三行'
      const messages = buildStructurePrompt(textWithNewlines, 'faithful')

      expect(messages[1].content).toContain(textWithNewlines)
    })

    it('should maintain message immutability', () => {
      const text = '测试文本'
      const messages1 = buildStructurePrompt(text, 'faithful')
      const messages2 = buildStructurePrompt(text, 'faithful')

      expect(messages1).not.toBe(messages2) // Different array instances
      expect(messages1).toEqual(messages2) // Same content
    })
  })
})
