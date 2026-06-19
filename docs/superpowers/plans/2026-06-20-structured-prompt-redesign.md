# 结构化提示词重设计 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 LLM 结构化输出从 Markdown 改为按文档类型分支的简洁纯文本（对话体/键值表/清单/散文 + mixed 混排），并让 orchestrator 生产路径真正接入提示词库，使重设计对用户可见。

**Architecture:** 方案 A——单一大提示词内嵌四类格式规约（TYPE_RULES 共享常量）+ 各模式 FidelityRules + `<type><thoughts><result>` 三段输出。`LlmClient` 新增 `extractType`，`extractResult` 增加 Markdown 清洗兜底。`orchestrator` 删除内联裸消息，改调 `chunking.ts` 的 `structureText`/`summarize`，让提示词进入生产路径。TDD：每步先写失败测试再实现。

**Tech Stack:** TypeScript 5.9、Vitest、electron-vite、Electron 28。测试用 vitest mock，主进程 CJS（禁纯 ESM 依赖，见 CLAUDE.md 坑点 8）。

**Spec:** [docs/superpowers/specs/2026-06-20-structured-prompt-redesign.md](../specs/2026-06-20-structured-prompt-redesign.md)

**项目约定（CLAUDE.md 摘录，执行时遵守）：**
- 任何文件修改前在计划内已列出，subagent 执行时按计划走；commit message 用英文 `<type>: <desc>`
- 主进程禁止引入纯 ESM 包（如 uuid v14），UUID 用 `crypto.randomUUID()`
- 构建配置改动须在 Windows 端实际跑 `npx electron-builder --win` 验证；本计划不改构建配置，但末尾需 Windows 端打包
- 修改 Tailwind/PostCSS 不涉及；`out/` 是 electron-vite 产物，`dist/` 是 electron-builder 产物

---

## File Structure

| 文件 | 职责 | 动作 |
|------|------|------|
| `src/main/llm/types.ts` | 新增 `DocType` 类型 | Modify |
| `src/main/llm/prompts.ts` | 重写三个 system prompt；新增 `TYPE_RULES` + 三个 `FIDELITY_RULES_*` 共享常量 | Modify |
| `src/main/llm/llm-client.ts` | 新增 `extractType`；`extractResult` 加 Markdown 清洗 | Modify |
| `src/main/llm/chunking.ts` | `structureText` 返回 `type`（聚合）；`summarize` 返回 `type: 'prose'` | Modify |
| `src/main/pipeline/orchestrator.ts` | 删除内联裸消息，改调 `structureText`/`summarize` | Modify |
| `src/main/llm/__tests__/prompts.test.ts` | 断言新结构 | Modify |
| `src/main/llm/__tests__/llm-client.test.ts` | 加 `extractType` + 清洗测试 | Modify |
| `src/main/llm/__tests__/chunking.test.ts` | mock 加 `extractType`；type 聚合断言 | Modify |
| `src/main/pipeline/__tests__/orchestrator.test.ts` | 改 mock `structureText`/`summarize` | Modify |

`src/shared/types.ts`、`src/renderer/**`、构建配置：**不动**。type 不持久化、不展示。

---

## Task 1: 新增 DocType 类型

**Files:**
- Modify: `src/main/llm/types.ts`

- [ ] **Step 1: 写失败测试**

新建 `src/main/llm/__tests__/types.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import type { DocType } from '../types'

describe('DocType', () => {
  it('should accept all valid doc type values', () => {
    const valid: DocType[] = ['dialogue', 'kv', 'list', 'prose', 'mixed', 'unknown']
    expect(valid).toHaveLength(6)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/main/llm/__tests__/types.test.ts`
Expected: FAIL — `DocType` 未导出，TS 编译报错或导入失败

- [ ] **Step 3: 实现**

在 `src/main/llm/types.ts` 末尾追加（保留现有 `ChatMessage` 接口不动）：

```typescript
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run src/main/llm/__tests__/types.test.ts`
Expected: PASS

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/main/llm/types.ts src/main/llm/__tests__/types.test.ts
git commit -m "feat: add DocType type for structured output classification"
```

---

## Task 2: 重写 prompts.ts — TYPE_RULES 共享常量

**Files:**
- Modify: `src/main/llm/prompts.ts`

- [ ] **Step 1: 写失败测试**

在 `src/main/llm/__tests__/prompts.test.ts` 顶部新增一个 describe 块（暂不放进现有 describe，避免冲突）：

```typescript
describe('TYPE_RULES shared constant', () => {
  it('should be exported and contain all four type formats', () => {
    const { TYPE_RULES } = require('../prompts')
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
    const { TYPE_RULES } = require('../prompts')
    expect(TYPE_RULES).toContain('禁止')
    expect(TYPE_RULES).toMatch(/#|星号|Markdown/)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/main/llm/__tests__/prompts.test.ts`
Expected: FAIL — `TYPE_RULES` 未导出

- [ ] **Step 3: 实现 TYPE_RULES**

在 `src/main/llm/prompts.ts` 顶部（import 之后）新增导出常量。这是四类格式规约的**唯一来源**，三个 prompt 复用：

```typescript
/**
 * Shared type-classification and formatting rules.
 * Embedded in all three system prompts (faithful/enhanced/summary).
 * The LLM uses this to classify the document and format output as plain text.
 */
export const TYPE_RULES = `
<TypeRules>
按文档类型把 OCR 原文重组为简洁纯文本，绝不输出任何 Markdown 标记。

四类格式：

1. 对话体（dialogue）— 聊天/访谈/客服/对话记录
   每行一条发言，格式：说话人：内容
   说话人用原文标识（A/B/我/对方/客服 等均可），不统一改写
   同一人连续发言合并为一行，不保留原文多余换行

2. 键值表（kv）— 发票/报告/证件/仪表读数/数据盘点
   每行一个字段，格式：字段名：值
   字段名用原文词，值保留原文数字与单位
   嵌套字段平铺为一行，用逗号或空格分隔子项，不再嵌套冒号

3. 清单列表（list）— 待办/列举项/步骤
   每行一项，- 开头（半角连字符 + 空格）
   原文无顺序用 - ；原文明确是步骤序号时保留 1. 2. 3. 形式

4. 纯段落散文（prose）— 文章/笔记/报告正文
   段落直接换行，段落间空一行
   不加标题、不加粗体、不加任何符号
   保留原文段落语义边界，仅清理 OCR 噪声换行

混排（mixed）— 一篇文档含多种内容时，用【】包裹的纯文本标题行分隔区块，标题行前后各空一行：
【数据盘点】

探索广度：1337 首
相遇次数：75 次

【年度歌曲】

今年最触动心弦的旋律是《Put Me Back Together》。

硬约束（所有类型通用）：
- 禁止一切 Markdown 标记：# ## ### * ** --- > 等一律不得出现
- 禁止占位符：[待补充] [xxx] TODO …… 等一律禁止
- 冒号统一全角：；清单连字符用半角 -
- 数字、单位、专有名词保留原文
</TypeRules>
`.trim()
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run src/main/llm/__tests__/prompts.test.ts`
Expected: 新增的 `TYPE_RULES shared constant` 两个用例 PASS（现有用例可能因后续 task 重写而失败，本 task 只关注新增用例）

- [ ] **Step 5: 提交**

```bash
git add src/main/llm/prompts.ts src/main/llm/__tests__/prompts.test.ts
git commit -m "feat: add TYPE_RULES shared constant for plain-text formatting"
```

---

## Task 3: 重写 prompts.ts — 三个 FIDELITY_RULES 常量

**Files:**
- Modify: `src/main/llm/prompts.ts`

- [ ] **Step 1: 写失败测试**

在 `src/main/llm/__tests__/prompts.test.ts` 新增 describe：

```typescript
describe('FIDELITY_RULES constants', () => {
  it('should export faithful rules forbidding addition/guess', () => {
    const { FIDELITY_RULES_FAITHFUL } = require('../prompts')
    expect(FIDELITY_RULES_FAITHFUL).toContain('R1')
    expect(FIDELITY_RULES_FAITHFUL).toContain('严禁')
    expect(FIDELITY_RULES_FAITHFUL).toContain('占位符')
    expect(FIDELITY_RULES_FAITHFUL).toContain('如实保留')
  })

  it('should export enhanced rules allowing conservative correction', () => {
    const { FIDELITY_RULES_ENHANCED } = require('../prompts')
    expect(FIDELITY_RULES_ENHANCED).toContain('高置信度')
    expect(FIDELITY_RULES_ENHANCED).toContain('保守')
    expect(FIDELITY_RULES_ENHANCED).toContain('占位符')
  })

  it('should export summary rules for 3-5 sentences', () => {
    const { FIDELITY_RULES_SUMMARY } = require('../prompts')
    expect(FIDELITY_RULES_SUMMARY).toContain('3')
    expect(FIDELITY_RULES_SUMMARY).toContain('5')
    expect(FIDELITY_RULES_SUMMARY).toContain('元话语')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/main/llm/__tests__/prompts.test.ts`
Expected: FAIL — 三个 FIDELITY_RULES 未导出

- [ ] **Step 3: 实现三个 FidelityRules**

在 `src/main/llm/prompts.ts`（TYPE_RULES 之后）新增：

```typescript
export const FIDELITY_RULES_FAITHFUL = `
<FidelityRules>
R1. 只能使用 OCR 原文已存在的文字，严禁新增/推测/补全原文没有的内容。
R2. 严禁任何占位符：[待补充]、[xxx]、TODO、（此处省略）、......、…… 等一律禁止。
R3. OCR 明显残缺处按原文如实保留，不编造填充。
R4. 操作仅限：按 TypeRules 排版、合并被错误断开的段落、清除噪声换行。
</FidelityRules>
`.trim()

export const FIDELITY_RULES_ENHANCED = `
<FidelityRules>
R1. 以 OCR 原文为准，可在高置信度时修正明显识别错误（形近字、错误断词），补全被截断常见词句，但不改语义、不增事实。
R2. 严禁任何占位符：[待补充]、[xxx]、TODO、（此处省略）、......、…… 等一律禁止。
R3. 修正应保守，拿不准就保留原文；仍严禁任何占位符。
R4. 操作包括：按 TypeRules 排版、合并被错误断开的段落、清除噪声换行、修正明显 OCR 错误。
</FidelityRules>
`.trim()

export const FIDELITY_RULES_SUMMARY = `
<FidelityRules>
R1. 只概括文档实际存在的信息，不引入外部知识或推测。
R2. 3–5 句，突出主题、关键要点、结论。
R3. 严禁占位符与本摘要由 AI 生成之类元话语。
R4. 摘要固定为纯段落散文，输出类型固定 prose。
</FidelityRules>
`.trim()
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run src/main/llm/__tests__/prompts.test.ts`
Expected: 三个新用例 PASS

- [ ] **Step 5: 提交**

```bash
git add src/main/llm/prompts.ts src/main/llm/__tests__/prompts.test.ts
git commit -m "feat: add FIDELITY_RULES constants for faithful/enhanced/summary"
```

---

## Task 4: 重写 prompts.ts — 三个 system prompt 组装 + buildStructurePrompt/buildSummaryPrompt

**Files:**
- Modify: `src/main/llm/prompts.ts`（替换旧的 `FAITHFUL_STRUCTURE_SYSTEM_PROMPT` / `ENHANCED_STRUCTURE_SYSTEM_PROMPT` / `SUMMARY_SYSTEM_PROMPT` 及两个 build 函数）

- [ ] **Step 1: 重写测试（替换现有 buildStructurePrompt/buildSummaryPrompt 的 describe 块）**

把 `src/main/llm/__tests__/prompts.test.ts` 中现有的 `describe('buildStructurePrompt', ...)` 和 `describe('buildSummaryPrompt', ...)` 整块替换为下面的新断言（Edge Cases 块保留）：

```typescript
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/main/llm/__tests__/prompts.test.ts`
Expected: FAIL — 旧 prompt 不含 `<TypeRules>`/`<type>` 等

- [ ] **Step 3: 重写 prompts.ts 的三个 system prompt 和 build 函数**

**删除**旧的 `FAITHFUL_STRUCTURE_SYSTEM_PROMPT`、`ENHANCED_STRUCTURE_SYSTEM_PROMPT`、`SUMMARY_SYSTEM_PROMPT` 三个常量及其 JSDoc 注释块。替换为下面的组装逻辑和 build 函数（TYPE_RULES / FIDELITY_RULES_* 已在 Task 2/3 定义，保留）：

```typescript
const STRUCTURE_PROCEDURE = `
<Procedure>
STEP 1 通读原文，判定主类型（dialogue / kv / list / prose / mixed）。
STEP 2 若 mixed，规划区块划分与各区块类型，用【】标题行分隔。
STEP 3 定位残缺片段（截断、乱码），如实保留，不得用占位符。
STEP 4 依 TypeRules + FidelityRules 组装最终纯文本。
</Procedure>
`.trim()

const ENHANCED_STRUCTURE_PROCEDURE = `
<Procedure>
STEP 1 通读原文，判定主类型（dialogue / kv / list / prose / mixed）。
STEP 2 若 mixed，规划区块划分与各区块类型，用【】标题行分隔。
STEP 3 定位残缺片段或明显识别错误（形近字混淆、错误断词）。
STEP 3.5 列出打算修正的点及依据（仅修正高置信度错误，拿不准则保留）。
STEP 4 依 TypeRules + FidelityRules 组装最终纯文本。
</Procedure>
`.trim()

const SUMMARY_PROCEDURE = `
<Procedure>
STEP 1 提取文档主题与 2–4 个关键要点。
STEP 2 判断是否有明确结论。
STEP 3 用 3–5 句组织成连贯摘要（纯段落散文）。
</Procedure>
`.trim()

const ROLE_LINE = '你是文档结构化排版引擎。把 OCR 原始文本重组为简洁纯文本，按文档类型走对应格式，绝不输出任何 Markdown 标记。'

const STRUCTURE_OUTPUT_FORMAT = `
输出格式（必须严格包含三段，按顺序）：
<type>dialogue | kv | list | prose | mixed</type>
<thoughts>按 STEP 1–4 依次写出你的分析</thoughts>
<result>最终纯文本正文，无任何解释、前言、后记，无任何 Markdown 标记</result>
`.trim()

const SUMMARY_OUTPUT_FORMAT = `
输出格式（必须严格包含三段，按顺序）：
<type>prose</type>
<thoughts>STEP 1–3 的分析</thoughts>
<result>摘要正文，纯段落散文，无任何 Markdown 标记</result>
`.trim()

function assembleStructurePrompt(mode: 'faithful' | 'enhanced'): string {
  const fidelity = mode === 'faithful' ? FIDELITY_RULES_FAITHFUL : FIDELITY_RULES_ENHANCED
  const procedure = mode === 'faithful' ? STRUCTURE_PROCEDURE : ENHANCED_STRUCTURE_PROCEDURE
  return [ROLE_LINE, TYPE_RULES, fidelity, procedure, STRUCTURE_OUTPUT_FORMAT].join('\n\n')
}

const SUMMARY_SYSTEM_PROMPT = [ROLE_LINE, TYPE_RULES, FIDELITY_RULES_SUMMARY, SUMMARY_PROCEDURE, SUMMARY_OUTPUT_FORMAT].join('\n\n')

/**
 * Build structure prompt messages for OCR text structuring.
 * Output format: <type><thoughts><result>, plain text per TYPE_RULES.
 */
export function buildStructurePrompt(
  rawText: string,
  mode: ProcessMode
): ChatMessage[] {
  return [
    { role: 'system', content: assembleStructurePrompt(mode) },
    {
      role: 'user',
      content: `OCR 原始文本：\n---\n${rawText}\n---`,
    },
  ]
}

/**
 * Build summary prompt messages. Type fixed to prose.
 */
export function buildSummaryPrompt(structuredText: string): ChatMessage[] {
  return [
    { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `结构化文档：\n---\n${structuredText}\n---`,
    },
  ]
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run src/main/llm/__tests__/prompts.test.ts`
Expected: 所有 buildStructurePrompt/buildSummaryPrompt/TYPE_RULES/FIDELITY_RULES 用例 PASS

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/main/llm/prompts.ts src/main/llm/__tests__/prompts.test.ts
git commit -m "feat: rewrite structure/summary prompts for plain-text typed output"
```

---

## Task 5: LlmClient — 新增 extractType

**Files:**
- Modify: `src/main/llm/llm-client.ts`
- Modify: `src/main/llm/__tests__/llm-client.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/main/llm/__tests__/llm-client.test.ts` 新增 describe（放在 `extractThoughts` describe 之后）：

```typescript
describe('extractType', () => {
  it('should extract dialogue type', () => {
    expect(client.extractType('<type>dialogue</type>')).toBe('dialogue')
  })
  it('should extract kv type', () => {
    expect(client.extractType('<type>kv</type>')).toBe('kv')
  })
  it('should extract list type', () => {
    expect(client.extractType('<type>list</type>')).toBe('list')
  })
  it('should extract prose type', () => {
    expect(client.extractType('<type>prose</type>')).toBe('prose')
  })
  it('should extract mixed type', () => {
    expect(client.extractType('<type>mixed</type>')).toBe('mixed')
  })
  it('should extract type from response with other tags', () => {
    const resp = '<thoughts>分析</thoughts><type>kv</type><result>发票：1</result>'
    expect(client.extractType(resp)).toBe('kv')
  })
  it('should trim whitespace around type value', () => {
    expect(client.extractType('<type>  kv  </type>')).toBe('kv')
  })
  it('should return unknown when type tag missing', () => {
    expect(client.extractType('<thoughts>x</thoughts><result>y</result>')).toBe('unknown')
  })
  it('should return unknown when type value invalid', () => {
    expect(client.extractType('<type>table</type>')).toBe('unknown')
  })
  it('should return unknown for empty type tag', () => {
    expect(client.extractType('<type></type>')).toBe('unknown')
  })
  it('should only extract first type tag if multiple', () => {
    expect(client.extractType('<type>kv</type><type>prose</type>')).toBe('kv')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/main/llm/__tests__/llm-client.test.ts`
Expected: FAIL — `client.extractType is not a function`

- [ ] **Step 3: 实现 extractType**

在 `src/main/llm/llm-client.ts` 顶部 import 加 `DocType`：

```typescript
import type { ChatMessage, DocType } from './types'
```

在 `extractThoughts` 方法之后新增方法：

```typescript
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run src/main/llm/__tests__/llm-client.test.ts`
Expected: extractType 全部 PASS（现有 extractResult/extractThoughts 用例仍 PASS）

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/main/llm/llm-client.ts src/main/llm/__tests__/llm-client.test.ts
git commit -m "feat: add LlmClient.extractType for doc type extraction"
```

---

## Task 6: LlmClient — extractResult 增加 Markdown 清洗

**Files:**
- Modify: `src/main/llm/llm-client.ts`
- Modify: `src/main/llm/__tests__/llm-client.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/main/llm/__tests__/llm-client.test.ts` 的 `extractResult` describe 块内追加用例：

```typescript
    it('should strip markdown heading markers', () => {
      const resp = '<result>### 标题\n正文</result>'
      expect(client.extractResult(resp)).toBe('标题\n正文')
    })

    it('should strip blockquote markers', () => {
      const resp = '<result>> 引用内容</result>'
      expect(client.extractResult(resp)).toBe('引用内容')
    })

    it('should remove horizontal rule lines', () => {
      const resp = '<result>上文\n---\n下文</result>'
      expect(client.extractResult(resp)).toBe('上文\n下文')
    })

    it('should unwrap bold markers', () => {
      const resp = '<result>**重点** 内容</result>'
      expect(client.extractResult(resp)).toBe('重点 内容')
    })

    it('should unwrap italic markers', () => {
      const resp = '<result>这是 *斜体* 词</result>'
      expect(client.extractResult(resp)).toBe('这是 斜体 词')
    })

    it('should unwrap inline code backticks', () => {
      const resp = '<result>用 `code` 标记</result>'
      expect(client.extractResult(resp)).toBe('用 code 标记')
    })

    it('should preserve list dash prefix', () => {
      const resp = '<result>- 项目一\n- 项目二</result>'
      expect(client.extractResult(resp)).toBe('- 项目一\n- 项目二')
    })

    it('should preserve numbered list prefix', () => {
      const resp = '<result>1. 第一步\n2. 第二步</result>'
      expect(client.extractResult(resp)).toBe('1. 第一步\n2. 第二步')
    })

    it('should preserve 【】 brackets', () => {
      const resp = '<result>【数据盘点】\n探索广度：1337 首</result>'
      expect(client.extractResult(resp)).toBe('【数据盘点】\n探索广度：1337 首')
    })

    it('should preserve full-width colon in kv', () => {
      const resp = '<result>探索广度：1337 首</result>'
      expect(client.extractResult(resp)).toBe('探索广度：1337 首')
    })

    it('should not strip inline standalone asterisk', () => {
      const resp = '<result>5 * 3 = 15</result>'
      expect(client.extractResult(resp)).toBe('5 * 3 = 15')
    })

    it('should clean markdown and keep placeholder detectable', () => {
      const resp = '<result>**标题**\n- 内容[待补充]</result>'
      expect(client.extractResult(resp)).toBe('标题\n- 内容[待补充]')
    })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/main/llm/__tests__/llm-client.test.ts`
Expected: FAIL — 现有 extractResult 不清洗，`### 标题` 等用例失败

- [ ] **Step 3: 实现 Markdown 清洗**

在 `src/main/llm/llm-client.ts` 中**替换** `extractResult` 方法为下面版本（保留 XML 注释清理，新增 Markdown 清洗，顺序敏感）：

```typescript
  /**
   * Extract structured result from LLM response and strip Markdown markers.
   * Order: extract <result> -> remove XML comments -> strip Markdown (rules
   * per spec 自审修订点 2). Preserves list dashes, numbered prefixes,
   * 【】, full-width colons, and inline standalone asterisks.
   * Falls back to full response if <result> tags missing.
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
```

并在文件底部（class 外）新增辅助函数：

```typescript
/**
 * Strip Markdown markers from text while preserving plain-text formatting
 * (list dashes, numbered prefixes, 【】, full-width colons, inline
 * standalone asterisks). Order-sensitive. Per spec 自审修订点 2.
 */
function stripMarkdown(text: string): string {
  return text
    // 1. Horizontal rule lines (---/***/___ on their own line)
    .replace(/^[-*-]{3,}\s*$/gm, '')
    // 2. Heading markers at line start (#..# + space)
    .replace(/^#{1,6}\s+/gm, '')
    // 3. Blockquote markers at line start
    .replace(/^>\s?/gm, '')
    // 4. Bold **xxx** -> xxx
    .replace(/\*\*(.+?)\*\*/g, '$1')
    // 5. Italic *xxx* -> xxx (avoid eating ** already handled above)
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1')
    // 6. Inline code `xxx` -> xxx
    .replace(/`(.+?)`/g, '$1')
    // Collapse 3+ blank lines left by removed rule lines into single blank line
    .replace(/\n{3,}/g, '\n\n')
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run src/main/llm/__tests__/llm-client.test.ts`
Expected: 全部 extractResult 新旧用例 PASS

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/main/llm/llm-client.ts src/main/llm/__tests__/llm-client.test.ts
git commit -m "feat: strip Markdown markers in extractResult with order-sensitive rules"
```

---

## Task 7: chunking.ts — structureText 返回 type 聚合 + summarize 固定 prose

**Files:**
- Modify: `src/main/llm/chunking.ts`
- Modify: `src/main/llm/__tests__/chunking.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/main/llm/__tests__/chunking.test.ts` 的 `structureText` describe 块内，先把 `beforeEach` 的 mock 补上 `extractType`：

```typescript
  beforeEach(() => {
    mockClient = {
      callLlm: vi.fn(),
      extractResult: vi.fn(),
      extractThoughts: vi.fn(),
      extractType: vi.fn(),
    } as unknown as LlmClient
  })
```

然后在该 describe 内追加用例：

```typescript
  it('should return type from extractType for single chunk', async () => {
    const rawText = 'Short OCR text'
    vi.mocked(mockClient.callLlm).mockResolvedValue('<type>kv</type><result>x</result>')
    vi.mocked(mockClient.extractResult).mockReturnValue('x')
    vi.mocked(mockClient.extractThoughts).mockReturnValue(undefined)
    vi.mocked(mockClient.extractType).mockReturnValue('kv')

    const result = await structureText(rawText, 'faithful', 100, mockClient)
    expect(result.type).toBe('kv')
  })

  it('should aggregate same type across chunks to that type', async () => {
    const rawText = 'a'.repeat(60) + '\n\n' + 'b'.repeat(60)
    vi.mocked(mockClient.callLlm)
      .mockResolvedValueOnce('<type>kv</type><result>1</result>')
      .mockResolvedValueOnce('<type>kv</type><result>2</result>')
    vi.mocked(mockClient.extractResult).mockReturnValueOnce('1').mockReturnValueOnce('2')
    vi.mocked(mockClient.extractThoughts).mockReturnValue(undefined)
    vi.mocked(mockClient.extractType).mockReturnValueOnce('kv').mockReturnValueOnce('kv')

    const result = await structureText(rawText, 'faithful', 100, mockClient)
    expect(result.type).toBe('kv')
  })

  it('should aggregate different types across chunks to mixed', async () => {
    const rawText = 'a'.repeat(60) + '\n\n' + 'b'.repeat(60)
    vi.mocked(mockClient.callLlm)
      .mockResolvedValueOnce('<type>kv</type><result>1</result>')
      .mockResolvedValueOnce('<type>prose</type><result>2</result>')
    vi.mocked(mockClient.extractResult).mockReturnValueOnce('1').mockReturnValueOnce('2')
    vi.mocked(mockClient.extractThoughts).mockReturnValue(undefined)
    vi.mocked(mockClient.extractType).mockReturnValueOnce('kv').mockReturnValueOnce('prose')

    const result = await structureText(rawText, 'faithful', 100, mockClient)
    expect(result.type).toBe('mixed')
  })

  it('should aggregate to mixed when any chunk type is unknown', async () => {
    const rawText = 'a'.repeat(60) + '\n\n' + 'b'.repeat(60)
    vi.mocked(mockClient.callLlm)
      .mockResolvedValueOnce('<type>kv</type><result>1</result>')
      .mockResolvedValueOnce('<result>2</result>')
    vi.mocked(mockClient.extractResult).mockReturnValueOnce('1').mockReturnValueOnce('2')
    vi.mocked(mockClient.extractThoughts).mockReturnValue(undefined)
    vi.mocked(mockClient.extractType).mockReturnValueOnce('kv').mockReturnValueOnce('unknown')

    const result = await structureText(rawText, 'faithful', 100, mockClient)
    expect(result.type).toBe('mixed')
  })
```

在 `summarize` describe 块内，同样补 `extractType` 到 beforeEach，并追加：

```typescript
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/main/llm/__tests__/chunking.test.ts`
Expected: FAIL — `result.type` 为 undefined

- [ ] **Step 3: 实现 type 聚合**

在 `src/main/llm/chunking.ts` 顶部 import 加 `DocType`：

```typescript
import type { ProcessMode } from '../../shared/types'
import type { LlmClient } from './llm-client'
import type { DocType } from './types'
import { buildStructurePrompt, buildSummaryPrompt } from './prompts'
```

在 `splitIntoChunks` 之前新增聚合辅助函数：

```typescript
/**
 * Aggregate per-chunk doc types into a single type.
 * - all same -> that type
 * - any diff or any unknown -> mixed
 * Per spec 自审修订点 4.
 */
function aggregateType(types: DocType[]): DocType {
  if (types.length === 0) return 'unknown'
  if (types.length === 1) return types[0]
  const first = types[0]
  for (const t of types) {
    if (t !== first || t === 'unknown') return 'mixed'
  }
  return first
}
```

**替换** `structureText` 函数为下面版本（加 type 提取与聚合，其余逻辑不变）：

```typescript
export async function structureText(
  rawText: string,
  mode: ProcessMode,
  threshold: number,
  llmClient: LlmClient
): Promise<{ text: string; thoughts?: string; type: DocType }> {
  const chunks = splitIntoChunks(rawText, threshold)

  if (chunks.length === 1) {
    const messages = buildStructurePrompt(chunks[0], mode)
    const response = await llmClient.callLlm(messages)
    const text = llmClient.extractResult(response)
    const thoughts = llmClient.extractThoughts(response)
    const type = llmClient.extractType(response)
    return { text, thoughts, type }
  }

  const results: Array<{ text: string; thoughts?: string; type: DocType }> = []

  for (const chunk of chunks) {
    const messages = buildStructurePrompt(chunk, mode)
    const response = await llmClient.callLlm(messages)
    const text = llmClient.extractResult(response)
    const thoughts = llmClient.extractThoughts(response)
    const type = llmClient.extractType(response)
    results.push({ text, thoughts, type })
  }

  const finalText = results.map((r) => r.text).join('\n\n')
  const allThoughts = results
    .map((r) => r.thoughts)
    .filter((t): t is string => t !== undefined)

  const finalThoughts =
    allThoughts.length > 0
      ? allThoughts.join('\n\n--- Chunk Boundary ---\n\n')
      : undefined

  return { text: finalText, thoughts: finalThoughts, type: aggregateType(results.map((r) => r.type)) }
}
```

**替换** `summarize` 函数为下面版本（返回值固定 `type: 'prose'`，其余逻辑不变）：

```typescript
export async function summarize(
  structuredText: string,
  threshold: number,
  llmClient: LlmClient
): Promise<{ text: string; thoughts?: string; type: DocType }> {
  const chunks = splitIntoChunks(structuredText, threshold)

  if (chunks.length === 1) {
    const messages = buildSummaryPrompt(chunks[0])
    const response = await llmClient.callLlm(messages)
    const text = llmClient.extractResult(response)
    const thoughts = llmClient.extractThoughts(response)
    return { text, thoughts, type: 'prose' }
  }

  const chunkSummaries: Array<{ text: string; thoughts?: string }> = []

  for (const chunk of chunks) {
    const messages = buildSummaryPrompt(chunk)
    const response = await llmClient.callLlm(messages)
    const text = llmClient.extractResult(response)
    const thoughts = llmClient.extractThoughts(response)
    chunkSummaries.push({ text, thoughts })
  }

  const concatenatedSummaries = chunkSummaries.map((s) => s.text).join('\n\n')
  const reduceMessages = buildSummaryPrompt(concatenatedSummaries)
  const reduceResponse = await llmClient.callLlm(reduceMessages)
  const finalText = llmClient.extractResult(reduceResponse)
  const reduceThoughts = llmClient.extractThoughts(reduceResponse)

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

  return { text: finalText, thoughts: finalThoughts, type: 'prose' }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run src/main/llm/__tests__/chunking.test.ts`
Expected: 全部 PASS（含现有 thoughts 拼接、map-reduce 用例 + 新 type 用例）

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/main/llm/chunking.ts src/main/llm/__tests__/chunking.test.ts
git commit -m "feat: return aggregated type from structureText, prose from summarize"
```

---

## Task 8: orchestrator.ts — 接入 structureText/summarize，删除内联裸消息

**Files:**
- Modify: `src/main/pipeline/orchestrator.ts`
- Modify: `src/main/pipeline/__tests__/orchestrator.test.ts`

- [ ] **Step 1: 重写测试**

`src/main/pipeline/__tests__/orchestrator.test.ts` 顶部 mock 块改为同时 mock chunking 的 `structureText`/`summarize`（保留 `splitIntoChunks` mock 以免其他 import 报错，但 orchestrator 不再直接用它）：

```typescript
vi.mock('../../llm/chunking', () => ({
  splitIntoChunks: (text: string, _t: number) => [text],
  structureText: vi.fn(async (_raw: string, _mode: string, _th: number, _llm: unknown) =>
    ({ text: 'structured text', thoughts: 'thoughts', type: 'kv' })),
  summarize: vi.fn(async (_text: string, _th: number, _llm: unknown) =>
    ({ text: 'summary text', thoughts: 'summary thoughts', type: 'prose' })),
}))
```

`beforeEach` 里移除 `mockLlm.callLlm`/`extractResult`/`extractThoughts` 的默认 mock 返回（orchestrator 不再直接调它们），但保留 `isRecoverableError`。改为：

```typescript
    mockLlm.callLlm = vi.fn()
    mockLlm.extractResult = vi.fn()
    mockLlm.extractThoughts = vi.fn()
    mockLlm.extractType = vi.fn()
    mockLlm.isRecoverableError = vi.fn().mockReturnValue(false)
```

每个测试用 `vi.mocked` 在需要时配置 `structureText`/`summarize`。把现有测试改造为：

```typescript
import { structureText, summarize } from '../../llm/chunking'

  it('should process a job successfully', async () => {
    const onProgress = vi.fn()
    vi.mocked(structureText).mockResolvedValue({ text: 'structured text', thoughts: 'thoughts', type: 'kv' })
    vi.mocked(summarize).mockResolvedValue({ text: 'summary text', thoughts: 'summary thoughts', type: 'prose' })

    const stats = await orchestrator.startBatch(['/path/file1.pdf'], 'faithful', onProgress)

    expect(stats).toEqual({ total: 1, success: 1, failed: 0 })
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'done' }))

    const result = orchestrator.getResult('mock-uuid-1234')
    expect(result).toBeDefined()
    expect(result?.rawText).toBe('raw ocr text')
    expect(result?.structuredText).toBe('structured text')
    expect(result?.summary).toBe('summary text')
    expect(result?.hasPlaceholderWarning).toBe(false)
  })
```

把"should split long text into chunks"测试改为验证 structureText 被调用一次且接收 mode：

```typescript
  it('should delegate structuring to structureText with mode and threshold', async () => {
    const onProgress = vi.fn()
    const longText = 'A'.repeat(150)
    mockTextIn.recognizeFile.mockResolvedValue(longText)
    vi.mocked(structureText).mockResolvedValue({ text: 'structured', thoughts: undefined, type: 'prose' })
    vi.mocked(summarize).mockResolvedValue({ text: 'summary', thoughts: undefined, type: 'prose' })

    await orchestrator.startBatch(['/file1.pdf'], 'enhanced', onProgress)
    expect(structureText).toHaveBeenCalledWith(longText, 'enhanced', 100, mockLlm)
    expect(summarize).toHaveBeenCalledWith('structured', 100, mockLlm)
  })
```

把"should detect placeholders"改为让 structureText 返回含占位符的 text：

```typescript
  it('should detect placeholders', async () => {
    const onProgress = vi.fn()
    vi.mocked(structureText).mockResolvedValue({ text: 'text [待补充] more', thoughts: undefined, type: 'kv' })
    vi.mocked(summarize).mockResolvedValue({ text: 'summary', thoughts: undefined, type: 'prose' })

    await orchestrator.startBatch(['/file1.pdf'], 'faithful', onProgress)
    const result = orchestrator.getResult('mock-uuid-1234')
    expect(result?.hasPlaceholderWarning).toBe(true)
  })
```

"should retry recoverable errors"：保留对 textin 的重试测；额外加一个 LLM 重试测——structureText 首次抛可恢复错、二次成功：

```typescript
  it('should retry structureText on recoverable LLM error', async () => {
    const onProgress = vi.fn()
    mockLlm.isRecoverableError.mockReturnValue(true)
    vi.mocked(structureText)
      .mockRejectedValueOnce(new Error('LLM network timeout'))
      .mockResolvedValueOnce({ text: 'structured', thoughts: undefined, type: 'kv' })
    vi.mocked(summarize).mockResolvedValue({ text: 'summary', thoughts: undefined, type: 'prose' })

    const stats = await orchestrator.startBatch(['/file1.pdf'], 'faithful', onProgress)
    expect(stats.success).toBe(1)
    expect(structureText).toHaveBeenCalledTimes(2)
  })
```

其余测试（失败隔离、不重试不可恢复错、取消、并发、getJobs）保留，但确保每个 startBatch 前配置好 structureText/summarize 的默认 mock 或按需 mock。在 beforeEach 末尾加默认：

```typescript
    vi.mocked(structureText).mockResolvedValue({ text: 'structured text', thoughts: 'thoughts', type: 'kv' })
    vi.mocked(summarize).mockResolvedValue({ text: 'summary text', thoughts: 'summary thoughts', type: 'prose' })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/main/pipeline/__tests__/orchestrator.test.ts`
Expected: FAIL — orchestrator 仍用内联 callLlm，未调 structureText/summarize

- [ ] **Step 3: 改写 orchestrator.ts**

顶部 import 改为：

```typescript
import { TextInClient } from '../ocr/textin-client'
import { LlmClient } from '../llm/llm-client'
import { OcrJob, JobResult, ProcessMode, JobStage } from '../../shared/types'
import { randomUUID } from 'crypto'
import * as path from 'path'
import { structureText, summarize } from '../llm/chunking'
import { assertNoPlaceholder } from '../llm/placeholder-guard'
```

**替换** `runStructuring` 和 `runSummarizing` 两个方法为：

```typescript
  private async runStructuring(job: OcrJob, rawText: string, mode: ProcessMode, _onProgress: (job: OcrJob) => void) {
    this.updateJob(job, 'structuring', _onProgress)
    const result = await structureText(rawText, mode, this.settings.chunkThreshold, this.llm)
    return { text: result.text, thoughts: result.thoughts }
  }

  private async runSummarizing(job: OcrJob, structuredText: string, onProgress: (job: OcrJob) => void) {
    this.updateJob(job, 'summarizing', onProgress)
    const result = await summarize(structuredText, this.settings.chunkThreshold, this.llm)
    return { text: result.text, thoughts: result.thoughts }
  }
```

`processJob` 中两处 `withRetry` 调用保持不变（仍包裹 `runStructuring`/`runSummarizing`，整体重试语义一致）。`this.results.set(...)` 处不改（type 不写入 JobResult）。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- --run src/main/pipeline/__tests__/orchestrator.test.ts`
Expected: 全部 PASS

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add src/main/pipeline/orchestrator.ts src/main/pipeline/__tests__/orchestrator.test.ts
git commit -m "refactor: route orchestrator through structureText/summarize so prompts reach production"
```

---

## Task 9: 全量测试 + typecheck + 构建

**Files:** 无（验证步骤）

- [ ] **Step 1: 全量测试**

Run: `npm test -- --run`
Expected: 全部 PASS（main + renderer 所有测试）

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: 无错误

- [ ] **Step 3: electron-vite 构建**

Run: `npm run build`
Expected: 构建成功，`out/main/index.js`、`out/preload/index.js`、`out/renderer/` 生成；`out/renderer/assets/*.css` 约 30KB+（Tailwind 仍正常，本次未动 CSS 配置）

- [ ] **Step 4: 验证提示词进入构建产物**

Run（在 WSL 或项目根）: 用 Grep 工具搜索 `out/main/index.js` 是否包含 `TypeRules` 或 `对话体`。
Expected: 命中（证明新提示词被打包进主进程）

- [ ] **Step 5: 提交（若有产物层小修，否则跳过；产物不入 git）**

无源码改动则跳过 commit。若 Step 4 发现提示词未进产物，回查 Task 4/8。

---

## Task 10: 同步到 Windows 端并生成 portable exe

**Files:** 无（部署/打包步骤，在 Windows 原生路径执行）

**背景（CLAUDE.md 坑点 3/4）：** WSL 端 `/home/arcdent/github/ocr-app/` 是 git 源，Windows 端 `C:\Users\yanga\Projects\ocr-app\` 是实际构建处。`npm install` 与 `electron-builder` 必须在 Windows 原生路径执行，严禁 UNC 路径。

- [ ] **Step 1: 确认 WSL 端工作区干净**

Run: `git status`
Expected: clean（所有 task 已提交）

- [ ] **Step 2: 同步源码到 Windows 端**

把 WSL 端 `/home/arcdent/github/ocr-app/` 的源码同步到 `C:\Users\yanga\Projects\ocr-app\`。同步范围：`src/`、`docs/`、`package.json`、`electron-builder.yml`、`tailwind.config.js`、`postcss.config.js`、`tsconfig*.json`、`vitest.config.ts`、`electron.vite.config.ts` 等所有 git 跟踪文件。**不同步** `out/`、`dist/`、`node_modules/`、`resources/*.ico`（gitignore）。

同步方式（二选一，按用户环境）：
- 选项 A：在 Windows 端 `C:\Users\yanga\Projects\ocr-app` 跑 `git pull`（若该目录是同一 git 仓库的 Windows worktree/clone）
- 选项 B：用 `robocopy` 或手动复制 WSL 源到 Windows 端（排除上述目录）

执行前向用户确认同步方式。

- [ ] **Step 3: Windows 端安装依赖（若 node_modules 缺失或过期）**

在 `C:\Users\yanga\Projects\ocr-app`（PowerShell）:
Run: `npm install`
Expected: 成功（CLAUDE.md 坑点 4：必须在 Windows 原生路径，不能在 UNC）

- [ ] **Step 4: Windows 端跑测试 + typecheck + 构建**

在 `C:\Users\yanga\Projects\ocr-app`（PowerShell）:
Run: `npm test -- --run`
Run: `npm run typecheck`
Run: `npm run build`
Expected: 三项全过，`out/renderer/assets/*.css` 约 30KB+

- [ ] **Step 5: 生成 portable exe**

在 `C:\Users\yanga\Projects\ocr-app`（PowerShell）:
Run: `npx electron-builder --win`
Expected: 成功生成 `dist/OCR App-0.1.0-portable.exe` 与 `dist/win-unpacked/ocr-app.exe`

**若遇 `read ECONNRESET`**（CLAUDE.md 坑点 5）：直接重试 `npx electron-builder --win`，非 bug，是向 GitHub 请求 Electron 元数据的网络抖动。

**若遇 `Icon must be at least 256x256 pixels`**（坑点 6）：确认 `resources/icon.ico` 含 256x256 条目，重新生成。

- [ ] **Step 6: 验证 portable exe 存在**

确认 `C:\Users\yanga\Projects\ocr-app\dist\OCR App-0.1.0-portable.exe` 文件存在且体积合理（通常 80-150MB）。

- [ ] **Step 7: 报告完成**

向用户报告：portable exe 路径、大小、测试/构建结果摘要。

---

## Self-Review（计划作者已执行）

**Spec 覆盖检查：**
- 四类格式规约 → Task 2 TYPE_RULES ✓
- 混排 `【】` → Task 2 TYPE_RULES ✓
- 硬约束（禁 Markdown/占位符、全角冒号）→ Task 2 TYPE_RULES ✓
- 三提示词四块结构 → Task 4 assembleStructurePrompt + SUMMARY_SYSTEM_PROMPT ✓
- faithful/enhanced FidelityRules 差异 + STEP 3.5 → Task 3 + Task 4 ✓
- summary 固定 prose → Task 4 输出格式 + Task 7 summarize 硬编码 ✓
- `<type><thoughts><result>` 三段 → Task 4 ✓
- extractType 五合法值 + 缺失 + 非法 → Task 5 ✓
- extractResult Markdown 清洗（精确规则）→ Task 6 ✓
- 分块 type 聚合（同→值，异/unknown→mixed）→ Task 7 aggregateType ✓
- orchestrator 接入 structureText/summarize → Task 8 ✓
- type 不持久化（不进 JobResult）→ Task 8 processJob 不改 results.set ✓
- placeholder-guard 兼容 → Task 6 清洗后保留 `[待补充]` 测试 ✓
- renderer 不动 → File Structure 明列不动 ✓
- Windows 端同步 + portable exe → Task 10 ✓

**Placeholder 扫描：** 无 TBD/TODO；每个代码步骤含完整代码。

**类型一致性：** `DocType`（Task 1）→ extractType 返回 `DocType`（Task 5）→ structureText/summarize 返回 `type: DocType`（Task 7）→ orchestrator 不读取 type（Task 8，一致）。`aggregateType` 签名 `(DocType[]) => DocType`。mock 中 `extractType: vi.fn()` 在 chunking/orchestrator 测试均补齐。

**无未定义引用：** TYPE_RULES/FIDELITY_RULES_*/stripMarkdown/aggregateType/assembleStructurePrompt 均在定义它们的 Task 中声明并在后续 Task 使用。
