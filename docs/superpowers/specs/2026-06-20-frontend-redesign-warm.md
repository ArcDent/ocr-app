# OCR App 前端重构设计方案 - 柔和温暖风格

**设计日期**: 2026-06-20  
**设计目标**: 将现有的蓝色系界面重构为温暖色系，提升界面的友好度和视觉吸引力，同时保持专业性和功能完整性

---

## 一、设计决策总览

### 1.1 整体风格
- **视觉风格**: 柔和温暖 (Warm & Soft)
- **参考案例**: Dribbble 流行设计、创意工具类应用
- **核心特征**: 温暖色系、圆润外观、友好亲和、柔和阴影

### 1.2 配色方案
- **主题名称**: 琥珀蜂蜜 (Amber Honey)
- **色彩组成**: 琥珀色 (amber) → 蜂蜜黄 (yellow) → 柔橙 (orange)
- **情感表达**: 温暖、明亮、积极向上

### 1.3 圆角程度
- **选择**: 适中圆角 (16-20px)
- **平衡点**: 友好且现代，平衡专业和亲和

### 1.4 布局策略
- **保持现有布局**: 左侧队列 + 右侧详情的双栏结构
- **信息密度**: 适中，不做大幅调整
- **改动范围**: 仅视觉层（颜色、圆角、阴影、渐变）

---

## 二、色彩系统设计

### 2.1 主色调映射表

| 用途 | 当前颜色 | 新颜色 | 说明 |
|------|---------|--------|------|
| 主按钮背景 | `from-blue-600 to-indigo-600` | `from-amber-500 to-orange-500` | 主要操作按钮 |
| 主按钮 Hover | `from-blue-700 to-indigo-700` | `from-amber-600 to-orange-600` | 悬停加深 |
| 选中态背景 | `from-blue-100 to-indigo-100` | `from-amber-100 to-orange-100` | 队列选中项 |
| 浅色背景 | `from-slate-50 via-blue-50 to-indigo-50` | `from-amber-50 via-orange-50 to-yellow-50` | 页面主背景 |
| 强调色 | `blue-600` | `amber-500` | 边框、图标等 |
| 次要强调 | `blue-500` | `amber-400` | 辅助元素 |
| 浅色面板 | `from-slate-50 to-blue-50` | `from-amber-50 to-orange-50` | Header、标题栏 |

### 2.2 功能色（保持不变）

- **成功色**: `emerald-*` 系列（绿色通用表示成功）
- **错误色**: `red-*` 系列（红色通用表示错误）
- **警告色**: `amber-*` 系列（已是温暖色系，保持）
- **中性色**: `slate-*` 系列（文字、边框、背景保持）

### 2.3 新增视觉效果

- **装饰渐变**: `from-amber-400 via-yellow-400 to-orange-400`
- **阴影光晕**: `shadow-amber-500/20` (主按钮)、`shadow-orange-100` (卡片 hover)
- **边框色**: `border-amber-300`、`border-orange-300`

---

## 三、组件视觉规范

### 3.1 Header（顶栏）

**文件**: `src/renderer/src/App.tsx`

**修改内容**:
```tsx
// Logo 图标背景
from: bg-gradient-to-br from-blue-600 to-indigo-600
to:   bg-gradient-to-br from-amber-500 to-orange-500

// Header 背景（保持不变）
bg-white/80 backdrop-blur-md

// 副标题颜色
from: text-slate-500
to:   text-amber-600

// 设置按钮 hover
from: hover:bg-slate-100
to:   hover:bg-amber-50
```

### 3.2 主按钮（开始处理 / 取消处理）

**文件**: `src/renderer/src/App.tsx`

**开始处理按钮**:
```tsx
from: bg-gradient-to-r from-blue-600 to-indigo-600
      hover:from-blue-700 hover:to-indigo-700
      shadow-lg
to:   bg-gradient-to-r from-amber-500 to-orange-500
      hover:from-amber-600 hover:to-orange-600
      shadow-lg shadow-amber-500/20
```

**取消处理按钮**:
```tsx
from: bg-gradient-to-r from-red-50 to-orange-50
      border-2 border-red-300
to:   保持不变（已是温暖色系）
```

**Disabled 状态**:
```tsx
from: disabled:from-slate-300 disabled:to-slate-400
to:   disabled:from-slate-300 disabled:to-slate-400
      (保持灰色，符合 disabled 惯例)
```

### 3.3 模式切换按钮（忠实提取 / 增强摘要）

**文件**: `src/renderer/src/App.tsx`

**选中态**:
```tsx
from: bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md
to:   bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md
```

**未选中态**:
```tsx
from: bg-white text-slate-700 hover:bg-slate-50
to:   bg-white text-slate-700 hover:bg-amber-50
```

**容器圆角**: 保持 `rounded-xl`

### 3.4 文件选择按钮

**文件**: `src/renderer/src/App.tsx`

**选择文件按钮**:
```tsx
from: bg-gradient-to-r from-blue-50 to-indigo-50
      border border-blue-200
      text-blue-700
      hover:from-blue-100 hover:to-indigo-100
to:   bg-gradient-to-r from-amber-50 to-orange-50
      border border-amber-300
      text-amber-700
      hover:from-amber-100 hover:to-orange-100
```

**选择文件夹按钮**:
```tsx
from: bg-gradient-to-r from-purple-50 to-pink-50
      border border-purple-200
      text-purple-700
      hover:from-purple-100 hover:to-pink-100
to:   bg-gradient-to-r from-orange-50 to-yellow-50
      border border-orange-300
      text-orange-700
      hover:from-orange-100 hover:to-yellow-100
```

### 3.5 队列列表（FileQueueList）

**文件**: `src/renderer/src/components/FileQueueList.tsx`

**标题栏背景**:
```tsx
from: bg-gradient-to-r from-slate-50 to-blue-50
to:   bg-gradient-to-r from-amber-50 to-orange-50
```

**选中态队列项**:
```tsx
from: bg-gradient-to-r from-blue-100 to-indigo-100 border-l-4 border-blue-600
to:   bg-gradient-to-r from-amber-100 to-orange-100 border-l-4 border-amber-500
```

**进度条**:
```tsx
from: bg-gradient-to-r from-blue-500 to-indigo-600
to:   bg-gradient-to-r from-amber-400 to-orange-500
```

**加载图标颜色**:
```tsx
from: text-blue-500
to:   text-amber-500
```

### 3.6 结果详情（ResultDetail）

**文件**: `src/renderer/src/components/ResultDetail.tsx`

**标题栏背景**:
```tsx
from: bg-gradient-to-r from-slate-50 to-blue-50
to:   bg-gradient-to-r from-amber-50 to-orange-50
```

**模式标签（增强摘要）**:
```tsx
from: bg-gradient-to-r from-purple-100 to-pink-100
      text-purple-800
      border border-purple-300
to:   bg-gradient-to-r from-amber-100 to-yellow-100
      text-amber-800
      border border-amber-300
```

**模式标签（忠实提取）**:
```tsx
from: bg-gradient-to-r from-blue-100 to-indigo-100
      text-blue-800
      border border-blue-300
to:   bg-gradient-to-r from-orange-100 to-amber-100
      text-orange-800
      border border-orange-300
```

**标签页选中态**:
```tsx
from: border-blue-600 text-blue-700 bg-blue-50/50
to:   border-amber-500 text-amber-700 bg-amber-50/50
```

**标签页未选中**:
```tsx
from: text-slate-600 hover:text-slate-800 hover:bg-slate-50
to:   text-slate-600 hover:text-slate-800 hover:bg-amber-50
```

**警告提示框**:
```tsx
from: bg-gradient-to-r from-amber-50 to-yellow-50
      border-l-4 border-amber-400
to:   保持不变（已是温暖色系）
```

**AI 推理过程展开按钮**:
```tsx
from: bg-gradient-to-r from-slate-50 to-blue-50
      hover:from-slate-100 hover:to-blue-100
to:   bg-gradient-to-r from-amber-50 to-orange-50
      hover:from-amber-100 hover:to-orange-100
```

### 3.7 配置对话框（ConfigDialog）

**文件**: `src/renderer/src/components/ConfigDialog.tsx`

**Header 背景**:
```tsx
from: bg-gradient-to-r from-slate-50 to-blue-50
to:   bg-gradient-to-r from-amber-50 to-orange-50
```

**测试按钮（OCR）**:
```tsx
from: bg-gradient-to-r from-blue-50 to-indigo-50
      border-2 border-blue-300
      text-blue-700
      hover:from-blue-100 hover:to-indigo-100
to:   bg-gradient-to-r from-amber-50 to-orange-50
      border-2 border-amber-300
      text-amber-700
      hover:from-amber-100 hover:to-orange-100
```

**测试按钮（LLM）**:
```tsx
from: bg-gradient-to-r from-purple-50 to-pink-50
      border-2 border-purple-300
      text-purple-700
      hover:from-purple-100 hover:to-pink-100
to:   bg-gradient-to-r from-orange-50 to-yellow-50
      border-2 border-orange-300
      text-orange-700
      hover:from-orange-100 hover:to-yellow-100
```

**保存配置按钮**:
```tsx
from: bg-gradient-to-r from-blue-600 to-indigo-600
      hover:from-blue-700 hover:to-indigo-700
to:   bg-gradient-to-r from-amber-500 to-orange-500
      hover:from-amber-600 hover:to-orange-600
```

**Footer 背景**:
```tsx
from: bg-gradient-to-r from-slate-50 to-blue-50
to:   bg-gradient-to-r from-amber-50 to-orange-50
```

**Input focus 状态**:
```tsx
from: focus:border-blue-500 (OCR)
      focus:border-purple-500 (LLM)
      focus:border-emerald-500 (Processing)
to:   focus:border-amber-500 (OCR)
      focus:border-orange-500 (LLM)
      focus:border-amber-500 (Processing)
```

### 3.8 页面背景

**文件**: `src/renderer/src/App.tsx`

```tsx
from: bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50
to:   bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50
```

### 3.9 导出按钮

**文件**: `src/renderer/src/App.tsx`

```tsx
// 保持绿色系不变
bg-gradient-to-r from-emerald-50 to-teal-50
border-2 border-emerald-300
text-emerald-700
hover:from-emerald-100 hover:to-teal-100
```

---

## 四、圆角和间距规范

### 4.1 圆角系统

| 元素类型 | Tailwind Class | 像素值 | 应用场景 |
|---------|---------------|--------|---------|
| 大容器 | `rounded-2xl` | 16px | Panel、Dialog、主卡片 |
| 中等元素 | `rounded-xl` | 12px | Button、Card、Input、队列项 |
| 小元素 | `rounded-lg` | 8px | Badge、小按钮 |
| 圆形元素 | `rounded-full` | 50% | 文本占位符、圆形图标 |

**不做修改**: 当前代码已使用 `rounded-2xl` 和 `rounded-xl`，符合设计规范，无需调整。

### 4.2 间距系统

**保持不变**: 所有 padding、margin、gap 保持现有值，不做调整。

---

## 五、阴影和视觉效果

### 5.1 阴影系统

**主按钮阴影**:
```tsx
from: shadow-lg
to:   shadow-lg shadow-amber-500/20
```

**卡片阴影**:
```tsx
// 保持不变
shadow-lg
```

**Dialog 阴影**: 保持 `shadow-2xl`

### 5.2 其他视觉效果

- **毛玻璃效果**: 保持现有的 `backdrop-blur-md` 和 `backdrop-blur-sm`
- **透明度**: 保持现有的 `/80`、`/90`、`/60` 等透明度设置
- **过渡动画**: 保持 `transition-all duration-200`

---

## 六、实现策略

### 6.1 修改文件清单

1. `src/renderer/src/App.tsx` - 主界面（Header、按钮、背景）
2. `src/renderer/src/components/FileQueueList.tsx` - 队列列表
3. `src/renderer/src/components/ResultDetail.tsx` - 结果详情
4. `src/renderer/src/components/ConfigDialog.tsx` - 配置对话框

### 6.2 测试文件

- `src/renderer/src/__tests__/components/FileQueueList.test.tsx` - 无需修改（文本内容未变）
- `src/renderer/src/__tests__/components/ResultDetail.test.tsx` - 无需修改（文本内容未变）

### 6.3 实现步骤

1. **Phase 1: 全局背景和 Header** (App.tsx)
   - 修改页面主背景渐变
   - 修改 Header logo 颜色
   - 修改 Header 副标题和设置按钮颜色

2. **Phase 2: 主要操作按钮** (App.tsx)
   - 修改"开始处理"按钮（含阴影）
   - 修改模式切换按钮
   - 修改文件选择按钮

3. **Phase 3: 队列列表** (FileQueueList.tsx)
   - 修改标题栏背景
   - 修改选中态样式
   - 修改进度条颜色
   - 修改加载图标颜色

4. **Phase 4: 结果详情** (ResultDetail.tsx)
   - 修改标题栏背景
   - 修改模式标签
   - 修改标签页选中态
   - 修改 AI 推理展开按钮

5. **Phase 5: 配置对话框** (ConfigDialog.tsx)
   - 修改 Header 和 Footer 背景
   - 修改测试按钮
   - 修改保存按钮
   - 修改 Input focus 边框色

### 6.4 验证方式

- 运行 `npm run dev` 启动开发服务器
- 目视检查所有页面和交互状态
- 运行 `npm test -- --run` 确保测试通过
- 验证不同状态：hover、选中、disabled、loading

---

## 七、设计原则和边界

### 7.1 设计原则

1. **保持功能完整**: 只改视觉，不改逻辑
2. **渐进增强**: 优先替换核心视觉元素（按钮、选中态）
3. **一致性**: 温暖色系统一应用，不混用蓝色
4. **可访问性**: 保持足够的对比度（文字与背景）

### 7.2 不改动的部分

- 组件结构和 HTML 层级
- 事件处理逻辑
- 状态管理（Zustand stores）
- IPC 通信
- 测试逻辑（除非 class 选择器需要更新）
- 图标选择（Lucide icons 保持）

### 7.3 风险控制

- **颜色对比度检查**: 确保文字颜色在背景上达到 WCAG AA 标准（4.5:1）。使用 `amber-700/800/900` 在白色背景上，`white` 在 `amber-500/600` 背景上
- **避免过度温暖**: 保留足够的中性色（slate 系列）用于文字和边框
- **测试覆盖**: 运行完整测试套件（230 tests），确保无回归

---

## 八、后续可选优化

以下内容不在本次设计范围内，可作为未来迭代考虑：

1. **自定义阴影工具类**: 在 `tailwind.config.js` 中定义暖色阴影
2. **深色模式**: 设计对应的深色温暖主题
3. **动画增强**: 增加更丰富的过渡动画
4. **插画元素**: 在空状态添加温暖风格的插画
5. **字体优化**: 引入更温暖的字体（如圆体）

---

## 九、设计检查清单

### 9.1 色彩检查
- [ ] 所有蓝色系已替换为琥珀-橙色系
- [ ] 功能色（绿色、红色）保持不变
- [ ] 中性色（slate）保持不变
- [ ] 背景渐变已更新为温暖色系

### 9.2 组件检查
- [ ] Header logo 和副标题已更新
- [ ] 主按钮（开始处理）已更新含阴影
- [ ] 模式切换按钮已更新
- [ ] 文件选择按钮已更新
- [ ] 队列列表选中态已更新
- [ ] 进度条颜色已更新
- [ ] 标签页选中态已更新
- [ ] 配置对话框按钮已更新
- [ ] 导出按钮保持绿色

### 9.3 测试检查
- [ ] 所有单元测试通过
- [ ] 目视验证所有交互状态
- [ ] 验证 hover、focus、disabled 状态
- [ ] 验证不同模式（忠实提取、增强摘要）

---

## 十、设计批准

**设计师**: Claude (AI Assistant)  
**批准日期**: 待用户确认  
**设计版本**: v1.0

**关键决策记录**:
1. 选择"柔和温暖"风格而非极简/专业/流畅渐变
2. 选择"琥珀蜂蜜"配色而非蜜桃珊瑚/赤陶玫瑰/日落霞光
3. 选择"适中圆角"(16-20px) 而非轻微/超大
4. 选择"保持当前布局"而非重新布局
5. 选择"混合优化方案"而非渐进式/完整重构

---

**文档结束**
