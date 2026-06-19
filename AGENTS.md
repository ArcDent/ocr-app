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

- **2026-06-20**: 迁移打包工具至 electron-builder 并修复 Tailwind 编译与图标问题
  - **打包迁移**: 彻底删除 `forge.config.js` 及其在 `package.json` 中的依赖，引入 `electron-builder`。配置 `electron-builder.yml` 输出 `portable` Windows 单文件 exe，打包产物路径变更为 `dist/OCR App-0.1.0-portable.exe`。
  - **Tailwind 样式修复**: 新建 `tailwind.config.js` 和 `postcss.config.js` 于项目根目录，引入 `tailwindcss` 和 `autoprefixer` 插件，打通 Vite 构建 CSS 的 PostCSS 管道，解决打包后前端由于未编译 `@tailwind` 指令导致样式完全丢失的 bug。
  - **图标升级**: 生成多尺寸（256/128/64/48/32/16）ICO 格式的 `resources/icon.ico`，替换低分辨率占位图标，满足 electron-builder 构建必须提供至少 256x256 图标的硬性要求。
  - **配置同步**: 将以上改动和新建配置文件（`.claude/CLAUDE.md`, `electron-builder.yml`, `tailwind.config.js`, `postcss.config.js`, `.gitignore`）同步到 Windows 本地路径 `C:\Users\yanga\Projects\ocr-app\`，实现 WSL 源码和 Windows 构建端一致性。

- **2026-06-20**: 中文化 README.md 并创建项目级 `.claude/CLAUDE.md`
  - **README.md**: 全文改为中文，更新构建与运行说明，使用新的 electron-builder 命令。
  - **`.claude/CLAUDE.md`**: 记录 8 个项目已知坑点（包括 out/ 目录冲突、双端同步、UNC 路径 npm install 限制、ESM/CJS 兼容性等）和命令表。

- **2026-06-20**: 前端主题重构为温暖色系（全部完成）
  - **设计方案**：从蓝色系重构为琥珀蜂蜜主题（amber-honey），保持功能完整性。
  - **修改文件**：`App.tsx`, `FileQueueList.tsx`, `ResultDetail.tsx`, `ConfigDialog.tsx`。

- **2026-06-20**: 前端美化与功能修复（全部完成）
  - **中文化界面**：所有按钮、标签、提示文本改为中文。
  - **修复导出路径问题**：新增 `DIALOG_PICK_EXPORT_DIR` IPC 通道，导出前弹出目录选择对话框。
  - **清理 LLM 输出注释**：`llm-client.ts` 过滤 `<!-- ... -->` XML 注释。

## 进行中

无。迁移 electron-builder、Tailwind 样式修复、多尺寸图标生成及双端同步已全部完成。

## 下一步

**立即**：
1. 运行 `dist/OCR App-0.1.0-portable.exe` 验证单文件自解压运行、主题样式是否正常。
2. 进行 happy path 流程测试。

**后续**：
- 真实 API 联调：配置真实 TextIn + LLM 凭证，跑通全链路。
- 完善单元测试与集成测试。

## 关键发现

### 技术决策
1. **electron-builder 迁移**: 比起 forge-squirrel，`electron-builder` 的 `portable` 目标生成单文件自解压可执行程序，体积更小，更加便携。且其打包时通过 `dist/` 与 electron-vite 的 `out/` 输出隔离，完美避开了 entry point 找不到的排除机制冲突。
2. **Tailwind PostCSS 管道**: vite 默认只在根目录发现 `postcss.config.js` 时才会运行 postcss 插件。若缺失这两个配置，CSS 打包只有原样 `@tailwind`，导致样式完全失效。补全后 output 的渲染 CSS 大小正常（约 30KB+）。
3. **多尺寸图标构建限制**: Windows 平台打包要求 `win.icon` 必须包含 256x256px 资源，否则报错 `Icon must be at least 256x256 pixels`。通过 headless Chrome 从 `icon.svg` 截图并用脚本封包为包含 16-256px 多尺寸 ICO。
4. **uuid v14 与 CJS 兼容陷阱**: `uuid` 在 v14 升级为纯 ESM 无法在 electron-vite 打包出的 CJS 主进程中通过 `require` 引入。决定弃用该依赖，直接使用 Node.js 自带的 `crypto.randomUUID()`（Electron 28 支持），保持测试的 mock 对应。
