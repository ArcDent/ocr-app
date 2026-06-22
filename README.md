# OCR App

OCR 文字识别 + LLM 结构化提取的桌面应用。

## 功能特性

- 通过 TextIn API 实现高质量 OCR 识别（图片/PDF 多页）
- 通过 OpenAI 兼容接口对接本地/远程 LLM 做结构化处理
- 忠实提取 / 增强摘要两种处理模式
- 可配置的并行批量处理，支持 map-reduce 摘要聚合
- 选文件夹自动递归展开为内部图片/PDF 文件列表
- Frameless 自定义标题栏（朱砂/纸色主题统一风格）
- 基于 electron-store 的全局配置管理 + 历史结果持久化
- 批量导出结构化结果为 Markdown

## 快速开始

```bash
# 安装依赖（必须在 WSL 原生路径或 Windows 原生路径执行，禁止 UNC 路径）
npm install

# 启动开发服务器（electron-vite dev）
npm run dev
```

## 常用命令

```bash
# 运行单元测试（vitest watch 模式）
npm run test

# 一次性运行全部测试
npx vitest run

# 类型检查
npm run typecheck

# 构建（electron-vite 产物到 out/，不打包）
npm run build
```

## 生产构建

### Windows 便携版 exe

```bash
npm run make
```

该命令会：

1. 通过 electron-vite 编译 TypeScript/React 源码，产物输出到 `out/`（main/preload/renderer）
2. 通过 electron-builder 打包成 Windows 单文件 portable exe
3. 产物输出到：`dist/OCR App-<version>-portable.exe`（当前 `0.4.4`）
4. 免安装目录：`dist/win-unpacked/ocr-app.exe`

**首次构建**可能因 electron-builder 向 GitHub 请求 Electron 元数据而 `ECONNRESET`，直接重试 `npx electron-builder --win` 即可（非配置问题）。

### 构建环境要求

- Node.js 18+（Electron 28 要求）
- Windows 10/11 x64，或可访问 Windows 文件系统的 WSL2
- `resources/icon.ico` 须含 256x256 及以上尺寸条目（否则 electron-builder 报 `Icon must be at least 256x256 pixels`）
- 约 500MB 可用磁盘空间

### 使用 portable exe

双击 `dist/OCR App-0.4.4-portable.exe` 即可运行，无需安装。

> **注意**：严禁在 WSL2 UNC 路径（`\\wsl.localhost\...`）下执行 `npm install` / `npm run make`（会因 `.bin` 符号链接 `EISDIR` 崩溃）。请改在 Windows 原生路径 `C:\...` 或 WSL 原生路径 `/home/...` 执行。

## 项目结构

```
src/
├── main/             # 主进程（OCR、LLM、任务编排、配置存储、IPC handlers、导出、历史）
│   ├── index.ts      # BrowserWindow 入口（frameless + titleBarOverlay）
│   ├── ipc-handlers.ts  # IPC 通道注册（含目录展开为文件列表）
│   ├── ocr/          # TextInClient
│   ├── llm/          # LlmClient + chunking + prompts
│   ├── pipeline/     # Orchestrator
│   ├── history/      # HistoryManager
│   └── export/       # markdown-exporter
├── preload/          # contextBridge 暴露给渲染进程的 API
├── renderer/         # React UI 界面（Zustand + Tailwind 纸本墨韵主题）
├── shared/           # 跨进程共享类型（IPC 通道、配置、JobResult）
resources/            # 图标（icon.ico 多尺寸）
electron-builder.yml  # electron-builder 配置
tailwind.config.js    # Tailwind CSS 配置
postcss.config.js     # PostCSS 配置（tailwindcss + autoprefixer）
```

## 技术栈

- Electron 28 + electron-vite + electron-builder
- TypeScript 5.9 + React 18 + Zustand
- Tailwind CSS（「纸本墨韵」主题：paper/ink/vermilion/seal 色系）
- Vitest 单元测试（275 个用例）
