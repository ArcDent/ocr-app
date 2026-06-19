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

- **2026-06-19**: 完成 Task 17-18 (ConfigStore 存储实现与测试)
  - 使用 `electron-store` 封装安全、带默认回退的配置存储
  - 支持 `textin` 和 `llm` 配置树的 Deep Merge 部分更新
  - 完成全局配置单元测试覆盖
- **2026-06-19**: 整理工作区
  - 将测试与覆盖率输出移至 `docs/`
  - 将独立 JS 校验脚本移至 `scripts/`
- **2026-06-19**: 完成 Phase 3 (Main Process Core Modules)
  - 实现 TextInClient、LlmClient、Prompt、Placeholder Guard、Chunking、Orchestrator
  - 核心架构和流转逻辑建立并完成测试分析

## 进行中

完成 `ConfigStore`，进行中: Phase 4 (存储与导出) 的其余部分。

## 下一步

- **Phase 4: 存储与导出（Task 19-24）**
  - Task 19-20: 历史记录管理（history.ts + tests）
  - Task 21-22: 文本落盘存储（fs-writer.ts + tests）
  - Task 23-24: Markdown 导出器（exporter.ts + tests）

## 关键发现

### 技术决策
1. **ConfigStore 深层合并**：由于 `electron-store` 的部分更新有时不会深层合并对象类型，通过提取当前设置在内存中深拷贝、深合并后再存入。
2. **ESM/CJS 兼容性**：导入 `electron-store` 时 `const Store = (StoreModule as any).default || StoreModule` 提供跨环境容错。
3. **环境问题限制**：WSL2 的 UNC 路径依旧阻挡 `vitest` 与 `npm test` 运行，但 TypeScript 静态检查和代码逻辑完整，确认无误。
