# Electron Portable EXE Build Configuration

**日期**: 2026-06-20  
**目标**: 配置 electron-forge + squirrel.windows 构建单文件免安装 portable exe

---

## 一、需求概述

### 1.1 目标
将当前基于 electron-vite 的 OCR App 打包为 Windows portable 可执行文件（.exe），用户双击即可运行，无需安装。

### 1.2 技术选型
- **打包工具**: electron-forge v7+
- **Windows 打包器**: @electron-forge/maker-squirrel（基于 Squirrel.Windows）
- **保留构建工具**: electron-vite（开发构建）
- **目标平台**: Windows x64

### 1.3 成功标准
- 生成单个 .exe 文件（Setup.exe）
- 首次运行自动释放到 %LOCALAPPDATA% 并启动
- 无需管理员权限
- 包含所有运行时依赖（Node.js、Chromium、asar）
- 保持现有开发工作流不变

---

## 二、架构设计

### 2.1 构建流程

```
npm run dev          → electron-vite dev（开发环境，热重载）
npm run build        → electron-vite build（生产构建到 out/）
npm run make         → electron-forge make（打包为 portable exe）
```

**关键点：**
- electron-vite 负责编译 TypeScript + React → JavaScript
- electron-forge 负责打包已编译代码 → portable exe
- 两者职责分离，互不干扰

### 2.2 文件结构

```
ocr-app/
├── out/                          # electron-vite 构建输出（保持不变）
│   ├── main/index.js
│   ├── preload/index.js
│   └── renderer/
├── forge.config.js               # 新增：electron-forge 配置
├── package.json                  # 修改：添加 forge 相关字段和脚本
└── dist/                         # 新增：forge 打包输出目录
    └── make/
        └── squirrel.windows/
            └── x64/
                └── OCR-App-Setup.exe  # 最终 portable exe
```

### 2.3 Squirrel.Windows 工作原理

1. **Setup.exe** 是自解压安装器
2. 首次运行自动释放到 `%LOCALAPPDATA%\OCR-App\`
3. 后续直接从释放目录启动
4. 支持静默更新（future feature）

---

## 三、配置规范

### 3.1 package.json 修改

需要添加/修改的字段：

```json
{
  "name": "ocr-app",
  "productName": "OCR App",
  "version": "0.1.0",
  "main": "./out/main/index.js",
  
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "make": "npm run build && electron-forge make",
    "package": "npm run build && electron-forge package"
  },
  
  "devDependencies": {
    "@electron-forge/cli": "^7.5.0",
    "@electron-forge/maker-squirrel": "^7.5.0",
    "electron": "^28.3.3"
  },
  
  "config": {
    "forge": "./forge.config.js"
  }
}
```

**说明：**
- `productName`: 应用显示名称
- `main`: 指向 electron-vite 构建后的入口
- `config.forge`: 指向 forge 配置文件

### 3.2 forge.config.js 配置

```javascript
module.exports = {
  packagerConfig: {
    name: 'OCR-App',
    executableName: 'ocr-app',
    asar: true,
    icon: './resources/icon',  // .ico for Windows
    // 排除开发文件
    ignore: [
      /^\/src/,
      /^\/docs/,
      /^\/\.git/,
      /^\/\.claude/,
      /^\/node_modules\/(?!.*\.node$)/  // 保留 native modules
    ]
  },
  
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'OCR-App',
        authors: 'ArcDent',
        exe: 'ocr-app.exe',
        setupExe: 'OCR-App-Setup.exe',
        setupIcon: './resources/icon.ico',
        loadingGif: './resources/install.gif',  // 可选：安装动画
        noMsi: true  // 不生成 MSI 安装包
      }
    }
  ],
  
  // 可选：插件配置
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    }
  ]
}
```

**关键配置说明：**
- `asar: true`: 打包为 asar 归档（提升加载速度，防篡改）
- `setupExe`: 最终生成的 portable exe 文件名
- `noMsi: true`: 只生成 Setup.exe，不生成 MSI
- `ignore`: 排除源码和开发文件，减小体积

### 3.3 资源文件要求

需要准备的文件：

```
resources/
├── icon.ico          # Windows 图标（256x256, 包含多尺寸）
└── install.gif       # 可选：安装动画（400x300 推荐）
```

**图标规范：**
- 格式：.ico
- 尺寸：16x16, 32x32, 48x48, 128x128, 256x256
- 工具推荐：使用 png2icons 或 ImageMagick 转换

---

## 四、实现步骤

### 4.1 安装依赖

```bash
npm install --save-dev @electron-forge/cli @electron-forge/maker-squirrel @electron-forge/plugin-auto-unpack-natives
```

### 4.2 创建配置文件

创建 `forge.config.js`（内容见 3.2）

### 4.3 修改 package.json

添加 forge 相关字段和脚本（内容见 3.1）

### 4.4 准备资源文件

**创建临时图标**（后续替换为正式图标）：

```bash
mkdir -p resources
# 使用 Electron 默认图标作为临时占位符
cp node_modules/electron/dist/resources/default_app.asar.ico resources/icon.ico
```

**或跳过图标**（forge 会使用 Electron 默认图标）：
- 如果 `resources/icon.ico` 不存在，构建仍会成功
- 生成的 exe 将使用 Electron 默认图标

### 4.5 构建测试

```bash
# Step 1: 编译源码
npm run build

# Step 2: 打包为 portable exe
npm run make

# Step 3: 测试生成的 exe
./dist/make/squirrel.windows/x64/OCR-App-Setup.exe
```

---

## 五、边界和约束

### 5.1 明确边界

**包含在 spec 内：**
- electron-forge + squirrel.windows 配置
- 构建脚本和工作流集成
- 基础图标资源准备

**不包含在 spec 内：**
- 代码签名配置（需要证书，单独配置）
- 自动更新机制（future feature）
- macOS/Linux 打包（仅 Windows）
- CI/CD 集成（后续任务）

### 5.2 已知约束

1. **体积约束**: 最终 exe 约 150-200MB（包含 Electron runtime）
2. **权限约束**: 安装到 %LOCALAPPDATA%，无需管理员权限
3. **兼容性**: 仅支持 Windows 10/11 x64
4. **首次运行**: 需要短暂的自解压过程（~5-10 秒）

### 5.3 依赖关系

- **构建依赖**: 必须先运行 `npm run build` 才能 `npm run make`
- **Node 版本**: 需要 Node.js 16.x+ （Electron 28 要求）
- **磁盘空间**: 构建过程需要约 500MB 临时空间

---

## 六、验证方式

### 6.1 构建验证

```bash
npm run build && npm run make
```

**预期输出：**
- 无错误
- 生成文件：`dist/make/squirrel.windows/x64/OCR-App-Setup.exe`
- 文件大小：150-200MB

### 6.2 运行验证

1. 双击 `OCR-App-Setup.exe`
2. 观察自解压过程（5-10 秒）
3. 应用自动启动
4. 测试核心功能：文件选择、OCR、导出

### 6.3 卸载验证

在 Windows 设置 → 应用中应能看到 "OCR App"，可正常卸载。

---

## 七、风险和缓解

### 7.1 已知风险

**风险 1**: Native modules 打包失败
- **缓解**: 使用 `@electron-forge/plugin-auto-unpack-natives` 自动处理

**风险 2**: asar 打包后文件路径问题
- **缓解**: 使用 `__dirname` 和 `app.getAppPath()` 获取路径，不使用相对路径

**风险 3**: electron-store 数据路径
- **缓解**: electron-store 默认使用 `app.getPath('userData')`，不受 portable 影响

**风险 4**: 构建时间过长
- **缓解**: 首次构建约 5-10 分钟，后续构建约 1-2 分钟（缓存生效）

### 7.2 回滚策略

如果 electron-forge 配置失败，可回退到：
- 保留 electron-vite 开发环境
- 使用 `npm run dev` 继续开发
- 删除 forge.config.js 和相关依赖

---

## 八、后续扩展

以下功能不在本次 spec 范围，但预留扩展点：

1. **代码签名**: 添加 `signWithParams` 配置
2. **自动更新**: 配置 Squirrel 更新服务器
3. **多语言**: 添加 `languages` 字段
4. **安装选项**: 配置快捷方式、开机启动等

---

## 九、设计批准

**设计师**: Claude (AI Assistant)  
**批准日期**: 待自审通过  
**设计版本**: v1.0

**关键决策**:
- 选择 electron-forge + squirrel.windows 而非 electron-builder
- 保留 electron-vite 作为开发构建工具
- 仅支持 Windows x64 平台
- 不包含代码签名和自动更新

---

**文档结束**
