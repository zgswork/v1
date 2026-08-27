<p align="center">
  <strong>🇨🇳 简体中文</strong> · <a href="README_en.md">🇬🇧 English</a>
</p>

# Tool Box 🐧

浏览器端工具集，纯前端实现，无需后端，开箱即用。

## 特点

- 纯前端，所有工具在浏览器本地运行
- 无需服务器，可直接用浏览器打开
- 深色主题，响应式设计
- 大部分工具无外部依赖

## 工具列表

| 工具 | 说明 | 依赖 |
|------|------|------|
| 二维码生成 | 文本 / URL 转二维码，支持颜色、渐变、样式自定义 | qr-code-styling |
| 文本统计 | 字数 / 字符 / 行数 / 段落 / 阅读时间实时统计 | 无 |
| 条形码生成 | Code128 / EAN-13 / EAN-8 / UPC-A，支持下载 PNG | 无 |
| 焦平面计算器 | 景深 / 超焦距 / 弥散圆计算，支持多种传感器格式 | 无 |
| 照片信息查看 | EXIF / IPTC / XMP 元数据解析，GPS 定位，导出 JSON | exifr |
| 简繁转换 | 简体 ↔ 繁体实时转换，支持明暗主题切换 | OpenCC |
| 照片水印添加 | 文字/图片水印，批量处理，模板预设，ZIP 打包下载 | JSZip |
| 花体字转换 | 普通文本 → 数学花体／哥特体／双线体／圆圈体等 9 种样式 | 无 |
| Markdown 预览 | 实时渲染，语法高亮，GFM 表格/任务列表/代码块 | marked + highlight.js |

## 使用

直接用浏览器打开 `index.html`，或部署到任意静态服务器：

- **GitHub Pages**：Settings → Pages → 选择分支
- **Vercel**：导入仓库，自动检测
- **Netlify**：拖拽文件夹上传

## 项目结构

```
Tool_Box/
├── index.html          # 主页
├── QRCode/             # 二维码生成
├── text-stats/         # 文本统计
├── barcode/            # 条形码生成
├── dof-calculator/     # 焦平面计算器
├── exif-viewer/        # 照片信息查看
├── zh-convert/         # 简繁转换
├── markdown-preview/   # Markdown 预览
├── watermark/          # 照片水印添加
└── fancy-text/         # 花体字转换
```

### 开发说明
本项目部分代码整理、文案撰写与结构优化由AI辅助完成，整体功能设计、逻辑调试与迭代优化均由作者独立完成。

### 支持
如果这套工具箱对你有用，麻烦点亮仓库 Star，你的支持是我持续更新、新增工具的最大动力！

## License
MIT
