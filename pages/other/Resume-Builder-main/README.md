# Resume Builder

本地离线简历生成工具，支持 HTML/CSS 模板、实时预览、PDF/Word 导出。

## 特性

- **模板驱动**：HTML/CSS 模板与数据解耦，一键切换风格
- **实时预览**：iframe 即时渲染，所见即所得
- **双格式导出**：PDF（Playwright 渲染，与预览一致）+ Word（python-docx）
- **离线运行**：纯本地，无需网络
- **批量操作**：表单支持条目添加/删除/上下移动

## 快速开始

```bash
# 1. 安装依赖
pip install -r requirements.txt
playwright install chromium

# 2. 启动
python app.py

# 3. 打开浏览器
# http://localhost:5000
```

## 项目结构

```
resume-builder/
├── app.py                  # Flask 后端（模板引擎 + API）
├── requirements.txt        # Python 依赖
├── templates/              # 简历模板
│   ├── classic/            #   经典模板
│   ├── modern/             #   现代模板（左侧边栏）
│   ├── minimal/            #   极简模板
│   ├── professional/       #   专业模板
│   └── qmjianli/           #   技术模板（深色头部）
│       ├── index.html      #   模板 HTML（{{placeholder}} 语法）
│       ├── style.css       #   模板样式
│       └── config.json     #   模板元信息
├── static/                 # 前端资源
│   ├── editor.html         #   编辑器页面
│   ├── editor.css          #   编辑器样式
│   └── editor.js           #   编辑器逻辑
├── data/                   # 示例数据
│   └── sample.json         #   （可选）自定义示例
├── fonts/                   # 中文字体文件
└── output/                 # 临时输出目录
```

## 模板语法

模板使用简洁的占位符语法：

| 语法 | 说明 |
|------|------|
| `{{key}}` | 简单字段 |
| `{{profile.name}}` | 嵌套字段 |
| `{{#if key}}...{{/if}}` | 条件渲染 |
| `{{#each items}}...{{/each}}` | 循环渲染 |
| `{{_value}}` | 循环内当前值 |

### 新增模板

1. 在 `templates/` 下新建文件夹（如 `templates/my-style/`）
2. 放入三个文件：
   - `index.html` — 使用上述模板语法
   - `style.css` — 自定义样式
   - `config.json` — `{"name": "我的模板", "description": "...", "author": "...", "version": "1.0"}`
3. 重启服务器，自动扫描

## API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 编辑器页面 |
| `/api/templates` | GET | 模板列表 |
| `/api/sample-data` | GET | 示例数据 |
| `/api/preview/<template>` | GET | 渲染预览 HTML |
| `/api/export-pdf/<template>` | GET | 导出 PDF |
| `/api/export-word/<template>` | GET | 导出 Word |

## 技术栈

- **后端**：Python Flask
- **PDF 引擎**：Playwright (Chromium)
- **Word 引擎**：python-docx
- **前端**：原生 HTML/CSS/JS，无框架依赖

## 许可

MIT
