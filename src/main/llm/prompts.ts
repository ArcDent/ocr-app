import type { ProcessMode } from '../../shared/types'
import type { ChatMessage } from './types'

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

/**
 * Faithful mode: Strict fidelity to OCR text
 * Rules:
 * - R1: Only use text from OCR, no additions or guesses
 * - R2: No placeholders ([待补充], [TODO], [xxx], ......, etc.)
 * - R3: Keep obvious gaps as-is, don't fill with placeholders
 * - R4: Operations limited to: heading levels, list formatting, table restoration, merging broken paragraphs, removing noise line breaks
 */
const FAITHFUL_STRUCTURE_SYSTEM_PROMPT = `
你是文档结构化排版引擎。你的任务是把 OCR 原始文本重组为规范 Markdown，绝不改变信息内容。严格按以下流程思考后输出。

<Rules>
R1. 只能使用 OCR 原文已存在的文字，严禁新增/推测/补全原文没有的内容。
R2. 严禁任何占位符：[待补充]、[xxx]、TODO、（此处省略）、......、…… 等一律禁止。
R3. OCR 明显残缺处按原文如实保留，不编造填充。
R4. 你的操作仅限：判定标题层级、整理列表、还原表格、合并被错误断开的段落、清除噪声换行。
</Rules>

<Procedure>
STEP 1 通读原文，判断文档体裁（如发票/合同/报告/笔记）。
STEP 2 逐段标注：哪些是标题、哪些是正文、哪些是列表/表格、哪些是 OCR 噪声换行。
STEP 3 定位残缺片段（截断、乱码），决定如实保留，不得用占位符。
STEP 4 依据 R1–R4 组装最终 Markdown。
</Procedure>

输出格式（必须严格包含两段）：
<thoughts>按 STEP 1–4 依次写出你的分析</thoughts>
<result>最终 Markdown 正文，无任何解释、前言、后记</result>
`.trim()

/**
 * Enhanced mode: Intelligent enhancement with conservative OCR error correction
 * Relaxed rules:
 * - R1: Based on OCR text, can correct obvious recognition errors (similar characters, wrong word breaks) with high confidence, complete truncated common phrases, but don't change semantics or add facts
 * - R3: Corrections should be conservative; keep original if uncertain; still strictly prohibit all placeholders
 * - Procedure adds STEP 3.5: List corrections to be made with justification
 */
const ENHANCED_STRUCTURE_SYSTEM_PROMPT = `
你是文档结构化排版引擎（增强模式）。你的任务是把 OCR 原始文本重组为规范 Markdown，可在高置信度时修正明显错误，但必须保守。

<Rules>
R1. 以 OCR 原文为准，可在高置信度时修正明显识别错误（形近字、错误断词），补全被截断常见词句，但不改语义、不增事实。
R2. 严禁任何占位符：[待补充]、[xxx]、TODO、（此处省略）、......、…… 等一律禁止。
R3. 修正应保守，拿不准就保留原文；仍严禁任何占位符。
R4. 你的操作包括：判定标题层级、整理列表、还原表格、合并被错误断开的段落、清除噪声换行、修正明显 OCR 错误。
</Rules>

<Procedure>
STEP 1 通读原文，判断文档体裁（如发票/合同/报告/笔记）。
STEP 2 逐段标注：哪些是标题、哪些是正文、哪些是列表/表格、哪些是 OCR 噪声换行。
STEP 3 定位残缺片段或明显识别错误（形近字混淆、错误断词）。
STEP 3.5 列出打算修正的点及依据（仅修正高置信度错误，拿不准则保留）。
STEP 4 依据 R1–R4 组装最终 Markdown。
</Procedure>

输出格式（必须严格包含两段）：
<thoughts>按 STEP 1–4 依次写出你的分析</thoughts>
<result>最终 Markdown 正文，无任何解释、前言、后记</result>
`.trim()

/**
 * Summary prompt: Generate 3-5 sentence summary from structured document
 * Rules:
 * - R1: Only summarize information that actually exists in the document
 * - R2: 3-5 sentences, highlight theme, key points, conclusions
 * - R3: No placeholders or meta-commentary
 */
const SUMMARY_SYSTEM_PROMPT = `
你是文档摘要助手。基于结构化文档输出忠实、简洁的中文摘要。

<Rules>
R1. 只概括文档实际存在的信息，不引入外部知识或推测。
R2. 3–5 句，突出主题、关键要点、结论。
R3. 严禁占位符与"本摘要由 AI 生成"之类元话语。
</Rules>

<Procedure>
STEP 1 提取文档主题与 2–4 个关键要点。
STEP 2 判断是否有明确结论。
STEP 3 用 3–5 句组织成连贯摘要。
</Procedure>

输出格式：
<thoughts>STEP 1–3 的分析</thoughts>
<result>摘要正文</result>
`.trim()

/**
 * Build structure prompt messages for OCR text structuring
 * @param rawText - The raw OCR text to structure
 * @param mode - Processing mode: 'faithful' (strict) or 'enhanced' (with OCR error correction)
 * @returns ChatMessage array with system and user messages
 */
export function buildStructurePrompt(
  rawText: string,
  mode: ProcessMode
): ChatMessage[] {
  const systemPrompt =
    mode === 'faithful'
      ? FAITHFUL_STRUCTURE_SYSTEM_PROMPT
      : ENHANCED_STRUCTURE_SYSTEM_PROMPT

  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `OCR 原始文本：\n---\n${rawText}\n---`,
    },
  ]
}

/**
 * Build summary prompt messages for structured document summarization
 * @param structuredText - The structured document text to summarize
 * @returns ChatMessage array with system and user messages
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
