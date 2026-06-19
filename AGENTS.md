# OCR App - AI 会话交接文件

## 项目身份

- **类型**：Electron 桌面应用
- **目标**：OCR 文字识别 + LLM 结构化处理 + 批量导出
- **技术栈**：Electron 28, TypeScript 5.9, React 18, Zustand, Tailwind CSS, Vitest

## 项目静态结构

```
src/
├── main/                    # 主进程
│   ├── index.ts            # 入口点
│   ├── store.ts            # 全局配置存储
│   ├── __tests__/          # 主进程全局测试
│   ├── ocr/                # OCR 模块
│   ├── llm/                # LLM 模块
│   └── pipeline/           # 任务编排
├── preload/                # Preload 脚本
├── renderer/               # 渲染进程
└── shared/                 # 共享类型
```

## 最近操作

- **2026-06-20**: 完成 IPC 集成与类型对齐（Task 1-15 全部完成）
  - **类型契约层（Task 1-7）**：`shared/types.ts` 补 HistoryItem；重写 `history-manager.ts` 用 shared JobResult/HistoryItem + 五份落盘 + 100 条淘汰 + getJob 数据损坏返回 null，删 `history/types.ts`；重写 `markdown-exporter.ts` 用 spec 字段 structuredText/summary；修 `orchestrator.ts` 的 `assertNoPlaceholder().clean` 调用 + 新增 `getJobs()`；三模块测试改 spec 字段
  - **接线层（Task 8-14）**：新建 `ipc-handlers.ts`（12 通道 + 批量后遍历 getJobs 存 done 项到 history + 配置缺失 throw + OCR_GET_RESULT 内存优先 + EXPORT_BATCH 从历史取）；`index.ts` 注册；`useOcrStore` 去 temp ID 改 pendingFiles；`FileQueueList` 扩展 pendingFiles props（不可选中）；`App.tsx` 接线
  - **dev 验证阻塞修复**：uuid v14 纯 ESM 与 CJS 主进程不兼容（`ERR_REQUIRE_ESM`），改用 `crypto.randomUUID()`（Node 16.7+ 内置，Electron 28 支持），去掉 uuid 依赖
  - **当前状态**：230 passed / 0 failed（14 test files）；`npm run dev` 主进程启动成功，IPC 注册生效，不再报 `No handler registered for 'settings:get'`；WSL2 无 GPU 环境的 GPU/网络服务错误属环境限制，非逻辑问题
  - **已知遗留**：`App.tsx` `exportBatch('')` 传空 outputDir（导出会 mkdir 失败，需后续加目录选择 IPC）；`store.test.ts` 2 个 newStore 未用 + uuid Uint8Array tsc 噪音（运行时无影响）；worktree 残留待清理

- **2026-06-20**: Task 9 完成 — 新建 `src/main/__tests__/ipc-handlers.test.ts`（26 tests）
  - Mock 策略：顶层 `vi.mock` + `vi.hoisted`（解决 `mockHandle`/`mockSend`/`historyInstance` 在 hoisted 工厂中引用的 TDZ 问题）
  - HistoryManager mock 用单例对象（`vi.fn(() => historyInstance)`）绕过 `registerIpcHandlers` 内 `if (!historyManager)` 守卫；`beforeEach` 重置单例方法实现
  - Orchestrator / TextInClient / LlmClient mock 用 `vi.mocked().mockImplementation` 按测试配置
  - 覆盖 8 个通道关键行为：SETTINGS_GET/SET、TEST_OCR/LLM（缺键 + 成功 + throw）、OCR_START_BATCH（配置缺失 throw、批量后存 done 项到 saveResult、send ON_BATCH_DONE、全 error 不存、rejection 传播）、OCR_GET_RESULT（内存/历史/null）、EXPORT_BATCH（无结果/有结果/过滤 null/throw/0 success）、HISTORY_LIST/GET/CLEAR、OCR_CANCEL
  - 当前状态：220 passed / 0 failed（13 test files，WSL 终端验证）

- **2026-06-19**: 系统性修复测试基础设施（第三轮修正）
  - **orchestrator.test.ts**：`beforeEach` 加 `vi.mocked(uuid.v4).mockReturnValue('mock-uuid-1234')`，解决 `clearAllMocks` 后上一测试的 `mockImplementation` 覆盖残留导致后续测试 `uuidv4()` 返回错误值、`getResult('mock-uuid-1234')` 找不到（3 个失败）
  - **llm-client / textin-client 4 个超时测试**：unhandled rejection 根因是 fake timers 时序竞争——`advanceTimersByTimeAsync` 触发 abort → 源码 throw timeout → callLlm promise reject，但此时测试尚未 await 该 promise，微任务窗内 unhandled。修复：`const promise = ...; promise.catch(() => {})` 预标记 handled，原 promise 引用保留给 `expect(promise).rejects.toThrow(...)`。`mockFetchHanging` 简化回 `return p`
  - **当前状态**：191 passed / 0 failed，4 个 unhandled rejection 已修复，需在 WSL 终端验证

- **2026-06-19**: 系统性修复测试基础设施（第二轮修正）
  - **store.test.ts**：`import electronStore` 在 vitest 下 default export 直解，`(electronStore as any).default` → `electronStore as any`
  - **orchestrator.test.ts**：`vi.mock('uuid', { v4: () => '...' })` 工厂返回普通函数 → `vi.fn(() => '...')`，使 `vi.mocked().mockImplementation()` 可用
  - **markdown-exporter.test.ts**：预存断言 bug `toHaveBeenCalledTimes(3)` → `4`（3 个文件 write 尝试 + 1 次 index.md）
  - **llm-client / textin-client timeout 测试**：`mockFetchHanging` 加 `p.catch(() => {})` 抑制 unhandled rejection 警告
  - **当前状态**：5 failed + 4 errors → 预期 0+0，需在 WSL 原生终端验证 `npm test -- --run`

- **2026-06-19**: 系统性修复测试基础设施（第一轮）

- **2026-06-19**: 完成 Phase 6 (Renderer 层)
  - 阶段 13: Zustand 状态管理（useOcrStore、useSettingsStore）
  - 阶段 14: 核心组件（FileQueueList、ResultDetail、ConfigDialog）
  - 阶段 15: 主界面集成（App.tsx 完整布局）

- **2026-06-19**: 完成 Phase 5 (IPC 与 Preload)
  - 阶段 11: IPC Handlers（Main 进程实现所有 IPC 通道，连接业务逻辑）
  - 阶段 12: Preload API（contextBridge 暴露类型安全 API）

## 进行中

IPC 集成与类型对齐已全部完成（Task 1-15）。`master` 分支当前在 `ae74927`。

## 下一步

**立即**：
1. 真实 API 联调：在 WSL 原生终端 `npm run dev`，配置真实 TextIn + LLM 凭证，跑通选文件→OCR→结构化→摘要→导出→历史全链路
2. 修复 `App.tsx` `exportBatch('')` 空 outputDir 问题（加目录选择 IPC 或让用户输入路径）
3. 清理 `store.test.ts` 的 newStore 未用变量 + uuid Uint8Array tsc 噪音
4. 清理 `.claude/worktrees/busy-wilbur-4a6988` 残留 worktree

**后续**：
- Phase 7：集成测试（happy path）+ 用户文档
- 可选：移除 `uuid` 依赖（已改用 crypto.randomUUID，package.json 的 uuid 可删，但需确认无其他引用）

## 关键发现

### 技术决策
1. **vitest workspace 配置隔离**：`vitest.config.ts` 与 `vitest.workspace.ts` 共存时，workspace 项目不继承 `vitest.config.ts` 的 `globals: true` 等设置。解决方案：删除 `vitest.config.ts`，所有配置统一写入 `vitest.workspace.ts` 各 project 的 `test` 选项。
2. **ESM mock 陷阱**：`require('uuid').v4 = ...` 在 uuid v14+ (纯 ESM) 下失效，ESM namespace exports 为只读。必须用 `vi.mock('uuid', () => ({ v4: vi.fn() }))` + `vi.mocked(uuid.v4).mockImplementation(...)`。
3. **纯 type 的值访问**：`export type JobStage = 'done' | 'error' | ...` 在运行时被擦除，`JobStage.DONE` → `undefined`。测试中的字面量类型必须直接用字符串值。
4. **fake timers + fetch mock**：`vi.useFakeTimers()` 不拦截 AbortController，但 mock fetch 必须监听 `init.signal`，abort 时 reject AbortError——否则 `setTimeout → controller.abort()` 触发后 fetch promise 永久 hanging。
5. **vi.mock hoisting + 共享 mock 对象**：`vi.mock` 工厂被 hoist 到文件顶部，工厂内不能引用未初始化的 `const`/`let`（TDZ）。共享 mock 对象（如 `mockHandle`、`historyInstance`）需用 `vi.hoisted(() => ({ ... }))` 声明，使其在 hoisted 工厂执行前可用。
6. **单例守卫绕过**：`registerIpcHandlers` 内 `if (!historyManager) historyManager = new HistoryManager(...)` 守卫使重复调用不重建实例。测试若需重置 mock 实现，不能靠重 `new`，应让 mock 工厂返回固定单例对象，`beforeEach` 重置单例方法。
7. **uuid v14 纯 ESM 与 CJS 主进程不兼容**：`electron-vite` 把 main 进程打成 CJS（package.json type: commonjs），`import { v4 } from 'uuid'` 编译成 `require('uuid')`，uuid v14 是纯 ESM (`"type": "module"`) 触发 `ERR_REQUIRE_ESM` 崩溃。解决：改用 Node 内置 `crypto.randomUUID()`（16.7+，Electron 28 的 Node 18 支持），去掉 uuid 依赖。测试 mock 改 `vi.mock('crypto', () => ({ randomUUID: vi.fn() }))`。
8. **Windows 端 npm 不可靠**：WSL2 项目通过 UNC 路径 `\\wsl.localhost\...` 访问时，Windows 端 npm install 会因 `.bin` 符号链接是目录而 `EISDIR` 崩溃，可能损坏 node_modules。npm/install 操作必须在 WSL 原生终端（Linux 路径）跑。
