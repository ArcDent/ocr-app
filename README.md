# OCR App

OCR 文字识别 + LLM 结构化提取的桌面应用。

## 功能特性

- 通过 TextIn API 实现高质量 OCR 识别
- 通过 OpenAI 兼容接口对接本地/远程 LLM 做结构化处理
- 忠实/增强两种回退处理模式
- 可配置的并行批量处理，支持 map-reduce 摘要聚合
- 基于 electron-store 的全局配置管理

## 快速开始

```bash
# 安装依赖（必须在 WSL 原生路径或 Windows 原生路径执行，见下方"已知坑点"）
npm install

# 启动开发服务器
npm run dev
```

## 常用命令

```bash
# 运行单元测试（vitest）
npm run test

# 类型检查
npm run typecheck

# 构建（electron-vite 产物，不打包）
npm run build
```

## 生产构建

### Windows 便携版 exe

```bash
npm run make
```

该命令会：

1. 通过 electron-vite 编译 TypeScript/React 源码，产物输出到 `out/`
2. 通过 electron-forge 打包成 portable exe（Squirrel.Windows 安装器）
3. 产物输出到：`dist/make/squirrel.windows/x64/OCR-App-Setup.exe`

**首次构建**需 5–10 分钟（下载 Electron 二进制）；后续构建约 1–2 分钟。

### 构建环境要求

- Node.js 18+（Electron 28 要求）
- Windows 10/11 x64，或可访问 Windows 文件系统的 WSL2
- 约 500MB 可用磁盘空间

### 使用安装器

双击 `OCR-App-Setup.exe` 安装并启动。应用会：

- 自动解压到 `%LOCALAPPDATA%\OCR-App\`
- 无需管理员权限运行
- 出现在 Windows「应用和功能」中，可卸载

也可直接运行免安装版 `dist/OCR-App-win32-x64/ocr-app.exe` 验证功能。

> **注意**：若在 WSL2 UNC 路径（`\\wsl.localhost\...`）下执行 `npm install` 报错，请改在 Windows 原生文件系统的 PowerShell 或 Git Bash 中运行。

## 项目结构

```
src/
├── main/             # 主进程（OCR、LLM、任务编排、配置存储）
├── preload/          # contextBridge 暴露给渲染进程的 API
├── renderer/         # React UI 界面
├── shared/           # 跨进程共享类型（IPC 定义、配置）
```

## 项目状态

已完成 Phase 1–3：

- 项目脚手架
- 共享类型定义
- 主进程核心模块（TextInClient、LlmClient、Orchestrator、ConfigStore）
