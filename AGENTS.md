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
electron-builder.yml        # electron-builder 配置文件
tailwind.config.js          # Tailwind CSS 配置文件
postcss.config.js           # PostCSS 配置文件
out/                        # electron-vite 构建产物（gitignore）
dist/                       # electron-builder 打包产物（gitignore）
```

## 最近操作

- **2026-06-22**: v1.0.1 发布（CI 路径 A）——图标替换 + 版本号 bump 触发 tag 自动打包
  - **触发**：用户说「提交当前改动 打新 tag 推送」。改动 = 图标替换（icon.svg/ICON_README/icon-256.png/icon.ico）+ package.json 1.0.0→1.0.1 + AGENTS.md 补记录。`.clinerules-*`（5 个 Cline IDE 配置）和 `resources/icon-128.png`/`icon-64.png`（ICO 生成中间尺寸）保留未追踪，不入提交。
  - **前置验证（路径 A 步骤 4）**：①WSL 原生路径 `npm install` 重生成 `package-lock.json`（lock 此前停在 1.0.0，与 package.json 1.0.1 不同步，CI `npm ci` 必报 out of sync——坑点已记录）；②`npm run typecheck` 零错误；③vitest 在 Windows 原生路径 `C:\Users\yanga\Projects\ocr-app` 跑，275/275 通过（17 文件，3.61s）——**WSL UNC 路径经 `wsl` 调用跑 vitest 会触发 vite-node 正则炸 `/(?:^|/@fs/)\(:[\/])/`，因 cwd 被暴露成 `file://wsl.localhost/...`，必须在 WSL 原生终端或 Windows 原生路径跑**；④lock 同步到 Windows 原生路径副本。
  - **README 刷新**：badge `Version-1.0.0`→`1.0.1`、产物名 `OCR App-1.0.0-portable.exe`→`1.0.1`、tag 示例 `v1.0.0`→`v1.0.1`。
  - **commit**：`cc0f558` `feat: replace icon with magnifier-over-text-lines, bump to 1.0.1`，7 文件（AGENTS.md/README.md/package.json/package-lock.json/resources/{icon.svg,ICON_README.md,icon-256.png}）。push master + tag `v1.0.1` 全成功。
  - **CI**：run `27963504205`，3m9s 全绿（Typecheck → Build → Package portable exe → Upload → Attach to Release）。Release https://github.com/ArcDent/ocr-app/releases/tag/v1.0.1，portable exe asset 已上传。
  - **CI annotation 提醒**：`Node.js 20 is deprecated`（actions/checkout@v4 等被强制跑 Node 24）。当前仍成功，但未来 workflow 可能需升 actions 版本或 node-version——记为待观察项，暂不改。

- **2026-06-22**: 替换应用图标——旧琥珀渐变扫描文档 → 新「放大镜 + 文字行」纯线条图标（已随 v1.0.1 打包发布）
  - **动机**：旧 `resources/icon.svg` 用 `#FF9A56 → #FFDD67` 琥珀渐变 + 3D 透视文档 + 白色扫描光束动画，与 renderer 当前的「纸本墨韵 + 朱砂 + 青墨绿 + 衬线」CSS 主题（`index.css` 的 `--ink-2 #4a453e` / `--vermilion #c8442a`）割裂。用户要求透明背景、简洁线条、无动画。
  - **brainstorming**：经 visual companion 浏览器 mockup 共 9 个方向（A–I），用户选 C（放大镜圈文字行）；又经 C1–C4 镜内表达变体 + U1/U2 双色加粗变体后，用户最终回到 C 原稿静态版。设计：4 条墨色文字行（`#4a453e` width 8）+ 1 把朱砂放大镜（`#c8442a` ring r=48 width 10 + handle width 12），256×256 透明背景，无填充无阴影无动画，SVG 与 ICO 像素一致。
  - **生成链路**（绕开 ImageMagick/Inkscape，用 headless Chrome + Pillow）：①`google-chrome --headless=new --default-background-color=00000000 --window-size=256,256 --screenshot` 把 WSL 端 `icon.svg` 渲染成 `icon-256.png`（4740 字节，PIL 采样 6 点全 `a=0` 确认真透明）；②PIL `Image.resize((s,s), LANCZOS)` 生成 256/128/64/48/32/16 六个 PNG；③手写 PNG-in-ICO 封装（`struct.pack('<HHH'` header + `'<BBBBHHII'` per entry，Vista+ 支持），输出 `icon.ico` 13198 字节含 6 尺寸，PIL `IcoFile.sizes()` 验证通过——满足坑点 6 的 256×256 硬约束。chrome-devtools MCP 的 `evaluate_script` + `canvas.toDataURL` 路径也试过，PNG 透明度 OK 但 base64 经传输给 Python 时被损坏（PIL 报 `unrecognized data stream`），改走 headless chrome 文件输出更稳。
  - **文件改动**：`resources/icon.svg`（859 字节，重写）、`resources/icon-256.png`（4740 字节，重新生成）、`resources/icon.ico`（13198 字节，重新生成，gitignore）、`resources/ICON_README.md`（重写为新方案 C 描述 + headless chrome/Pillow 重生命令）。
  - **双端同步**：hdresearch-python MCP 从 WSL `/home/arcdent/github/ocr-app/resources/` 复制 4 文件到 `/mnt/c/Users/yanga/Projects/ocr-app/resources/`，SHA-256 逐文件校验全 identical（坑点 3）。
  - **验证**：`npm run typecheck` 零错误；`npx vitest run` 275/275 通过（17 文件，3.97s）。未打包（用户未要求 bump 版本号，仅换资源；下次发版走 CI 路径 A 时会自动用新 icon.ico）。
  - **把手截断修复（同日）**：首次打包后用户发现放大镜把手被截断。根因：headless chrome `--screenshot` 命令渲染 SVG 时裁切了内容（256 PNG bbox 只到 x=204/y=168，把手端点 (206,196)+round cap 应到 (212,202) 却缺失 ~19px）。修复：改用 chrome-devtools MCP 的 `canvas.toDataURL` 路径渲染（bbox 完整到 (212,202)），base64 分 5 块（每块 2000 字符）经 `evaluate_script` 取回后 Python 拼接解码（避免单次传输 9236 字符 base64 损坏——之前 PIL 报 `unrecognized data stream` 即此）。新 256 PNG 6925 字节（旧 4740），ICO 15968 字节含 6 尺寸，bbox 验证完整。**坑点追加：headless chrome `--screenshot` 不可靠，canvas.toDataURL 才是 SVG→PNG 的可靠路径；base64 超长需分块传输**。
  - **重打包**：`npx electron-builder --win` 一次成功（无 ECONNRESET），产出 `dist/OCR App-1.0.1-portable.exe` 66.26 MB（22:16，覆盖 22:03 旧版）。版本号保持 1.0.1（同版本内修复，产物覆盖）。

- **2026-06-22**: v1.0.0 发布——README 重写 + GitHub 仓库创建 + tag 触发自动打包 workflow
  - **README 重写**：仿 MaiCLI 风格（ASCII logo + 徽章 + 功能表格 + ASCII 界面截图 + FAQ + 贡献指南 + 许可证）。版本号 0.4.4 → 1.0.0。
  - **GitHub 仓库**：创建 `ArcDent/ocr-app`（public），推送 master 全历史。
  - **workflow**：`.github/workflows/build-portable.yml`，tag `v*` 触发，在 `windows-latest` 上 `npm ci` → typecheck → electron-vite build → `electron-builder --win portable` → 上传 portable exe 到 GitHub Release。Node 20（electron-builder 26 的 app-builder-lib require 纯 ESM 的 @noble/hashes，Node 18 不支持 require(ESM)）。
  - **CI 修复既有 typecheck 错误**（7 条全清零）：①`store.test.ts` 删未用 `newStore` 局部；②`orchestrator.test.ts` 的 randomUUID mock 用合法 UUID 格式字符串（template-literal 类型拒 `mock-uuid-1234`）；③`ResultDetail.test.tsx` 补 `import { describe, it, expect, vi } from 'vitest'`；④恢复 `@types/jest`（测试用 describe/it/expect globals，非死依赖——我之前误删）；⑤`tsconfig.json` 清残留 `@/*` paths alias。
  - **双端同步**：PowerShell Copy-Item 逐文件同步 WSL→Windows，哈希校验全 OK；package-lock 在 Windows 端 `npm install` 重新生成后同步回 WSL。
  - **Release**：https://github.com/ArcDent/ocr-app/releases/tag/v1.0.0，portable exe 作为 asset 已上传。workflow 3 分 45 秒全绿。

- **2026-06-22**: 代码与文档瘦身收敛（第一性原理 + 降低错误面，未打包，待双端同步）
  - **根目录垃圾删除**：`.clinerules-{architect,ask,code,debug,test}`（Cline IDE 残留）、`.probe-uuid.cjs`（uuid 调试探针）、`.superpowers/`（空状态缓存）、`C:\Users\yanga\Projects\ocr-app\.claude`（Windows 路径在 WSL 被当字面量创建的错误目录）、`docs/`（TASK_*_COMPLETE.md × 3 + PHASE_6_*.md + superpowers/ 下 16 个历史 specs/plans——设计决策已固化到 .claude/CLAUDE.md 坑点 + AGENTS.md 关键发现）。docs 目录随之删除。
  - **死依赖清理**（package.json）：`uuid` + `@types/uuid`（坑点 8 已改 crypto.randomUUID）、`react-router-dom`（源码零引用，App 无路由）、`@types/jest`（用 vitest，@testing-library/jest-dom 自带类型）、`touch`（零引用）、`@types/electron-store`（v8 自带类型，源码用 any）。同步清理 electron-builder.yml 排除列表中对已删 `.probe-uuid.cjs`/`forge.config.js` 的引用。
  - **源码瘦身**：①删 `src/main/pipeline/types.ts`（纯 re-export shared/types，orchestrator 已直接 import，零引用）；②`src/preload/index.ts` 删 `once` + `removeAllListeners`（未用）+ 清掉既有死 import `IPC_CHANNELS`；③`src/renderer/src/App.tsx` 删 `handleDragOver`/`handleDrop` + `onDragOver`/`onDrop`（未实现的拖拽伪扩展点，注释自承"rely on pickFiles buttons"）；④`src/main/history/history-manager.ts` 用 shared `HISTORY_LIMIT` 替代本地重复常量 `MAX_HISTORY_ITEMS`；⑤`tailwind.config.js` 删 `fade-in` + `paper-rise` keyframes/animation（零引用，仅 overlay-fade-in/zoom-in/seal-press 在用）；⑥`electron.vite.config.ts` + `vitest.workspace.ts` 删 `@` alias（源码零引用）。
  - **文档收敛**：README.md 版本号 0.4.2 → 0.4.4 同步 + 用例数 274 → 275；AGENTS.md「最近操作」从 7 条裁到 5 条（删 0.4.0 UI 优化 6 项重复条 + CLAUDE.md 收尾约束条，后者已固化在 .claude/CLAUDE.md）。
  - **验证**：typecheck 零新增错误（7 条既存错误全在 main/preload 测试文件未触及）；vitest 275/275 通过（17 文件，WSL 原生路径 `node node_modules/vitest/vitest.mjs run`）。

- **2026-06-22**: 修复窗口圆角消失 + 复制按钮挡内容两个问题，已打包 0.4.4 portable exe
  - **根因 1（窗口圆角消失，0.4.2 有 0.4.3 没了）**：用户确认 Win11 + 还原态窗口本角圆角消失。调查 `main/index.ts` 配置正确（titleBarStyle: 'hidden' + titleBarOverlay，frame 默认 true、resizable 默认 true、roundedCorners 默认 true、无 transparent）。tavily 查 Electron 官方文档 + issue #32981：`resizable: false` / `frame: false` / `transparent: true` 会让 Win11 圆角失效——本项目均无这些配置。0.4.2→0.4.3 未动 main/index.ts（只改了 App.tsx 按钮 + ConfigDialog no-drag），代码层面窗口配置没变。根因判定：**Win11 DWM 对 frameless-titlebar 窗口圆角判定的 OS 层抖动**（已知行为，valinet 文章证实软件显示适配器/远程会话也会让圆角失效）。防御性根因修复：显式设 `roundedCorners: true`（Electron 官方 Windows 圆角控制选项，虽默认 true 但显式声明确保意图明确、防隐式行为漂移）。若重打后仍无圆角则是 OS/驱动层问题非代码可修。
  - **根因 2（复制按钮挡内容）**：`ResultDetail.tsx` 的复制按钮 `absolute top-3 right-3 z-10` 浮在内容区右上角，长等宽文本延伸到按钮下方被遮挡。用户方案：移到导出按钮旁边。实施：①把 `activeTab` state 从 ResultDetail 内部 useState **提升到 App 组件**（最小改动，不污染 store），ResultDetail 接 `activeTab` + `onActiveTabChange` props 并导出 `ResultTab` 类型；②移除 ResultDetail 内部 absolute 复制按钮 + `copyToClipboard` + `copySuccess` state + `Copy` import；③App.tsx 底部 Action Bar 新增复制按钮（与导出按钮并列 `gap-3`），根据 `currentResult` + `activeTab` 算 `currentContent`，调 `navigator.clipboard.writeText` + sonner toast 反馈 + `copySuccess` 2s 视态（已复制/复制内容文案切换）；④`ResultDetail.test.tsx` 更新：所有 render 传 `activeTab` + `onActiveTabChange` props，tab 切换测试改为 controlled prop rerender + 新增 `onActiveTabChange` 回调用例。
  - **验证**：typecheck 零新增错误（7 条既存错误全在 main/preload 测试文件未触及）；vitest 全量 274/274 通过（17 文件，ResultDetail 5 测试含新增 onActiveTabChange 用例）；electron-vite build + electron-builder 打包（待完成通知后验证产物）。
  - **双端同步**：WSL 改 5 文件（main/index.ts、App.tsx、ResultDetail.tsx、ResultDetail.test.tsx、package.json），`[System.IO.File]::WriteAllText` LF 无 BOM 同步到 Windows，逐文件 `$a -eq $b` 校验全 OK。
  - **版本号**：0.4.3 → 0.4.4（patch，UI bug 修复）。

- **2026-06-22**: 修复设置按钮布局 + ConfigDialog x 关不掉两个问题，已打包 0.4.3 portable exe
  - **根因 1（设置按钮位置偏）**：`App.tsx` header 用 `justify-between` + `pr-[140px]`，Settings 按钮作为末元素停在距窗口右缘 140px 处避让 titleBarOverlay 系统控件，视觉上偏左。用户要求移到"摘要栏上面"（右侧 ResultDetail 面板顶部）。修复：header 移除 Settings 按钮、改 `justify-start`；右侧面板容器顶部新增工具栏（`px-4 py-2.5 border-b` + `justify-end`）放置 Settings 按钮，无论是否选中文件都可见，位于 ResultDetail 标题/tab 栏上方。headerPadRight 保留（header 仍是 drag region，需避让系统控件）。
  - **根因 2（点 x 关不掉设置）**：**非按钮代码问题，是 Electron drag region 拦截**。`App.tsx` header 整条设了 `WebkitAppRegion: 'drag'`（窗口拖拽区），`ConfigDialog` 的 `fixed inset-0` overlay 容器**未显式设 `no-drag`**。弹窗居中时其 header 行（含 x 按钮）屏幕坐标恰好覆盖 App header 的 drag region，Electron 命中 drag 把点击交给系统做窗口拖拽，React onClick 收不到事件 → x 点了没反应。"取消""保存"在弹窗底部 y 坐标远离 App header 不受影响。修复：ConfigDialog 外层 `fixed inset-0` div 加 `style={{ WebkitAppRegion: 'no-drag' }}`，整个弹窗及其所有按钮都不再被 drag 拦截。**保留 x 按钮**（Iron Law 根因修复优于症状移除）。验证关键发现 18。
  - **验证**：typecheck 零新增错误（7 条既存错误全在 main/preload 测试文件未触及）；electron-vite build 成功，renderer CSS 23.01KB（坑点 2 通过 >210 字节）；`npm run make` 一次成功无 ECONNRESET；产出 `dist/OCR App-0.4.3-portable.exe`（66.68 MB）+ `dist/win-unpacked/ocr-app.exe`（168.71 MB）。
  - **双端同步**：WSL 改 3 文件（App.tsx、ConfigDialog.tsx、package.json），用 `[System.IO.File]::WriteAllText` LF 无 BOM 同步到 Windows `C:\Users\yanga\Projects\ocr-app`，逐文件 `$a -eq $b` 校验全 identical（避免 Out-File 默认 CRLF 导致的差异）。
  - **版本号**：0.4.2 → 0.4.3（patch，UI bug 修复）。

- **2026-06-22**: 修复两个 bug（EISDIR 选文件夹崩溃 + 标题栏未统一风格），已打包 0.4.2 portable exe
  - **根因 1（EISDIR）**：`ipc-handlers.ts` 的 `ocr:pick-files` 对 `type==='directory'` 分支直接返回目录路径（如 `D:\imgs`），renderer 把目录路径当文件 push 进 `pendingFiles`，`startBatch` 传给 `Orchestrator` → `TextInClient.recognizeFile` 调 `fs.readFile(目录)` → Node 抛 EISDIR。修复：主进程新增 `collectSupportedFiles(dir)` 递归展开目录为受支持扩展名（jpg/jpeg/png/pdf，与 files 分支 filters 一致）文件绝对路径列表；`directory` 分支调它返回文件列表而非目录路径。`readdir` 失败（EACCES 等）返回空数组不抛。测试：mock `node:fs/promises` 的 `readdir`，新增 3 个用例（展开含子目录+大小写扩展名过滤+忽略非图片、空目录返回空、readdir 失败返回空），原「返回目录路径」用例改为验证展开行为。
  - **根因 2（标题栏未统一风格）**：`main/index.ts` 的 `BrowserWindow` 未配 `titleBarStyle`/`titleBarOverlay`，用 Windows 原生标题栏（系统色背景+原生关闭按钮）与 app 朱砂/纸色主题割裂。修复（context7 查 Electron 官方文档确认 API）：`titleBarStyle: 'hidden'` + `titleBarOverlay: { color: '#f3eee2'(--paper-2), symbolColor: '#1a1815'(--ink), height: 40 }`（Windows/Linux 用系统原生覆盖控件但配色自定义；macOS 自动保留原生交通灯，overlay 选项被忽略）；`App.tsx` header 加 `style={{ WebkitAppRegion: 'drag' }}` 让整条可拖拽，设置按钮加 `WebkitAppRegion: 'no-drag'` 保持可点击；header 右侧 `pr-[140px]`（仅 Windows/Linux，macOS 用 `navigator.platform` 判断跳过）为窗口控制按钮预留空间避免遮挡。
  - **验证**：typecheck 零新增错误（7 条既存错误全在 store.test/orchestrator.test/preload 未触及文件）；274/274 测试全过（17 文件，新增 3 个目录展开用例）；electron-vite build 成功，CSS 22.96KB（含 vermilion×26/paper-2×5/c8442a×1），主进程 bundle 含 `titleBarStyle`/`titleBarOverlay`/`collectSupportedFiles`/`SUPPORTED_EXTENSIONS`，renderer bundle 含 `WebkitAppRegion`×2（drag+no-drag）。
  - **双端同步**：PowerShell `Copy-Item` 把 4 个修改文件 + package.json 从 WSL `\\wsl.localhost\ubuntu\home\arcdent\github\ocr-app` 同步到 Windows `C:\Users\yanga\Projects\ocr-app`（坑点 3 约束），哈希校验全 MATCH。
  - **打包**：版本号 bump 0.4.1→0.4.2（patch，纯 bug 修复）；`npm run make` 一次成功无 ECONNRESET；产出 `dist/OCR App-0.4.2-portable.exe`（66.68 MB）+ `dist/win-unpacked/ocr-app.exe`（168.71 MB）。

- **2026-06-22**: 修复 UI 三处样式 bug（圆角/滚动条/顶栏风格），已打包 0.4.1 portable exe
  - **根因 1（滚动条未隐藏，3 处）**：`index.css` 设计意图是「静止时 thumb 透明、滚动时朱砂显示」，规则 `.scroll-overlay::-webkit-scrollbar-thumb { background: transparent }` + `.is-scrolling::-webkit-scrollbar-thumb { background: vermilion }`。`useScrollOverlay` hook 只在滚动瞬间加 `is-scrolling`，静止时移除，因此元素必须**静态拥有 `scroll-overlay` 基类**才能在静止时匹配规则1 隐藏。但三个滚动容器只挂了 ref 没加基类：`ConfigDialog.tsx` contentRef、`FileQueueList.tsx` scrollRef、`ResultDetail.tsx` scrollRef。修复：三处 div className 追加 `scroll-overlay`。
  - **根因 2（ConfigDialog 没有圆角）**：dialog 卡片是 `rounded-xl`（24px），但直接子元素 Header（`bg-paper-2`）和 Footer（`bg-paper-2`）背景色贴边铺满、自身无圆角，且卡片无 `overflow-hidden`，子块方角盖过父级圆角。修复：dialog 卡片 className 追加 `overflow-hidden`，让 Header/Footer 被父级圆角裁剪。
  - **根因 3（顶栏风格不统一）**：App.tsx 顶 header `py-4`/标题 `text-base font-semibold`，dialog header `py-5`/标题 `text-2xl font-bold`，参数不一致。修复（对齐+强化层级）：`py-4`→`py-5`、标题 `text-base font-semibold`→`text-lg font-bold`、logo 与文字间加 `w-1 h-8 bg-vermilion rounded-sm` 朱砂竖条标识（与 dialog section 标题的朱砂点呼应）。
  - **验证**：typecheck renderer 零新增错误（7 条既存错误全在 main/preload 未触及文件）；272/272 测试全过；electron-vite build 成功，CSS 产物 22.89KB（含 `scroll-overlay` 规则）；`npx electron-builder --win` 生成 `dist/OCR App-0.4.1-portable.exe`（66.68 MB）。版本号 bump 0.4.0→0.4.1（patch，纯 bug 修复）。
  - **双端同步**：Windows 端 Edit 工具改 + WSL git 源 filesystem MCP edit_file 重放同样 5 处修改，git status 确认 5 文件 modified。
  - **已 git add**：5 文件 staged（package.json + 4 源码），未 commit（等用户决定）。

- **2026-06-22**: 前端整体重设计「纸本墨韵 / Editorial Ink」——移除「文」字 logo、ConfigDialog 卡片化、摆脱 amber+slate AI slop
  - **设计**：`/brainstorming` + sequential-thinking MCP 推导设计令牌 → AskUserQuestion 三决策（审美方向/logo 方案/body 字体）→ plan 文件 `C:\Users\yanga\.claude\plans\mossy-sleeping-volcano.md`。
  - **方向**：暖纸白 `#FAF7F0` 底 + 深墨 `#1A1815` 文字 + 朱砂红 `#C8442A`（印章红）强调 + 青墨绿 `#2D5F4E` 成功态 + 衬线 display（Iowan/Songti SC 系统栈，离线可用）。圆角体系统一为 input 8 / button 12 / card 16 / dialog 24。
  - **改动文件**（6 个，纯样式层，零逻辑改动）：`index.css`（注入 :root CSS 变量 + 字体栈 + 滚动条 amber→vermilion）、`tailwind.config.js`（extend colors/fontFamily/borderRadius/boxShadow/keyframes）、`App.tsx`（删 `<span>文</span>` 换 inline SVG 朱砂方印 logo + header/按钮全调色）、`ConfigDialog.tsx`（三个 `<section>` 包进 `bg-paper-2 border-line rounded-lg shadow-card` 卡片容器——修复用户点名的「没圆角」+ 全组件调色）、`FileQueueList.tsx`、`ResultDetail.tsx`（调色 + font-display + font-mono JSON 区）。
  - **验证**：electron-vite build 成功，CSS 产物 22.83KB（坑点 2 标准 >210 字节），grep `--paper`×9 / `vermilion`×27 / `font-display`×6 命中，`amber`/`slate-200` 残留 0。272/272 测试全绿（17 文件）——修复了一处测试断言：`ResultDetail.test.tsx:34` 断言 `⚠️ 注意`，最初误删 emoji 已恢复。typecheck 零新增错误（7 条既存错误全在 main/preload 未触及文件）。
  - **双端同步**：PowerShell `Copy-Item` 把 6 个文件从 WSL `\\wsl.localhost\Ubuntu\home\arcdent\github\ocr-app` 同步到 Windows 原生路径 `C:\Users\yanga\Projects\ocr-app`（坑点 4 约束，npm/build 必须在原生路径跑）。
## 进行中

无。v1.0.1 已发布（GitHub 仓库 ArcDent/ocr-app，tag v1.0.1，CI 3m9s 全绿，portable exe 已上传 Release https://github.com/ArcDent/ocr-app/releases/tag/v1.0.1）。「纸本墨韵」重设计 + 图标替换全部完成。

## 下一步

**立即**：
1. 视觉冒烟：下载 Release 的 `OCR-App-1.0.1-portable.exe` 跑一遍，确认新图标在任务栏/标题栏/安装器渲染正常（尤其 16x16 小尺寸下放大镜把手是否清晰）。
2. 真实 API 联调：用真实 OCR 文本（发票/聊天记录/报告）验证四类格式判定与输出效果。

**后续**：
- 若发现 LLM 高频误判类型，在 `prompts.ts` 的 TYPE_RULES 里强化判定准则。
- 后续发版：改完代码后 `git tag vX.Y.Z && git push origin vX.Y.Z`，workflow 自动构建并发布 Release。

**后续**：
- 真实 API 联调：用真实 OCR 文本（发票/聊天记录/报告）验证四类格式判定与输出效果。
- 若发现 LLM 高频误判类型，在 `prompts.ts` 的 TYPE_RULES 里强化判定准则。

## 关键发现

### 技术决策
1. **electron-builder 迁移**: 比起 forge-squirrel，`electron-builder` 的 `portable` 目标生成单文件自解压可执行程序，体积更小，更加便携。且其打包时通过 `dist/` 与 electron-vite 的 `out/` 输出隔离，完美避开了 entry point 找不到的排除机制冲突。
2. **Tailwind PostCSS 管道**: vite 默认只在根目录发现 `postcss.config.js` 时才会运行 postcss 插件。若缺失这两个配置，CSS 打包只有原样 `@tailwind`，导致样式完全失效。补全后 output 的渲染 CSS 大小正常（约 30KB+）。
3. **多尺寸图标构建限制**: Windows 平台打包要求 `win.icon` 必须包含 256x256px 资源，否则报错 `Icon must be at least 256x256 pixels`。通过 headless Chrome 从 `icon.svg` 截图并用脚本封包为包含 16-256px 多尺寸 ICO。
4. **uuid v14 与 CJS 兼容陷阱**: `uuid` 在 v14 升级为纯 ESM 无法在 electron-vite 打包出的 CJS 主进程中通过 `require` 引入。决定弃用该依赖，直接使用 Node.js 自带的 `crypto.randomUUID()`（Electron 28 支持），保持测试的 mock 对应。
5. **提示词链路防回退**: orchestrator 必须经 `chunking.ts` 的 `structureText`/`summarize` 调 `prompts.ts` 的 `buildStructurePrompt`/`buildSummaryPrompt`，禁止直接发裸 user message。改提示词时确认走 orchestrator→chunking→prompts 链路。
6. **LLM 输出格式：纯文本按类型分支**: 提示词要求 LLM 输出 `<type><thoughts><result>` 三段，`<result>` 是简洁纯文本（禁 Markdown），按四类（dialogue/kv/list/prose）+ mixed（`【】`分区块）格式。`extractResult` 有 Markdown 清洗兜底（防 LLM 不守规矩），`extractType` 提取类型（仅内部用，不持久化、不展示）。
7. **双端验证模式**: WSL 端是 git 源、node_modules 是 Linux 版（rollup-linux-x64），Windows 端 `C:\Users\yanga\Projects\ocr-app` 不是 git 仓库、是独立构建副本。测试可在 WSL 端用 `wsl -e bash -c "cd /home/arcdent/github/ocr-app && node node_modules/vitest/vitest.mjs run <path>"` 跑，但 electron-vite build 和 electron-builder 必须在 Windows 端原生路径跑。改源码后用 PowerShell `Copy-Item` 同步触及的文件到 Windows 端（哈希校验一致）。注意 `npm run test` 脚本是 `vitest`（watch 模式不退出），Windows 端交叉验证要用 `npx vitest run`。
8. **测试连接读已持久化配置的陷阱**: `settings:test-ocr`/`settings:test-llm` handler 读 `configStore.getSettings()`（已落盘），而配置对话框的新值只在渲染层 `localSettings`。若不在测试前先 `SETTINGS_SET`，测的是旧配置必然失败。已改为 store action 先静默保存当前表单再测试。后续若新增「测试」类按钮，确认它测的是当前表单值而非已持久化值。
9. **导出 success 判定阈值**: `exportBatch` 返回 `{success, failed}`（成功数/失败数），IPC handler 必须用 `success>0 && failed===0` 才标记 `success:true`——`success>0` 会把部分失败误报成功。导出提示分三色：全成功 toast.success、部分成功部分失败 toast.warning（`exportedCount>0 && failedCount>0`）、全失败 toast.error（`exportedCount===0`）。
10. **IPC 调用统一走 `window.api`**: preload 用 `exposeInMainWorld('api', ...)` 暴露 API，渲染层禁止用不存在的 `window.electron.ipcRenderer`，统一 `window.api.invoke`。
11. **叠加式滚动条用 background-color 过渡**: `::-webkit-scrollbar-thumb` 的 `transition: opacity` 在部分 Chromium 版本对伪元素不稳定，改用 `transition: background-color`——非滚动时 thumb 背景透明，`.is-scrolling` 时变琥珀色，停止 800ms 后回透明，视觉等同淡入淡出。Firefox 用 `scrollbar-color` 始终可见（退化可接受）。注：2026-06-22 前端重设计后滚动条色已从琥珀 `rgba(245,158,11,*)` 改为朱砂 `rgba(200,68,42,*)`。
12. **前端设计令牌体系（2026-06-22 重设计）**: 前端从 amber+slate 的 AI slop 迁移到「纸本墨韵」体系，令牌集中在 `index.css` `:root` CSS 变量 + `tailwind.config.js` extend 双层定义：颜色 `paper/paper-2/ink/ink-2/ink-3/line/vermilion/vermilion-2/vermilion-soft/seal/seal-soft/red-soft`；字体 `--font-display`（衬线 Iowan/Palatino/Songti SC 系统栈，离线可用无 Google Fonts 依赖）/`--font-body`（保留无衬线）/`--font-mono`（JSON 区）；圆角重定义 `sm8/md12/lg16/xl24`（input/button/card/dialog 四级体系）；阴影 `shadow-card`/`shadow-float`（纸感轻柔替代 shadow-2xl）。改样式只动这层令牌 + 组件 className，零逻辑改动。验证方式：`npm run build` 后 `out/renderer/assets/*.css` grep `vermilion`/`--paper`/`font-display` 有命中、`amber`/`slate-200` 残留为 0。
13. **ConfigDialog「卡片没圆角」根因**: 三个 `<section>`（TextIn OCR/LLM/处理参数）原本没有卡片容器，只是裸 `<h3>` + 散落输入框堆在 `space-y-8` 里，所以视觉上「没圆角」。修复方式：每个 section 包进 `bg-paper-2 border border-line rounded-lg p-5 shadow-card`。这是卡片容器的来源，不是 dialog 本身（dialog 一直是 `rounded-3xl`）。
14. **叠加式滚动条必须静态挂 `scroll-overlay` 基类（2026-06-22 修复）**: `index.css` 的规则是 `.scroll-overlay` 和 `.is-scrolling` 两类共享 `::-webkit-scrollbar-thumb { background: transparent }`，只有 `.is-scrolling` 覆盖为朱砂色。`useScrollOverlay` hook 只在滚动瞬间加 `is-scrolling`、静止 800ms 后移除，所以元素若不静态拥有 `scroll-overlay` 基类，静止时不匹配任何规则 → 浏览器默认丑滚动条常驻。修复：所有用 `useScrollOverlay` 的滚动容器 className 必须追加 `scroll-overlay` 基类。后续新增滚动容器时，`ref` + `scroll-overlay` 基类 + `useScrollOverlay(ref)` 三件套缺一不可。
15. **dialog 子元素方角遮挡父级圆角（2026-06-22 修复）**: `rounded-xl` 的卡片若直接子元素（Header/Footer）背景色贴边铺满且无 `overflow-hidden`，子块方角会盖过父级圆角，视觉上整个弹窗呈现方角。修复：dialog 卡片加 `overflow-hidden` 让子块被父级圆角裁剪。后续 dialog/卡片容器若 header/footer 贴边铺满，父级必须 `overflow-hidden`。
16. **目录选择必须主进程展开为文件列表（2026-06-22 修复 EISDIR）**: `dialog.showOpenDialog({properties:['openDirectory']})` 返回的是目录路径，不能直接喂给 `fs.readFile`（抛 EISDIR）。主进程 `ocr:pick-files` 的 `directory` 分支必须用 `fs.readdir({withFileTypes:true})` 递归展开目录为受支持扩展名（jpg/jpeg/png/pdf，与 files 分支 filters 一致）文件绝对路径列表。`readdir` 失败（EACCES 等）返回空数组不抛，避免单个无权限子目录中断整个批次。后续若新增其他受支持扩展名，同步更新 `SUPPORTED_EXTENSIONS` 常量与 files 分支 filters。
17. **frameless 标题栏用 titleBarOverlay 而非自绘窗口控件（2026-06-22 修复）**: `BrowserWindow` 配 `titleBarStyle: 'hidden'` + `titleBarOverlay: {color, symbolColor, height}`（Windows/Linux）让系统原生绘制 min/max/close 控件但用 app 主题色（paper-2 背景 #f3eee2 + ink 符号 #1a1815 + 40px 与 header 视觉高度对齐），macOS 自动保留原生交通灯且 overlay 选项被忽略。React 侧 header 加 `style={{WebkitAppRegion:'drag'}}` 让整条可拖拽，按钮加 `WebkitAppRegion:'no-drag'` 保持可点击。`WebkitAppRegion` 是 Electron 专属 CSS 属性，React CSS 类型不含需 `as React.CSSProperties` 强转，且作为内联 style 不进打包 CSS（运行时挂 DOM），验证时 grep renderer JS bundle 而非 CSS。Windows/Linux 上 header 右侧需 `pr-[140px]` 为系统控件预留空间（macOS 用 `navigator.platform` 判断跳过）。后续若 header 布局变化，确认 overlay height 与 header 实际视觉高度一致避免色带错位。
18. **overlay 覆盖 drag region 必须显式设 no-drag（2026-06-22 修复 x 关不掉）**: Electron 的 `-webkit-app-region: drag` 命中是基于屏幕像素位置的——当一个 `fixed inset-0` 的 overlay（如 ConfigDialog 遮罩）覆盖在设置了 drag 的 header 之上时，**overlay 本身若未显式设 `WebkitAppRegion: 'no-drag'`，其覆盖 drag region 的屏幕区域内的点击会被 Electron 拦截做窗口拖拽，React onClick 收不到事件**。表现为：弹窗里只有落在 App header drag region 屏幕坐标范围内的按钮（如 ConfigDialog header 行的 x）点不动，落在 drag region 之外的按钮（如底部"取消""保存"）正常。根因修复：给 overlay 容器（`fixed inset-0` 那层）加 `style={{ WebkitAppRegion: 'no-drag' }}`，整个 overlay 及其子元素都不再被 drag 命中。**禁止用"移除 x 按钮"做症状修复**——那样根因仍在，弹窗位置或内容一变就会复发。后续新增任何覆盖 header 的 fixed overlay（modal/dropdown/popover）都必须显式设 `no-drag`。
19. **CI 构建必须用 Node 20+（2026-06-22 修复 ERR_REQUIRE_ESM）**: electron-builder 26 的 app-builder-lib 依赖 `@noble/hashes@2.x`（纯 ESM 包），打包 blockmap 时用 `require()` 加载它。Node 18 不支持 `require(ESM)`，报 `ERR_REQUIRE_ESM`。GitHub Actions workflow 必须用 `node-version: 20`（或更高）。本地构建同理。后续若升级 electron-builder 版本，确认其依赖链无纯 ESM 包冲突，或 Node 版本足够。
20. **@types/jest 非死依赖（2026-06-22 误删后恢复）**: 测试文件用 `describe`/`it`/`expect`/`vi` 全局函数。vitest 本身不提供这些全局的 TypeScript 类型（运行时靠 vitest/globals，但 typecheck 时需类型声明）。`@types/jest` 提供 describe/it/expect 的类型，是 typecheck 通过的依赖。**禁止再次误删**——删后本地因 node_modules 残留不报错，但 CI 全新 `npm ci` 会暴露 `Cannot find name 'describe'`。验证方式：删任何 `@types/*` 前先 grep 测试文件是否用到其提供的全局类型。
