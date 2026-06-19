# 结构化提示词重设计 — 设计文档

- 日期：2026-06-20
- 范围：`src/main/llm/` 提示词模块（faithful / enhanced / summary 三个 system prompt 全部重写）
- 状态：待用户审阅

## 背景与动机

当前 `prompts.ts` 的三个 system prompt（`FAITHFUL_STRUCTURE_SYSTEM_PROMPT`、`ENHANCED_STRUCTURE_SYSTEM_PROMPT`、`SUMMARY_SYSTEM_PROMPT`）都要求 LLM 在 `<result>` 中输出「最终 Markdown 正文」，主动要求 LLM 产出 `###`、`* **xx**：`、`---`、`>` 等 Markdown 标记。

典型问题输出（如 Lyricify 年度音乐报告）：

```
### 🎧 ArcDent 的年度音乐旅程
#### 📊 数据盘点：你的音乐足迹
*   **探索广度**：你的曲库储备达到了 **1,337 首** 歌曲。
*   **相遇次数**：这一年你启动了 Lyricify **75 次**。
```

用户需求：

1. 去掉所有 Markdown 标记（`*` `###` `**` `---` `>` 等），输出简洁纯文本
2. 按数据类型走不同格式（聊天记录类 `A：xxx` / `B：xxx`，键值数据类 `xx：xx`）
3. 适用范围：faithful / enhanced / summary 三个提示词全部重写
4. 文档类型由 LLM 自动判定，无需用户手动选择

## 设计决策（brainstorming 对齐结果）

| 决策点 | 选择 |
|--------|------|
| 适用范围 | 全部重写（faithful / enhanced / summary） |
| 类型分支颗粒度 | 多类型预设（4 类） |
| 预设类型 | 对话体 / 键值表 / 清单列表 / 纯段落散文 |
| 类型判定权 | LLM 自动判定 |
| 冒号与分隔符 | 统一全角「：」；清单用半角 `- ` |
| 混排规则 | 分区块混排，区块标题用 `【】` 包裹 |
| 区块标题区分 | 用 `【】` 包裹（如 `【数据盘点】`） |
| 输出结构 | `<type>` + `<thoughts>` + `<result>` 三段 |
| 实现路径 | 方案 A：单一大提示词内嵌四类规约 |
| summary 的 type | 固定为 `prose`，不做类型判定 |
| TypeRules 组织 | 抽成共享常量，三提示词复用 |
| Markdown 清洗兜底 | 加在 `extractResult`，双保险 |
| 分块时 type 聚合 | 标 `mixed`（跨块类型不同时） |
| UI 展示类型 | 不需要，仅内部用，不改 renderer |
| orchestrator 接入 | 改调 chunking.ts 的 structureText/summarize，删除内联裸消息（见自审修订） |
| type 持久化 | 不持久化，JobResult/HistoryItem 不加 type 字段 |

## 核心格式规约

### 文档类型与格式

**类型 1 · 对话体（dialogue）** — 聊天/访谈/客服/对话记录

```
A：你好，在吗
B：在的，什么事
A：想问下订单进度
```

- 每行一条发言，格式 `说话人：内容`
- 说话人用原文出现的标识（A/B/我/对方/客服 等均可），不统一改写
- 同一人连续发言合并为一行；不保留原文多余换行

**类型 2 · 键值表（kv）** — 发票/报告/证件/仪表读数/数据盘点

```
探索广度：1337 首
相遇次数：75 次
歌词阅读：5302 次
平台偏好：桌面端 5211 次，移动端 91 次
```

- 每行一个字段，格式 `字段名：值`
- 字段名用原文词；值保留原文数字与单位
- 嵌套字段（如「平台偏好」下分桌面/移动）平铺为一行，用逗号或空格分隔子项，不再嵌套冒号

**类型 3 · 清单列表（list）** — 待办/列举项/步骤

```
- 上传歌词
- 浏览歌词
- 启动应用
```

- 每行一项，`- ` 开头（半角连字符 + 空格）
- 原文无顺序用 `- `；原文明确是步骤序号时，保留 `1. 2. 3.` 形式

**类型 4 · 纯段落散文（prose）** — 文章/笔记/报告正文/段落性内容

```
今年最触动心弦的旋律是《Put Me Back Together》。这首歌的名字意为拼凑完整的我。在那些疲惫或迷茫的时刻，这首歌的旋律与歌词像一剂温柔的解药。
```

- 段落直接换行，段落间空一行
- 不加标题、不加粗体、不加任何符号
- 保留原文段落语义边界，仅清理 OCR 噪声换行

### 混排规则（mixed）

一篇文档含多种内容时，用 `【】` 包裹的纯文本标题行分隔区块，标题行前后各空一行：

```
【数据盘点】

探索广度：1337 首
相遇次数：75 次

【年度歌曲】

今年最触动心弦的旋律是《Put Me Back Together》。……
```

### 硬约束（所有类型通用）

- 禁止一切 Markdown 标记：`#` `##` `###` `*` `**` `---` `>` `` ` `` `[]()` 等
- 禁止占位符：`[待补充]` `[xxx]` `TODO` `……` 等（沿用现有 R2）
- 冒号统一全角 `：`；清单连字符用半角 `- `
- faithful 模式：只能用 OCR 原文文字，不得新增/推测/补全
- enhanced 模式：可高置信度修正明显 OCR 错误，保守，不改语义不增事实

## 提示词结构

### 统一骨架

每个 system prompt 由四块组成：

```
<角色与任务>
你是文档结构化排版引擎。把 OCR 原始文本重组为简洁纯文本，按文档类型走对应格式，绝不输出任何 Markdown 标记。

<TypeRules>
[四类格式规约 + 混排规则 + 硬约束]
</TypeRules>

<FidelityRules>
[faithful / enhanced / summary 各自的 R1–R4]
</FidelityRules>

<Procedure>
STEP 1 通读原文，判定主类型（dialogue / kv / list / prose / mixed）
STEP 2 若 mixed，规划区块划分与各区块类型
STEP 3 定位残缺/错误片段（enhanced 在此列出修正点及依据）
STEP 4 依 TypeRules + FidelityRules 组装最终纯文本
</Procedure>

输出格式（必须严格包含三段，按顺序）：
<type>dialogue | kv | list | prose | mixed</type>
<thoughts>按 STEP 1–4 依次写出分析</thoughts>
<result>最终纯文本正文，无任何解释、前言、后记</result>
```

### 三个提示词的差异

| 提示词 | `<type>` 可选值 | `<FidelityRules>` | 用途 |
|--------|----------------|-------------------|------|
| faithful | dialogue / kv / list / prose / mixed | R1 只能用原文，禁新增推测；R2 禁占位符；R3 残缺如实保留；R4 仅排版 | 结构化（忠实） |
| enhanced | 同上 | R1 可高置信度修形近字/断词，不改语义不增事实；R2 禁占位符；R3 保守，拿不准保留；R4 排版+修正 | 结构化（增强） |
| summary | prose（固定） | R1 只概括实际存在信息；R2 3–5 句；R3 禁占位符与元话语 | 摘要 |

summary 的 `<type>` 固定输出 `prose`，不走混排；但仍受硬约束（无 Markdown）和 FidelityRules 约束。三个提示词的 TypeRules 块内容完全相同，代码层抽成共享常量 `TYPE_RULES` 复用。

### 函数签名

- `buildStructurePrompt(rawText, mode)` — 签名不变，仅 system prompt 内容替换；user message 包裹方式不变（`\n---\n`）
- `buildSummaryPrompt(structuredText)` — 签名不变，仅 system prompt 内容替换

## Before / After 示例

### 示例 1：Lyricify 报告（mixed，faithful）

Before（当前 Markdown 输出）：

```
### 🎧 ArcDent 的年度音乐旅程
#### 📊 数据盘点：你的音乐足迹
*   **探索广度**：你的曲库储备达到了 **1,337 首** 歌曲。
*   **相遇次数**：这一年你启动了 Lyricify **75 次**。
#### 🎵 年度歌曲：《Put Me Back Together》
今年最触动你心弦的旋律是 **《Put Me Back Together》**。
```

After（新纯文本输出）：

```
<type>mixed</type>
<thoughts>STEP1 判定为 mixed：含数据盘点（键值）与年度歌曲（散文）两区块。STEP2 区块1 键值、区块2 散文。STEP3 无残缺。STEP4 按 TypeRules 组装。</thoughts>
<result>【数据盘点】

探索广度：1337 首
相遇次数：75 次
歌词阅读：5302 次
平台偏好：桌面端 5211 次，移动端 91 次

【年度歌曲】

今年最触动心弦的旋律是《Put Me Back Together》。这首歌的名字意为拼凑完整的我。
</result>
```

### 示例 2：聊天记录（dialogue，faithful）

```
<type>dialogue</type>
<thoughts>STEP1 判定为 dialogue。STEP2 单一对话体不分区块。STEP3 无残缺。STEP4 按 TypeRules 组装。</thoughts>
<result>A：你好，在吗
B：在的，什么事
A：想问下订单进度
</result>
```

### 示例 3：发票（kv，faithful）

```
<type>kv</type>
<thoughts>STEP1 判定为 kv。...</thoughts>
<result>发票号码：12345678
开票日期：2026年6月20日
金额合计：500.00 元
</result>
```

## 错误处理与边界

- **`<type>` 缺失或非法值**：`extractType` 返回 `'unknown'`；`<result>` 仍正常提取，不阻塞输出
- **LLM 仍输出 Markdown**：`extractResult` 后做清洗，精确规则见「自审修订点 2」。与提示词约束双保险。清洗用正则，有单测
- **`<type>` 与实际内容不符**：不做强制纠错，信任 LLM；thoughts 可观测
- **空输入**：沿用现有行为，`<result>` 为空字符串，不报错
- **分块场景**：每个 chunk 独立判型、独立输出；`structureText` 拼接时各 chunk 的 `<result>` 用 `\n\n` 连接（沿用现有逻辑），`<type>` 聚合规则见「自审修订点 4」

## 代码影响

| 文件 | 改动 |
|------|------|
| `src/main/llm/prompts.ts` | 三个 system prompt 重写为四块结构；新增共享常量 `TYPE_RULES`；新增 `FIDELITY_RULES_FAITHFUL` / `FIDELITY_RULES_ENHANCED` / `FIDELITY_RULES_SUMMARY` |
| `src/main/llm/llm-client.ts` | 新增 `extractType(response)`；`extractResult` 增加 Markdown 清洗正则（见自审修订点 2） |
| `src/main/llm/types.ts` | 新增 `DocType = 'dialogue' \| 'kv' \| 'list' \| 'prose' \| 'mixed' \| 'unknown'` 类型 |
| `src/main/llm/chunking.ts` | `structureText` 返回值新增 `type?: DocType` 字段；分块拼接逻辑加 type 聚合（见自审修订点 4）；`summarize` 返回值固定 `type: 'prose'`（见自审修订点 3） |
| `src/main/pipeline/orchestrator.ts` | **删除** `runStructuring`/`runSummarizing` 内联裸消息构造；改调 `structureText(rawText, mode, chunkThreshold, this.llm)` 和 `summarize(structuredText, chunkThreshold, this.llm)`；`withRetry` 仍包裹整体调用，语义不变 |
| `src/main/llm/__tests__/prompts.test.ts` | 断言改为新结构（含 `<type>`、`<TypeRules>`、无 Markdown 输出要求） |
| `src/main/llm/__tests__/llm-client.test.ts` | 新增 `extractType` 测试（五合法值 + 缺失 + 非法）、Markdown 清洗测试 |
| `src/main/llm/__tests__/chunking.test.ts` | mock client 加 `extractType`；新增 type 字段断言、分块聚合断言 |
| `src/main/pipeline/__tests__/orchestrator.test.ts` | 调整为 mock `structureText`/`summarize`（而非内联 callLlm 次数断言）；保留占位符检测、并发、取消、重试测 |
| `src/renderer/...` | 不改动（类型仅内部用，不展示） |

`summarize` 函数返回值固定 `type?: DocType` = `'prose'`，保持与 `structureText` 一致的接口形状。`structureText` 返回 `type` 由分块聚合得出。两者返回的 `type` **不写入 JobResult/HistoryItem**，仅 LLM 返回时内部可观测（见自审修订点 6）。

## 测试策略

- **提示词单测**（`prompts.test.ts`）：断言含 `<type>`/`<thoughts>`/`<result>`、含四类格式规约关键词、含 TypeRules 共享常量内容、faithful/enhanced 的 FidelityRules 差异、summary 的 type 固定 prose
- **llm-client 单测**：`extractType` 对五种合法值 + 缺失 + 非法值的处理；`extractResult` 对含 `#/*/**/---/>` 的输入做清洗后不含这些标记
- **chunking 单测**：多 chunk 时 type 聚合逻辑（同类型保留、跨类型标 mixed）

## 非目标（YAGNI）

- 不做用户手动选类型的 UI（LLM 自动判定已满足需求）
- 不在 UI 展示识别类型（仅内部用）
- 不做多轮判型调用（方案 A 单次推理完成判型+排版）
- 不改 `buildStructurePrompt` / `buildSummaryPrompt` 函数签名
- 不改 user message 包裹方式（`\n---\n`）

## 风险

- **LLM 不守 Markdown 禁令**：靠 `extractResult` 清洗兜底，风险可控
- **类型误判**：LLM 把键值表误判为散文等。靠 thoughts 可观测，不做自动纠错；若后续发现高频误判，可在提示词的 TypeRules 里强化判定准则
- **提示词变长**：四类规约全量内嵌，token 略增。可接受，因调用次数不变
- **清洗正则误伤**：剥离成对 `*`/`**` 可能误删原文中的成对星号。原文是 OCR 文本，成对星号罕见，且提示词已禁止输出 Markdown，清洗是兜底。单测覆盖此边界
- **orchestrator 接入的回归风险**：改调 structureText/summarize 后，orchestrator 原有的内联分块/重试语义需在测试中确认等价（重试边界、callLlm 次数断言调整）

## 自审修订（2026-06-20，解决冲突与边界不清）

自审发现原 spec 与现实代码存在重大偏差，修订如下。这些修订是 spec 的正式组成部分，优先级高于上方未修订处的任何隐含假设。

### 修订点 0 · orchestrator 接入提示词库（最大盲区，已确认）

**发现的偏差**：`prompts.ts` 的三个提示词只被 `chunking.ts` 的 `structureText`/`summarize` 使用。但生产路径 `orchestrator.ts` 的 `runStructuring`/`runSummarizing` 绕过了它们——直接发裸 user message（`content = chunk`），摘要还硬编码英文 `"Please summarize the following text:\n\n..."`，不调用 `buildStructurePrompt`/`buildSummaryPrompt`。`chunking.ts` 的 `structureText`/`summarize` 当前是孤岛（有测试、无生产调用方）。

**后果**：只重写 `prompts.ts` 对用户不可见——LLM 收到裸消息，不按新格式输出。

**已确认方案（接入）**：
- `orchestrator.runStructuring` 改为：`return await structureText(rawText, mode, this.settings.chunkThreshold, this.llm)`
- `orchestrator.runSummarizing` 改为：`return await summarize(structuredText, this.settings.chunkThreshold, this.llm)`
- 删除 orchestrator 内联的 `splitIntoChunks` 循环、裸 messages 构造、硬编码英文摘要指令
- `withRetry` 仍包裹 `structureText`/`summarize` 整体调用，重试语义不变（整体重来）
- `orchestrator.ts` 顶部 import 调整：`splitIntoChunks` 不再直接用，改 import `structureText, summarize`
- `orchestrator.test.ts` 调整：原断言 `mockLlm.callLlm` 调用次数（2 chunks + 1 summary）改为 mock `structureText`/`summarize`；保留占位符检测、并发、取消、重试、失败隔离测试

### 修订点 1 · extractType 为 LlmClient 实例方法，调用链与 mock 同步

- `extractType(rawResponse: string): DocType` 为 `LlmClient` 实例方法
- `chunking.ts` 的 `structureText`/`summarize` 通过 `llmClient.extractType(response)` 调用
- `chunking.test.ts` 和 `orchestrator.test.ts` 的 mock client 须加 `extractType: vi.fn()`
- `extractType` 无 `<type>` 标签或值非法时返回 `'unknown'`

### 修订点 2 · 清洗正则精确规则

`extractResult` 提取 `<result>` 内容并清掉 XML 注释后，再按以下顺序清洗 Markdown 标记（仅清标记符号，保留文字内容）：

1. 整行分隔线：`/^[-*_]{3,}\s*$/gm` → 删除整行
2. 行首标题：`/^#{1,6}\s+/gm` → 删除 `#` 及其后空格，保留标题文字
3. 行首引用：`/^>\s?/gm` → 删除 `>` 及空格
4. 成对粗体 `**xxx**`：`/\*\*(.+?)\*\*/g` → `$1`
5. 成对斜体 `*xxx*`：`/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g` → `$1`（避免误吃 `**`）
6. 成对反引号 `` `xxx` ``：`` /`(.+?)`/g `` → `$1`

**明确保留**：
- 行首 `- `（这是清单格式本身，不是要清的 Markdown）
- 行内非成对的 `*`（作为原文内容）
- `【】`《》等中文标点
- `1. 2. 3.` 编号（清单列表的步骤序号形式）

**顺序敏感**：分隔线和行首标记先于成对包裹符，避免互相干扰。

### 修订点 3 · summarize 的 type 硬编码 prose

`summarize` 函数返回值固定 `type: 'prose'`，**不依赖** `extractType` 提取（避免 LLM 漏 `<type>` 标签导致返回 `unknown`）。提示词仍要求 summary 输出 `<type>prose</type>`，但函数层不依赖该标签——摘要本来就是散文，类型确定。

### 修订点 4 · 分块 type 聚合规则

`structureText` 多 chunk 时的 type 聚合：
- 收集每个 chunk 的 `extractType` 结果
- 全部相同 → 返回该值
- 含不同值，或任一为 `'unknown'` → 返回 `'mixed'`
- 单 chunk → 返回该 chunk 的 type
- `unknown` 视为不可信，单独出现也触发 `mixed`

### 修订点 5 · placeholder-guard 兼容

清洗在 `extractResult` 内部完成（提取 `<result>` → 清 XML 注释 → 清 Markdown）。`orchestrator` 随后对清洗后的 `text` 调 `assertNoPlaceholder`。`[待补充]` 等占位符不含 Markdown 标记，清洗不影响其检测。测试覆盖「清洗后仍能检出占位符」。

### 修订点 6 · type 不持久化

`JobResult`（`src/shared/types.ts`）和 `HistoryItem` **不加** type 字段。`structureText`/`summarize` 返回的 `type` 仅在 LLM 响应处理时内部可观测（可进 thoughts 或日志），不写入结果对象、不存 history、不传 renderer。最小改动，避免 IPC 契约和 history 序列化连锁变更。若后续需要展示类型，再单独加字段。
