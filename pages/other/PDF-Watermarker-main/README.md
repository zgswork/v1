# PDF 加水印

一个**纯本地、零上传**的 PDF 加水印工具。所有处理都在浏览器里完成，PDF 文件**不会上传到任何服务器**，适合医院、政务、企业等对文档保密有要求的场景。

支持文字 / 图片水印、多水印叠加、实时预览，并且可以**打包成单个 HTML 文件双击离线使用**。

![PDF 加水印界面](docs/screenshot.png)

## ✨ 功能特性

- **多水印叠加**：以图层列表的方式添加任意多个水印，按顺序绘制
- **文字 + 图片水印**：文字水印内嵌中文字体（黑体 / 宋体），图片水印支持 PNG / JPG
- **丰富的样式**：平铺 / 单点（九宫格定位）、颜色、大小、透明度、旋转角度、平铺间距
- **X / Y 偏移**：每个水印可单独设置偏移量，方便错开、防止多个水印叠在一起
- **独立页码范围**：每个水印可作用于不同的页码区间
- **实时预览**：所见即所得，底部工具栏支持翻页、缩放（50%–300%）、重新选择文件
- **水印模板**：保存 / 加载常用的水印配置（存于本地 IndexedDB）
- **三种交付形态**：浏览器直接用 / 安装为 PWA / 单文件离线版
- **完全本地**：纯客户端处理，不联网、不上传，可离线使用

## 🛠 技术栈

| 用途 | 选型 |
|------|------|
| 框架 / 构建 | React 19 + TypeScript + Vite |
| 写水印 | [pdf-lib](https://github.com/Hopding/pdf-lib)（MIT） |
| 预览渲染 | [pdf.js](https://github.com/mozilla/pdf.js)（Apache-2.0） |
| 中文字体嵌入 | [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) |
| 本地存储 | [idb](https://github.com/jakearchibald/idb)（IndexedDB） |
| PWA | vite-plugin-pwa |
| 单文件构建 | vite-plugin-singlefile |
| 测试 | Vitest |

所有依赖均为宽松开源许可，可自由用于商业 / 闭源项目。

## 🚀 快速开始

环境要求：Node.js ≥ 18（推荐 20+）

```bash
# 安装依赖
npm install

# 本地开发（带热更新）
npm run dev

# 运行测试
npm test
```

## 📦 构建与分发

提供两种构建方式：

### 1. 普通构建（部署到服务器 / 可安装 PWA）

```bash
npm run build      # 产物在 dist/
npm run preview    # 本地预览构建结果
```

部署到任意静态服务器即可，也可在浏览器中「安装」为桌面 PWA（离线可用）。

### 2. 单文件离线构建（双击打开，无需服务器）

```bash
npm run build:offline   # 产物为单个 dist-offline/index.html
```

把 JS / CSS / 字体 / pdf.js worker 全部内联进一个 `index.html`，**双击即可在浏览器打开使用**，可随邮件、U 盘分发。

> 浏览器出于安全限制，禁止在 `file://` 下加载 ES 模块、Web Worker、本地 `fetch`、Service Worker，所以普通的多文件构建必须经 HTTP 访问；单文件构建则规避了这些限制。

| 命令 | 产物 | 适用场景 |
|------|------|----------|
| `npm run build` | `dist/`（多文件 + PWA） | 部署服务器 / 安装为 PWA |
| `npm run build:offline` | `dist-offline/index.html`（单文件，约 10MB） | 双击直接用，离线分发 |

## 🧭 使用步骤

1. 拖入或选择一个 PDF
2. 在右侧用「＋ 添加文字 / ＋ 添加图片」添加一个或多个水印
3. 调整每个水印的内容、样式、X/Y 偏移、页码范围
4. 在左侧实时预览，用底部工具栏翻页 / 缩放查看效果
5. 点「立即添加」导出加好水印的 PDF

## 📁 项目结构

```
src/
  engine/          # 与 UI 解耦的纯逻辑（可单独测试）
    types.ts         # 水印配置类型
    layout-calculator.ts  # 平铺/单点 + 偏移 的坐标计算
    watermark-engine.ts   # pdf-lib 多图层写水印
    color.ts / file-io.ts / fonts.ts / preset-store.ts
  preview/
    pdf-preview.ts   # pdf.js 渲染 + 水印 overlay
  ui/                # React 组件
    App / WatermarkList / LayerEditor / PreviewPane / PreviewToolbar / ...
  assets/fonts/      # 内嵌中文字体（见该目录 README）
docs/superpowers/    # 设计文档与实现计划
```

## 🔤 关于中文字体

`src/assets/fonts/` 内置黑体（Noto Sans SC）与宋体（Noto Serif SC），授权为 **SIL Open Font License 1.1**（可自由嵌入 / 商用）。

为保证生成的 PDF 在 **Chrome / 打印 / 系统预览**等严格渲染器中都能正常显示，字体经过特殊处理（glyf TrueType + 预裁剪到 GB2312 + 整体嵌入），详见 [`src/assets/fonts/README.md`](src/assets/fonts/README.md)。

## 🔒 隐私

本工具**不进行任何网络上传**：选择的 PDF、生成的结果、保存的模板全部留在你本地的浏览器中。可断网使用。

## 📄 许可

代码部分采用 MIT 许可（如需可在此注明）。内置字体遵循各自的 SIL OFL 许可。
