# OCR App — 项目级 CLAUDE.md

本项目级规则在全局 CLAUDE.md 基础上追加，记录 OCR App 的专属约定与已踩坑点。
全局规则优先级高于本文件冲突处；本文件针对项目特性补充。

---

## 项目身份

- **类型**：Electron 桌面应用（OCR + LLM 结构化提取）
- **技术栈**：Electron 28、TypeScript 5.9、React 18、Zustand、Tailwind CSS、Vitest、electron-vite、electron-forge
- **入口**：`package.json` `main: "./out/main/index.js"`（electron-vite 构建产物）

## 核心命令

| 命令 | 作用 |
|------|------|
| `npm run dev` | electron-vite 开发模式 |
| `npm run build` | electron-vite 构建，产物到 `out/` |
| `npm run make` | `build` + electron-builder 打包成 Windows 单文件 portable exe |
| `npm run package` | `build` + electron-builder 仅打包不生成安装器（`--dir`） |
| `npm run test` | vitest 单元测试 |
| `npm run typecheck` | tsc 类型检查 |

## 目录约定

- `src/main`、`src/preload`、`src/renderer`、`src/shared`：源码
- `out/`：**electron-vite 构建产物**（main/preload/renderer），被打包进 app
- `dist/`：**electron-builder 打包产物**（`dist/win-unpacked/` 免安装目录 + `dist/OCR App-0.1.0-portable.exe` 单文件）
- `resources/`：图标等资源（`icon.ico`、`icon.svg`、`icon-256.png`）
- `out/`、`dist/`、`resources/*.ico` 均在 `.gitignore` 中忽略

---

## 已知坑点（强约束，不可跳过）

### 1. `out/` 目录命名冲突（历史，已解决）

**坑**：electron-vite 默认输出目录是 `out/`，electron-forge 默认输出目录也是 `out/`，两者冲突导致 forge 打包时把 `out/` 整体排除，报 `main entry point not found`。

**现状**：已切到 electron-builder（builder 默认输出 `dist/`，与 electron-vite 的 `out/` 不冲突）。本坑点保留作历史背景，**electron-forge 相关配置已全部移除**，`forge.config.js` 已删除。

### 2. Tailwind/PostCSS 配置必须存在（最高优先级）

**坑**：`src/renderer/src/index.css` 用 `@tailwind base/components/utilities` 指令，若项目根没有 `postcss.config.js` 和 `tailwind.config.js`，vite 的 PostCSS pipeline 不含 tailwindcss 插件，`@tailwind` 指令不被编译，产物 CSS 仅 ~210 字节、无任何工具类规则，界面表现为「功能正常但无样式」（琥珀色主题等 Tailwind class 全部失效）。

**约束**：`tailwind.config.js`（`content: ['./src/renderer/**/*.{tsx,ts,html}']`）和 `postcss.config.js`（plugins: tailwindcss + autoprefixer）**必须存在**于项目根。修改 CSS 入口或 Tailwind 依赖时务必确认这两个文件还在。验证方式：`npm run build` 后 `out/renderer/assets/*.css` 应为 ~30KB 且 grep amber 有命中。

### 3. Windows/WSL 双端配置必须同步

**坑**：本项目通过 WSL UNC 路径（`\\wsl.localhost\...`）在 Windows 端访问，同时 git 仓库在 WSL。两端配置文件曾出现不一致导致行为漂移。

**约束**：修改任一端配置文件（`package.json`、`electron-builder.yml`、`tailwind.config.js`、`postcss.config.js` 等）时，必须同步另一端。WSL 端（`/home/arcdent/github/ocr-app/`）是 git 源，Windows 端（`C:\Users\yanga\Projects\ocr-app\`）是实际构建处，两边内容必须完全一致。`resources/icon.ico` 等二进制构建产物被 gitignore，无需同步。

### 4. npm install 不能在 UNC 路径执行

**坑**：通过 `\\wsl.localhost\...` 访问时，Windows 端 `npm install` 会因 `.bin` 符号链接是目录而 `EISDIR` 崩溃，可能损坏 node_modules。

**约束**：`npm install` 必须在 Windows 原生路径（`C:\...`）或 WSL 原生路径（`/home/...`）执行，严禁在 UNC 路径下运行。

### 5. 构建首跑可能 ECONNRESET（非 bug）

**坑**：`npm run make` 首次运行可能报 `read ECONNRESET`，是 electron-builder 向 GitHub 请求 Electron 元数据时的网络抖动，**非配置问题**。Electron zip 缓存在 `C:\Users\yanga\AppData\Local\electron\Cache`。

**约束**：遇到 ECONNRESET 直接重试 `npx electron-builder --win`，不要当 bug 排查，不要改配置。

### 6. icon.ico 至少 256x256

**坑**：electron-builder 要求 `win.icon` 至少 256x256 像素，否则报 `Icon must be at least 256x256 pixels` 中断构建。早期占位 icon.ico 仅 32x32。

**约束**：`resources/icon.ico` 必须含 256x256 及以上尺寸条目（当前为多尺寸：256/128/64/48/32/16）。生成方式：headless Chrome 把 `icon.svg` 截图成 256 PNG，再用脚本封装成 ICO（PNG-in-ICO，Vista+ 支持）。`icon-256.png` 是中间产物，可入 git。

### 7. package.json 不要保留 root `directories` 字段

**坑**：electron-builder 26 报 `"directories" in the root is deprecated, please specify in the "build"` 并中断构建。

**约束**：`directories` 配置只放 `electron-builder.yml`（yml 文件本身就是 build 节），package.json 不要有 `directories` 字段。

### 8. uuid v14 纯 ESM 与 CJS 主进程不兼容

**坑**：electron-vite 把 main 进程打成 CJS（`package.json type: commonjs`），`import { v4 } from 'uuid'` 编译成 `require('uuid')`，uuid v14 是纯 ESM 触发 `ERR_REQUIRE_ESM` 崩溃。

**约束**：主进程生成 UUID 用 Node 内置 `crypto.randomUUID()`（Electron 28 的 Node 18 支持），**禁止**重新引入 uuid 依赖。测试中 mock 用 `vi.mock('crypto', () => ({ randomUUID: vi.fn() }))`。

---

## 开发流程补充

- 修改 `electron-builder.yml` 或 `package.json` 后，必须在 Windows 端实际跑 `npx electron-builder --win` 验证，不能只靠 typecheck/test
- 修改 Tailwind/PostCSS 配置后，必须 `npm run build` 检查 `out/renderer/assets/*.css` 体积和 amber 命中
- 新增主进程依赖前，检查是否为纯 ESM 包，若是则评估 CJS 兼容性（参考坑点 8）
- 修改构建配置后同步更新本文件「已知坑点」与 `AGENTS.md`「关键发现」

## 收尾流程约束（强约束，不可跳过）

本项目在全局「任务收尾执行顺序」基础上，追加以下项目专属收尾步骤。
当本次任务涉及功能/修复/可见变更、准备交付时，按以下顺序执行，**顺序不可调换**：

1. **先更新版本号** — 在 `package.json` 中按 semver 递增 `version` 字段
   （常规修复/小功能 → patch；新增功能 → minor；破坏性变更 → major）。
   版本号决定 portable exe 文件名（`dist/OCR App-<version>-portable.exe`），
   必须先改版本号再打包，否则产物会覆盖上一次同名 exe，无法追溯。

2. **同步双端配置** — 修改 `package.json` 后按坑点 3 同步 WSL/Windows 两端，
   避免构建处与 git 源漂移。

3. **再打包成单一二进制 portable exe** — 在 Windows 原生路径执行
   `npm run make`（= `build` + `electron-builder --win`），产出
   `dist/OCR App-<version>-portable.exe` 单文件。
   严禁在 UNC 路径下执行（坑点 4）。

4. **验证产物** — 确认 `dist/OCR App-<version>-portable.exe` 存在且体积合理；
   遇到 ECONNRESET 按坑点 5 直接重试，不当 bug 排查。
   注意坑点 6：`resources/icon.ico` 须含 256x256 尺寸，否则构建中断。

**顺序铁律**：版本号未更新就打包 → 旧版本 portable exe 被覆盖、无法回溯。

## 参考

- 构建产物路径：`dist/OCR App-0.1.0-portable.exe`（单文件 portable）、`dist/win-unpacked/ocr-app.exe`（免安装目录）
- 完整技术决策记录见 `AGENTS.md`「关键发现」章节
