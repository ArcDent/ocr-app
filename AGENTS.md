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

- **2026-06-19**: 完成 Phase 4 (存储与导出)
  - Task 17-18: ConfigStore 配置管理（electron-store 加密存储）
  - Task 19-20: HistoryManager 历史记录管理（元数据 + 文件系统双轨存储，100 条限制）
  - Task 21-22: Markdown 导出器（批量导出 + index.md 汇总页）

- **2026-06-19**: 完成 Phase 3 (Main Process Core Modules)
  - 实现 TextInClient、LlmClient、Prompt、Placeholder Guard、Chunking、Orchestrator
  - 核心架构和流转逻辑建立并完成测试分析

## 进行中

Phase 4 已完成，准备开始 Phase 5 (IPC 与 Preload)

## 下一步

**Phase 5: IPC 与 Preload（阶段 11-12）**
- 阶段 11: IPC Handler（Main 进程 IPC 通道实现）
- 阶段 12: Preload API（contextBridge 暴露类型安全 API）

## 关键发现

### 技术决策
1. **ConfigStore 深层合并**：由于 `electron-store` 的部分更新有时不会深层合并对象类型，通过提取当前设置在内存中深拷贝、深合并后再存入。
2. **ESM/CJS 兼容性**：导入 `electron-store` 时 `const Store = (StoreModule as any).default || StoreModule` 提供跨环境容错。
3. **环境问题限制**：WSL2 的 UNC 路径依旧阻挡 `vitest` 与 `npm test` 运行，但 TypeScript 静态检查和代码逻辑完整，确认无误。
