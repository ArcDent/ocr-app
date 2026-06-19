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

    it('should use faithful template in faithful mode', () => {
      const messages = buildStructurePrompt(rawText, 'faithful')
      const systemPrompt = messages[0].content

      expect(systemPrompt).toContain('文档结构化排版引擎')
      expect(systemPrompt).toContain(
        'R1. 只能使用 OCR 原文已存在的文字，严禁新增/推测/补全原文没有的内容'
      )
      expect(systemPrompt).toContain('R2. 严禁任何占位符')
      expect(systemPrompt).toContain('R3. OCR 明显残缺处按原文如实保留')
      expect(systemPrompt).toContain('R4. 你的操作仅限：判定标题层级')
      expect(systemPrompt).not.toContain('增强模式')
    })

    it('should use enhanced template in enhanced mode', () => {
      const messages = buildStructurePrompt(rawText, 'enhanced')
      const systemPrompt = messages[0].content

      expect(systemPrompt).toContain('文档结构化排版引擎（增强模式）')
      expect(systemPrompt).toContain(
        'R1. 以 OCR 原文为准，可在高置信度时修正明显识别错误'
      )
      expect(systemPrompt).toContain('STEP 3.5 列出打算修正的点及依据')
      expect(systemPrompt).toContain('R2. 严禁任何占位符')
      expect(systemPrompt).toContain('R3. 修正应保守')
    })

    it('should inject rawText correctly in user message', () => {
      const messages = buildStructurePrompt(rawText, 'faithful')
      const userMessage = messages[1].content

      expect(userMessage).toContain('OCR 原始文本：')
      expect(userMessage).toContain(rawText)
      expect(userMessage).toMatch(/^OCR 原始文本：\n---\n[\s\S]*\n---$/)
    })

    it('should return correct message structure with 2 messages', () => {
      const messages = buildStructurePrompt(rawText, 'faithful')

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('system')
      expect(messages[1].role).toBe('user')
      expect(messages[0].content).toBeTruthy()
      expect(messages[1].content).toBeTruthy()
    })

    it('should include output format instructions in system prompt', () => {
      const faithfulMessages = buildStructurePrompt(rawText, 'faithful')
      const enhancedMessages = buildStructurePrompt(rawText, 'enhanced')

      const faithfulSystem = faithfulMessages[0].content
      const enhancedSystem = enhancedMessages[0].content

      // Both modes should have the same output format
      expect(faithfulSystem).toContain('<thoughts>')
      expect(faithfulSystem).toContain('<result>')
      expect(faithfulSystem).toContain('输出格式')

      expect(enhancedSystem).toContain('<thoughts>')
      expect(enhancedSystem).toContain('<result>')
      expect(enhancedSystem).toContain('输出格式')
    })

    it('should handle empty rawText', () => {
      const messages = buildStructurePrompt('', 'faithful')
      const userMessage = messages[1].content

      expect(userMessage).toContain('OCR 原始文本：')
      expect(messages).toHaveLength(2)
    })

    it('should handle rawText with special characters', () => {
      const specialText = '特殊字符：<>&"\'、【】《》'
      const messages = buildStructurePrompt(specialText, 'faithful')
      const userMessage = messages[1].content

      expect(userMessage).toContain(specialText)
    })

    it('should switch templates based on mode parameter', () => {
      const faithfulMessages = buildStructurePrompt(rawText, 'faithful')
      const enhancedMessages = buildStructurePrompt(rawText, 'enhanced')

      expect(faithfulMessages[0].content).not.toBe(
        enhancedMessages[0].content
      )
      expect(faithfulMessages[1].content).toBe(enhancedMessages[1].content) // User message should be the same
    })

    it('should include all required procedure steps in faithful mode', () => {
      const messages = buildStructurePrompt(rawText, 'faithful')
      const systemPrompt = messages[0].content

      expect(systemPrompt).toContain('STEP 1')
      expect(systemPrompt).toContain('STEP 2')
      expect(systemPrompt).toContain('STEP 3')
      expect(systemPrompt).toContain('STEP 4')
      expect(systemPrompt).not.toContain('STEP 3.5') // Faithful mode has no STEP 3.5
    })

    it('should include all required procedure steps in enhanced mode', () => {
      const messages = buildStructurePrompt(rawText, 'enhanced')
      const systemPrompt = messages[0].content

      expect(systemPrompt).toContain('STEP 1')
      expect(systemPrompt).toContain('STEP 2')
      expect(systemPrompt).toContain('STEP 3')
      expect(systemPrompt).toContain('STEP 3.5') // Enhanced mode has STEP 3.5
      expect(systemPrompt).toContain('STEP 4')
    })
  })

  describe('buildSummaryPrompt', () => {
    const structuredText = '# 测试文档\n\n这是一个测试文档的内容。'

    it('should use summary system prompt', () => {
      const messages = buildSummaryPrompt(structuredText)
      const systemPrompt = messages[0].content

      expect(systemPrompt).toContain('文档摘要助手')
      expect(systemPrompt).toContain('基于结构化文档输出忠实、简洁的中文摘要')
    })

    it('should inject structuredText correctly in user message', () => {
      const messages = buildSummaryPrompt(structuredText)
      const userMessage = messages[1].content

      expect(userMessage).toContain('结构化文档：')
      expect(userMessage).toContain(structuredText)
      expect(userMessage).toMatch(/^结构化文档：\n---\n[\s\S]*\n---$/)
    })

    it('should include summary rules (3-5 sentences)', () => {
      const messages = buildSummaryPrompt(structuredText)
      const systemPrompt = messages[0].content

      expect(systemPrompt).toContain('R1. 只概括文档实际存在的信息')
      expect(systemPrompt).toContain('R2. 3–5 句')
      expect(systemPrompt).toContain('突出主题、关键要点、结论')
      expect(systemPrompt).toContain('R3. 严禁占位符')
    })

    it('should return correct message structure with 2 messages', () => {
      const messages = buildSummaryPrompt(structuredText)

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('system')
      expect(messages[1].role).toBe('user')
      expect(messages[0].content).toBeTruthy()
      expect(messages[1].content).toBeTruthy()
    })

    it('should include output format instructions', () => {
      const messages = buildSummaryPrompt(structuredText)
      const systemPrompt = messages[0].content

      expect(systemPrompt).toContain('<thoughts>')
      expect(systemPrompt).toContain('<result>')
      expect(systemPrompt).toContain('输出格式')
    })

    it('should include all required procedure steps', () => {
      const messages = buildSummaryPrompt(structuredText)
      const systemPrompt = messages[0].content

      expect(systemPrompt).toContain('STEP 1')
      expect(systemPrompt).toContain('STEP 2')
      expect(systemPrompt).toContain('STEP 3')
    })

    it('should handle empty structuredText', () => {
      const messages = buildSummaryPrompt('')
      const userMessage = messages[1].content

      expect(userMessage).toContain('结构化文档：')
      expect(messages).toHaveLength(2)
    })

    it('should handle structuredText with markdown formatting', () => {
      const markdownText = `# 标题\n\n## 副标题\n\n- 列表项 1\n- 列表项 2\n\n**粗体** *斜体*`
      const messages = buildSummaryPrompt(markdownText)
      const userMessage = messages[1].content

      expect(userMessage).toContain(markdownText)
    })

    it('should prohibit placeholders and meta-commentary', () => {
      const messages = buildSummaryPrompt(structuredText)
      const systemPrompt = messages[0].content

      expect(systemPrompt).toContain('严禁占位符')
      expect(systemPrompt).toContain('元话语')
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
