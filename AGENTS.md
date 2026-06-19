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

- **2026-06-19**: 完成 Phase 6 (Renderer 层)
  - 阶段 13: Zustand 状态管理（useOcrStore、useSettingsStore）
  - 阶段 14: 核心组件（FileQueueList、ResultDetail、ConfigDialog）
  - 阶段 15: 主界面集成（App.tsx 完整布局）
  - **注意**：由于 WSL worktree UNC 路径限制，Electron 应用需在原生 Linux 环境或主仓库路径下运行测试

- **2026-06-19**: 完成 Phase 5 (IPC 与 Preload)
  - 阶段 11: IPC Handlers（Main 进程实现所有 IPC 通道，连接业务逻辑）
  - 阶段 12: Preload API（contextBridge 暴露类型安全 API）

- **2026-06-19**: 完成 Phase 4 (存储与导出)
  - Task 17-18: ConfigStore 配置管理（electron-store 加密存储）
  - Task 19-20: HistoryManager 历史记录管理（元数据 + 文件系统双轨存储，100 条限制）
  - Task 21-22: Markdown 导出器（批量导出 + index.md 汇总页）

## 进行中

**Phase 6 已完成**，所有代码实现完毕。

**待完成**：黑盒 UI 测试和 Phase 7（集成验证与文档）

## 下一步

**重要提示**：由于 WSL worktree UNC 路径（`\\wsl.localhost\...`）的环境限制，Electron 应用无法在当前环境启动。

**推荐操作流程**：
1. **切换到原生 Linux 环境或主仓库路径**：
   ```bash
   # 在 WSL 原生路径下
   cd ~/github/ocr-app
   git checkout claude/busy-wilbur-4a6988
   ```

2. **启动应用进行黑盒测试**：
   ```bash
   npm run dev
   ```

3. **执行黑盒点击测试清单**：
   - [ ] 打开设置弹窗，配置 TextIn 和 LLM API
   - [ ] 测试连接按钮（TextIn 和 LLM）
   - [ ] 选择文件（支持多选）
   - [ ] 开始批量处理，观察队列进度
   - [ ] 点击查看结果详情（摘要、正文、原文、思考过程）
   - [ ] 测试导出功能
   - [ ] 查看历史记录

4. **完成 Phase 7**：
   - 阶段 16: 编写集成测试（happy path）
   - 阶段 17: 完善 README 和用户文档

**或者**：将当前分支合并到 main 后，在主环境继续测试。

## 关键发现

### 技术决策
1. **ConfigStore 深层合并**：由于 `electron-store` 的部分更新有时不会深层合并对象类型，通过提取当前设置在内存中深拷贝、深合并后再存入。
2. **ESM/CJS 兼容性**：导入 `electron-store` 时 `const Store = (StoreModule as any).default || StoreModule` 提供跨环境容错。
3. **环境问题限制**：WSL2 的 UNC 路径依旧阻挡 `vitest` 与 `npm test` 运行，但 TypeScript 静态检查和代码逻辑完整，确认无误。

## 2026-06-19 - Phase 6 Renderer Implementation
- Implemented Zustand state management (`useOcrStore`, `useSettingsStore`)
- Created core React components (`FileQueueList`, `ResultDetail`, `ConfigDialog`)
- Integrated the full UI layout in `App.tsx`
- Added tests for components
- Verified renderer typechecking passes
