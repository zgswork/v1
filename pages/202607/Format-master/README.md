# Format

离线文本排版与 Word 导出工具。粘贴文本或导入 TXT/MD/DOCX 文件，自定义字体、字号、行距、页边距等样式，一键导出格式规范的 Word 文档。

## 功能特性

- **文本输入** — 支持直接粘贴、拖拽导入 TXT/MD/DOCX，自动识别 Markdown 标题
- **样式配置** — 页面设置（纸张/边距/页码）、标题样式（1-4 级独立字体/颜色/加粗）、正文样式、高级选项（目录/分页）
- **模板系统** — 内置公文标准、学术论文、简洁报告三套预设；支持保存/导入自定义模板
- **批量导出** — 多文件队列处理，一键批量导出格式化 Word 文档
- **页码支持** — 自动生成页码，支持左/中/右/奇偶对齐

## 使用方式

### 浏览器直接运行（推荐）

双击 `Format.html` 即可在任何电脑的浏览器中使用，无需安装。

或启动本地服务：

```bash
npx serve .
```

### Electron 桌面应用

```bash
npm install
npm start
```

构建安装包：

```bash
npm run build:win    # Windows
npm run build:mac    # macOS
```

## 项目结构

```
Format/
├── index.html          # 主页面
├── app.js              # 核心逻辑（DOCX 生成、模板管理、UI 交互）
├── styles.css          # 样式表
├── main.js             # Electron 主进程
├── package.json        # 项目配置
├── Format Logo-remove-bg-io.png  # 应用图标
└── QR_code.JPG         # 打赏二维码
```

## 技术实现

- 纯前端实现，零后端依赖，所有数据仅存储在浏览器 localStorage
- OOXML 标准生成 `.docx` 文件，包含完整的样式定义、页码域、目录域
- 内置 ZIP 打包器（CRC32 + DEFLATE），无需调用外部库
- Electron 打包为独立桌面应用，支持 Windows/macOS

## 隐私说明

- 不联网、不上传任何数据
- 所有处理在本地浏览器/应用内完成
- 关闭即清除内存数据

## 许可证

[MIT](https://opensource.org/licenses/MIT)
