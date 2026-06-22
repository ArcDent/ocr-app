# OCR App - AI 会话交接文件

## 项目身份

- **类型**：Electron 桌面应用
- **目标**：OCR 文字识别 + LLM 结构化处理 + 批量导出
- **技术栈**：Electron 28, TypeScript 5.9, React 18, Zustand, Tailwind CSS, Vitest, electron-vite, electron-builder

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
.claude/CLAUDE.md           # 项目级规则与已知坑点
electron-builder.yml        # electron-builder 配置文件（代替 forge.config.js）
tailwind.config.js          # Tailwind CSS 配置文件
postcss.config.js           # PostCSS 配置文件
out/                        # electron-vite 构建产物（gitignore）
dist/                       # electron-builder 打包产物（gitignore）
```

## 最近操作

- **2026-06-22**: 前端整体重设计「纸本墨韵 / Editorial Ink」——移除「文」字 logo、ConfigDialog 卡片化、摆脱 amber+slate AI slop
  - **设计**：`/brainstorming` + sequential-thinking MCP 推导设计令牌 → AskUserQuestion 三决策（审美方向/logo 方案/body 字体）→ plan 文件 `C:\Users\yanga\.claude\plans\mossy-sleeping-volcano.md`。
  - **方向**：暖纸白 `#FAF7F0` 底 + 深墨 `#1A1815` 文字 + 朱砂红 `#C8442A`（印章红）强调 + 青墨绿 `#2D5F4E` 成功态 + 衬线 display（Iowan/Songti SC 系统栈，离线可用）。圆角体系统一为 input 8 / button 12 / card 16 / dialog 24。
  - **改动文件**（6 个，纯样式层，零逻辑改动）：`index.css`（注入 :root CSS 变量 + 字体栈 + 滚动条 amber→vermilion）、`tailwind.config.js`（extend colors/fontFamily/borderRadius/boxShadow/keyframes）、`App.tsx`（删 `<span>文</span>` 换 inline SVG 朱砂方印 logo + header/按钮全调色）、`ConfigDialog.tsx`（三个 `<section>` 包进 `bg-paper-2 border-line rounded-lg shadow-card` 卡片容器——修复用户点名的「没圆角」+ 全组件调色）、`FileQueueList.tsx`、`ResultDetail.tsx`（调色 + font-display + font-mono JSON 区）。
  - **验证**：electron-vite build 成功，CSS 产物 22.83KB（坑点 2 标准 >210 字节），grep `--paper`×9 / `vermilion`×27 / `font-display`×6 命中，`amber`/`slate-200` 残留 0。272/272 测试全绿（17 文件）——修复了一处测试断言：`ResultDetail.test.tsx:34` 断言 `⚠️ 注意`，最初误删 emoji 已恢复。typecheck 零新增错误（7 条既存错误全在 main/preload 未触及文件）。
  - **双端同步**：PowerShell `Copy-Item` 把 6 个文件从 WSL `\\wsl.localhost\Ubuntu\home\arcdent\github\ocr-app` 同步到 Windows 原生路径 `C:\Users\yanga\Projects\ocr-app`（坑点 4 约束，npm/build 必须在原生路径跑）。
  - **未打包**：本次仅样式重设计，未触版本号、未打包 portable exe（用户未表达提交意图，按收尾流程 README/打包步骤不触发）。

- **2026-06-20**: 更新项目级 CLAUDE.md 收尾流程约束——追加「先更新版本号 → 同步双端 → 再打包 portable exe → 验证产物」四步顺序铁律
  - **动因**：版本号决定 `dist/OCR App-<version>-portable.exe` 文件名，若先打包再改版本号，旧版本 exe 会被覆盖无法回溯。
  - **变更**：`.claude/CLAUDE.md` 新增「收尾流程约束（强约束，不可跳过）」章节，插入在「开发流程补充」与「参考」之间，串联坑点 3/4/5/6。全局「任务收尾执行顺序」仍为上层流程，本章节为项目专属追加。

- **2026-06-20**: UI 优化与连接测试修复（6 项需求，全部完成，已打包 portable exe）
  - **设计**：brainstorming → spec（自审修正 2 处歧义：导出 toast 分支边界、滚动条 transition 技术风险）→ 实现计划。spec 见 `docs/superpowers/specs/2026-06-20-ui-polish-and-connection-fix.md`，计划见 `docs/superpowers/plans/2026-06-20-ui-polish-and-connection-fix.md`。
  - **根因修复 1（测试连接永远失败）**：`ConfigDialog` 点测试连接时主进程读的是已持久化 `configStore`，而表单新值只在 `localSettings` 未保存。改 `useSettingsStore` 的 `testOcrConnection/testLlmConnection` 接收 `currentSettings`，先 `SETTINGS_SET` 持久化再 `SETTINGS_TEST_*`；`ConfigDialog` 调用时传 `localSettings`。
  - **根因修复 2（导出提示不准且用原生 alert）**：`ipc-handlers` 的 EXPORT_BATCH 原本 `success>0` 即报成功（部分失败误报成功）且吞错误。扩展 IPC 契约为 `{success, exportedCount, failedCount, error?}`，handler 改 `success>0 && failed===0` 才成功、catch 带 `error`；`useOcrStore.exportBatch` 返回四字段；`App.tsx handleExport` 改用 sonner toast 按状态分色（成功/部分失败 warning/全失败 error），并修掉原 `window.electron.ipcRenderer` 不存在的既有 bug（改 `window.api.invoke`）；`main.tsx` 挂 `<Toaster/>`。
  - **UI 优化**：①标题删「智能文档识别系统」留副标题「OCR + AI 结构化处理」；②`main/index.ts` 加 `Menu.setApplicationMenu(null)` 移除菜单栏；③新增 `useScrollOverlay` hook + `index.css` 琥珀色叠加式滚动条（`is-scrolling` class 切换，`background-color` 过渡），挂到队列/配置对话框/结果详情 3 个容器；④`tailwind.config.js` 加 `fade-in`/`overlay-fade-in`/`zoom-in` keyframes，`ConfigDialog` 蒙层淡入+卡片缩放动效，圆角 `rounded-2xl`→`rounded-3xl`。
  - **执行**：Inline Execution 按 1→2→3→4→6→8→9→5→7→10 顺序，9 个 commit 在 master。TDD 全程，272 测试全过（新增 10 个：useSettingsStore 4 + useScrollOverlay 2 + 导出 4）。typecheck 零新增错误（7 条既存错误全在未触及文件）。
  - **打包**：17 文件 PowerShell 同步到 Windows 端（哈希全一致），`npx vitest run` 272 过，electron-vite build 成功（renderer CSS 30.33KB，grep 命中 `amber`/`zoom-in`/`overlay-fade-in`/`is-scrolling`），`npx electron-builder --win` 生成 `dist/OCR App-0.3.0-portable.exe`（66.7 MB）。版本号 bump 0.2.0→0.3.0（含新功能+bug 修复，语义化版本）。

- **2026-06-20**: LLM 结构化提示词重设计——从 Markdown 输出改为按文档类型分支的简洁纯文本（全部完成，已打包 portable exe）
  - **设计**：brainstorming → spec → 自审修订（发现 orchestrator 绕过 prompts.ts 的盲区并修正）→ 实现计划。spec 见 `docs/superpowers/specs/2026-06-20-structured-prompt-redesign.md`，计划见 `docs/superpowers/plans/2026-06-20-structured-prompt-redesign.md`。
  - **格式规约**：四类（对话体 `A：xxx` / 键值表 `xx：xx` / 清单 `- xxx` / 散文无符号）+ mixed 混排用 `【】` 分区块；禁一切 Markdown 标记；全角冒号。
  - **提示词**：`prompts.ts` 三个 system prompt 重写为四块结构（ROLE + TYPE_RULES 共享常量 + FIDELITY_RULES + PROCEDURE），输出 `<type><thoughts><result>` 三段；LLM 自动判型。
  - **提取层**：`LlmClient` 新增 `extractType`（返回 DocType，缺失/非法返回 unknown）；`extractResult` 增加 Markdown 清洗兜底（顺序敏感正则，保留清单/编号/【】/全角冒号/行内星号）。
  - **编排层**：`chunking.ts` 的 `structureText` 返回聚合 type（同类型→该值，异/unknown→mixed），`summarize` 固定 `type:'prose'`；`orchestrator.ts` 删除内联裸消息和硬编码英文摘要指令，改调 `structureText`/`summarize`，使提示词真正进入生产路径。
  - **范围控制**：type 不持久化（JobResult/HistoryItem 不加字段），renderer 不动。
  - **执行**：subagent-driven-development，9 个 commit 在 `feat/structured-prompt-redesign` 分支，TDD 全程。262 测试全过，typecheck 零新增错误（8 条既存错误与本改动无关）。
  - **打包**：源码同步到 Windows 端 `C:\Users\yanga\Projects\ocr-app`，electron-vite build 成功（renderer CSS 29.14KB，Tailwind 正常），`npx electron-builder --win` 生成 `dist/OCR App-0.1.0-portable.exe`（66.7 MB）。验证主进程产物含 `TypeRules`/`对话体`/`键值表`。

- **2026-06-20**: 迁移打包工具至 electron-builder 并修复 Tailwind 编译与图标问题
  - **打包迁移**: 彻底删除 `forge.config.js` 及其在 `package.json` 中的依赖，引入 `electron-builder`。配置 `electron-builder.yml` 输出 `portable` Windows 单文件 exe，打包产物路径变更为 `dist/OCR App-0.1.0-portable.exe`。
  - **Tailwind 样式修复**: 新建 `tailwind.config.js` 和 `postcss.config.js` 于项目根目录，引入 `tailwindcss` 和 `autoprefixer` 插件，打通 Vite 构建 CSS 的 PostCSS 管道，解决打包后前端由于未编译 `@tailwind` 指令导致样式完全丢失的 bug。
  - **图标升级**: 生成多尺寸（256/128/64/48/32/16）ICO 格式的 `resources/icon.ico`，替换低分辨率占位图标，满足 electron-builder 构建必须提供至少 256x256 图标的硬性要求。
  - **配置同步**: 将以上改动和新建配置文件（`.claude/CLAUDE.md`, `electron-builder.yml`, `tailwind.config.js`, `postcss.config.js`, `.gitignore`）同步到 Windows 本地路径 `C:\Users\yanga\Projects\ocr-app\`，实现 WSL 源码和 Windows 构建端一致性。

## 进行中

无。前端「纸本墨韵」重设计已完成样式层与验证，未提交 git、未打包。

## 下一步

**立即**：
1. 视觉冒烟：在 Windows 原生路径跑 `npm run dev`，肉眼确认——logo 是朱砂方印 SVG 无「文」字、全局纸白底+深墨文字+朱砂强调、ConfigDialog 三个 section 是有圆角卡片、圆角层级统一（input 8/button 12/card 16/dialog 24）、标题衬线+JSON mono、滚动条朱砂红。
2. 若视觉通过，按收尾流程：bump `package.json` version（patch 或 minor）→ 同步双端 → `npm run make` 打 portable exe。
3. master 有本次前端重设计改动待评估是否提交/推送。

**后续**：
- 真实 API 联调：用真实 OCR 文本（发票/聊天记录/报告）验证四类格式判定与输出效果。
- 若发现 LLM 高频误判类型，在 `prompts.ts` 的 TYPE_RULES 里强化判定准则。

## 关键发现

### 技术决策
1. **electron-builder 迁移**: 比起 forge-squirrel，`electron-builder` 的 `portable` 目标生成单文件自解压可执行程序，体积更小，更加便携。且其打包时通过 `dist/` 与 electron-vite 的 `out/` 输出隔离，完美避开了 entry point 找不到的排除机制冲突。
2. **Tailwind PostCSS 管道**: vite 默认只在根目录发现 `postcss.config.js` 时才会运行 postcss 插件。若缺失这两个配置，CSS 打包只有原样 `@tailwind`，导致样式完全失效。补全后 output 的渲染 CSS 大小正常（约 30KB+）。
3. **多尺寸图标构建限制**: Windows 平台打包要求 `win.icon` 必须包含 256x256px 资源，否则报错 `Icon must be at least 256x256 pixels`。通过 headless Chrome 从 `icon.svg` 截图并用脚本封包为包含 16-256px 多尺寸 ICO。
4. **uuid v14 与 CJS 兼容陷阱**: `uuid` 在 v14 升级为纯 ESM 无法在 electron-vite 打包出的 CJS 主进程中通过 `require` 引入。决定弃用该依赖，直接使用 Node.js 自带的 `crypto.randomUUID()`（Electron 28 支持），保持测试的 mock 对应。
5. **orchestrator 曾绕过 prompts.ts（已修复）**: 重设计提示词时自审发现，`orchestrator.ts` 的 `runStructuring`/`runSummarizing` 原本直接发裸 user message（摘要还硬编码英文 "Please summarize the following text"），不调用 `buildStructurePrompt`/`buildSummaryPrompt`，导致 `prompts.ts` 提示词对生产路径无效（`chunking.ts` 的 `structureText`/`summarize` 曾是孤岛）。已改为 orchestrator 调 `structureText`/`summarize`，提示词进入生产路径。后续若再改提示词，确认走的是 orchestrator→chunking→prompts 链路。
6. **LLM 输出格式：纯文本按类型分支**: 提示词要求 LLM 输出 `<type><thoughts><result>` 三段，`<result>` 是简洁纯文本（禁 Markdown），按四类（dialogue/kv/list/prose）+ mixed（`【】`分区块）格式。`extractResult` 有 Markdown 清洗兜底（防 LLM 不守规矩），`extractType` 提取类型（仅内部用，不持久化、不展示）。
7. **双端验证模式**: WSL 端是 git 源、node_modules 是 Linux 版（rollup-linux-x64），Windows 端 `C:\Users\yanga\Projects\ocr-app` 不是 git 仓库、是独立构建副本。测试可在 WSL 端用 `wsl -e bash -c "cd /home/arcdent/github/ocr-app && node node_modules/vitest/vitest.mjs run <path>"` 跑，但 electron-vite build 和 electron-builder 必须在 Windows 端原生路径跑。改源码后用 PowerShell `Copy-Item` 同步触及的文件到 Windows 端（哈希校验一致）。注意 `npm run test` 脚本是 `vitest`（watch 模式不退出），Windows 端交叉验证要用 `npx vitest run`。
8. **测试连接读已持久化配置的陷阱**: `settings:test-ocr`/`settings:test-llm` handler 读 `configStore.getSettings()`（已落盘），而配置对话框的新值只在渲染层 `localSettings`。若不在测试前先 `SETTINGS_SET`，测的是旧配置必然失败。已改为 store action 先静默保存当前表单再测试。后续若新增「测试」类按钮，确认它测的是当前表单值而非已持久化值。
9. **导出 success 判定阈值**: `exportBatch` 返回 `{success, failed}`（成功数/失败数），IPC handler 必须用 `success>0 && failed===0` 才标记 `success:true`——`success>0` 会把部分失败误报成功。导出提示分三色：全成功 toast.success、部分成功部分失败 toast.warning（`exportedCount>0 && failedCount>0`）、全失败 toast.error（`exportedCount===0`）。
10. **App.tsx 曾用不存在的 `window.electron`**: 既有 `handleExport` 用 `window.electron.ipcRenderer.invoke('dialog:pick-export-dir')`，但 preload 暴露的是 `window.api`（`exposeInMainWorld('api', ...)`），`window.electron` 不存在导致目录选择必抛错。已改 `window.api.invoke`。后续 IPC 调用统一走 `window.api`。
11. **叠加式滚动条用 background-color 过渡**: `::-webkit-scrollbar-thumb` 的 `transition: opacity` 在部分 Chromium 版本对伪元素不稳定，改用 `transition: background-color`——非滚动时 thumb 背景透明，`.is-scrolling` 时变琥珀色，停止 800ms 后回透明，视觉等同淡入淡出。Firefox 用 `scrollbar-color` 始终可见（退化可接受）。注：2026-06-22 前端重设计后滚动条色已从琥珀 `rgba(245,158,11,*)` 改为朱砂 `rgba(200,68,42,*)`。
12. **前端设计令牌体系（2026-06-22 重设计）**: 前端从 amber+slate 的 AI slop 迁移到「纸本墨韵」体系，令牌集中在 `index.css` `:root` CSS 变量 + `tailwind.config.js` extend 双层定义：颜色 `paper/paper-2/ink/ink-2/ink-3/line/vermilion/vermilion-2/vermilion-soft/seal/seal-soft/red-soft`；字体 `--font-display`（衬线 Iowan/Palatino/Songti SC 系统栈，离线可用无 Google Fonts 依赖）/`--font-body`（保留无衬线）/`--font-mono`（JSON 区）；圆角重定义 `sm8/md12/lg16/xl24`（input/button/card/dialog 四级体系）；阴影 `shadow-card`/`shadow-float`（纸感轻柔替代 shadow-2xl）。改样式只动这层令牌 + 组件 className，零逻辑改动。验证方式：`npm run build` 后 `out/renderer/assets/*.css` grep `vermilion`/`--paper`/`font-display` 有命中、`amber`/`slate-200` 残留为 0。
13. **ConfigDialog「卡片没圆角」根因**: 三个 `<section>`（TextIn OCR/LLM/处理参数）原本没有卡片容器，只是裸 `<h3>` + 散落输入框堆在 `space-y-8` 里，所以视觉上「没圆角」。修复方式：每个 section 包进 `bg-paper-2 border border-line rounded-lg p-5 shadow-card`。这是卡片容器的来源，不是 dialog 本身（dialog 一直是 `rounded-3xl`）。
