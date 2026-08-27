# CSS皮肤系统设计规范

## 一、系统架构概述

本系统是一套基于纯CSS实现的轻量级皮肤（主题）系统，通过CSS变量、选择器和模块化设计，实现无缝的主题切换体验。

## 二、核心设计原则

### 1. 分离原则
- **布局样式**：固定在基础CSS中，负责宽高、间距、定位等结构属性
- **主题样式**：通过CSS变量管理，包含颜色、背景、边框风格等视觉属性

### 2. 最小侵入原则
- 不依赖特定框架，仅使用原生CSS特性
- 兼容任何前端项目（HTML、Vue、React等）
- 对页面结构无侵入，仅需在`<html>`或`<body>`元素添加类名

### 3. 模块化原则
- 每个主题作为独立模块存在
- 新增/删除主题不影响其他主题或基础样式
- 主题配置集中管理，便于维护

### 4. 平滑过渡原则
- 主题切换时自动应用过渡动画
- 避免视觉突兀，提升用户体验

## 三、主题变量体系

### 1. 变量分类

#### 1.1 基础色板变量
- `--color-primary`：主色调，用于关键元素
- `--color-secondary`：辅助色，用于次要元素
- `--color-success`：成功色，用于积极状态
- `--color-danger`：危险色，用于错误/警告状态
- `--color-warning`：警告色，用于提示状态
- `--color-info`：信息色，用于一般提示

#### 1.2 背景色系统
- `--color-bg-primary`：主要背景色
- `--color-bg-secondary`：次要背景色
- `--color-bg-tertiary`：第三级背景色
- `--color-bg-hover`：悬停状态背景色
- `--color-bg-active`：激活状态背景色
- `--color-bg-disabled`：禁用状态背景色

#### 1.3 文本颜色系统
- `--color-text-primary`：主要文本色
- `--color-text-secondary`：次要文本色
- `--color-text-muted`：弱化文本色
- `--color-text-light`：浅色文本
- `--color-text-disabled`：禁用文本色

#### 1.4 边框颜色系统
- `--color-border`：常规边框色
- `--color-border-light`：浅色边框
- `--color-border-dark`：深色边框

#### 1.5 阴影系统
- `--color-shadow`：常规阴影
- `--color-shadow-light`：浅阴影
- `--color-shadow-dark`：深阴影

#### 1.6 透明度系统
- `--color-opacity-light`：浅色透明度
- `--color-opacity-medium`：中等透明度
- `--color-opacity-dark`：深色透明度

#### 1.7 字体系统
- `--font-family`：主要字体

#### 1.8 组件专用变量
各组件特定变量，以`--color-组件名-`为前缀

### 2. 变量命名规范
- 统一使用`kebab-case`格式（小写字母+连字符）
- 以`--color-`、`--font-`等前缀明确变量类型
- 语义化命名，清晰表达变量用途

## 四、主题激活机制

### 1. 选择器优先级
- 类选择器：`.skin-{theme-name}`
- 组合选择器：`:root:has([data-theme="{theme-name}"])`
- 变量选择器：`:root[style*="--current-theme: {theme-name}"]`

### 2. 主题切换方式
- URL参数：`?theme={theme-name}`
- 配置文件：通过JSON配置持久化主题选择
- JavaScript动态切换：更新CSS变量和类名

## 五、主题目录结构

```
skins/
├── {theme-name}/
│   ├── skin.json         # 主题元数据配置
│   └── assets/           # 主题相关资源(可选)
│       ├── fonts/        # 自定义字体
│       ├── images/       # 主题图片
│       └── overrides.css # 可选的覆盖样式
├── skin_variables.css    # 集中的变量定义
└── skin_preview.php      # 主题预览工具
```

## 六、主题开发指南

### 1. 创建新主题
1. 在`skins/`目录下创建主题文件夹
2. 创建`skin.json`配置文件
3. 在`skin_variables.css`中添加主题变量定义

### 2. skin.json配置规范
```json
{
  "name": "主题名称",
  "description": "主题描述",
  "previewColor": "主题代表色",
  "author": "作者",
  "version": "1.0.0"
}
```

### 3. 自定义字体集成
- 如需使用自定义字体，将字体文件放在主题的`assets/fonts/`目录
- 在`assets/overrides.css`中使用`@font-face`声明字体

## 七、过渡动画规范

### 1. 全局过渡
为保证主题切换的平滑性，在基础样式中添加全局过渡：

```css
* {
  transition-property: color, background-color, border-color, box-shadow;
  transition-duration: 0.3s;
  transition-timing-function: ease-in-out;
}
```

### 2. 性能优化
- 避免在高频变化的元素上应用复杂过渡
- 对于大型页面，可考虑延迟加载过渡效果

## 八、最佳实践

### 1. 变量复用
尽量复用已有变量，减少重复定义

### 2. 主题一致性
保持主题内部视觉一致性，建立合理的色彩体系

### 3. 兼容性考虑
- 确保CSS变量在目标浏览器中得到支持
- 为不支持CSS变量的浏览器提供回退样式

### 4. 性能优化
- 避免过多的CSS变量导致渲染性能下降
- 合理组织选择器，避免过度复杂的选择器链

## 九、系统集成指南

### 1. 基本集成
1. 引入`skin_variables.css`
2. 在`<html>`或`<body>`元素添加主题类名
3. 按需使用PHP皮肤加载器或纯JavaScript方案

### 2. 动态切换
使用提供的`changeSkin()`函数或自行实现主题切换逻辑

### 3. 持久化
通过Cookie或本地存储保存用户的主题偏好