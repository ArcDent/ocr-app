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

无。LLM 结构化提示词重设计已全部完成并打包。

## 下一步

**立即**：
1. 运行 `C:\Users\yanga\Projects\ocr-app\dist\OCR App-0.1.0-portable.exe` 验证单文件自解压运行、配置真实 TextIn + LLM 凭证跑通全链路，确认 LLM 输出为简洁纯文本（无 Markdown 标记、按类型分支）。
2. 决定 `feat/structured-prompt-redesign` 分支是否合并回 master（9 个 commit 待合并）。

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
7. **双端验证模式**: WSL 端是 git 源、node_modules 是 Linux 版（rollup-linux-x64），Windows 端 `C:\Users\yanga\Projects\ocr-app` 不是 git 仓库、是独立构建副本。测试可在 WSL 端用 `wsl -e bash -c "cd /home/arcdent/github/ocr-app && node node_modules/vitest/vitest.mjs run <path>"` 跑，但 electron-vite build 和 electron-builder 必须在 Windows 端原生路径跑。改源码后用 PowerShell `Copy-Item` 同步触及的文件到 Windows 端（哈希校验一致）。
