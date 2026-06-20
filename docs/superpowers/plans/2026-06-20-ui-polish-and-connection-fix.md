# UI 优化与连接测试修复 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复测试连接永远失败的 bug、导出错误提示改造为 sonner toast 分色提示，并完成 4 项 UI 优化（标题精简、移除菜单栏、macOS 叠加式滚动条、配置卡片打开动效+圆角）。

**Architecture:** 改动集中在渲染层（App/ConfigDialog/ResultDetail/FileQueueList/index.css/main.tsx）、主进程菜单（main/index.ts）、IPC 契约扩展（shared/types.ts）、导出 handler（ipc-handlers.ts）、两个 store。不引入新依赖（sonner 已在 deps）。遵循项目 CLAUDE.md 已知坑点：Tailwind/PostCSS 配置不删、双端同步、主进程不引入纯 ESM 包。

**Tech Stack:** Electron 28、TypeScript 5.9、React 18、Zustand、Tailwind CSS 3、sonner、Vitest、electron-vite、electron-builder。

**Spec:** `docs/superpowers/specs/2026-06-20-ui-polish-and-connection-fix.md`

**执行环境约定：**
- 源码改在 WSL 端 `\\wsl.localhost\ubuntu\home\arcdent\github\ocr-app`（git 源）
- typecheck/test/build/electron-builder 在 Windows 端原生路径 `C:\Users\yanga\Projects\ocr-app` 执行（坑点 4：UNC 路径不能 npm install）
- WSL 端可用 `wsl -e bash -c "cd /home/arcdent/github/ocr-app && node node_modules/vitest/vitest.mjs run <path>"` 跑单测
- 每个涉及源码的任务完成后，用 PowerShell `Copy-Item` 同步触及文件到 Windows 端（坑点 3）

---

## 文件结构

| 文件 | 责任 | 操作 |
|------|------|------|
| `src/shared/types.ts` | IPC 契约类型，扩展 EXPORT_BATCH 响应 | 修改 |
| `src/main/ipc-handlers.ts` | EXPORT_BATCH handler 返回四字段 | 修改 |
| `src/main/index.ts` | 移除应用菜单栏 | 修改 |
| `src/renderer/src/stores/useSettingsStore.ts` | 测试连接先保存再测试 | 修改 |
| `src/renderer/src/stores/useOcrStore.ts` | exportBatch 返回四字段 | 修改 |
| `src/renderer/src/hooks/useScrollOverlay.ts` | 滚动叠加式 hook | 新建 |
| `src/renderer/src/index.css` | 滚动条样式 | 修改 |
| `src/renderer/src/main.tsx` | 挂载 sonner Toaster | 修改 |
| `src/renderer/src/App.tsx` | 删标题、handleExport 改 toast | 修改 |
| `src/renderer/src/components/ConfigDialog.tsx` | 动效+圆角+滚动 hook+测试传参 | 修改 |
| `src/renderer/src/components/FileQueueList.tsx` | 挂滚动 hook | 修改 |
| `src/renderer/src/components/ResultDetail.tsx` | 挂滚动 hook | 修改 |
| `tailwind.config.js` | 新增 keyframes/animation | 修改 |
| `src/main/__tests__/ipc-handlers.test.ts` | 更新导出断言 | 修改 |
| `src/renderer/src/__tests__/stores/useSettingsStore.test.ts` | 新建测试 | 新建 |
| `src/renderer/src/__tests__/stores/useOcrStore.test.ts` | 更新导出断言 | 修改 |
| `src/renderer/src/__tests__/hooks/useScrollOverlay.test.ts` | 新建 hook 测试 | 新建 |

**任务依赖**：Task 1（IPC 契约）→ Task 2（导出 handler）→ Task 3（store）为一条链；Task 4-9 相互独立可并行；Task 10（构建）依赖全部完成。

---

## Task 1: 扩展 EXPORT_BATCH IPC 契约

**Files:**
- Modify: `src/shared/types.ts:138`

- [ ] **Step 1: 修改 IpcResponse 的 EXPORT_BATCH 类型**

打开 `src/shared/types.ts`，找到第 138 行：

```typescript
[IPC_CHANNELS.EXPORT_BATCH]: { success: boolean; exportedCount: number }
```

替换为：

```typescript
[IPC_CHANNELS.EXPORT_BATCH]: {
  success: boolean
  exportedCount: number
  failedCount: number
  error?: string
}
```

- [ ] **Step 2: 验证 typecheck 暴露下游错误**

Run (Windows 端): `npm run typecheck`
Expected: 出现新的类型错误，集中在 `ipc-handlers.ts`（EXPORT_BATCH 返回旧结构）和 `useOcrStore.ts`（exportBatch 返回旧结构）。这些将在 Task 2、3 修复。记录错误数量作为基线。

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "refactor: extend EXPORT_BATCH ipc response with failedCount and error"
```

---

## Task 2: 修复 EXPORT_BATCH handler 返回真实统计

**Files:**
- Modify: `src/main/ipc-handlers.ts:166-183`
- Test: `src/main/__tests__/ipc-handlers.test.ts:404-491`

- [ ] **Step 1: 更新已有 5 个导出测试断言**

打开 `src/main/__tests__/ipc-handlers.test.ts`，找到 `describe('EXPORT_BATCH', () => {`（第 405 行）。

将 `it('returns failure when no valid results')`（第 406 行）的断言：

```typescript
expect(result).toEqual({ success: false, exportedCount: 0 })
```

改为：

```typescript
expect(result).toEqual({ success: false, exportedCount: 0, failedCount: 0, error: '没有可导出的结果' })
```

将 `it('calls exportBatch with results from history')`（第 416 行）的断言：

```typescript
expect(result).toEqual({ success: true, exportedCount: 1 })
```

改为：

```typescript
expect(result).toEqual({ success: true, exportedCount: 1, failedCount: 0 })
```

将 `it('filters out null results before export')`（第 435 行）的断言同理改为：

```typescript
expect(result).toEqual({ success: true, exportedCount: 1, failedCount: 0 })
```

将 `it('returns failure when exportBatch throws')`（第 456 行）的断言改为：

```typescript
expect(result).toEqual({ success: false, exportedCount: 0, failedCount: 0, error: 'disk full' })
```

将 `it('marks success false when exportBatch reports 0 successes')`（第 474 行）的断言改为：

```typescript
expect(result).toEqual({ success: false, exportedCount: 0, failedCount: 1 })
```

- [ ] **Step 2: 新增「部分失败标 success=false」测试**

在同一 `describe('EXPORT_BATCH')` 块末尾（第 491 行 `})` 之前）插入：

```typescript
it('marks success false and reports failedCount on partial failure', async () => {
  const fakeResult = {
    jobId: 'j1',
    fileName: 'f.pdf',
    structuredText: 's',
    summary: 'sum',
  }
  ;(historyInstance.getJob as any).mockResolvedValue(fakeResult)
  ;(exportBatch as any).mockResolvedValue({ success: 2, failed: 1 })

  const result = await handlers[IPC_CHANNELS.EXPORT_BATCH](
    {},
    { jobIds: ['j1'], outputDir: '/out' }
  )

  expect(result).toEqual({ success: false, exportedCount: 2, failedCount: 1 })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run (WSL): `wsl -e bash -c "cd /home/arcdent/github/ocr-app && node node_modules/vitest/vitest.mjs run src/main/__tests__/ipc-handlers.test.ts"`
Expected: FAIL — 测试期望新返回结构，但 handler 仍返回旧结构。

- [ ] **Step 4: 修改 handler 返回四字段**

打开 `src/main/ipc-handlers.ts`，找到 EXPORT_BATCH handler（第 166-183 行）：

```typescript
ipcMain.handle(
  IPC_CHANNELS.EXPORT_BATCH,
  async (_, data: IpcRequest['export:batch']): Promise<IpcResponse['export:batch']> => {
    if (!historyManager) return { success: false, exportedCount: 0 }
    const results = await Promise.all(data.jobIds.map((id) => historyManager!.getJob(id)))
    const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null)
    if (validResults.length === 0) {
      return { success: false, exportedCount: 0 }
    }
    try {
      const { success } = await exportBatch(validResults, data.outputDir)
      return { success: success > 0, exportedCount: success }
    } catch (error) {
      console.error('Export error:', error)
      return { success: false, exportedCount: 0 }
    }
  }
)
```

替换为：

```typescript
ipcMain.handle(
  IPC_CHANNELS.EXPORT_BATCH,
  async (_, data: IpcRequest['export:batch']): Promise<IpcResponse['export:batch']> => {
    if (!historyManager) return { success: false, exportedCount: 0, failedCount: 0, error: '历史管理未初始化' }
    const results = await Promise.all(data.jobIds.map((id) => historyManager!.getJob(id)))
    const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null)
    if (validResults.length === 0) {
      return { success: false, exportedCount: 0, failedCount: 0, error: '没有可导出的结果' }
    }
    try {
      const { success, failed } = await exportBatch(validResults, data.outputDir)
      return {
        success: success > 0 && failed === 0,
        exportedCount: success,
        failedCount: failed,
      }
    } catch (error) {
      console.error('Export error:', error)
      return {
        success: false,
        exportedCount: 0,
        failedCount: 0,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
)
```

- [ ] **Step 5: 运行测试确认通过**

Run (WSL): `wsl -e bash -c "cd /home/arcdent/github/ocr-app && node node_modules/vitest/vitest.mjs run src/main/__tests__/ipc-handlers.test.ts"`
Expected: PASS — 所有 EXPORT_BATCH 用例通过。

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc-handlers.ts src/main/__tests__/ipc-handlers.test.ts
git commit -m "fix: export handler returns real success/failed counts with error detail"
```

---

## Task 3: 更新 useOcrStore.exportBatch 返回四字段

**Files:**
- Modify: `src/renderer/src/stores/useOcrStore.ts:24,112-121`
- Test: `src/renderer/src/__tests__/stores/useOcrStore.test.ts`

- [ ] **Step 1: 更新接口类型与新增导出测试**

打开 `src/renderer/src/__tests__/stores/useOcrStore.test.ts`，在最后一个 `it`（第 74 行 `startBatch does nothing when no pendingFiles`）之后、`describe` 闭合 `})`（第 78 行）之前插入：

```typescript
it('exportBatch returns four-field result on success', async () => {
  useOcrStore.setState({
    results: {
      j1: {
        jobId: 'j1',
        fileName: 'f.pdf',
        rawText: 'r',
        structuredText: 's',
        summary: 'sum',
        mode: 'faithful',
        createdAt: 0,
      },
    },
  })
  mockInvoke.mockResolvedValue({ success: true, exportedCount: 1, failedCount: 0 })

  const result = await useOcrStore.getState().exportBatch('/out')

  expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.EXPORT_BATCH, {
    jobIds: ['j1'],
    outputDir: '/out',
  })
  expect(result).toEqual({ success: true, exportedCount: 1, failedCount: 0 })
})

it('exportBatch returns error message when invoke throws', async () => {
  useOcrStore.setState({
    results: {
      j1: {
        jobId: 'j1',
        fileName: 'f.pdf',
        rawText: 'r',
        structuredText: 's',
        summary: 'sum',
        mode: 'faithful',
        createdAt: 0,
      },
    },
  })
  mockInvoke.mockRejectedValue(new Error('ipc boom'))

  const result = await useOcrStore.getState().exportBatch('/out')

  expect(result).toEqual({ success: false, exportedCount: 0, failedCount: 0, error: 'ipc boom' })
})

it('exportBatch returns empty failure when no results', async () => {
  const result = await useOcrStore.getState().exportBatch('/out')
  expect(result).toEqual({ success: false, exportedCount: 0, failedCount: 0 })
  expect(mockInvoke).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: 运行测试确认失败**

Run (WSL): `wsl -e bash -c "cd /home/arcdent/github/ocr-app && node node_modules/vitest/vitest.mjs run src/renderer/src/__tests__/stores/useOcrStore.test.ts"`
Expected: FAIL — 新测试期望四字段，但 store 仍返回旧结构。

- [ ] **Step 3: 修改 store 接口与实现**

打开 `src/renderer/src/stores/useOcrStore.ts`。

第 24 行接口：

```typescript
exportBatch: (outputDir: string) => Promise<{ success: boolean; exportedCount: number }>
```

改为：

```typescript
exportBatch: (outputDir: string) => Promise<{ success: boolean; exportedCount: number; failedCount: number; error?: string }>
```

第 112-121 行实现：

```typescript
exportBatch: async (outputDir) => {
  const jobIds = Object.keys(get().results)
  if (jobIds.length === 0) return { success: false, exportedCount: 0, failedCount: 0 }
  try {
    return await (window as any).api.invoke(IPC_CHANNELS.EXPORT_BATCH, { jobIds, outputDir })
  } catch (err) {
    console.error('Failed to export batch:', err)
    return { success: false, exportedCount: 0, failedCount: 0, error: (err as Error).message }
  }
},
```

- [ ] **Step 4: 运行测试确认通过**

Run (WSL): `wsl -e bash -c "cd /home/arcdent/github/ocr-app && node node_modules/vitest/vitest.mjs run src/renderer/src/__tests__/stores/useOcrStore.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/stores/useOcrStore.ts src/renderer/src/__tests__/stores/useOcrStore.test.ts
git commit -m "fix: useOcrStore.exportBatch returns failedCount and error detail"
```

---

## Task 4: 测试连接先静默保存再测试

**Files:**
- Modify: `src/renderer/src/stores/useSettingsStore.ts:14-15,61-77`
- Test: `src/renderer/src/__tests__/stores/useSettingsStore.test.ts` (新建)

- [ ] **Step 1: 新建 useSettingsStore 测试文件**

创建 `src/renderer/src/__tests__/stores/useSettingsStore.test.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { IPC_CHANNELS, AppSettings, DEFAULT_SETTINGS } from '../../../../shared/types'

describe('useSettingsStore', () => {
  let mockInvoke: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke = vi.fn()
    ;(globalThis as any).window = {
      api: { invoke: mockInvoke, on: vi.fn() },
    }
  })

  afterEach(() => {
    delete (globalThis as any).window
  })

  const sampleSettings: AppSettings = {
    ...DEFAULT_SETTINGS,
    textin: { ...DEFAULT_SETTINGS.textin, appId: 'app-1', secretCode: 'secret-1' },
    llm: { ...DEFAULT_SETTINGS.llm, apiKey: 'key-1', model: 'gpt-4', baseUrl: 'https://api.x.com/v1' },
  }

  it('testOcrConnection persists settings via SETTINGS_SET before testing', async () => {
    mockInvoke
      .mockResolvedValueOnce(undefined) // SETTINGS_SET
      .mockResolvedValueOnce({ success: true, message: 'ok' }) // SETTINGS_TEST_OCR

    const result = await useSettingsStore.getState().testOcrConnection(sampleSettings)

    expect(mockInvoke).toHaveBeenNthCalledWith(1, IPC_CHANNELS.SETTINGS_SET, sampleSettings)
    expect(mockInvoke).toHaveBeenNthCalledWith(2, IPC_CHANNELS.SETTINGS_TEST_OCR, undefined)
    expect(result).toEqual({ success: true, message: 'ok' })
  })

  it('testOcrConnection returns failure when SETTINGS_SET throws', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('save failed'))

    const result = await useSettingsStore.getState().testOcrConnection(sampleSettings)

    expect(result.success).toBe(false)
    expect(result.message).toContain('save failed')
    expect(mockInvoke).toHaveBeenCalledTimes(1)
  })

  it('testLlmConnection persists settings before testing', async () => {
    mockInvoke
      .mockResolvedValueOnce(undefined) // SETTINGS_SET
      .mockResolvedValueOnce({ success: true, message: 'ok' }) // SETTINGS_TEST_LLM

    const result = await useSettingsStore.getState().testLlmConnection(sampleSettings)

    expect(mockInvoke).toHaveBeenNthCalledWith(1, IPC_CHANNELS.SETTINGS_SET, sampleSettings)
    expect(mockInvoke).toHaveBeenNthCalledWith(2, IPC_CHANNELS.SETTINGS_TEST_LLM, undefined)
    expect(result).toEqual({ success: true, message: 'ok' })
  })

  it('testOcrConnection returns failure when test itself fails', async () => {
    mockInvoke
      .mockResolvedValueOnce(undefined) // SETTINGS_SET ok
      .mockResolvedValueOnce({ success: false, message: 'bad key' }) // SETTINGS_TEST_OCR

    const result = await useSettingsStore.getState().testOcrConnection(sampleSettings)

    expect(result).toEqual({ success: false, message: 'bad key' })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run (WSL): `wsl -e bash -c "cd /home/arcdent/github/ocr-app && node node_modules/vitest/vitest.mjs run src/renderer/src/__tests__/stores/useSettingsStore.test.ts"`
Expected: FAIL — `testOcrConnection` 当前不接收参数，且不先 SET。

- [ ] **Step 3: 修改 store 接口与实现**

打开 `src/renderer/src/stores/useSettingsStore.ts`。

第 14-15 行接口：

```typescript
testOcrConnection: () => Promise<{ success: boolean; message: string }>
testLlmConnection: () => Promise<{ success: boolean; message: string }>
```

改为：

```typescript
testOcrConnection: (currentSettings: AppSettings) => Promise<{ success: boolean; message: string }>
testLlmConnection: (currentSettings: AppSettings) => Promise<{ success: boolean; message: string }>
```

第 61-77 行实现：

```typescript
testOcrConnection: async (currentSettings) => {
  try {
    // @ts-ignore
    await window.api.invoke(IPC_CHANNELS.SETTINGS_SET, currentSettings)
  } catch (err) {
    return { success: false, message: '保存配置失败：' + (err as Error).message }
  }
  try {
    // @ts-ignore
    return await window.api.invoke(IPC_CHANNELS.SETTINGS_TEST_OCR, undefined)
  } catch (err) {
    return { success: false, message: (err as Error).message }
  }
},

testLlmConnection: async (currentSettings) => {
  try {
    // @ts-ignore
    await window.api.invoke(IPC_CHANNELS.SETTINGS_SET, currentSettings)
  } catch (err) {
    return { success: false, message: '保存配置失败：' + (err as Error).message }
  }
  try {
    // @ts-ignore
    return await window.api.invoke(IPC_CHANNELS.SETTINGS_TEST_LLM, undefined)
  } catch (err) {
    return { success: false, message: (err as Error).message }
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run (WSL): `wsl -e bash -c "cd /home/arcdent/github/ocr-app && node node_modules/vitest/vitest.mjs run src/renderer/src/__tests__/stores/useSettingsStore.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/stores/useSettingsStore.ts src/renderer/src/__tests__/stores/useSettingsStore.test.ts
git commit -m "fix: test connection persists current form settings before invoking test"
```

---

## Task 5: ConfigDialog 测试连接传 localSettings + 动效 + 圆角 + 滚动 hook

**Files:**
- Modify: `src/renderer/src/components/ConfigDialog.tsx`

> 本任务合并 3 项 ConfigDialog 改动（需求 4 调用方传参、需求 6 动效圆角、需求 3 滚动 hook），因改动同一文件。无单测（动效为 CSS 类名，靠 typecheck + 构建 + 视觉验证）。

- [ ] **Step 1: 修改 import 与测试连接调用传参**

打开 `src/renderer/src/components/ConfigDialog.tsx`。

第 1 行 import 后追加 React 的 `useRef`：

```typescript
import { useEffect, useState, useRef } from 'react'
```

第 32-46 行的两个 handler：

```typescript
const handleTestOcr = async () => {
  setIsTesting(true)
  setOcrTestResult(null)
  const result = await testOcrConnection()
  setOcrTestResult(result)
  setIsTesting(false)
}

const handleTestLlm = async () => {
  setIsTesting(true)
  setLlmTestResult(null)
  const result = await testLlmConnection()
  setLlmTestResult(result)
  setIsTesting(false)
}
```

改为（传入 localSettings）：

```typescript
const handleTestOcr = async () => {
  setIsTesting(true)
  setOcrTestResult(null)
  const result = await testOcrConnection(localSettings)
  setOcrTestResult(result)
  setIsTesting(false)
}

const handleTestLlm = async () => {
  setIsTesting(true)
  setLlmTestResult(null)
  const result = await testLlmConnection(localSettings)
  setLlmTestResult(result)
  setIsTesting(false)
}
```

- [ ] **Step 2: 加滚动 hook 与 content ref**

在 `if (!isOpen) return null`（第 25 行）之前插入 ref 与 hook：

```typescript
const contentRef = useRef<HTMLDivElement>(null)
useScrollOverlay(contentRef)
```

并在文件顶部 import 区追加：

```typescript
import { useScrollOverlay } from '../hooks/useScrollOverlay'
```

> 注意：`useScrollOverlay` 在 Task 6 创建。若 Task 5 先于 Task 6 执行，typecheck 会报 import 找不到模块——属预期，Task 6 完成后消除。执行时建议 Task 6 先于 Task 5。

找到 content 容器（第 63 行）：

```typescript
<div className="flex-1 overflow-y-auto p-6 space-y-8">
```

改为（挂 ref）：

```typescript
<div ref={contentRef} className="flex-1 overflow-y-auto p-6 space-y-8">
```

- [ ] **Step 3: 加打开动效与圆角**

找到蒙层 div（第 49 行）：

```typescript
<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
```

改为（加 `animate-overlay-fade-in`）：

```typescript
<div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-overlay-fade-in">
```

找到卡片 div（第 50 行）：

```typescript
<div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
```

改为（`rounded-2xl`→`rounded-3xl` + `animate-zoom-in`）：

```typescript
<div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-zoom-in">
```

- [ ] **Step 4: 同步到 Windows 端并 typecheck**

```powershell
Copy-Item "\\wsl.localhost\ubuntu\home\arcdent\github\ocr-app\src\renderer\src\components\ConfigDialog.tsx" "C:\Users\yanga\Projects\ocr-app\src\renderer\src\components\ConfigDialog.tsx" -Force
```

Run (Windows): `npm run typecheck`
Expected: 若 Task 6 已完成则无新错误；若 Task 6 未完成则报 `useScrollOverlay` 模块找不到 + `animate-overlay-fade-in`/`animate-zoom-in` 类名无定义（类名非 typecheck 错误，仅运行时无样式）。

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/ConfigDialog.tsx
git commit -m "feat: config dialog open animation, rounded-3xl, scroll overlay, test passes localSettings"
```

---

## Task 6: useScrollOverlay hook + 滚动条 CSS

**Files:**
- Create: `src/renderer/src/hooks/useScrollOverlay.ts`
- Create: `src/renderer/src/__tests__/hooks/useScrollOverlay.test.ts`
- Modify: `src/renderer/src/index.css`

- [ ] **Step 1: 写 hook 的失败测试**

创建 `src/renderer/src/__tests__/hooks/useScrollOverlay.test.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { useScrollOverlay } from '../../hooks/useScrollOverlay'

describe('useScrollOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds is-scrolling class on scroll and removes after 800ms idle', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null)
      // attach ref to our element manually
      ;(ref as any).current = el
      useScrollOverlay(ref)
      return ref
    })

    el.dispatchEvent(new Event('scroll'))
    expect(el.classList.contains('is-scrolling')).toBe(true)

    // advance just under 800ms — still scrolling
    vi.advanceTimersByTime(799)
    expect(el.classList.contains('is-scrolling')).toBe(true)

    // pass the idle threshold — class removed
    vi.advanceTimersByTime(2)
    expect(el.classList.contains('is-scrolling')).toBe(false)

    unmount()
    document.body.removeChild(el)
  })

  it('does not throw when ref is null on mount', () => {
    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null)
      useScrollOverlay(ref)
      return ref
    })
    // no throw
    unmount()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run (WSL): `wsl -e bash -c "cd /home/arcdent/github/ocr-app && node node_modules/vitest/vitest.mjs run src/renderer/src/__tests__/hooks/useScrollOverlay.test.ts"`
Expected: FAIL — 模块 `../../hooks/useScrollOverlay` 不存在。

- [ ] **Step 3: 创建 hook**

创建 `src/renderer/src/hooks/useScrollOverlay.ts`：

```typescript
import { useEffect, type RefObject } from 'react'

const IDLE_MS = 800

export function useScrollOverlay(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    let timer: ReturnType<typeof setTimeout> | undefined

    const onScroll = () => {
      el.classList.add('is-scrolling')
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        el.classList.remove('is-scrolling')
      }, IDLE_MS)
    }

    el.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      el.removeEventListener('scroll', onScroll)
      if (timer) clearTimeout(timer)
      el.classList.remove('is-scrolling')
    }
  }, [ref])
}
```

- [ ] **Step 4: 运行测试确认通过**

Run (WSL): `wsl -e bash -c "cd /home/arcdent/github/ocr-app && node node_modules/vitest/vitest.mjs run src/renderer/src/__tests__/hooks/useScrollOverlay.test.ts"`
Expected: PASS

- [ ] **Step 5: 追加滚动条 CSS**

打开 `src/renderer/src/index.css`，在文件末尾追加：

```css
/* macOS-style overlay scrollbar */
.scroll-overlay,
.is-scrolling {
  scrollbar-width: thin;
  scrollbar-color: rgba(245, 158, 11, 0.5) transparent;
}

.scroll-overlay::-webkit-scrollbar,
.is-scrolling::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.scroll-overlay::-webkit-scrollbar-track,
.is-scrolling::-webkit-scrollbar-track {
  background: transparent;
}

.scroll-overlay::-webkit-scrollbar-thumb,
.is-scrolling::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 9999px;
  transition: background-color 300ms ease;
}

.is-scrolling::-webkit-scrollbar-thumb {
  background: rgba(245, 158, 11, 0.5);
}

.scroll-overlay::-webkit-scrollbar-thumb:hover,
.is-scrolling::-webkit-scrollbar-thumb:hover {
  background: rgba(245, 158, 11, 0.8);
}
```

> 说明：实现采用「`is-scrolling` 时滑块变琥珀色」方案。由于 `::-webkit-scrollbar-thumb` 的 `transition: background-color` 比 `opacity` 在 Chromium 上更稳定，这里用 `background-color` 过渡而非 `opacity`。非滚动时 thumb 背景透明（看不见），滚动时变琥珀，停止 800ms 后 `is-scrolling` 移除、背景回到透明——视觉即「滚动时出现、停止后淡出」。Firefox 用 `scrollbar-color` 始终可见琥珀细条（Firefox 不支持按 class 切换，此为可接受退化）。

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/hooks/useScrollOverlay.ts src/renderer/src/__tests__/hooks/useScrollOverlay.test.ts src/renderer/src/index.css
git commit -m "feat: add macOS-style overlay scrollbar hook and amber themed css"
```

---

## Task 7: FileQueueList 与 ResultDetail 挂滚动 hook

**Files:**
- Modify: `src/renderer/src/components/FileQueueList.tsx`
- Modify: `src/renderer/src/components/ResultDetail.tsx`

> 无单测（hook 行为已在 Task 6 覆盖，此处仅挂载）。

- [ ] **Step 1: FileQueueList 挂 hook**

打开 `src/renderer/src/components/FileQueueList.tsx`。

第 2 行 import 后追加：

```typescript
import { useRef } from 'react'
import { useScrollOverlay } from '../hooks/useScrollOverlay'
```

> 注意：原 import 是 `import { Check, FileText, ... } from 'lucide-react'` 与 `import { JobStage, OcrJob } from '...'`，在第 2-3 行。在它们之后追加上面两行。

在 `FileQueueList` 函数体第一行（第 20 行 `const totalCount = ...` 之前）插入：

```typescript
const scrollRef = useRef<HTMLDivElement>(null)
useScrollOverlay(scrollRef)
```

找到队列滚动容器（第 80 行）：

```typescript
<div className="flex-1 overflow-y-auto">
```

改为：

```typescript
<div ref={scrollRef} className="flex-1 overflow-y-auto">
```

- [ ] **Step 2: ResultDetail 挂 hook**

打开 `src/renderer/src/components/ResultDetail.tsx`。

第 1 行 import 改为：

```typescript
import { useState, useRef } from 'react'
```

在 `ResultDetail` 函数体（第 10 行 `const [showThoughts, ...]` 之前）插入：

```typescript
const scrollRef = useRef<HTMLDivElement>(null)
useScrollOverlay(scrollRef)
```

并在 import 区追加：

```typescript
import { useScrollOverlay } from '../hooks/useScrollOverlay'
```

找到内容滚动容器（第 100 行）：

```typescript
<div className="flex-1 p-6 overflow-y-auto font-mono text-sm whitespace-pre-wrap leading-relaxed text-slate-800">
```

改为：

```typescript
<div ref={scrollRef} className="flex-1 p-6 overflow-y-auto font-mono text-sm whitespace-pre-wrap leading-relaxed text-slate-800">
```

- [ ] **Step 3: 同步并 typecheck**

```powershell
Copy-Item "\\wsl.localhost\ubuntu\home\arcdent\github\ocr-app\src\renderer\src\components\FileQueueList.tsx" "C:\Users\yanga\Projects\ocr-app\src\renderer\src\components\FileQueueList.tsx" -Force
Copy-Item "\\wsl.localhost\ubuntu\home\arcdent\github\ocr-app\src\renderer\src\components\ResultDetail.tsx" "C:\Users\yanga\Projects\ocr-app\src\renderer\src\components\ResultDetail.tsx" -Force
```

Run (Windows): `npm run typecheck`
Expected: 无新增错误。

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/FileQueueList.tsx src/renderer/src/components/ResultDetail.tsx
git commit -m "feat: attach overlay scrollbar to queue and result detail containers"
```

---

## Task 8: 移除应用菜单栏

**Files:**
- Modify: `src/main/index.ts:1,30-33`

- [ ] **Step 1: 修改 import 与 ready 回调**

打开 `src/main/index.ts`。

第 1 行：

```typescript
import { app, BrowserWindow } from 'electron'
```

改为：

```typescript
import { app, BrowserWindow, Menu } from 'electron'
```

第 30-33 行：

```typescript
app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
})
```

改为：

```typescript
app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerIpcHandlers()
  createWindow()
})
```

- [ ] **Step 2: 同步并 typecheck**

```powershell
Copy-Item "\\wsl.localhost\ubuntu\home\arcdent\github\ocr-app\src\main\index.ts" "C:\Users\yanga\Projects\ocr-app\src\main\index.ts" -Force
```

Run (Windows): `npm run typecheck`
Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: remove application menu bar for cleaner window top"
```

---

## Task 9: App.tsx 标题精简 + handleExport toast + main.tsx 挂 Toaster

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/main.tsx`
- Modify: `tailwind.config.js`

> 无单测（toast 分支依赖 sonner DOM，ROI 低；标题与 Toaster 挂载靠构建+视觉验证）。

- [ ] **Step 1: tailwind.config.js 加 keyframes**

打开 `tailwind.config.js`，整体替换为：

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{tsx,ts,html}'],
  theme: {
    extend: {
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'overlay-fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'zoom-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'overlay-fade-in': 'overlay-fade-in 200ms ease-out',
        'zoom-in': 'zoom-in 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: main.tsx 挂 Toaster**

打开 `src/renderer/src/main.tsx`，整体替换为：

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'sonner'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          borderRadius: '12px',
          border: '1px solid rgb(251 191 36 / 0.3)',
        },
      }}
    />
  </React.StrictMode>
)
```

- [ ] **Step 3: App.tsx 加 toast import 与删标题**

打开 `src/renderer/src/App.tsx`。

第 2 行 import 后追加：

```typescript
import { toast } from 'sonner'
```

找到 Header 标题区（第 83-87 行）：

```typescript
<div>
  <h1 className="text-xl font-bold text-slate-800 tracking-tight">智能文档识别系统</h1>
  <p className="text-xs text-amber-600">OCR + AI 结构化处理</p>
</div>
```

替换为（删 h1，副标题升格）：

```typescript
<div>
  <p className="text-sm font-semibold text-amber-700">OCR + AI 结构化处理</p>
</div>
```

- [ ] **Step 4: App.tsx handleExport 改 toast**

找到 `handleExport`（第 45-60 行）：

```typescript
const handleExport = async () => {
  try {
    // Request directory picker via IPC
    const outputDir = await window.electron.ipcRenderer.invoke('dialog:pick-export-dir')
    if (!outputDir) return // User cancelled

    const { success, exportedCount } = await exportBatch(outputDir)
    if (success) {
      alert(`成功导出 ${exportedCount} 个结果！`)
    } else {
      alert('导出完成，但部分文件失败。')
    }
  } catch (err) {
    alert('导出失败: ' + (err as Error).message)
  }
}
```

> 注意：上面这段代码里 `window.electron.ipcRenderer.invoke` 与 store 里 `window.api.invoke` 风格不一致——实际文件第 48 行用的是 `window.electron.ipcRenderer.invoke('dialog:pick-export-dir')`。但 preload 暴露的是 `window.api`（见 preload/index.ts:38 `exposeInMainWorld('api', api)`），并不存在 `window.electron`。这是既有 bug：`handleExport` 的目录选择调用走的是不存在的 API，会抛错被 catch 成「导出失败」。本步一并修正为 `window.api.invoke`。

替换为：

```typescript
const handleExport = async () => {
  let outputDir: string | null
  try {
    // @ts-ignore
    outputDir = await window.api.invoke('dialog:pick-export-dir')
  } catch (err) {
    toast.error('导出失败：' + (err as Error).message)
    return
  }
  if (!outputDir) return // User cancelled

  const result = await exportBatch(outputDir)
  if (result.success) {
    toast.success(`成功导出 ${result.exportedCount} 个结果`)
  } else if (result.exportedCount > 0 && result.failedCount > 0) {
    toast.warning(`导出 ${result.exportedCount} 个，失败 ${result.failedCount} 个`)
  } else {
    toast.error('导出失败：' + (result.error || '没有可导出的结果'))
  }
}
```

> 分支边界（来自 spec）：`exportedCount>0 且 failedCount>0` 才算部分失败（warning）；`exportedCount===0` 无论 failedCount 多少都归 error（全失败是错误不是警告）。

- [ ] **Step 5: 同步并 typecheck**

```powershell
Copy-Item "\\wsl.localhost\ubuntu\home\arcdent\github\ocr-app\src\renderer\src\App.tsx" "C:\Users\yanga\Projects\ocr-app\src\renderer\src\App.tsx" -Force
Copy-Item "\\wsl.localhost\ubuntu\home\arcdent\github\ocr-app\src\renderer\src\main.tsx" "C:\Users\yanga\Projects\ocr-app\src\renderer\src\main.tsx" -Force
Copy-Item "\\wsl.localhost\ubuntu\home\arcdent\github\ocr-app\tailwind.config.js" "C:\Users\yanga\Projects\ocr-app\tailwind.config.js" -Force
```

Run (Windows): `npm run typecheck`
Expected: 无新增错误（`window.api` 在 renderer 有全局声明或 ts-ignore；既有 8 条既存错误数量不增加）。

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/App.tsx src/renderer/src/main.tsx tailwind.config.js
git commit -m "feat: toast-based export feedback, sonner toaster, trimmed header, animation keyframes"
```

---

## Task 10: 全量同步、测试、构建 portable exe

**Files:** 无（验证与构建）

- [ ] **Step 1: 全量同步源码到 Windows 端**

为确保 Windows 端与 WSL git 源完全一致，同步所有触及的文件。逐条执行：

```powershell
$src = "\\wsl.localhost\ubuntu\home\arcdent\github\ocr-app"
$dst = "C:\Users\yanga\Projects\ocr-app"
Copy-Item "$src\src\shared\types.ts" "$dst\src\shared\types.ts" -Force
Copy-Item "$src\src\main\ipc-handlers.ts" "$dst\src\main\ipc-handlers.ts" -Force
Copy-Item "$src\src\main\index.ts" "$dst\src\main\index.ts" -Force
Copy-Item "$src\src\renderer\src\stores\useSettingsStore.ts" "$dst\src\renderer\src\stores\useSettingsStore.ts" -Force
Copy-Item "$src\src\renderer\src\stores\useOcrStore.ts" "$dst\src\renderer\src\stores\useOcrStore.ts" -Force
Copy-Item "$src\src\renderer\src\hooks\useScrollOverlay.ts" "$dst\src\renderer\src\hooks\useScrollOverlay.ts" -Force
Copy-Item "$src\src\renderer\src\index.css" "$dst\src\renderer\src\index.css" -Force
Copy-Item "$src\src\renderer\src\main.tsx" "$dst\src\renderer\src\main.tsx" -Force
Copy-Item "$src\src\renderer\src\App.tsx" "$dst\src\renderer\src\App.tsx" -Force
Copy-Item "$src\src\renderer\src\components\ConfigDialog.tsx" "$dst\src\renderer\src\components\ConfigDialog.tsx" -Force
Copy-Item "$src\src\renderer\src\components\FileQueueList.tsx" "$dst\src\renderer\src\components\FileQueueList.tsx" -Force
Copy-Item "$src\src\renderer\src\components\ResultDetail.tsx" "$dst\src\renderer\src\components\ResultDetail.tsx" -Force
Copy-Item "$src\tailwind.config.js" "$dst\tailwind.config.js" -Force
Copy-Item "$src\src\main\__tests__\ipc-handlers.test.ts" "$dst\src\main\__tests__\ipc-handlers.test.ts" -Force
Copy-Item "$src\src\renderer\src\__tests__\stores\useOcrStore.test.ts" "$dst\src\renderer\src\__tests__\stores\useOcrStore.test.ts" -Force
Copy-Item "$src\src\renderer\src\__tests__\stores\useSettingsStore.test.ts" "$dst\src\renderer\src\__tests__\stores\useSettingsStore.test.ts" -Force
Copy-Item "$src\src\renderer\src\__tests__\hooks\useScrollOverlay.test.ts" "$dst\src\renderer\src\__tests__\hooks\useScrollOverlay.test.ts" -Force
```

- [ ] **Step 2: Windows 端 typecheck**

Run (Windows): `npm run typecheck`
Expected: 零新增错误（既有 8 条既存错误与本改动无关，数量不增加）。

- [ ] **Step 3: Windows 端全量测试**

Run (Windows): `npm run test`
Expected: 全部 PASS，含新增的 useSettingsStore、useScrollOverlay 测试与更新的 ipc-handlers/useOcrStore 导出测试。

- [ ] **Step 4: Windows 端 electron-vite 构建**

Run (Windows): `npm run build`
Expected: 构建成功。验证 renderer CSS：

```powershell
Get-ChildItem "C:\Users\yanga\Projects\ocr-app\out\renderer\assets\*.css" | Select-Object Name, Length
Select-String -Path "C:\Users\yanga\Projects\ocr-app\out\renderer\assets\*.css" -Pattern "amber","zoom-in","overlay-fade-in" | Select-Object -First 10
```
Expected: CSS 文件 ~30KB+，grep 命中 `amber`、`zoom-in`、`overlay-fade-in`（确认 Tailwind 编译正常 + 动效类名进入产物，坑点 2 验证）。

- [ ] **Step 5: Windows 端 electron-builder 打包**

Run (Windows): `npx electron-builder --win`
Expected: 生成 `C:\Users\yanga\Projects\ocr-app\dist\OCR App-0.2.0-portable.exe`。若首跑报 `read ECONNRESET`（坑点 5），直接重试同一命令，不当 bug 排查。

- [ ] **Step 6: 验证产物**

```powershell
Get-Item "C:\Users\yanga\Projects\ocr-app\dist\OCR App-0.2.0-portable.exe" | Select-Object Name, Length, LastWriteTime
```
Expected: 文件存在，~60-70MB，LastWriteTime 为当前时间。

- [ ] **Step 7: 可选冒烟（手动）**

用户手动运行 portable exe 确认：窗口顶部无菜单栏、Header 无「智能文档识别系统」标题、滚动条为琥珀叠加式、配置对话框打开有缩放淡入动效且圆角更大、测试连接输入新配置后点测试可成功、导出用 toast 提示而非原生 alert。此步非自动化，记录结果即可。

---

## Self-Review

**1. Spec coverage：**
- 需求 1 标题精简 → Task 9 Step 3 ✅
- 需求 2 移除菜单栏 → Task 8 ✅
- 需求 3 macOS 叠加滚动条 → Task 6（hook+CSS）+ Task 5/7（挂载 3 容器）✅
- 需求 4 测试连接先保存 → Task 4（store）+ Task 5（调用方传参）✅
- 需求 5 导出 toast → Task 1（契约）+ Task 2（handler）+ Task 3（store）+ Task 9（App.tsx toast + main.tsx Toaster）✅
- 需求 6 配置卡片动效+圆角 → Task 9 Step 1（tailwind keyframes）+ Task 5 Step 3（ConfigDialog 动效圆角）✅
- 双端同步与构建 → Task 10 ✅
- 测试覆盖 → Task 2/3/4/6 ✅

**2. Placeholder scan：** 无 TBD/TODO/"add error handling"等占位符；所有代码步骤含完整代码；所有命令含 expected 输出。✅

**3. Type consistency：**
- `exportBatch` 返回类型 `{success, exportedCount, failedCount, error?}` 在 Task 1（契约）、Task 2（handler）、Task 3（store）、Task 9（App.tsx 解构 `result.success/exportedCount/failedCount/error`）四处一致 ✅
- `testOcrConnection(currentSettings: AppSettings)` 签名在 Task 4（store 定义）与 Task 5（调用 `testOcrConnection(localSettings)`）一致 ✅
- `useScrollOverlay(ref: RefObject<HTMLElement | null>)` 在 Task 6（定义）与 Task 5/7（调用 `useScrollOverlay(contentRef/scrollRef)`，ref 类型 `useRef<HTMLDivElement>` 兼容 `HTMLElement`）一致 ✅
- `animate-overlay-fade-in`/`animate-zoom-in` 类名在 Task 9（tailwind 定义）与 Task 5（ConfigDialog 使用）一致 ✅

**4. 执行顺序注意：** Task 5 依赖 Task 6 的 `useScrollOverlay` 模块与 Task 9 的 tailwind keyframes。若严格按编号执行，Task 5 会因 import 找不到模块而 typecheck 失败。**建议执行顺序：Task 1 → 2 → 3 → 4 → 6 → 8 → 9 → 5 → 7 → 10**（把 Task 6、9 前置到 Task 5、7 之前）。各 Task 自身 commit 不受顺序影响，仅 typecheck 时机需对齐。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-20-ui-polish-and-connection-fix.md`。鉴于本会话 goal 要求「更新后构建 portable exe」，采用 **Inline Execution**（在当前会话按计划执行，每个 Task 的 commit 节点为 checkpoint），执行顺序按 Self-Review 第 4 点调整后的：1→2→3→4→6→8→9→5→7→10。
