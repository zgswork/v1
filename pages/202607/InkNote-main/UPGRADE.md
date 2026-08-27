# InkNote 升级记录

---

## v1.5（当前）

新增 AI 助手功能：可拖拽浮动按钮 + 可拖拽聊天面板 + 移动端底部抽屉定位。

### 功能新增

#### 1. AI 浮动按钮（`.ai-fab`）

右下角灵眸图标按钮，可拖拽移动，点击展开/收起 AI 聊天面板。

- **桌面端：** `bottom:90px; right:28px`，48x48px
- **移动端（≤640px）：** `bottom:70px; right:16px`，44x44px
- hover 放大 1.1x，active 缩小 0.95x
- 拖拽状态 `dragging` 放大 1.05x + 强化阴影，过渡动画暂停

#### 2. AI 聊天面板（`.ai-chat-panel`）

固定定位的可拖拽聊天窗口，含顶部拖拽栏、消息区、输入框、发送按钮、打字动画。

**桌面端定位：**
- `top: calc(var(--header-h) + 20px); right: 20px`
- 380px 宽，max-height 100vh-80px
- 可拖拽移动（拖拽头 `#aiChatHeader`）
- z-index: 96（高于进度面板，低于分享弹窗）

**移动端（≤640px）底部抽屉：**
```css
.ai-chat-panel {
  width: calc(100vw - 16px);
  right: 8px !important;
  left: 8px !important;
  bottom: 8px !important;
  top: auto !important;
  max-height: 70vh;
  border-radius: 12px;
}
```

**极小屏（≤480px）进一步收窄：**
```css
.ai-chat-panel {
  width: calc(100vw - 12px) !important;
  right: 6px !important;
  left: 6px !important;
  bottom: 6px !important;
  max-height: 75vh;
  border-radius: 10px;
}
```

#### 3. 交互细节

- 面板打开/关闭动画：`modalPopIn` 0.25s 弹性曲线
- 消息区：`ai-messages` 自动滚动到底部，最小高度 150px
- 输入框：`ai-input-row textarea` 自动调整高度
- 打字动画：三个点 `.ai-typing` 使用 `aiTypingDot` 错帧动画
- 发送按钮：渐变背景 `linear-gradient(135deg, #7b93ff, #5a7aff)`

#### 4. 主题兼容

所有 AI 相关 CSS 变量均使用 `:root` / `[data-theme="light"]` 定义，亮暗切换无样式断裂。

### 自测验证

| 测试 | 验证内容 | 状态 |
|------|---------|:----:|
| AI FAB 显示/隐藏 | 点击切换面板，FAB 保持可见 | ✓ |
| FAB 拖拽 | 按住拖拽后释放，位置不还原 | ✓ |
| AI 面板桌面定位 | 右上角固定，top 在 header 下方 | ✓ |
| AI 面板移动端定位 | ≤640px 底部抽屉，≤480px 更窄边距 | ✓ |
| 面板拖拽 | 拖拽头后面板跟随移动 | ✓ |
| 消息发送/展示 | 输入文字发送后消息区显示 | ✓ |
| 打字动画 | AI 回复时三点动画持续 | ✓ |
| 亮暗切换 | 面板背景/文字/按钮颜色正确切换 | ✓ |

---

## v1.4

修复 1 个异常场景和删除 1 个功能遮罩。

### 1. 移动端进度面板 toggle 按钮无响应

**问题：** 移动端点击「≡」按钮时，进度面板打开后立即关闭。

**原因：** 事件冒泡导致 `document` 上的 click handler 检测到点击不在面板外部但点击到了 toggle 按钮 → 先打开 → 然后 document handler 关闭面板。

**修复：** toggle 按钮的 click 事件添加 `event.stopPropagation()` 阻止冒泡到 document。

**改动位置：** 第 4523 行

### 2. 删除功能遮罩

去掉了一个功能按钮的盖板 CSS。

---

## v1.3

修复 2 个 bug，新增 2 个体验优化。

### Bug 修复

#### 1. 进度导出按钮失效

**问题：** 点击进度面板的「📥 导出进度」按钮时，面板被关闭且没有文件下载。

**原因：** 两个子问题叠加：

- **事件冒泡导致面板关闭：** 进度面板按钮的点击事件冒泡到 document，触发了「点击外部关闭面板」的逻辑
- **URL 过早释放导致下载静默失败：** `exportProgress()` 中 `a.click()` 后立即执行 `URL.revokeObjectURL()`，浏览器还没处理完下载

**修复：**
- 导出/导入按钮添加 `event.stopPropagation()` 阻止冒泡
- `exportProgress()`、`downloadAsFile()`、`exportToHTML()` 三处下载函数均改为：先 `appendChild` 到 DOM 再 click，延迟 200ms 释放 URL

**改动位置：** 第 531-532 行（HLMT）、第 2197-2208 行、第 1637 行、第 2859-2862 行

#### 2. 保存流程相关

（v1.2 已修复，参考上一版本记录）

---

### 体验优化

#### 3. 侧边栏 active 切换优化

`openFile()` 中缓存 `state._activeTreeItem` DOM 引用，避免每次切换都 `querySelectorAll` 遍历所有 tree-item。

**改动位置：** 第 1672-1679 行

#### 4. 自定义平滑滚动

替换浏览器原生 `scroll-behavior: smooth`，使用 `ease-out-cubic` 缓动曲线（`1 - (1-t)³`）+ `requestAnimationFrame` 驱动，滚动更流畅自然。

**改动位置：** 第 2443-2459 行

---

### 自测验证

| 测试 | 验证内容 | 状态 |
|------|---------|:----:|
| 进度导出按钮 | 点击后面板不关闭，文件正常下载 | ✓ |
| 进度导入按钮 | 点击后面板不关闭，文件选择器正常弹出 | ✓ |
| 导出/下载后 URL 释放 | 延迟 200ms 后 URL 释放，不泄露 | ✓ |
| 侧边栏切换 | 连续切换不同文件，active 高亮正常 | ✓ |
| 回到顶部 | 自定义滚动动画流畅，无卡顿 | ✓ |

---

## v1.2

修复 3 个用户体验问题，涉及新建笔记、保存流程和关闭文件三个核心交互。

### 1. 新建笔记编辑器未激活

**问题：** 用户点击「＋」新建笔记后，页面显示的是预览模式，编辑器没有自动打开。

**原因：** `createNewFile()` 先调用 `openFile()` 渲染 Markdown 预览，紧接着调用 `enterEditMode()` 替换为编辑器。这个「先渲染预览再替换编辑器」的时序导致编辑器未正确激活。

**修复：** `createNewFile()` 跳过 `openFile()` 的预览渲染，直接设置 `state.currentFile` + 高亮侧边栏 + 调用 `enterEditMode()`。

**改动位置：** 第 1508-1528 行

### 2. 保存流程顺序优化

**问题：** 保存新建的 MD 文件时，流程是「弹框改文件名 → 确认 → 打开目录选择器」。用户期望先选目录再改文件名，或者一步完成。

**原因：** 原实现用 `showDirectoryPicker` 只能选目录，不能改文件名，所以需要先弹自定义 modal 让用户输入文件名。

**修复：** 改用 `showSaveFilePicker` API（原生「另存为」对话框），一个界面同时完成选目录和改文件名。不支持该 API 的浏览器走 fallback（自定义 modal + 下载）。

**改动位置：** 第 1531-1613 行

### 3. 关闭文件后侧边栏未清理

**问题：** 点击关闭文件按钮后，页面内容清除了（回到拖拽区），但侧边栏文件树仍然显示已关闭的文件。

**原因：** `closeFile()` 只清除了 `state.currentFile` 和内容区的 active 高亮，没有从 `state.files` 移除未保存文件，也没有调用 `refreshTree()` 重建侧边栏。

**修复：** `closeFile()` 在关闭前检查文件是否未保存（`_unsaved`），如果是则从 `state.files` 中移除，然后调用 `refreshTree()` 重建侧边栏。

**改动位置：** 第 1749-1761 行

### 自测验证

| 测试 | 验证内容 | 状态 |
|------|---------|:----:|
| Test 15 | `createNewFile` 后 `state._editing === true` | ✓ |
| Test 15 | `createNewFile` 后 `editorTextarea` 存在 | ✓ |
| Test 16 | 有 `showSaveFilePicker` 时直接调用，不弹 modal | ✓ |
| Test 17 | `closeFile` 后未保存文件从侧边栏移除 | ✓ |

### 兼容性

| 特性 | Chromium | Firefox | Safari |
|------|----------|---------|--------|
| `showSaveFilePicker` | ✓ | ✗ (fallback) | ✗ (fallback) |
| fallback（modal + 下载） | ✓ | ✓ | ✓ |
