 [简体中文](README.md) | [English](README.en-US.md)
 ## 📄 开源协议 (License)
本项目采用 [GPL v3](LICENSE) 协议开源。

<p align="center">
  <img src="assets/logo.png" width="128" alt="WordSmith AI Logo" />
</p>

<h1 align="center">WordSmith AI（智排精灵）</h1>
<p align="center">基于 HTML 的 AI Word 排版工具</p>

---

## 📱 给用户的使用指南 (User Guide)

### 🎯 程序介绍
WordSmith AI 是利用HTML格式，通过严格提示词限制，与AI对话，进行文章段落排版，并复制粘贴回word中的便捷排版工具，同时支持数学物理公式渲染。既可以让AI直接生成文章，也可以根据word原有文章段落进行仿照排版，同时也支持对网页HTML复制的HTML格式进行清洗，精确符合word排版功能。最新版本已支持OCR图片识别，提供两种模式：

- **本地 OCR（推荐）**：基于 ONNX Runtime + DirectML 的 GPU 加速流水线，支持版面分析、文字检测与识别，输出 Markdown 格式文本。全平台 GPU 通用（NVIDIA / AMD / Intel），无需联网。
- **云端 OCR**：通过 VLM 视觉语言模型在线推理，需填写服务商 API Key 并选择对应视觉模型。

识别结果支持手动二次更正，用户可直接上传或拖拽图片进行文本识别。

此外，v1.2.0 新增了 **LaTeX 公式编辑器**（侧边栏 Σ 入口），支持：
- KaTeX 实时预览 + LaTeX → UnicodeMath 转换（粘贴到 Word 后 Alt+= 空格即可构建公式）
- 高清图片导出（4x 超采样 + 智能裁剪 + DPI 适配 Word 11pt 字号）
- AI 公式助手（流式对话生成 LaTeX，一键插入）+ 上下文数控制
- 阶梯式双面板布局（AI 助手 + 历史记录可同时打开）

### 智能上下文控制

精细化控制发送给 AI 的对话上下文，优化排版质量并节省 Token：

- **轮次滑条**：设定最近 N 轮（0~20）对话参与 AI 推理，默认不限
- **逐轮勾选**：每轮对话旁可手动包含/排除，覆盖默认窗口规则
- **引用历史对话**：从历史记录中 pin 有价值的对话片段作为跨会话上下文，快照独立存储，删除历史不影响引用
- **重新生成 / 继续生成**：对最后一轮 AI 回复可重新生成或在中断处继续

### 版本更新检测

程序启动时自动检测新版本，发现更新后弹窗提示：

- 显示新版本号、更新日期和更新内容
- 支持「稍后提醒」（3 天内不再弹窗）和「跳过此版本」（同版本永不弹窗）
- 如果 OCR 引擎架构有变更，会额外提醒用户更新后需重新导入 OCR 引擎包
- 侧边栏设置图标红点提示（用户做出决定后消失）
- 设置页「常规」tab 可查看当前版本和更新详情，手动检查更新
- 覆盖安装新版本时，用户数据和 OCR 引擎自动保留，无需重新配置
- 通过系统默认浏览器打开下载链接


### 📥 如何安装
1.  下载最新版本的 `.exe` 安装包（当前最新：**v1.2.1**）。
2.  **OCR 功能**需额外导入引擎包，在「设置 → 高级 → OCR 图片识别」中操作：
    - **本地 OCR**：依次导入 `wordsmith-ocr-engine.zip`（OCR 引擎，约 3.9GB）和 `wordsmith-gpu-pack.zip`（GPU 加速包，约 543MB）。导入后自动启用 DirectML GPU 加速，无 GPU 时自动回退 CPU。
    - **云端 OCR**：填写对应服务商的 API Key，选择视觉模型即可使用。

<p align="center">
  <img src="assets/ocr-gpu-settings.png" width="700" alt="OCR 与 GPU 加速设置界面" />
</p>


---

## 🛠️ 给开发者的文档 (Developer Guide)

### 技术栈

Electron 30 + React 18 + TypeScript + Tailwind CSS v4 + Zustand + Vite

### 环境准备

```bash
# 1. 安装依赖（国内 Electron 下载慢可加镜像）
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"; npm install

# 2. 启动开发
npm run dev

# 3. 打包
npm run build
```

### 排版协议

核心约束 — 保证 HTML 粘贴到 Word 格式正确：

- 仅行内样式，禁止 `<style>` 标签
- 单位必须为 `pt`（Guard Layer 自动 px→pt ×0.75）
- 表格 `align="center"`，`width:440pt; border-collapse:collapse;`
- 数学公式保留 `$...$` / `$$...$$` 原样，清除 MathML

### OCR 引擎

OCR 引擎不含在安装包中，用户通过「设置 → 高级」导入。

**本地 OCR 流水线（v1.1.3）**：
- 基于 3+2 个 ONNX 模型：版面分析（PP-DocLayout）+ 文字检测（PP-OCRv5 det）+ 文字识别（PP-OCRv5 rec）+ 可选表格单元格检测（RT-DETR-L wired/wireless）
- GPU 加速：ONNX Runtime + DirectML，支持 NVIDIA / AMD / Intel 全平台显卡
- 后处理增强：数学符号纠错、公式 2D 空间重组（视觉分数线检测）、3 级表格重建回退链（模型 → 形态学 → 聚类）
- 多页 PDF 支持：基于 PyMuPDF 逐页渲染 OCR
- 单图耗时约 1.5 ~ 2.4 秒（GPU），无 GPU 自动回退 CPU
- 核心脚本：`ocr_engine/onnx_pipeline.py`，TypeScript 端通过 `execFile` 调用

**分发包构建**：
```powershell
# OCR 引擎包（~3.9GB）
powershell -ExecutionPolicy Bypass -File scripts/pack-ocr-engine.ps1

# GPU 加速包（~543MB）
pwsh scripts/prepare-gpu-pack.ps1
```

开发时将 `ocr_engine/` 放项目根目录即可自动检测。技术细节见 `docs/OCR模块技术文档.md`。

## 📄 开源协议
本项目采用 [GPL v3 协议](LICENSE) 开源。
> 
⚖️开源协议与版权声明(License&Copyright)
本项目（包括但不限于源代码、文档、资源文件等）的著作权归原作者（本人）所有。
授权协议说明：
1. 统一授权： 本项目自 首个 Commit (Initial Commit) 起的所有历史版本、分支及后续更新，现统一采用 GNU General Public License v3.0 (GPLv3) 协议进行授权。
2. 溯及力声明： 无论您是在本项目添加 LICENSE 文件之前还是之后获取的源代码，只要您分发、修改或使用本项目代码，均须严格遵守 GPLv3 协议的所有条款。
3. 闭源限制： 严禁任何个人或机构在未履行 GPLv3 义务（如开源衍生项目源码）的情况下，将本项目代码用于商业闭源软件、打包为 .exe 或其他二进制形式进行分发。
4. 侵权追究： 任何违反 GPLv3 协议的行为均视为对著作权的直接侵权。本人保留通过法律途径（包括但不限于向托管平台提交 DMCA/侵权申诉、提起司法诉讼等）追究侵权者法律责任的权利。
提示： 如果您希望在不遵守 GPLv3 协议（如保持闭源）的情况下使用本项目代码，请务必联系作者获得额外的商业授权。

## 📫 联系我 (Contact)

如果你有任何建议或需要商业授权，欢迎通过邮件联系：zkydw.dev@outlook.com