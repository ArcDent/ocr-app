# ocr-app IPC 集成与类型对齐设计

> 日期：2026-06-19
> 类型：设计文档（brainstorming 产物）
> 状态：待写实施计划
> 上游契约：[2026-06-17-ocr-app-design.md](./2026-06-17-ocr-app-design.md)（权威 spec）

## 1. 背景与问题

`npm run dev` 启动后报 `No handler registered for 'settings:get'`。排查发现这不是单点接线遗漏，而是上会话的"幽灵实现"暴露的系统性问题：

### 1.1 证据链

1. `src/main/index.ts` 只 `createWindow()`，从未调用任何 IPC 注册函数，也未 import IPC 模块。
2. `git ls-tree master src/main/` 确认 master 分支**没有 `ipc-handlers.ts`** 文件。
3. `docs/TASK_11_12_COMPLETE.md` 与 AGENTS.md 声称"Phase 5 IPC Handlers 已完成"——文档与代码不符。
4. worktree 工作目录里残留一个未提交的 `ipc-handlers.ts`，但基于旧 API（`configStore.updateSettings`、`settings.ocr`、`settings.app.concurrency`），与 master 当前 API（`setSettings`、`settings.textin`、`settings.concurrency`）不兼容，不能直接用。

### 1.2 代码库内部类型割裂

以 `shared/types.ts`（符合上游 spec）为基准，主进程三个模块偏离了契约：

| 模块 | 偏离 |
|------|------|
| `history/history-manager.ts` + `history/types.ts` | 自造 `JobResult`（`rawOutput`/`structuredOutput`/`summaryOutput`/`fileSize`/`timestamp`/`status`）与 `HistoryItem`（`fileSize`/`status`/`hasRawOutput` 等），与 shared 的 JobResult 完全不同 |
| `export/markdown-exporter.ts` | 用 `result.content`/`result.summary`，`content` 在 shared JobResult 中不存在（应为 `structuredText`） |
| `pipeline/orchestrator.ts:110` | `!assertNoPlaceholder(text)` 把返回对象 `{clean, hits}` 当布尔用，`!{...}` 恒为 `false`，导致 `hasPlaceholderWarning` 永远 false |

renderer 侧 stores（`useSettingsStore`/`useOcrStore`）已正确使用 shared 类型，是契约符合方。

### 1.3 renderer job ID 契约隐患

`useOcrStore.pickFiles` 自行生成 `temp_<ts>_<rand>` ID，靠 `handleJobProgress` 按 `filePath` 匹配替换为 backend 的 uuid。同路径重复文件会错乱，且 temp 残留。

## 2. 目标

1. 全量对齐 2026-06-17 spec：history、export、orchestrator 三模块统一用 `shared/types.ts` 契约。
2. 新建 `src/main/ipc-handlers.ts`，实现全部 IPC 通道，并在 `index.ts` 注册。
3. backend 统一发放 job ID，消除 renderer temp ID 机制。
4. `npm run dev` 启动后设置弹窗可用、批量处理端到端跑通、导出与历史可用。
5. 全部单测通过，无 unhandled rejection。

## 3. 决策汇总

| # | 议题 | 决策 |
|---|------|------|
| 1 | 对齐程度 | 全量对齐 spec 并接通 IPC |
| 2 | history-manager 处理 | 按 spec 重写，删自造类型，用 shared JobResult |
| 3 | 历史保存时机 | ipc 层批量结束后存历史，orchestrator 不依赖 historyManager |
| 4 | job ID 契约 | backend 统一发 ID（uuid），去掉 renderer temp ID |
| 5 | 导出来源 | EXPORT_BATCH 从 historyManager.getJob 取结果 |
| 6 | markdown-exporter 修复 | 字段 + 逻辑全按 spec 重写 |
| 7 | 实施切分 | 方案 C 混合切：类型层先对齐（单测验证），再接线层（dev 端到端验证） |

## 4. 类型契约层对齐

以 `shared/types.ts` 为权威契约源。该文件已符合上游 spec，本层不改它，只对齐偏离模块。

### 4.1 `shared/types.ts` 补充 HistoryItem

上游 spec §2.1#2 定义了历史存储方式但 `shared/types.ts` 当前缺 `HistoryItem`。新增（与 spec 一致）：

```ts
export interface HistoryItem {
  jobId: string
  fileName: string
  mode: ProcessMode
  hasPlaceholderWarning: boolean
  createdAt: number
  rawTextPath: string
  structuredTextPath: string
  structuredThoughtsPath?: string
  summaryPath: string
  summaryThoughtsPath?: string
}
```

`JobResult`、`OcrJob`、`AppSettings`、`ProcessMode`、`JobStage`、`IPC_CHANNELS`、`IpcRequest`、`IpcResponse`、`IpcEvents` 均已存在且符合 spec，不改。

### 4.2 `history/types.ts` 删除

删除整个 `src/main/history/types.ts`（自造 `JobResult` 与 `HistoryItem`）。`history-manager.ts` 改为从 `../../shared/types` 导入 `JobResult` 与 `HistoryItem`。

### 4.3 `history/history-manager.ts` 按 spec 重写

构造与存储：
- `constructor(userDataPath: string)`：`ocrResultsDir = path.join(userDataPath, 'ocr-results')`；electron-store 实例 `name: 'ocr-history'`，`defaults: { history: [] }`。
- `MAX_HISTORY_ITEMS = 100`（spec §2.1#3）。

`HistoryItem` 的路径字段存**绝对路径**（`path.join(ocrResultsDir, jobId, 'raw.txt')` 等）。理由：本应用为桌面单机，userData 路径在生命周期内稳定，绝对路径实现简单、读取无需拼接基准目录。

`saveResult(result: JobResult): Promise<void>`：
- 建 `{ocrResultsDir}/{jobId}/` 目录。
- 落盘五份文件（仅在对应字段非空时）：
  - `raw.txt` ← `result.rawText`，索引 `rawTextPath`（绝对路径）
  - `structured.md` ← `result.structuredText`，索引 `structuredTextPath`
  - `structured-thoughts.txt` ← `result.structuredThoughts`（可选），索引 `structuredThoughtsPath`
  - `summary.md` ← `result.summary`，索引 `summaryPath`
  - `summary-thoughts.txt` ← `result.summaryThoughts`（可选），索引 `summaryThoughtsPath`
- 构造 `HistoryItem`（含上述路径索引 + `jobId`/`fileName`/`mode`/`hasPlaceholderWarning`/`createdAt`），写入 store 的 `history` 数组。同 jobId 则覆盖。
- 按 `createdAt` 降序排序；超 100 条则淘汰最旧并 `fs.rm` 对应 `{jobId}` 目录。

`listHistory(): HistoryItem[]`：从 store 读 `history`，按 `createdAt` 降序返回。

`getJob(jobId: string): Promise<JobResult | null>`：
- 从 store 找 `HistoryItem`；未找到返回 `null`。
- 按 `HistoryItem` 的路径索引从盘读取五份内容，拼装 `JobResult`。
- **数据完整性边界**：`rawText`/`structuredText`/`summary` 是必填字段。若其中任一对应文件读取失败（ENOENT 或读出空），视为数据损坏，`getJob` 返回 `null`（不返回半空 JobResult，避免 UI 展示残缺详情）。`structuredThoughts`/`summaryThoughts` 为可选，读取失败置 `undefined`。
- `mode`/`hasPlaceholderWarning`/`createdAt`/`jobId`/`fileName` 从 `HistoryItem` 取（这些不依赖落盘文件）。

`clearHistory(): Promise<void>`：store `history` 置空，`fs.rm(ocrResultsDir, {recursive, force})`。

### 4.4 `export/markdown-exporter.ts` 按 spec 重写

`exportBatch(results: JobResult[], outputDir: string): Promise<{ success: number; failed: number }>`：

- `fs.mkdir(outputDir, { recursive: true })`，失败抛 `Failed to create output directory`。
- 遍历 results：
  - 跳过无效项：`!result.jobId` 或 `!result.structuredText?.trim()` 或 `!result.summary?.trim()` → `failed++`，continue。
  - 基础文件名：`result.fileName || 'job-{jobId}'`，去扩展名，加 `.md`。冲突时追加 `-1`/`-2` 计数（用 `fs.access` 探测）。
  - 文件内容：`# {baseName}\n\n## 摘要\n{result.summary}\n\n## 正文\n{result.structuredText}\n`。
  - `fs.writeFile` 写入；单文件失败 `console.error` + `failed++`，继续。
  - 成功项记入 `generatedFiles: {name, summary, relativePath}[]`，`success++`。
- `success > 0` 时生成 `index.md`：`# OCR 批量导出 - {YYYY-MM-DD}\n\n` + 每项 `- [{name}]({relativePath}): {summary 首行}\n`。index 失败 `console.error`，不计 failed。
- 返回 `{ success, failed }`。

字段映射关键点：`result.content` → `result.structuredText`，`result.summary` 不变。测试 `createMockResult` 改用 spec 字段（`rawText`/`structuredText`/`summary`/`mode`/`createdAt`/`hasPlaceholderWarning`/`jobId`/`fileName`）。

### 4.5 `pipeline/orchestrator.ts` 修 assertNoPlaceholder 调用

第 110 行：
```ts
// 改前
const hasPlaceholderWarning = !assertNoPlaceholder(structuredResult.text)
// 改后
const hasPlaceholderWarning = !assertNoPlaceholder(structuredResult.text).clean
```

`placeholder-guard.ts` 返回 `{clean, hits}` 符合 spec，不改。orchestrator 其余逻辑（并发、retry、取消、分块）符合 spec，不改。

orchestrator 保持纯净：不注入 historyManager，不调存历史。结果只放内存 `this.results` Map，`getResult(jobId)` 返回内存结果或 undefined。

### 4.6 类型层验证

类型层改完后，现有单测需同步更新：
- `history-manager.test.ts`：mock 数据改用 spec JobResult 字段；`getJob` 断言读回的 `rawText`/`structuredText` 等。
- `markdown-exporter.test.ts`：`createMockResult` 改 spec 字段；导出内容断言 `structuredText` 注入 `## 正文`。
- `orchestrator.test.ts`：`should detect placeholders` 用真实 `assertNoPlaceholder`（不 mock），断言含占位符文本时 `hasPlaceholderWarning === true`。

这批单测应全绿，证明类型对齐不回归。

## 5. 接线层：IPC handler 与 index 注册

### 5.1 `src/main/ipc-handlers.ts` 新建

模块级单例：
```ts
let historyManager: HistoryManager | null = null
let currentOrchestrator: Orchestrator | null = null
```

`registerIpcHandlers()` 开头**先初始化** `historyManager = new HistoryManager(app.getPath('userData'))`，保证所有 handler 调用时 historyManager 已就绪（`EXPORT_BATCH` 等可直接 `historyManager!` 或安全 `historyManager?`）。`currentOrchestrator` 每次批量开始时赋值、结束时置 null。

各通道：

**SETTINGS_GET**：返回 `configStore.getSettings()`。

**SETTINGS_SET**：`configStore.setSettings(data)`（data 为 `AppSettings`）。

**SETTINGS_TEST_OCR**：
- 读 settings；`!settings.textin.appId || !settings.textin.secretCode` → `{success:false, message:'OCR API keys not configured'}`。
- `new TextInClient(settings.textin).testConnection()`，返回其结果；catch 转 `{success:false, message}`。

**SETTINGS_TEST_LLM**：
- 读 settings；`!settings.llm.apiKey` → `{success:false, message:'LLM API key not configured'}`。
- `new LlmClient(settings.llm).testConnection()`，返回其结果；catch 转 `{success:false, message}`。

**OCR_PICK_FILES**：入参 `{type: 'files'|'directory'}`。
- `type==='directory'` → `dialog.showOpenDialog({properties:['openDirectory']})`。
- `type==='files'` → `dialog.showOpenDialog({properties:['openFile','multiSelections'], filters:[{name:'Images & PDFs', extensions:['jpg','jpeg','png','pdf']}]})`。
- `canceled` 返回 `[]`，否则返回 `filePaths`。
- **不在此处生成 jobId**——jobId 由 orchestrator 在 startBatch 时生成。

**OCR_START_BATCH**：入参 `{paths, mode}`。这是 backend 统一发 ID 的关键通道。
- 读 settings；校验必填项：`settings.textin.appId`、`settings.textin.secretCode`、`settings.llm.apiKey`、`settings.llm.model`、`settings.llm.baseUrl` 均非空。**任一缺失则 `throw new Error('配置缺失：{具体字段}，请先在设置中填写')`**，让 `ipcRenderer.invoke` reject，renderer catch 后 toast 提示去设置（区分于"全部 OCR 失败"的 ON_BATCH_DONE 路径）。不 emit ON_BATCH_DONE，不创建 orchestrator。
- 校验通过：`new TextInClient(settings.textin)`、`new LlmClient(settings.llm)`，`new Orchestrator(textin, llm, {concurrency: settings.concurrency, chunkThreshold: settings.chunkThreshold})`，赋给 `currentOrchestrator`。
- **关键**：orchestrator 在 `startBatch` 内为每个 path 生成 uuid 后立即 emit `ON_JOB_PROGRESS({stage:'queued'})`（见 §5.2）。renderer 据此建 job，无需 temp ID。
- `onProgress = (job) => event.sender.send(ON_JOB_PROGRESS, job)`。
- `const stats = await currentOrchestrator.startBatch(paths, mode, onProgress)`。
- **批量结束后存历史**：需要 jobId↔结果映射。orchestrator 暴露 `getJobStatus(jobId): OcrJob | undefined`（已有）和 `getResult(jobId): JobResult | undefined`（已有）。但 ipc handler 不知道哪些 jobId 属于本批。**解决方案**：orchestrator 新增 `getJobs(): OcrJob[]` 方法（返回当前批所有 job 的快照），ipc handler 遍历 `currentOrchestrator.getJobs()`，对 `job.stage==='done'` 的项调 `currentOrchestrator.getResult(job.jobId)` 拿 JobResult，再 `await historyManager.saveResult(result)`。`stage==='error'` 的不存历史。
- `event.sender.send(ON_BATCH_DONE, stats)`。
- `finally { currentOrchestrator = null }`。

**OCR_CANCEL**：`currentOrchestrator?.cancel()`。

**OCR_GET_RESULT**：入参 `{jobId}`。
- 先 `currentOrchestrator?.getResult(jobId)`（当前批内存，可能未入历史）。
- 未找到则 `await historyManager?.getJob(jobId)`（历史落盘）。
- 返回 `JobResult | null`。

**EXPORT_BATCH**：入参 `{jobIds, outputDir}`。
- `Promise.all(jobIds.map(id => historyManager!.getJob(id)))`，过滤非 null。
- `validResults.length === 0` → `{success:false, exportedCount:0}`。
- `const { success } = await exportBatch(validResults, outputDir)`；返回 `{success: success>0, exportedCount: success}`。
- catch 返回 `{success:false, exportedCount:0}`。

**HISTORY_LIST**：`historyManager?.listHistory() || []`。

**HISTORY_GET**：入参 `{jobId}`。`await historyManager?.getJob(jobId) || null`。

**HISTORY_CLEAR**：`await historyManager?.clearHistory()`。

### 5.2 orchestrator 改动

orchestrator 的 ID 生成（`uuidv4()`）和 emit queued 循环（当前第 30-46 行）**已符合** backend 统一发 ID 的要求，无需改动该逻辑。

唯一新增：暴露 `getJobs(): OcrJob[]` 方法，返回 `Array.from(this.jobs.values())`，供 ipc handler 在批量结束后遍历取 jobId 存历史。这是纯只读访问，不破坏 orchestrator 封装。

`placeholder-guard` 调用修复见 §4.5（`!assertNoPlaceholder(text).clean`），属类型层。

### 5.3 `src/main/index.ts` 注册

```ts
import { registerIpcHandlers } from './ipc-handlers'
// ...
app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
})
```

### 5.4 renderer `useOcrStore` 去 temp ID

`pickFiles`：调用 `OCR_PICK_FILES` 拿到 paths 后，**不**生成 temp job，只把 paths 转成 `pendingFiles: {path: string, fileName: string}[]`（新增字段，fileName 从 path 提取供 UI 展示）追加到 store。

`startBatch`：发送 `{paths: pendingFiles.map(f => f.path), mode}`，清空 `pendingFiles`，`set({isProcessing: true})`。**不**预建 job——job 由后续 `ON_JOB_PROGRESS(queued)` 事件建。

`handleJobProgress`：收到 job 后直接 `newJobs[job.jobId] = job`，**删除** temp ID 按 filePath 匹配替换的逻辑（第 163-170 行）。

store 初始化：`jobs: {}`、`pendingFiles: []`。`clearJobs` 同时清 `pendingFiles`。`pendingFiles` 是纯展示态，不进 orchestrator。

### 5.5 接线层验证

`npm run dev` 启动后：
- 设置弹窗打开 → `SETTINGS_GET` 返回默认配置 → 各字段填充。
- 填写并保存 → `SETTINGS_SET` 写入 → 重新 `SETTINGS_GET` 一致。
- 测试连接按钮 → `SETTINGS_TEST_OCR`/`SETTINGS_TEST_LLM` 返回结果 toast。
- 选文件 → `OCR_PICK_FILES` 返回 paths → UI 展示待处理列表。
- 开始批量 → `OCR_START_BATCH` → 收到 `ON_JOB_PROGRESS(queued)`×N → 队列建立 → 各 stage 推进 → `ON_BATCH_DONE`。
- 点结果详情 → `OCR_GET_RESULT` 返回 JobResult → 展示。
- 导出 → `EXPORT_BATCH` → 落盘 .md + index.md。
- 历史页 → `HISTORY_LIST` → 列表；点条目 `HISTORY_GET` → 详情。

## 6. renderer 待处理文件展示（去 temp ID 后）

`pickFiles` 不再建 job，UI 需要展示已选但未开始的文件。方案：

- `useOcrStore` 新增 `pendingFiles: {path: string, fileName: string}[]`（pickFiles 时填充，startBatch 时清空）。
- `FileQueueList` 扩展 props，新增 `pendingFiles`。渲染两类条目：
  - `pendingFiles` 项：显示文件名 + "待处理"标记，**无 jobId，不可点击选中**（`onSelectJob` 不触发，因为没有结果详情可看）。仅作选文件后的可视化反馈。
  - `jobs` 项：有 jobId，按 stage 显示图标，可点击选中查看详情。
- `startBatch` 后 `pendingFiles` 清空，`jobs` 由 `ON_JOB_PROGRESS` 填充，列表无缝切换为 backend 驱动状态。
- `clearJobs` 同时清 `pendingFiles` 和 `jobs`。

这保证选文件后用户立即看到列表，开始处理后切换为 backend 驱动的 job 状态，且消除 temp ID 替换的竞态。

## 7. 错误处理

| 场景 | 处理 |
|------|------|
| `OCR_START_BATCH` 配置缺失 | `throw new Error('配置缺失：{字段}，请先在设置中填写')`，`ipcRenderer.invoke` reject，renderer catch 后 toast 提示去设置；不创建 orchestrator、不 emit ON_BATCH_DONE（与"全部 job 失败"的 done 路径区分） |
| OCR/LLM 调用失败 | orchestrator 内部 retry 1 次（可恢复错误），仍失败标 `stage:'error'`+error 文案，单 job 隔离不影响整批（已有逻辑） |
| `OCR_GET_RESULT` 内存与历史都无 | 返回 `null`，renderer 显示空详情 |
| `EXPORT_BATCH` 无有效结果 | 返回 `{success:false, exportedCount:0}`，renderer toast |
| `historyManager.saveResult` 落盘失败 | `console.error`，不阻塞批量完成事件（历史保存失败不应让整批看起来失败）；该 job 不入历史但不影响 stats |
| `historyManager.getJob` 数据损坏 | 返回 `null`（见 §4.3），UI 显示空详情 |
| ipc handler 内未捕获异常 | 各 handler try/catch；invoke 类 handler 返回安全默认值或 rethrow 让 ipcRenderer.invoke reject（renderer catch 后 toast）；event 类（ON_*）send 靠 orchestrator 内部已处理 |

## 8. 测试策略

### 8.1 类型层单测更新（TDD 先行）

- `history-manager.test.ts`：重写——saveResult 落盘五份、listHistory 排序、getJob 读回拼装、clearHistory、超 100 条淘汰+删盘。mock fs + electron-store。
- `markdown-exporter.test.ts`：createMockResult 改 spec 字段；断言 `## 摘要`/`## 正文` 内容来自 `structuredText`/`summary`；index.md 格式；冲突计数；单文件失败继续。
- `orchestrator.test.ts`：`should detect placeholders` 用真实 assertNoPlaceholder，断言含 `[待补充]` 文本 → `hasPlaceholderWarning === true`，正常文本 → `false`。

### 8.2 接线层测试

- `ipc-handlers.test.ts` 新建：mock electron `ipcMain`/`dialog`/`app`，mock configStore/Orchestrator/HistoryManager/exportBatch。逐通道断言：handler 注册、入参转发、返回值、事件 emit。重点测 `OCR_START_BATCH` 批量结束后调 `historyManager.saveResult`、`OCR_GET_RESULT` 先内存后历史、`EXPORT_BATCH` 从历史取。
- `index.ts` 不单测（Electron 入口），靠 dev 验证。

### 8.3 renderer store 测试新建

当前 renderer 仅有 `FileQueueList.test.tsx`/`ResultDetail.test.tsx` 组件测试，**无 `useOcrStore` 单测**。本轮新建 `src/renderer/src/__tests__/stores/useOcrStore.test.ts`：mock `window.api`，测 `pickFiles` 填 `pendingFiles` 且不建 job、`handleJobProgress` 按 jobId 直接建 job（验证 temp 替换逻辑已删除）、`startBatch` 发 paths 并清 `pendingFiles`。

### 8.4 集成验证

`npm run dev` 端到端走通 §5.5 全部路径。`npm test -- --run` 全绿，0 unhandled rejection。

## 9. 实施切分（方案 C）

### 阶段 1：类型契约层对齐（单测验证）

1. `shared/types.ts` 补 `HistoryItem`。
2. 删 `history/types.ts`；重写 `history-manager.ts` 用 shared 类型 + spec 落盘逻辑。
3. 重写 `markdown-exporter.ts` 用 spec 字段。
4. 修 `orchestrator.ts` 的 `assertNoPlaceholder().clean`。
5. 更新三模块单测为 spec 字段；跑 `npm test -- --run` 确认类型层不回归。

### 阶段 2：接线层（dev 端到端验证）

6. orchestrator 新增 `getJobs(): OcrJob[]` 只读方法。
7. 新建 `ipc-handlers.ts`，实现全部通道 + 批量后存历史（遍历 `getJobs()` 存 done 项）。
8. `index.ts` 调 `registerIpcHandlers()`。
9. `useOcrStore` 去 temp ID，加 `pendingFiles`；`FileQueueList` 扩展 props 加 `pendingFiles` 并渲染两类条目（pendingFiles 不可选中）。
10. 新建 `ipc-handlers.test.ts` 与 `useOcrStore.test.ts`；更新 `FileQueueList.test.tsx` 适配新 props。
11. `npm run dev` 走通 §5.5；`npm test -- --run` 全绿。

## 10. 不做（YAGNI）

- 不改 `placeholder-guard.ts`、`llm-client.ts`、`prompts.ts`、`chunking.ts`、`textin-client.ts`（已符合 spec）。
- 不改 `shared/types.ts` 已有类型（只补 `HistoryItem`）。
- 不实现 `useHistoryStore`（spec 提及但本轮历史页靠 `HISTORY_LIST`/`HISTORY_GET` 通道，store 可后续；若 renderer 现有历史 UI 直接调 IPC 也可）。
- 不做 Electron 打包/窗口样式调整。
- 不做真实 TextIn/LLM 网络调用测试（全 mock）。
- 不清理 worktree 残留文件（另议）。
