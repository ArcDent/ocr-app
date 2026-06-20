# UI 优化与连接测试修复设计

- **日期**：2026-06-20
- **范围**：渲染层 UI 优化（标题/菜单栏/滚动条/动效）+ 连接测试 bug 修复 + 导出错误提示改造
- **状态**：待实现

## 背景与动机

用户反馈 6 个问题，混合 UI 体验改进与功能 bug：

1. 标题「智能文档识别系统」冗余，希望精简
2. 窗口顶部 Electron 默认菜单栏（File/Edit/View/Window/Help）不符合应用定位
3. 滚动条为系统默认样式，与琥珀色前端风格不搭
4. **配置对话框「测试连接」不论输入什么配置都显示失败**
5. **导出失败时用原生 `alert()` 弹窗，不符合前端风格，且错误信息丢失**
6. 配置卡片打开时无过渡动效，显得生硬

经排查，问题 4 与 5 存在明确根因（非主观体验问题），需一并修复。

## 根因分析

### 问题 4：测试连接永远失败

`ConfigDialog.tsx` 的 `handleTestOcr`/`handleTestLlm` 调用 store 的 `testOcrConnection()`/`testLlmConnection()`，这两个 action 直接 `invoke(SETTINGS_TEST_*)`。但主进程 handler（`ipc-handlers.ts:32-60`）读的是 `configStore.getSettings()`——**已持久化的配置**。用户在对话框里输入的新值只存在 React 的 `localSettings` 状态中，尚未保存。因此只要用户没先点「保存配置」就点「测试连接」，主进程用的是旧配置（空或过期），必然失败。

### 问题 5：导出错误提示不准且风格不符

两层问题：

- **风格**：`App.tsx:45-60` 的 `handleExport` 用原生 `alert()`，与琥珀色 Tailwind 主题不符。
- **语义错误**：`ipc-handlers.ts:176-177` 在 `exportBatch` 返回 `success > 0` 时即标记 `success: true`，**部分失败会被报成成功**。且 `useOcrStore.ts:112-121` 的 `exportBatch` catch 后吞掉错误，只返回 `{success:false, exportedCount:0}`，错误详情丢失。导出 IPC 响应类型 `{success, exportedCount}` 也缺 `failedCount` 与 `error` 字段，无法支撑分色提示。

## 设计

### 需求 1：标题精简

**改动文件**：`src/renderer/src/App.tsx`

删除 `<h1>智能文档识别系统</h1>`（第 84 行）。保留琥珀色「文」logo 图标与副标题 `OCR + AI 结构化处理`。副标题从 `text-xs text-amber-600` 提升为 `text-sm font-semibold text-amber-700`，作为 Header 的主视觉标识。Header 右侧设置按钮不变。

### 需求 2：移除菜单栏

**改动文件**：`src/main/index.ts`

在 `app.whenReady().then(...)` 回调内、`createWindow()` 之前调用 `Menu.setApplicationMenu(null)`，彻底移除应用菜单栏。新增 `Menu` 到 electron import。

**DevTools 补偿**：dev 模式已通过 `mainWindow.webContents.openDevTools()` 自动打开 DevTools，移除菜单不影响开发调试。prod 模式本就不需要菜单。不保留任何自定义菜单（YAGNI）。

### 需求 3：macOS 叠加式滚动条（CSS + JS）

**新增文件**：`src/renderer/src/hooks/useScrollOverlay.ts`

导出 `useScrollOverlay` hook：接收一个 ref，在该 ref 当前元素上监听 `scroll` 事件；滚动触发时给元素加 CSS class `is-scrolling`，停止滚动 800ms 后移除该 class（由 CSS `transition: opacity` 实现淡出）。hook 在 mount 时绑定、unmount 时解绑，使用 `setTimeout` 配合 `clearTimeout` 防抖。

**改动文件**：`src/renderer/src/index.css`

追加全局滚动条样式：

- `::-webkit-scrollbar`：宽 8px、高 8px
- `::-webkit-scrollbar-track`：透明
- `::-webkit-scrollbar-thumb`：圆角 `rounded`、半透明琥珀色 `rgba(245, 158, 11, 0.4)`、默认 `opacity: 0`
- `::-webkit-scrollbar-thumb:hover`：`rgba(245, 158, 11, 0.7)`
- 容器在 `.is-scrolling` 状态下 `::-webkit-scrollbar-thumb` `opacity: 1`
- `transition: opacity 300ms ease` 实现淡入淡出
- Firefox 兼容：`scrollbar-width: thin` + `scrollbar-color: rgba(245, 158, 11, 0.4) transparent`

**应用范围**：3 个滚动容器，各挂 `useScrollOverlay`：

- `FileQueueList.tsx` 的队列 `overflow-y-auto` 容器（第 80 行）
- `ConfigDialog.tsx` 的 content `overflow-y-auto` 容器（第 63 行）
- `ResultDetail.tsx` 的内容 `overflow-y-auto` 容器（第 100 行）

**技术风险与备选**：`::-webkit-scrollbar-thumb` 的 `transition: opacity` 在部分 Chromium 版本上对伪元素过渡支持不稳定。实现时先按 `transition: opacity 300ms ease` 实现；若构建后实测淡出无效，退化为方案 A 近似——去掉 JS hook，仅保留「默认半透明 `rgba(...,0.4)`、hover 变深 `rgba(...,0.7)`」的纯 CSS 静态样式（放弃淡出，保留琥珀配色）。退化不改变文件结构，仅删 hook 挂载与 `is-scrolling` 相关 CSS。

### 需求 4：测试连接先静默保存再测试

**改动文件**：`src/renderer/src/stores/useSettingsStore.ts`

`testOcrConnection` 与 `testLlmConnection` 签名改为接收 `currentSettings: AppSettings` 参数。函数体内先 `invoke(SETTINGS_SET, currentSettings)` 持久化当前表单值，再 `invoke(SETTINGS_TEST_*)` 测试。若 SET 失败，返回 `{success:false, message:'保存配置失败：...'}`。

**改动文件**：`src/renderer/src/components/ConfigDialog.tsx`

`handleTestOcr`/`handleTestLlm` 调用时传入 `localSettings`。

**语义说明**：测试的就是输入框当前值，用户无需先点「保存配置」。测试失败不回滚已保存配置——符合「用户就是要测这个配置」的直觉；若测试成功，配置已顺便保存，点「保存配置」按钮变为幂等确认。

### 需求 5：导出 toast 按状态分色

**改动文件**：`src/shared/types.ts`

`IpcResponse[EXPORT_BATCH]` 从 `{success, exportedCount}` 扩展为 `{success: boolean; exportedCount: number; failedCount: number; error?: string}`。

**改动文件**：`src/main/ipc-handlers.ts`

EXPORT_BATCH handler 改为：

- 正常路径：`const { success, failed } = await exportBatch(...)`，返回 `{success: success > 0 && failed === 0, exportedCount: success, failedCount: failed}`（全成功才 success=true，部分失败标 false）
- `validResults.length === 0`：返回 `{success:false, exportedCount:0, failedCount:0, error:'没有可导出的结果'}`
- catch：返回 `{success:false, exportedCount:0, failedCount:0, error: error.message}`

**改动文件**：`src/renderer/src/stores/useOcrStore.ts`

`exportBatch` 返回类型改为 `{success, exportedCount, failedCount, error?}`，catch 时带 `error: (err as Error).message`，不再吞错误。

**改动文件**：`src/renderer/src/App.tsx`

`handleExport` 删除所有 `alert()`，改用 `sonner` toast：

- `outputDir` 为 null（用户取消）→ 静默 return
- `success === true`（exportedCount>0 且 failedCount===0）→ `toast.success('成功导出 ${exportedCount} 个结果')`
- `success === false && exportedCount > 0 && failedCount > 0`（部分成功部分失败）→ `toast.warning('导出 ${exportedCount} 个，失败 ${failedCount} 个')`
- `success === false && exportedCount === 0`（一个都没导出，含全失败、无可用结果、抛错）→ `toast.error('导出失败：' + (error || '没有可导出的结果'))`
- 顶层 try/catch（invoke 本身抛错）→ `toast.error('导出失败：' + (err as Error).message)`

**分支边界说明**：「部分失败」严格定义为 `exportedCount>0 且 failedCount>0`，即至少成功一个且至少失败一个。若一个都没成功（exportedCount===0），无论 failedCount 多少，都归为 `toast.error`（全部失败是错误，不是警告）。

**改动文件**：`src/renderer/src/main.tsx`

挂载 sonner `<Toaster />`，position `bottom-right`，`toastOptions` 用琥珀色主题（`style` 设琥珀色边框/背景适配）。import `toast` 在 App.tsx 顶部从 `sonner` 引入。

### 需求 6：配置卡片动效 + 圆角

**改动文件**：`tailwind.config.js`

`theme.extend.keyframes` 与 `animation` 新增：

- `fade-in`：`from { opacity: 0 } to { opacity: 1 }`，对应 `animate-fade-in`
- `overlay-fade-in`：同 fade-in，语义命名用于蒙层
- `zoom-in`：`from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) }`，对应 `animate-zoom-in`

**改动文件**：`src/renderer/src/components/ConfigDialog.tsx`

- 蒙层 div（第 49 行）加 `animate-overlay-fade-in`
- 卡片 div（第 50 行）加 `animate-zoom-in`，圆角 `rounded-2xl`→`rounded-3xl`
- 三个内嵌 section（TextIn/LLM/处理参数）外层暂不加圆角——它们是标题+表单的语义分组，加圆角会与卡片圆角嵌套产生视觉噪声。仅卡片本体与 Header/Footer 区域圆角统一为 `rounded-3xl`。

**关闭动效**：不实现（YAGNI），仅打开有过渡。

## 数据流与接口变更

### IPC 契约变更（shared/types.ts）

```typescript
// before
[IPC_CHANNELS.EXPORT_BATCH]: { success: boolean; exportedCount: number }
// after
[IPC_CHANNELS.EXPORT_BATCH]: {
  success: boolean
  exportedCount: number
  failedCount: number
  error?: string
}
```

### Store 接口变更

```typescript
// useSettingsStore.ts
testOcrConnection: (currentSettings: AppSettings) => Promise<{success, message}>
testLlmConnection: (currentSettings: AppSettings) => Promise<{success, message}>

// useOcrStore.ts
exportBatch: (outputDir: string) => Promise<{
  success: boolean
  exportedCount: number
  failedCount: number
  error?: string
}>
```

## 测试策略

### 主进程

- `ipc-handlers.test.ts`：更新已有 4 个 EXPORT_BATCH 测试断言为新返回结构；新增「部分失败标 success=false 且 failedCount 正确」「catch 带 error 字段」用例。
- `markdown-exporter.test.ts`：无改动（其返回 `{success, failed}` 不变）。

### 渲染层

- `useSettingsStore.test.ts`：新增 `testOcrConnection` 先 invoke SETTINGS_SET 再 invoke SETTINGS_TEST_OCR 的顺序断言（mock invoke 断言调用顺序）。
- `useOcrStore.test.ts`：更新 `exportBatch` 测试，断言返回含 `failedCount`/`error`；新增 catch 路径带 error。
- 新增 `useScrollOverlay.test.ts`：mock ref + 模拟 scroll 事件，断言加 `is-scrolling` class、800ms 后移除、unmount 解绑。
- ConfigDialog 无既有测试，动效为 CSS 类名，不写单测（类名验证靠 typecheck + 视觉确认）。
- App.tsx `handleExport` toast 分支不写单测（依赖 sonner DOM，ROI 低），靠手动构建后验证。

### 构建验证

- `npm run typecheck`：零新增错误（既有 8 条既存错误与本改动无关，保持不增加）
- `npm run test`：全部通过
- `npm run build`：`out/renderer/assets/*.css` 体积正常（~30KB+），grep 命中 `amber` 与新增 keyframes（`zoom-in`/`fade-in`）
- `npx electron-builder --win`：生成 `dist/OCR App-0.2.0-portable.exe`

## 双端同步

按项目 CLAUDE.md 坑点 3，源码改在 WSL 端（git 源），用 PowerShell `Copy-Item` 同步触及文件到 Windows 端 `C:\Users\yanga\Projects\ocr-app`。哈希校验一致后，typecheck/test/build/electron-builder 均在 Windows 端原生路径执行（坑点 4：不在 UNC 路径 npm install）。

## 范围控制（YAGNI）

- 不实现关闭动效
- 不引入 framer-motion 等新依赖（sonner 已在 deps）
- 不保留自定义菜单（彻底移除）
- 不给配置对话框内嵌 section 加圆角（避免嵌套视觉噪声）
- 不把滚动条 overlay hook 做成全局自动应用（显式挂载到 3 个容器，可控）
- 标题精简只删主标题，不动 logo 与副标题

## 已知坑点遵循

- 坑点 2：tailwind.config.js 与 postcss.config.js 不动其存在性，仅在 tailwind.config.js 追加 keyframes
- 坑点 3：所有配置改动双端同步
- 坑点 4：npm install/typecheck/test/build 在 Windows 原生路径执行
- 坑点 8：不引入 uuid 等纯 ESM 包，本次无主进程新依赖

## 涉及文件清单

| 文件 | 改动类型 |
|------|----------|
| `src/renderer/src/App.tsx` | 删标题、handleExport 改 toast、import toast |
| `src/main/index.ts` | 移除菜单栏 |
| `src/renderer/src/index.css` | 滚动条样式 |
| `src/renderer/src/hooks/useScrollOverlay.ts` | 新增 |
| `src/renderer/src/components/FileQueueList.tsx` | 挂 useScrollOverlay |
| `src/renderer/src/components/ConfigDialog.tsx` | 挂 useScrollOverlay、动效、圆角、测试传 localSettings |
| `src/renderer/src/components/ResultDetail.tsx` | 挂 useScrollOverlay |
| `src/renderer/src/stores/useSettingsStore.ts` | 测试连接先保存 |
| `src/renderer/src/stores/useOcrStore.ts` | exportBatch 返回四字段 |
| `src/renderer/src/main.tsx` | 挂 Toaster |
| `src/shared/types.ts` | EXPORT_BATCH 响应扩展 |
| `src/main/ipc-handlers.ts` | EXPORT_BATCH handler 返回四字段 |
| `tailwind.config.js` | 新增 keyframes/animation |
| `src/renderer/src/__tests__/stores/useSettingsStore.test.ts` | 新增顺序断言 |
| `src/renderer/src/__tests__/stores/useOcrStore.test.ts` | 更新断言 |
| `src/renderer/src/__tests__/hooks/useScrollOverlay.test.ts` | 新增 |
| `src/main/__tests__/ipc-handlers.test.ts` | 更新导出断言 |
