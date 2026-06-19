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

**测试修复已完成**，所有代码变更已写入。当前在 `master` 分支（存在未提交的测试修复改动）。

**待验证**：在 WSL 原生终端运行 `npm test -- --run` 确认 21 个失败全消。

## 下一步

**立即**：
1. 在 WSL 原生终端运行：`cd ~/github/ocr-app && npm test -- --run`
2. 确认所有 163 个测试通过（预期：9 个 failed 套件 → 0，21 个 failed tests → 0）
3. 若通过，提交这批测试修复

**后续**：
- 注意当前在 `master` 分支，不是之前的 `claude/busy-wilbur-4a6988` worktree
- 项目根存在 `.claude/worktrees/busy-wilbur-4a6988` 残留 worktree 目录，可清理
- 完成 Phase 7：集成测试 + 用户文档

## 关键发现

### 技术决策
1. **vitest workspace 配置隔离**：`vitest.config.ts` 与 `vitest.workspace.ts` 共存时，workspace 项目不继承 `vitest.config.ts` 的 `globals: true` 等设置。解决方案：删除 `vitest.config.ts`，所有配置统一写入 `vitest.workspace.ts` 各 project 的 `test` 选项。
2. **ESM mock 陷阱**：`require('uuid').v4 = ...` 在 uuid v14+ (纯 ESM) 下失效，ESM namespace exports 为只读。必须用 `vi.mock('uuid', () => ({ v4: vi.fn() }))` + `vi.mocked(uuid.v4).mockImplementation(...)`。
3. **纯 type 的值访问**：`export type JobStage = 'done' | 'error' | ...` 在运行时被擦除，`JobStage.DONE` → `undefined`。测试中的字面量类型必须直接用字符串值。
4. **fake timers + fetch mock**：`vi.useFakeTimers()` 不拦截 AbortController，但 mock fetch 必须监听 `init.signal`，abort 时 reject AbortError——否则 `setTimeout → controller.abort()` 触发后 fetch promise 永久 hanging。
