# ocr-app 设计文档

> 日期：2026-06-17
> 类型：Electron 桌面应用（OCR + LLM 结构化/摘要）
> 状态：设计已确认，待写实施计划

## 1. 概述

ocr-app 是一个 Electron 桌面应用，对用户选择的图片/PDF 文件进行批量处理，流程为：

```
文件/目录 → TextIn OCR（原始文本） → LLM 结构化（高质量 Markdown，无占位符） → LLM 摘要 → 展示/导出
```

复用两个现有项目：

- **xmuxk-auto**：Electron + electron-vite + React 18 + Tailwind + zustand + react-router(HashRouter) + sonner 的三段式骨架、IPC 封装模式、ModelConfig（LLM 配置）、侧边栏布局。
- **ocr2md-mcp**：TextIn OCR API 调用封装（`TextInClient`）、`buildMarkdown` 转换逻辑、批量并发思路。

## 2. 核心决策

| 维度 | 决策 |
|---|---|
| 产品形态 | Electron 桌面应用，完整复用 xmuxk-auto 骨架 |
| 处理流程 | OCR → 结构化 → 摘要（串联，质量最高） |
| LLM 接入 | OpenAI 兼容（`/chat/completions`），用户配置 baseUrl/apiKey/model |
| 输入范围 | 批量/目录处理（复用 ocr2md 并发，默认并发 3） |
| 主界面布局 | A. 列表 + 详情（主从布局） |
| 导出存储 | 批量导出 .md 到目录 + 复制剪贴板 + 保存处理历史 |
| Prompt 设计 | 硬编码，两种模式可切换（faithful 严格忠实 / enhanced 智能增强），CoT + 标签输出，强调无占位符 |
| 设置页组织 | 单弹窗分 Tab（OCR / LLM 两个标签页） |
| thoughts 推理 | 存档（保存进 JobResult 与历史，详情页可折叠查看） |

## 3. 架构与数据流

三段式 Electron：

- **Renderer (React)**：文件队列列表（主）+ 结构化文本/摘要（详情）+ 模式切换 + 设置弹窗 + 历史 + 导出。zustand 管状态，组件不直接调 IPC。
- **Main (Node)**：① pipeline 编排器（并发队列）→ ② TextInClient（复用 ocr2md）→ ③ LlmClient（OpenAI 兼容，硬编码 prompt：3a 结构化、3b 摘要）→ ④ electron-store 存配置/历史 → ⑤ markdown-exporter 批量写 .md。
- **外部服务**：TextIn OCR API + LLM 端点（OpenAI 兼容）。

数据流：

```
RENDERER --window.api(IPC)--> MAIN
  ① orchestrator 并发队列
  ② TextInClient: POST /ai/service/v2/recognize/multipage → rawText
  ③ LlmClient:
       3a 结构化(faithful/enhanced) → structuredText
       3b 摘要(基于 structuredText) → summary
  ④ electron-store: 加密存配置 + 历史
  ⑤ exporter: 批量写 .md
MAIN --ON_JOB_PROGRESS/ON_BATCH_DONE--> RENDERER
```

## 4. 模块划分与目录结构

```
ocr-app/
├─ src/
│  ├─ main/
│  │  ├─ index.ts                # 应用入口、窗口创建
│  │  ├─ ipc-handlers.ts         # 注册所有 IPC handler
│  │  ├─ store.ts                # electron-store 封装（配置+历史，加密）
│  │  ├─ pipeline/
│  │  │  ├─ orchestrator.ts      # 批量队列编排（信号量并发控制）
│  │  │  └─ types.ts
│  │  ├─ ocr/
│  │  │  ├─ textin-client.ts     # 复用 ocr2md TextInClient
│  │  │  └─ types.ts
│  │  ├─ llm/
│  │  │  ├─ llm-client.ts        # OpenAI 兼容调用 + extractResult + 守卫
│  │  │  ├─ prompts.ts           # 硬编码 prompt 库（结构化×2 + 摘要）
│  │  │  └─ types.ts
│  │  └─ export/
│  │     └─ markdown-exporter.ts # 复用 ocr2md buildMarkdown，批量写盘
│  ├─ preload/
│  │  └─ index.ts                # contextBridge 暴露 window.api
│  ├─ shared/
│  │  └─ types.ts                # IPC_CHANNELS 常量 + 跨进程类型
│  └─ renderer/
│     ├─ index.html
│     └─ src/
│        ├─ App.tsx              # HashRouter + 布局
│        ├─ main.tsx
│        ├─ store/
│        │  ├─ useOcrStore.ts        # 队列/当前结果/处理状态
│        │  ├─ useSettingsStore.ts   # TextIn + LLM 配置
│        │  └─ useHistoryStore.ts    # 处理历史
│        ├─ components/
│        │  ├─ layout/            # TitleBar / Sidebar / StatusBar（复用 xmuxk）
│        │  └─ ocr/               # FileQueueList / ResultDetail / ModeSwitch / ConfigDialog
│        └─ pages/
│           ├─ WorkbenchPage.tsx     # 主工作台（布局 A：列表+详情）
│           ├─ HistoryPage.tsx       # 处理历史
│           └─ SettingsPage.tsx      # 打开 ConfigDialog（OCR/LLM 两 Tab）
├─ docs/superpowers/specs/
├─ AGENTS.md
└─ package.json
```

职责边界：每个单元单一目的——`textin-client` 只管 OCR、`llm-client` 只管模型调用、`prompts.ts` 集中所有硬编码 prompt、`orchestrator` 只管并发编排不关心步骤实现。Renderer 每个 store 对应一个领域，组件通过 store 间接调 IPC。

## 5. IPC 通道与核心类型

### IPC 通道（`shared/types.ts` 的 `IPC_CHANNELS`）

invoke 类（请求-响应）：

- `SETTINGS_GET` / `SETTINGS_SET` — 读写 TextIn + LLM 配置
- `SETTINGS_TEST_OCR` / `SETTINGS_TEST_LLM` — 分别对应 ConfigDialog 两 Tab 的「测试连接」
- `OCR_PICK_FILES` — 打开文件/目录选择对话框，返回路径列表
- `OCR_START_BATCH` — 启动批量任务，入参 `{ paths, mode }`
- `OCR_CANCEL` — 取消进行中的批量任务
- `OCR_GET_RESULT` — 按 jobId 取单个结果
- `EXPORT_BATCH` — 批量导出 .md 到目录
- `HISTORY_LIST` / `HISTORY_GET` / `HISTORY_CLEAR`

事件类（主→渲染，进度推送）：

- `ON_JOB_PROGRESS` — 单个文件阶段变化
- `ON_BATCH_DONE` — 整批完成汇总

### 核心类型

```ts
type ProcessMode = 'faithful' | 'enhanced'    // 严格忠实 / 智能增强

type JobStage = 'queued' | 'ocr' | 'structuring' | 'summarizing' | 'done' | 'error'

interface OcrJob {
  jobId: string
  filePath: string
  fileName: string
  stage: JobStage
  error?: string
}

interface JobResult {
  jobId: string
  fileName: string
  rawText: string                  // OCR 原文
  structuredText: string           // <result> 提取后的结构化文本
  structuredThoughts?: string      // 结构化阶段 <thoughts>（存档）
  summary: string                  // <result> 提取后的摘要
  summaryThoughts?: string         // 摘要阶段 <thoughts>（存档）
  mode: ProcessMode
  hasPlaceholderWarning?: boolean
  createdAt: number
}

interface AppSettings {
  textin: { appId: string; secretCode: string; baseUrl: string }
  llm: { baseUrl: string; apiKey: string; model: string }
  concurrency: number              // 默认 3
}
```

进度推送流：orchestrator 每推进一个文件的 stage 就 emit `ON_JOB_PROGRESS`，renderer 的 `useOcrStore` 订阅后更新队列列表状态图标（✅/⏳/❌）。

`JobStage` 不细分 OCR 分页进度——TextIn multipage 单次请求返回整份，无逐页回调。

## 6. 硬编码 Prompt 设计（核心）

全部集中在 `main/llm/prompts.ts`。统一输出协议：LLM 必须输出 `<thoughts>...</thoughts>` + `<result>...</result>` 两段；主进程提取 `<result>` 存入 `structuredText`/`summary`，`<thoughts>` 存入 `*Thoughts` 字段存档。

### 6.1 结构化 Prompt — faithful 模式（CoT 版）

```
System:
你是文档结构化排版引擎。你的任务是把 OCR 原始文本重组为规范 Markdown，
绝不改变信息内容。严格按以下流程思考后输出。

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

User:
OCR 原始文本：
---
{rawText}
---
```

### 6.2 结构化 Prompt — enhanced 模式

同骨架，R1/R3 放宽：

- R1：以 OCR 原文为准，可在高置信度时修正明显识别错误（形近字、错误断词），补全被截断常见词句，但不改语义、不增事实。
- R3：修正应保守，拿不准就保留原文；仍严禁任何占位符。
- `<Procedure>` 加 STEP 3.5：列出打算修正的点及依据。

### 6.3 摘要 Prompt（CoT 版，基于结构化文本）

```
System:
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

User:
结构化文档：
---
{structuredText}
---
```

### 6.4 组装与守卫

```ts
function buildStructurePrompt(rawText: string, mode: ProcessMode): ChatMessage[]
function buildSummaryPrompt(structuredText: string): ChatMessage[]

function extractResult(raw: string): string {
  const m = raw.match(/<result>([\s\S]*?)<\/result>/i)
  return (m ? m[1] : raw).trim()   // 缺标签时降级用全文
}
function extractThoughts(raw: string): string | undefined {
  const m = raw.match(/<thoughts>([\s\S]*?)<\/thoughts>/i)
  return m ? m[1].trim() : undefined
}

const PLACEHOLDER_RE = /\[(待补充|待填|TODO|xxx|此处.*?省略)\]|…{2,}|\.{3,}/gi
function assertNoPlaceholder(text: string): { clean: boolean; hits: string[] }
// 命中：结果照常返回，标 hasPlaceholderWarning，详情页黄色提示
```

关键设计点：

- prompt 全硬编码，不可被用户修改。
- 无占位符双重保障：prompt 显式禁止 + 正则后处理守卫。
- CoT 让模型先分类再排版，标题/表格判定更准、残缺处不被占位符填充。
- `<thoughts>` 存档但不进 `structuredText`/`summary`，不污染导出。
- 摘要基于结构化文本（串联流程）而非 OCR 原文。

## 7. 错误处理与边界

分阶段错误隔离（pipeline orchestrator）：每个文件是独立 job，单个失败不影响整批，失败标 `stage: 'error'` + `error` 文案，可单独重试。

| 阶段 | 失败场景 | 处理 |
|---|---|---|
| 读文件 | 路径不可读/格式不支持 | job 直接 error，跳过 OCR |
| OCR (TextIn) | HTTP 非 200 / code≠200 / 超时 | 复用 ocr2md 错误抛出；retry 1 次后标 error |
| 结构化 (LLM) | 端点不通/超时/返回空 | retry 1 次；连续失败标 error，保留 rawText |
| 摘要 (LLM) | 同上 | 失败不影响已得 structuredText，summary 置空 + 局部警告 |
| 占位符守卫 | 正则命中 | 不算失败，标 hasPlaceholderWarning |

- **配置缺失防护**：启动批量前校验 `settings.textin`/`settings.llm` 填全，缺则 toast 引导去设置弹窗，不发起请求。
- **并发与取消**：信号量控制并发（默认 3）；`OCR_CANCEL` 设取消标志，在途请求跑完、未开始的不再启动。
- **安全**：API key 经 electron-store 加密存本地，不回显明文到 renderer 日志；`rawText` 仅作 user message 内容，不拼进 system prompt（防注入）。

## 8. 测试策略（TDD）

分层测试，重逻辑轻 UI，用 vitest + @testing-library/react。

主进程单元测试：

| 模块 | 测试重点 |
|---|---|
| `llm/prompts.ts` | 两模式模板选择正确、`{rawText}` 注入、messages 结构 |
| `llm/llm-client.ts` | `extractResult`/`extractThoughts` 提取与降级、mock fetch 测请求体 |
| 占位符守卫 | `assertNoPlaceholder` 命中各类占位符、正常文本不误报 |
| `ocr/textin-client` | 复用 ocr2md 测试 + mock fetch 测 header/错误码 |
| `pipeline/orchestrator` | 并发上限、单 job 失败隔离、retry 1 次、取消标志 |
| `export/markdown-exporter` | 文件名映射、buildMarkdown 输出格式 |

渲染进程测试：

- `useOcrStore`/`useSettingsStore`：mock `window.api`，测状态流转。
- 组件冒烟：FileQueueList 渲染各 stage 图标、ResultDetail 折叠 thoughts、ConfigDialog 两 Tab 切换。

集成测试（关键路径）：

- happy path：mock TextIn + LLM，跑 选文件→OCR→结构化→摘要→JobResult，断言 `<result>` 提取干净、无占位符、thoughts 已存档。
- 失败路径：LLM 摘要阶段失败，断言 structuredText 保留、summary 空、不影响整批。

不测：Electron 窗口/打包、真实 TextIn/LLM 网络调用（用 mock）。

## 9. 复用与新增清单

复用（来自现有项目）：

- ocr2md-mcp：`TextInClient`、`buildMarkdown`、批量并发思路、TextIn 错误处理。
- xmuxk-auto：三段式骨架、electron-vite/tsconfig 配置、IPC invoke+事件订阅模式、`window.api` preload 封装、ModelConfig 结构与测试连接逻辑、zustand store 模式、TitleBar/Sidebar/StatusBar 布局、sonner toast、electron-store 加密存储。

新增：

- `pipeline/orchestrator.ts` 并发编排器。
- `llm/llm-client.ts` + `llm/prompts.ts` 硬编码 prompt 库（结构化×2 模式 + 摘要，CoT + 标签）。
- `extractResult`/`extractThoughts`/`assertNoPlaceholder` 解析守卫。
- 详情双栏 UI（FileQueueList / ResultDetail / ModeSwitch）。
- ConfigDialog（OCR/LLM 两 Tab）。
- 处理历史页与 store。
