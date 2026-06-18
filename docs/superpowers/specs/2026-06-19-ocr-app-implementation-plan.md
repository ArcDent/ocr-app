# ocr-app 实施计划

> 日期：2026-06-19
> 基于：2026-06-17 设计文档
> 策略：方案 A - 自底向上（基础设施优先）

## 概述

本实施计划采用**自底向上**策略，按以下顺序实施：

1. 项目脚手架与类型定义
2. Main 进程核心模块（OCR/LLM/Pipeline）
3. 配置存储与历史管理
4. IPC 通信层
5. Renderer 基础设施（stores/布局）
6. UI 组件实现
7. 集成测试与优化

每个阶段包含：文件清单、核心代码示例、测试策略、验收标准。

---

## 阶段划分总览

| 阶段 | 模块 | 工期估算 | 依赖阶段 |
|-----|------|---------|---------|
| 1 | 项目基础设施 | 2h | - |
| 2 | 共享类型定义 | 1h | 1 |
| 3 | OCR 客户端 | 3h | 2 |
| 4 | LLM 客户端与 Prompt | 4h | 2 |
| 5 | 占位符守卫 | 2h | 4 |
| 6 | 分块处理逻辑 | 3h | 4,5 |
| 7 | Pipeline 编排器 | 4h | 3,4,5,6 |
| 8 | 配置存储 | 2h | 2 |
| 9 | 历史管理 | 3h | 2,8 |
| 10 | Markdown 导出器 | 2h | 2 |
| 11 | IPC 处理器 | 3h | 7,8,9,10 |
| 12 | Preload 层 | 1h | 2,11 |
| 13 | Renderer Stores | 3h | 12 |
| 14 | 布局与路由 | 2h | 13 |
| 15 | UI 组件 | 5h | 13,14 |
| 16 | 集成测试 | 3h | 15 |
| 17 | 端到端验证 | 2h | 16 |

**总工期估算**：约 45-50 小时

---

## 第一部分：项目初始化（阶段 1-2）

### 阶段 1：项目基础设施搭建

**目标**：建立 Electron + Vite + React 开发环境

**文件清单**：
- package.json
- tsconfig.json / tsconfig.node.json
- electron.vite.config.ts
- vitest.config.ts
- tailwind.config.js / postcss.config.js
- .gitignore / .eslintrc.json / .prettierrc

**核心依赖**：
- Electron 28.x + electron-vite 2.x
- React 18.x + React Router 6.x
- Zustand 4.x（状态管理）
- Tailwind CSS 3.x（样式）
- Vitest 1.x（测试）
- sonner（Toast 提示）
- electron-store 8.x（持久化）

**验收标准**：
- npm install 成功
- npm run dev 启动 Electron 窗口
- 热重载生效
- npm run build 构建成功

---

### 阶段 2：共享类型定义

**目标**：定义跨进程通信的类型系统

**文件**：src/shared/types.ts

**核心类型**：
- IPC_CHANNELS：所有通道常量
- ProcessMode：faithful | enhanced
- JobStage：queued | ocr | structuring | summarizing | done | error
- OcrJob：任务状态
- JobResult：处理结果（含 thoughts）
- AppSettings：TextIn + LLM 配置
- HistoryItem：历史记录元数据（正文存盘）
- IpcRequest/IpcResponse/IpcEvents：类型安全的 IPC 映射

**常量**：
- HISTORY_LIMIT = 100
- DEFAULT_CONCURRENCY = 3
- DEFAULT_CHUNK_THRESHOLD = 12000

**验收标准**：
- TypeScript 编译通过
- 类型可被 main/renderer 导入

---

## 第二部分：Main 进程核心模块（阶段 3-7）

### 阶段 3：TextIn OCR 客户端

**目标**：实现 TextIn API 调用封装

**文件清单**：
```
src/main/ocr/
├── textin-client.ts
├── types.ts
└── __tests__/
    └── textin-client.test.ts
```

**核心类**：TextInClient

**关键方法**：
- `recognizeFile(filePath: string): Promise<string>` - 识别单个文件，返回拼接的全文
- `testConnection(): Promise<{success, message}>` - 测试连接

**错误处理**：
- 60s 超时
- HTTP 非 200 抛出错误
- TextIn code !== 200 抛出错误
- isRecoverableError() 判定可恢复错误（超时/5xx/网络）

**测试用例**：
- 成功识别（mock 多页响应）
- HTTP 错误（500）
- API 错误（code 401）
- 超时（60s）
- 可恢复错误判定

**验收标准**：
- 所有测试通过
- 覆盖率 > 90%

---

### 阶段 4：LLM 客户端与 Prompt

**目标**：实现 OpenAI 兼容 LLM 调用 + 硬编码 Prompt

**文件清单**：
```
src/main/llm/
├── llm-client.ts
├── prompts.ts
├── types.ts
└── __tests__/
    ├── llm-client.test.ts
    └── prompts.test.ts
```

**llm-client.ts 核心方法**：
- `callLlm(messages, config): Promise<string>` - 调用 /chat/completions
- `extractResult(raw: string): string` - 提取 <result>...</result>
- `extractThoughts(raw: string): string | undefined` - 提取 <thoughts>
- 超时 120s，支持 retry

**prompts.ts 核心函数**：
- `buildStructurePrompt(rawText, mode): ChatMessage[]` - 结构化 prompt（faithful/enhanced）
- `buildSummaryPrompt(structuredText): ChatMessage[]` - 摘要 prompt

**Prompt 设计要点**（见设计文档 6.1-6.3）：
- System prompt 包含 Rules + Procedure
- 严禁占位符（明确列举）
- CoT 思考流程（STEP 1-4）
- 输出协议：<thoughts> + <result>
- faithful 模式：严格忠实原文
- enhanced 模式：可修正明显错误，但保守

**测试用例**：
- LLM 调用成功
- HTTP 错误
- 超时
- extractResult 正常提取
- extractResult 缺标签降级
- extractThoughts 提取
- Prompt 模板正确（faithful/enhanced）
- messages 结构正确

**验收标准**：
- 所有测试通过
- Prompt 与设计文档一致
- 覆盖率 > 85%

---

### 阶段 5：占位符守卫

**目标**：实现占位符检测逻辑

**文件**：
```
src/main/llm/placeholder-guard.ts
src/main/llm/__tests__/placeholder-guard.test.ts
```

**核心函数**：
```typescript
export function assertNoPlaceholder(text: string): {
  clean: boolean
  hits: string[]
}
```

**检测模式**（正则）：
- [待补充] / [待填] / [TODO] / [xxx]
- [此处...省略]
- …{2,} / \.{3,}

**测试用例**：
- 命中各类占位符
- 正常文本不误报
- 多个占位符返回完整列表

**验收标准**：
- 所有测试通过
- 覆盖率 100%

---

### 阶段 6：分块处理逻辑

**目标**：实现超长文本分块与 map-reduce 摘要

**文件**：
```
src/main/llm/chunking.ts
src/main/llm/__tests__/chunking.test.ts
```

**核心函数**：
- `splitIntoChunks(text, threshold): string[]` - 按段落边界切块
- `structureText(rawText, mode, threshold, llm): Promise<{text, thoughts}>` - 自动分块结构化
- `summarize(structuredText, threshold, llm): Promise<{text, thoughts}>` - 自动 map-reduce 摘要

**策略**（见设计文档 6.5）：
- 结构化：超阈值 → 分块 → 逐块结构化 → 拼接
- 摘要：超阈值 → 分块摘要 → 汇总摘要

**测试用例**：
- splitIntoChunks 按段落切分
- 每块 <= threshold
- 不超阈值不分块
- 超阈值走分块路径
- map-reduce 摘要逻辑

**验收标准**：
- 所有测试通过
- 覆盖率 > 90%

---

### 阶段 7：Pipeline 编排器

**目标**：实现批量任务并发编排 + 错误隔离 + retry

**文件清单**：
```
src/main/pipeline/
├── orchestrator.ts
├── types.ts
└── __tests__/
    └── orchestrator.test.ts
```

**核心类**：Orchestrator

**关键方法**：
- `startBatch(paths, mode, settings)` - 启动批量任务
- `cancel()` - 取消任务
- `getJobStatus(jobId)` - 获取任务状态
- `getResult(jobId)` - 获取结果

**编排逻辑**：
1. 文件列表 → 创建 OcrJob[]（stage: queued）
2. 信号量并发控制（concurrency = 3）
3. 每个 job：OCR → 结构化 → 占位符检测 → 摘要
4. 每阶段 emit ON_JOB_PROGRESS
5. 单个失败不影响整批
6. 完成后 emit ON_BATCH_DONE

**Retry 策略**：
- 仅可恢复错误 retry 1 次
- 4xx 不重试
- 连续失败标 error

**测试用例**：
- 并发上限控制
- 单 job 失败隔离
- retry 策略（可恢复 retry，4xx 不 retry）
- 取消标志生效
- 进度事件发送

**验收标准**：
- 所有测试通过
- 覆盖率 > 85%

---

## 第三部分：存储与导出（阶段 8-10）

### 阶段 8：配置存储

**目标**：实现 electron-store 封装，加密存储配置

**文件清单**：
```
src/main/store.ts
src/main/__tests__/store.test.ts
```

**核心类**：ConfigStore

**关键方法**：
- `getSettings(): AppSettings` - 读取配置（含默认值）
- `setSettings(settings: AppSettings): void` - 保存配置
- `clear(): void` - 清空配置

**存储结构**：
```typescript
{
  settings: AppSettings,
  version: '1.0.0'
}
```

**加密**：
- electron-store 的 encryptionKey 选项
- API key 加密存储

**测试用例**：
- 读取默认配置
- 保存并读取
- 部分更新
- 加密存储验证

**验收标准**：
- 所有测试通过
- 配置持久化生效

---

### 阶段 9：历史管理

**目标**：实现历史记录管理（元数据 + 落盘文件）

**文件清单**：
```
src/main/history/
├── history-manager.ts
├── types.ts
└── __tests__/
    └── history-manager.test.ts
```

**核心类**：HistoryManager

**关键方法**：
- `saveResult(result: JobResult): Promise<void>` - 保存结果到历史
- `listHistory(): HistoryItem[]` - 列出历史（最近 100 条）
- `getResult(jobId: string): Promise<JobResult | null>` - 读取完整结果
- `clearHistory(): Promise<void>` - 清空历史

**存储策略**（见设计文档 2.1 补充决策 #2-3）：
- 元数据存 electron-store：jobId, fileName, mode, hasPlaceholderWarning, createdAt, 文件路径
- 正文落盘到 userData/ocr-results/{jobId}/：
  - raw.txt
  - structured.md
  - structured-thoughts.txt（可选）
  - summary.md
  - summary-thoughts.txt（可选）
- 超 100 条自动淘汰最旧（删元数据 + 删盘文件）

**测试用例**：
- 保存结果
- 读取结果
- 列表排序（最近优先）
- 超 100 条淘汰
- 清空历史

**验收标准**：
- 所有测试通过
- 覆盖率 > 90%

---

### 阶段 10：Markdown 导出器

**目标**：批量导出 .md 文件 + index.md

**文件清单**：
```
src/main/export/
├── markdown-exporter.ts
└── __tests__/
    └── markdown-exporter.test.ts
```

**核心函数**：
- `exportBatch(results: JobResult[], outputDir: string): Promise<{success, count}>` - 批量导出

**导出结构**（见设计文档 2.1 补充决策 #8-9）：
每个文件导出为 `<fileName>.md`：
```markdown
## 摘要

{summary}

## 正文

{structuredText}
```

index.md 汇总：
```markdown
# OCR 批量处理结果

生成时间：{timestamp}

---

## {fileName1}

**摘要**：{summary1}

[查看完整内容](./{fileName1}.md)

---

## {fileName2}
...
```

**测试用例**：
- 单文件导出格式
- index.md 格式
- 多文件批量导出
- 文件名冲突处理

**验收标准**：
- 所有测试通过
- 导出格式与设计文档一致

---

## 第四部分：IPC 与 Preload（阶段 11-12）

### 阶段 11：IPC 处理器

**目标**：注册所有 IPC handler，连接 Main 模块与 Renderer

**文件清单**：
```
src/main/ipc-handlers.ts
src/main/__tests__/ipc-handlers.test.ts
```

**核心函数**：
- `registerIpcHandlers()` - 注册所有 handler

**处理器清单**：
- SETTINGS_GET/SET - 调用 ConfigStore
- SETTINGS_TEST_OCR - 调用 TextInClient.testConnection()
- SETTINGS_TEST_LLM - 调用 LlmClient.testConnection()
- OCR_PICK_FILES - dialog.showOpenDialog()
- OCR_START_BATCH - 调用 Orchestrator.startBatch()
- OCR_CANCEL - 调用 Orchestrator.cancel()
- OCR_GET_RESULT - 调用 Orchestrator.getResult()
- EXPORT_BATCH - 调用 MarkdownExporter.exportBatch()
- HISTORY_LIST/GET/CLEAR - 调用 HistoryManager

**事件发送**：
- Orchestrator 事件 → webContents.send(ON_JOB_PROGRESS / ON_BATCH_DONE)

**测试用例**：
- 每个 handler 调用正确的模块
- 错误正确传递
- 事件正确发送

**验收标准**：
- 所有测试通过
- 所有 IPC 通道覆盖

---

### 阶段 12：Preload 层

**目标**：通过 contextBridge 暴露类型安全的 window.api

**文件**：`src/preload/index.ts`

**核心实现**：
```typescript
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type IpcRequest, type IpcResponse, type IpcEvents } from '../shared/types'

const api = {
  // Invoke methods
  invoke: <K extends keyof IpcRequest>(
    channel: K,
    data: IpcRequest[K]
  ): Promise<IpcResponse[K]> => {
    return ipcRenderer.invoke(channel, data)
  },

  // Event listeners
  on: <K extends keyof IpcEvents>(
    channel: K,
    callback: (data: IpcEvents[K]) => void
  ): (() => void) => {
    const listener = (_event: any, data: IpcEvents[K]) => callback(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
}

contextBridge.exposeInMainWorld('api', api)

export type WindowApi = typeof api
```

**类型声明**：`src/preload/index.d.ts`
```typescript
import type { WindowApi } from './index'

declare global {
  interface Window {
    api: WindowApi
  }
}
```

**验收标准**：
- TypeScript 类型检查通过
- Renderer 可访问 window.api
- 类型提示正确

---

## 第五部分：Renderer 层（阶段 13-15）

### 阶段 13：Zustand Stores

**目标**：实现三个状态管理 store

**文件清单**：
```
src/renderer/src/store/
├── useOcrStore.ts
├── useSettingsStore.ts
├── useHistoryStore.ts
└── __tests__/
    ├── useOcrStore.test.tsx
    ├── useSettingsStore.test.tsx
    └── useHistoryStore.test.tsx
```

**useOcrStore.ts**：
```typescript
interface OcrState {
  jobs: OcrJob[]
  currentResult: JobResult | null
  isProcessing: boolean
  
  // Actions
  pickFiles: (type: 'files' | 'directory') => Promise<void>
  startBatch: (paths: string[], mode: ProcessMode) => Promise<void>
  cancelBatch: () => Promise<void>
  loadResult: (jobId: string) => Promise<void>
  
  // Internal (订阅 IPC 事件)
  _onJobProgress: (job: OcrJob) => void
  _onBatchDone: (summary) => void
}
```

**useSettingsStore.ts**：
```typescript
interface SettingsState {
  settings: AppSettings | null
  isLoading: boolean
  
  // Actions
  loadSettings: () => Promise<void>
  saveSettings: (settings: AppSettings) => Promise<void>
  testOcr: () => Promise<{success, message}>
  testLlm: () => Promise<{success, message}>
}
```

**useHistoryStore.ts**：
```typescript
interface HistoryState {
  items: HistoryItem[]
  isLoading: boolean
  
  // Actions
  loadHistory: () => Promise<void>
  loadResult: (jobId: string) => Promise<JobResult | null>
  clearHistory: () => Promise<void>
}
```

**IPC 事件订阅**（在 App.tsx mount 时）：
```typescript
useEffect(() => {
  const unsubProgress = window.api.on('on:job-progress', (job) => {
    useOcrStore.getState()._onJobProgress(job)
  })
  const unsubDone = window.api.on('on:batch-done', (summary) => {
    useOcrStore.getState()._onBatchDone(summary)
  })
  return () => {
    unsubProgress()
    unsubDone()
  }
}, [])
```

**测试用例**：
- store 初始化
- actions 调用 window.api
- 状态正确更新
- 事件订阅生效

**验收标准**：
- 所有测试通过
- Mock window.api 测试通过

---

### 阶段 14：布局与路由

**目标**：搭建应用骨架（复用 xmuxk-auto 布局）

**文件清单**：
```
src/renderer/src/
├── App.tsx
├── components/layout/
│   ├── TitleBar.tsx
│   ├── Sidebar.tsx
│   └── StatusBar.tsx
└── pages/
    ├── WorkbenchPage.tsx
    ├── HistoryPage.tsx
    └── SettingsPage.tsx
```

**App.tsx**（HashRouter 路由）：
```typescript
import { HashRouter, Routes, Route } from 'react-router-dom'
import TitleBar from './components/layout/TitleBar'
import Sidebar from './components/layout/Sidebar'
import StatusBar from './components/layout/StatusBar'
import WorkbenchPage from './pages/WorkbenchPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <HashRouter>
      <div className="h-screen flex flex-col">
        <TitleBar />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<WorkbenchPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
        <StatusBar />
      </div>
    </HashRouter>
  )
}
```

**Sidebar 菜单**：
- 工作台（/）
- 历史记录（/history）
- 设置（/settings）

**验收标准**：
- 路由切换正常
- 布局显示正常
- 响应式布局

---

### 阶段 15：UI 组件实现

**目标**：实现所有功能组件

**文件清单**：
```
src/renderer/src/components/ocr/
├── FileQueueList.tsx
├── ResultDetail.tsx
├── ModeSwitch.tsx
├── ConfigDialog.tsx
└── __tests__/
    ├── FileQueueList.test.tsx
    ├── ResultDetail.test.tsx
    ├── ModeSwitch.test.tsx
    └── ConfigDialog.test.tsx
```

**WorkbenchPage.tsx**（主从布局 A）：
```typescript
export default function WorkbenchPage() {
  const { jobs, currentResult, pickFiles, startBatch } = useOcrStore()
  const [mode, setMode] = useState<ProcessMode>('faithful')
  
  return (
    <div className="h-full flex">
      {/* 左侧：文件队列列表 */}
      <div className="w-96 border-r">
        <div className="p-4 border-b">
          <button onClick={() => pickFiles('files')}>选择文件</button>
          <button onClick={() => pickFiles('directory')}>选择目录</button>
          <ModeSwitch value={mode} onChange={setMode} />
        </div>
        <FileQueueList jobs={jobs} onSelect={loadResult} />
      </div>
      
      {/* 右侧：详情 */}
      <div className="flex-1 overflow-auto">
        {currentResult ? (
          <ResultDetail result={currentResult} />
        ) : (
          <div>选择文件查看结果</div>
        )}
      </div>
    </div>
  )
}
```

**FileQueueList.tsx**：
- 显示 jobs 列表
- 各 stage 对应图标（⏳ queued, 🔄 processing, ✅ done, ❌ error）
- 点击加载详情

**ResultDetail.tsx**：
- 顶部：文件名 + mode 标签 + 警告标志
- Tab 切换：摘要 / 结构化文本 / 原始文本
- thoughts 可折叠查看（默认折叠）
- 复制按钮 / 导出按钮

**ModeSwitch.tsx**：
- faithful / enhanced 单选按钮
- Tooltip 说明差异

**ConfigDialog.tsx**（两 Tab）：
- Tab 1：OCR 配置（TextIn appId/secretCode/baseUrl + 测试连接按钮）
- Tab 2：LLM 配置（baseUrl/apiKey/model + 测试连接按钮）
- 并发数 / 分块阈值

**HistoryPage.tsx**：
- 列表显示历史记录
- 点击加载完整结果
- 清空历史按钮

**SettingsPage.tsx**：
- 打开 ConfigDialog

**测试用例**：
- 组件渲染
- 交互事件
- 状态绑定

**验收标准**：
- 所有组件正常显示
- 交互功能正常
- 测试通过

---

## 第六部分：集成与验证（阶段 16-17）

### 阶段 16：集成测试

**目标**：端到端测试关键路径

**文件**：`src/__tests__/integration/`

**测试场景**：

**场景 1：Happy Path**
- Mock TextIn + LLM 响应
- 启动批量任务（2 个文件，faithful 模式）
- 断言：
  - OCR → 结构化 → 摘要 流程完整
  - `<result>` 提取正确
  - `<thoughts>` 已存档
  - 无占位符警告
  - JobResult 完整
  - 历史已保存

**场景 2：超长文本分块**
- Mock 超阈值 rawText（> 12000 字符）
- 断言：
  - 自动分块
  - 逐块结构化
  - 拼接完整
  - 摘要阶段判断是否再次分块

**场景 3：失败隔离**
- Mock LLM 摘要阶段失败
- 断言：
  - structuredText 保留
  - summary 为空
  - 其他文件不受影响

**场景 4：可恢复错误 Retry**
- Mock 首次 5xx，第二次成功
- 断言：
  - Retry 1 次成功
  - 结果正确

**场景 5：不可恢复错误直接失败**
- Mock 401 错误
- 断言：
  - 不 retry
  - 直接标记 error

**场景 6：导出功能**
- 完成批量任务
- 导出到目录
- 断言：
  - 每个文件一个 .md
  - index.md 存在
  - 格式正确

**验收标准**：
- 所有集成测试通过
- 覆盖核心路径

---

### 阶段 17：端到端验证

**目标**：手动测试完整流程

**测试清单**：

**功能测试**：
- [ ] 启动应用，界面正常显示
- [ ] 设置 OCR 配置，测试连接成功
- [ ] 设置 LLM 配置，测试连接成功
- [ ] 选择图片文件（JPG/PNG/PDF），显示在队列
- [ ] 选择目录，递归扫描所有图片
- [ ] 切换 faithful / enhanced 模式
- [ ] 启动批量处理
- [ ] 查看实时进度（⏳ → 🔄 → ✅）
- [ ] 点击查看详情（摘要/正文/原文）
- [ ] thoughts 折叠/展开
- [ ] 复制文本到剪贴板
- [ ] 导出 Markdown 到目录
- [ ] 查看历史记录
- [ ] 清空历史

**错误处理测试**：
- [ ] 未配置时启动任务，提示引导设置
- [ ] OCR 认证失败，显示错误
- [ ] LLM 超时，显示错误
- [ ] 单文件失败，其他继续
- [ ] 取消任务生效

**边界测试**：
- [ ] 超长文本（> 12000 字符）自动分块
- [ ] 多页 PDF 正确拼接
- [ ] 历史超 100 条自动淘汰
- [ ] 占位符检测警告显示

**性能测试**：
- [ ] 并发 3 个文件处理流畅
- [ ] 大批量（50+ 文件）不卡顿
- [ ] 内存占用合理

**验收标准**：
- 所有功能正常
- 无明显 bug
- 性能可接受

---

## 实施顺序总结

**Phase 1: 基础（1-2 天）**
- 阶段 1-2：项目搭建 + 类型定义

**Phase 2: Main 核心（3-4 天）**
- 阶段 3-7：OCR + LLM + Pipeline

**Phase 3: 存储（1-2 天）**
- 阶段 8-10：配置 + 历史 + 导出

**Phase 4: 通信（1 天）**
- 阶段 11-12：IPC + Preload

**Phase 5: UI（2-3 天）**
- 阶段 13-15：Stores + 布局 + 组件

**Phase 6: 验证（1-2 天）**
- 阶段 16-17：集成测试 + 端到端

**总工期**：10-14 个工作日（45-50 小时）

---

## 关键依赖关系

```
1 → 2 → 3,4
4 → 5,6
3,4,5,6 → 7
2 → 8 → 9
2 → 10
7,8,9,10 → 11
2,11 → 12
12 → 13
13 → 14,15
15 → 16 → 17
```

**并行机会**：
- 阶段 3,4 可并行
- 阶段 8,10 可并行（与 7 完成后）
- 阶段 14,15 部分可并行

---

## 复用策略

**从 xmuxk-auto 复用**：
- electron-vite 配置
- TypeScript 配置
- TitleBar / Sidebar / StatusBar 组件
- HashRouter 路由模式
- Zustand store 模式
- sonner Toast 集成
- electron-store 加密配置

**从 ocr2md-mcp 复用**：
- TextInClient 基础结构
- TextIn API 调用封装
- multipage 拼接逻辑
- 错误处理模式
- 批量并发思路

**新增核心模块**：
- LLM 客户端（OpenAI 兼容）
- Prompt 硬编码库（CoT + 标签）
- 占位符守卫
- 分块处理
- Pipeline 编排器
- 历史管理
- UI 详情组件

---

## 风险与应对

**风险 1：参考项目代码定位困难**
- 应对：先实现独立模块（基于设计文档），后期再整合复用代码

**风险 2：LLM Prompt 效果不理想**
- 应对：设计文档已明确 Prompt，先实现；测试阶段可微调

**风险 3：分块逻辑复杂**
- 应对：先实现简单等分，通过测试后再优化段落边界

**风险 4：历史存储文件管理复杂**
- 应对：统一用 jobId 目录，删除时递归删目录

**风险 5：UI 交互细节多**
- 应对：分阶段实现，先核心功能（列表+详情），再优化交互

---

## 测试覆盖目标

**单元测试覆盖率**：
- Main 核心模块：> 90%
- Stores：> 85%
- 工具函数：100%

**集成测试覆盖**：
- Happy path（完整流程）
- 错误路径（OCR 失败、LLM 失败、网络错误）
- 边界场景（超长文本、大批量、历史淘汰）

**手动测试覆盖**：
- 所有 UI 交互
- 设置页配置
- 导出功能
- 跨平台兼容（Windows/macOS/Linux）

---

## 交付物清单

**代码**：
- 完整源码（src/ 目录）
- 测试套件（__tests__/ 目录）
- 配置文件（package.json, tsconfig.json 等）

**文档**：
- README.md（安装、使用、开发指南）
- API 文档（IPC 通道、类型定义）
- 测试报告

**构建产物**：
- 开发版（npm run dev）
- 生产版（npm run build）
- 打包应用（electron-builder，可选）

---

## 下一步行动

完成本实施计划后，调用 `writing-plans` skill 生成更细粒度的实施任务分解。

---

## 附录：与设计文档的映射

本实施计划完全基于 `2026-06-17-ocr-app-design.md`，映射关系：

| 设计文档章节 | 实施计划阶段 |
|------------|------------|
| 3. 架构与数据流 | 阶段 1-2, 11-12 |
| 4. 模块划分与目录结构 | 阶段 1, 3-15 |
| 5. IPC 通道与核心类型 | 阶段 2, 11-12 |
| 6. 硬编码 Prompt 设计 | 阶段 4-6 |
| 7. 错误处理与边界 | 阶段 3, 7 |
| 8. 测试策略 | 阶段 16-17 |
| 9. 复用与新增清单 | 复用策略章节 |
| 2.1 补充决策 | 阶段 6（分块）, 9（历史）, 10（导出） |

---

**文档版本**：v1.0  
**最后更新**：2026-06-19  
**状态**：待审批 → 实施

