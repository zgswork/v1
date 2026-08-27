# AgentChat Viewer

> 一个单文件、零依赖的浏览器工具，用于解析并可视化查看 AI 编码助手（ZCode / Codex / Workbuddy）的会话记录、调用轨迹与遥测事件。

通用 JSON 格式化工具只能格式化单行 JSON，而这些助手的会话记录是**每行一个 JSON 对象**的 JSONL 文件，且字段结构各异。AgentChat Viewer 把它们统一归一化，并以仿 ZCode 风格的界面呈现对话、工具调用、推理过程与系统提示词。

## ✨ 特性

- 📦 **单文件 HTML** — 双击即开，无需安装、无需后端、无需联网
- 🧩 **四种格式自动识别** — 加载时自动判断格式，无需手动选择
- 🗂️ **多会话管理** — 一次加载多个文件，按来源分组，随时切换/移除
- 💬 **对话视图** — 消息气泡（user/assistant/system 分色）、工具调用卡片（参数+输出）、推理过程折叠、系统提示词折叠、`<system-reminder>` 自动折叠
- 📊 **调用轨迹** — 时间线，按事件类型筛选（消息/工具调用/工具结果/推理/Turn/快照）
- 📡 **遥测视图** — ZCode 运行日志专用，按 event 前缀分组、traceId 搜索
- ℹ️ **元数据视图** — 会话信息、事件统计、Token 总量、系统提示词全文
- 🔍 **全文搜索** — 跨消息内容、工具参数、输出实时搜索（带防抖）
- 🌙 **暗色主题** — 仿 ZCode 配色，长时间阅读不疲劳

## 🚀 快速开始

1. 下载 [`agentchat-viewer.html`](./agentchat-viewer.html)
2. 双击用浏览器打开
3. 点「选择 JSONL 文件」或直接把文件**拖拽**到窗口

就这样。

## 📂 支持的格式

| 来源 | 文件位置 | 说明 |
|------|---------|------|
| **ZCode rollout** | `~/.zcode/cli/rollout/model-io-sess_*.jsonl` | 每行一次完整模型调用（请求+响应），含系统提示词、工具调用、token 用量 |
| **ZCode 遥测日志** | `~/.zcode/cli/log/zcode-*.jsonl` | 结构化运行轨迹（工具执行、模型调用、MCP、启动），按 traceId/spanId 链接 |
| **Codex rollout** | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | 事件流：session_meta、消息、function_call/output、reasoning（加密）、custom_tool_call |
| **Workbuddy** | `~/.workbuddy/projects/<slug>/<uuid>.jsonl` | 事件流：消息、**可读推理**、函数调用、文件快照；通过 parentId 构建树 |

### 格式差异速览

| 维度 | ZCode rollout | Codex rollout | Workbuddy |
|------|--------------|---------------|-----------|
| 粒度 | 1 行 = 1 次模型调用 | 1 行 = 1 事件 | 1 行 = 1 事件 |
| 时间戳 | ISO-8601 | ISO-8601 | epoch 毫秒 |
| 推理过程 | 折叠在响应文本中 | **已加密**（不可读） | ✅ **明文可读** |
| 工具参数 | 原生对象 | JSON 字符串 | JSON 字符串 |
| 系统提示词 | `request.body.system[]` | `base_instructions.text` | 嵌入首条 user 消息 |

本工具内置 4 个适配器，把上述异构格式归一化为统一的中间模型后再渲染。

## 🖥️ 四个视图

| 视图 | 内容 |
|------|------|
| **对话** | 时间序消息气泡；assistant 气泡内嵌工具调用卡片（可展开参数/输出）；reasoning 折叠；系统提示词折叠 |
| **调用轨迹** | 每个事件一行：时间戳 + 类型图标 + 摘要 + 耗时/token；支持类型筛选 |
| **遥测** | （仅 ZCode 日志）表格：时间/事件/级别/模块/耗时/traceId/上下文；event 前缀筛选 |
| **元数据** | 来源/会话ID/模型/cwd/时间范围/事件统计/Token 总量/系统提示词全文 |

## 🔧 技术细节

- **零依赖**：纯 HTML + CSS + 原生 JS，无框架、无构建、无 CDN
- **本地运行**：所有解析在浏览器内完成，文件内容不上传任何服务器
- **容错解析**：逐行 `JSON.parse`，跳过损坏行不中断
- **搜索性能**：加载时预缓存每个事件的可搜索文本，搜索时仅做字符串包含判断，并带 180ms 防抖
- **极简 Markdown**：内置代码块/行内代码/标题/加粗/链接渲染，无需外部库

## 📁 项目结构

```
.
├── agentchat-viewer.html   # 全部代码（HTML + CSS + JS 单文件）
├── README.md
└── LICENSE
```

## ❓ 常见问题

**Q: 为什么不自动扫描我电脑上的 `.zcode` / `.codex` / `.workbuddy` 目录？**
A: 浏览器（出于安全）不允许网页直接访问文件系统。需要你手动选择或拖拽文件。如果你想要自动扫描能力，需要改成带后端的版本（Python/Node 本地服务）。

**Q: 支持其他 AI 助手（如 Claude Code、Cursor）吗？**
A: 当前内置 4 种格式。架构上预留了适配器接口，新增格式只需实现一个 `parseXxx(text)` 函数并在 `detectFormat` / `loadFile` 中注册。

**Q: Codex 的推理过程为什么显示「已加密」？**
A: Codex 在 rollout 中以 `encrypted_content` 字段存储思维链，是密文，无法还原为明文。这是 Codex 的设计，不是本工具的限制。Workbuddy 的推理则是明文可读的。

## 📝 许可证

[MIT](./LICENSE)
