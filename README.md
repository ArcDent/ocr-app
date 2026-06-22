<!-- markdownlint-disable -->

<p align="center">
  <pre>
 _    _    __  __ __      ___   ___ ___
| |  | |  |  \/  / _|___ / _ \ / __| _ \
| |__| |__| |\/| > _|_ _| (_) | (__|   /
|____|____|_|  |_\_____| \___/ \___|_|_\
          OCR + LLM 结构化工坊
  </pre>
</p>

<div align="center">

![Electron](https://img.shields.io/badge/Electron-28-47848F?style=for-the-badge&logo=electron&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Windows-blue?style=for-the-badge)
![Version](https://img.shields.io/badge/Version-1.0.1-C8442A?style=for-the-badge)

OCR 文字识别 + LLM 结构化提取桌面应用

把图片/PDF 变成结构化纯文本，纸本墨韵，一键导出

[功能介绍](#功能特点) • [快速开始](#快速开始) • [界面展示](#界面展示) • [构建打包](#构建打包) • [常见问题](#常见问题) • [贡献指南](#贡献指南)

</div>

---

## 项目简介

OCR App 是一款基于 Electron 的桌面应用，把 **TextIn OCR** 与 **OpenAI 兼容 LLM** 串成一条最小闭环：选文件，然后文字识别、结构化排版、摘要，最后导出 Markdown。

- **TextIn** 提供高质量多页 OCR（图片/PDF）
- **LLM** 按 dialogue / kv / list / prose / mixed 五类格式重组为纯文本，禁 Markdown、禁占位符

### 为什么选 OCR App

- **最小闭环**：从选文件到导出 Markdown 一条龙，不堆砌伪扩展点
- **纸本墨韵**：暖纸白 + 深墨 + 朱砂红主题，frameless 自定义标题栏
- **忠实 / 增强双模式**：忠实提取保留原文，增强摘要高置信度修错
- **map-reduce 摘要**：超长文本分块处理再聚合，不丢语义
- **批量并行**：可配置并发，目录递归展开自动过滤图片/PDF

---

## 功能特点

### 核心功能

| 功能 | 描述 |
|:---|:---|
| **多页 OCR** | TextIn API 识别图片/PDF，按行拼接 |
| **结构化排版** | LLM 按文档类型重组为简洁纯文本，禁 Markdown |
| **双处理模式** | 忠实提取（只排版）/ 增强摘要（高置信度修错） |
| **分块聚合** | 超长文本 map-reduce，多 chunk 类型聚合为 mixed |
| **占位符守卫** | 检测 `[待补充]`/`TODO`/`……` 等占位符并警告 |
| **历史持久化** | 结果落盘到 userData，最近 100 条可回看 |
| **批量导出** | 一键导出全部结果为 Markdown + index.md 索引 |

### 界面特性

| 特性 | 描述 |
|:---|:---|
| **纸本墨韵主题** | paper / ink / vermilion / seal 四色体系，衬线 display 字体 |
| **Frameless 标题栏** | titleBarOverlay 配 app 主题色，Win11 原生圆角 |
| **叠加式滚动条** | 静止透明、滚动朱砂，macOS 风格 |
| **Toast 反馈** | sonner 分色提示（成功/警告/失败） |
| **状态灯** | 队列清晰显示 queued/ocr/structuring/summarizing/done/error |

### 技术特性

| 特性 | 描述 |
|:---|:---|
| **IPC 类型契约** | IpcRequest/IpcResponse/IpcEvents 强类型通道 |
| **可恢复错误重试** | 5xx / 网络错误自动重试一次，4xx 不重试 |
| **并发信号量** | Promise.race 控制并发上限 |
| **electron-store 加密** | 配置加密落盘 |
| **275 单元测试** | Vitest 全量覆盖 main + renderer |

---

## 快速开始

### 环境要求

- **操作系统**: Windows 10/11 x64
- **Node.js**: ≥ 18（Electron 28 要求；CI 打包需 ≥ 20）
- **磁盘**: 约 500MB（含 Electron 缓存）

### 开发模式

```bash
# 安装依赖（必须在 WSL 原生路径或 Windows 原生路径，禁止 UNC 路径）
npm install

# 启动 electron-vite 开发服务器
npm run dev
```

### 常用命令

```bash
npm run test          # vitest watch 模式
npx vitest run        # 一次性运行全部测试
npm run typecheck     # tsc 类型检查
npm run build         # electron-vite 构建到 out/（不打包）
```

---

## 界面展示

### 主界面

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ▣ OCR 结构化工坊          OCR + AI 结构化处理                            │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐  ┌──────────────────────────────────────────────┐ │
│ │ 选择文件 选择文件夹 │  │ [设置]                                       │ │
│ │                  │  │                                              │ │
│ │ 处理模式          │  │  文件名.pdf                                  │ │
│ │ [忠实] [增强]     │  │  [增强摘要]  2026/6/22 18:00                 │ │
│ │                  │  │  ─────────────────────────                   │ │
│ │ ▶ 开始处理        │  │  [结构化内容] [摘要] [原始 OCR]              │ │
│ ├──────────────────┤  │                                              │ │
│ │ 任务队列 (3)     │  │  字段名：值                                   │ │
│ │ ✓ done.pdf       │  │  探索广度：1337 首                           │ │
│ │ ◷ ocr 中...      │  │  相遇次数：75 次                             │ │
│ │ ○ queued         │  │                                              │ │
│ │                  │  │                                              │ │
│ ├──────────────────┤  ├──────────────────────────────────────────────┤ │
│ │                  │  │ [复制内容]  [导出所有结果]                    │ │
│ └──────────────────┘  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 配置对话框

```
        ┌──────────────────────────────────────────┐
        │  系统配置                            ✕    │
        ├──────────────────────────────────────────┤
        │  ┌─ TextIn OCR 配置 ──────────────────┐  │
        │  │  App ID      [_______________]    │  │
        │  │  Secret Code [_______________]    │  │
        │  │  Base URL    [_______________]    │  │
        │  │  [测试 OCR 连接]                   │  │
        │  └──────────────────────────────────┘  │
        │  ┌─ LLM 配置 ─────────────────────────┐  │
        │  │  Base URL  [_______________]      │  │
        │  │  API Key   [_______________]      │  │
        │  │  模型      [_______________]      │  │
        │  │  [测试 LLM 连接]                   │  │
        │  └──────────────────────────────────┘  │
        │  ┌─ 处理参数 ─────────────────────────┐  │
        │  │  并发数量   [3]   1-10             │  │
        │  │  分块阈值   [12000] 字符           │  │
        │  └──────────────────────────────────┘  │
        │                          [取消] [保存]  │
        └──────────────────────────────────────────┘
```

---

## 构建打包

### Windows 便携版 exe

```bash
npm run make
```

该命令会：

1. electron-vite 编译 TypeScript/React 源码到 `out/`（main/preload/renderer）
2. electron-builder 打包成 Windows 单文件 portable exe
3. 产物：`dist/OCR App-1.0.1-portable.exe`
4. 免安装目录：`dist/win-unpacked/ocr-app.exe`

**首次构建**可能因 electron-builder 向 GitHub 请求 Electron 元数据而 `ECONNRESET`，直接重试 `npx electron-builder --win` 即可（非配置问题）。

### 构建环境要求

- Node.js 18+（本地开发）；20+（CI 打包，见下）
- Windows 10/11 x64，或可访问 Windows 文件系统的 WSL2
- `resources/icon.ico` 须含 256x256 及以上尺寸条目
- 约 500MB 可用磁盘空间

### 使用 portable exe

双击 `dist/OCR App-1.0.1-portable.exe` 即可运行，无需安装。

> **注意**：严禁在 WSL2 UNC 路径（`\\wsl.localhost\...`）下执行 `npm install` / `npm run make`（会因 `.bin` 符号链接 `EISDIR` 崩溃）。请改在 Windows 原生路径 `C:\...` 或 WSL 原生路径 `/home/...` 执行。

### 自动化构建（GitHub Actions）

打 tag 触发自动构建并发布到 Release：

```bash
git tag v1.0.1
git push origin v1.0.1
```

workflow 会在 `windows-latest`（Node 20）上依次执行 `npm ci`、typecheck、`electron-vite build`、`electron-builder --win portable`，把 `OCR App-<tag>-portable.exe` 上传到对应 Release。约 4 分钟出产物，见 https://github.com/ArcDent/ocr-app/releases 。

---

## 项目结构

```
src/
├── main/             # 主进程
│   ├── index.ts      # BrowserWindow 入口（frameless + titleBarOverlay）
│   ├── ipc-handlers.ts  # IPC 通道（含目录展开为文件列表）
│   ├── store.ts      # electron-store 配置存储
│   ├── ocr/          # TextInClient
│   ├── llm/          # LlmClient + chunking + prompts + placeholder-guard
│   ├── pipeline/     # Orchestrator
│   ├── history/      # HistoryManager
│   └── export/       # markdown-exporter
├── preload/          # contextBridge 暴露 invoke/on API
├── renderer/         # React UI（Zustand + Tailwind 纸本墨韵）
└── shared/           # 跨进程共享类型（IPC 契约、配置、JobResult）
resources/            # 图标（icon.ico 多尺寸）
electron-builder.yml  # electron-builder 配置
tailwind.config.js    # Tailwind CSS 配置
postcss.config.js     # PostCSS（tailwindcss + autoprefixer）
```

---

## 技术栈

| 技术 | 版本 | 用途 |
|:---|:-----|:-----|
| Electron | 28 | 桌面应用框架 |
| electron-vite | 2.3 | 构建 + 热重载 |
| electron-builder | 26 | 打包 portable exe |
| TypeScript | 5.9 | 类型安全 |
| React | 18 | UI |
| Zustand | 4 | 状态管理 |
| Tailwind CSS | 3.4 | 纸本墨韵主题 |
| Vitest | 1.6 | 单元测试（275 用例） |
| lucide-react | 1.x | 图标 |
| sonner | 1.x | Toast 通知 |

---

## 常见问题

### Q: 测试连接失败怎么排查？

**A:** 设置对话框的「测试连接」会先静默保存当前表单值再测试，测的是表单当前值而非旧配置。若仍失败，依次检查 TextIn 的 App ID / Secret Code、LLM 的 API Key / Base URL / 模型名是否正确，以及网络能否访问对应 API。

### Q: 构建报 `Icon must be at least 256x256 pixels`？

**A:** `resources/icon.ico` 必须含 256x256 及以上尺寸条目。当前为多尺寸（256/128/64/48/32/16）。若替换图标，用支持多尺寸的 ICO 生成工具确保含 256x256。

### Q: GitHub 访问困难导致构建卡住或首次 `ECONNRESET`？

**A:** `npm run make` 首次可能 `ECONNRESET`，是 electron-builder 请求 Electron 元数据时的网络抖动，Electron zip 缓存在 `C:\Users\<u>\AppData\Local\electron\Cache`，直接重试即可，非配置问题。

### Q: CI workflow 构建失败 `ERR_REQUIRE_ESM`？

**A:** electron-builder 26 的 app-builder-lib 依赖纯 ESM 包 `@noble/hashes`，Node 18 不支持 `require(ESM)`。`.github/workflows/build-portable.yml` 已固定 `node-version: 20`。本地跑 `npm run make` 若也遇到，升级 Node 到 20+。

### Q: CI `npm ci` 报 lock 文件 `out of sync`？

**A:** 删改 `package.json` 依赖后必须重新生成 `package-lock.json`（在原生路径 `npm install`）并 commit，否则 `npm ci` 严格校验失败。

---

## 贡献指南

### 开发环境搭建

```bash
git clone https://github.com/ArcDent/ocr-app.git
cd ocr-app

npm install                # 必须在原生路径，禁止 UNC
npm run dev                # 启动开发
npm run test               # 跑测试
npm run typecheck          # 类型检查
```

### 代码规范

- TypeScript 严格类型，提交前 `npm run typecheck` 零错误
- 修改后跑 `npx vitest run`，测试全绿
- 修改 Tailwind/PostCSS 后 `npm run build` 检查 CSS 产物（应 ~30KB）
- 主进程禁用纯 ESM 依赖（uuid v14 与 CJS 不兼容，用 `crypto.randomUUID()`）
- CI 跑 typecheck 且不容忍既有错误，提交前务必本地验证通过

### 提交规范

```
feat: 新功能
fix: 错误修复
docs: 文档更新
refactor: 重构
test: 测试相关
chore: 构建/工具相关
```

---

## 许可证

本项目采用 [MIT](LICENSE) 许可证开源。

---

## 致谢

- [TextIn](https://www.textin.com/) — 多页 OCR API
- [Electron](https://www.electronjs.org/) — 跨平台桌面框架
- [Tailwind CSS](https://tailwindcss.com/) — 原子化 CSS
- [Zustand](https://github.com/pmndrs/zustand) — 轻量状态管理

---

<div align="center">

Made by [ArcDent](https://github.com/ArcDent)

Star 如果这个项目对你有帮助

</div>

<!-- markdownlint-restore -->