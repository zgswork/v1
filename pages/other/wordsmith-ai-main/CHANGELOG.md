[简体中文](CHANGELOG.md) | [English](CHANGELOG.en-US.md)
# Changelog

> **版本号规范**: 正式版使用 `vX.Y.Z`，beta 分支使用 `vX.Y.Z-<feature>.N` 区分功能线。合并至 main 后统一提升为下一个正式版号。

## v1.2.1
### Fixed
- 修复 AI 流式响应长时间使用后 UI 卡顿、必须重启应用的问题。爆发速率 + 多轮累积场景下，主线程占用从 47.8% 降到 35.2%，累计阻塞时长减少 59%（21s → 8.6s）
  - ChatPanel: 流式 token 循环用 `requestAnimationFrame` 节流 `setWorkspaceMessages`，把触发频率从"每 token"压到帧率（≤60Hz）
  - useAppStore: 包装 `localStorage` 为 100ms throttled storage，`setItem` 频率封顶 10Hz；`beforeunload` / `pagehide` / `visibilitychange` 兜底强制 flush
  - partialize: 流式期间跳过 `workspace.messages`，强制 `streaming=false` 持久化，附带修复"崩溃后挂死在流式中"的潜在 bug
- 新增 `scripts/bench-stream-perf.mjs`：可重跑的离线基准测试，覆盖普通/爆发/多轮累积/极端 4 种场景

## v1.2.0
### Added
- 新增 LaTeX 公式编辑器页面（侧边栏 Σ 入口），支持 KaTeX 实时预览 + 8 个示例公式
- 新增 LaTeX → UnicodeMath 转换器，覆盖：分数、上下标、希腊字母、根号、矩阵、分段函数、修饰符、数学字体、大型算子保护
- 新增高清图片导出：4x 超采样 + 白转透明 + 智能裁剪 + PNG pHYs DPI 元数据注入（~524 DPI，适配 Word 11pt 字号）
- 新增 AI 公式助手：左侧可折叠面板，流式对话生成 LaTeX 公式，支持一键插入、悬停高亮、自动填入
- 新增阶梯式双面板布局：AI 助手和历史记录可同时打开
- 新增上下文轮次滑条（0=不限，最大 20 轮），控制发送给 AI 的历史对话轮数，减少 Token 消耗
- 新增逐轮勾选框：手动包含/排除特定对话轮次，覆盖窗口默认规则
- 新增引用历史对话（Pinned Rounds）：从历史记录中选取对话轮次作为跨对话上下文快照
- 新增重新生成 / 继续生成按钮
- 新增上下文过滤引擎 `context-filter.ts`，含 14 个单元测试
- 新增版本更新检测：程序启动时自动检测新版本，支持「前往下载」「稍后提醒」「跳过此版本」
- 新增 OCR 架构变更提示、侧边栏红点提示、设置页「版本与更新」卡片
- 新增 `window:openExternal` IPC 通道，通过系统默认浏览器打开下载链接
- 通过 Vite `define` 注入 `__APP_VERSION__`，运行时动态获取当前版本号
- 新增 25 个 UnicodeMath 转换单元测试
### Changed
- 图片导出零闪烁：离屏 BrowserWindow 替代可见 DOM capturePage
- 历史记录面板从右侧迁移到左侧，面板按钮统一放在左栏标题行
- 优化公式提取：多行环境按 `\\` 拆分（≤10 行拆分，>10 行保留整块）
### Fixed
- 修复聊天面板输入框被窗口底部截断的布局问题
- 修复左侧栏新增区域挤占自定义指令和参考文档空间的问题
- 覆盖安装时用户数据和 OCR 引擎自动保留

## v1.1.3
### Added
- 新增表格结构增强：接入 RT-DETR-L 有线/无线表格单元格检测模型（`table_wired_det.onnx` + `table_wireless_det.onnx`），3 级回退链（模型检测 → 形态学网格 → 坐标聚类），复杂表格重建精度显著提升
- 新增 OCR 后处理增强：数学符号正则纠错器（`sn→sin`, `coS→cos`, `tg→tan` 等）、公式区域 2D 空间重组（整块合并 + OpenCV 视觉分数线检测 + `\frac` 输出）、OpenCV 形态学表格网格提取
- 新增多页 PDF 支持：基于 PyMuPDF 逐页渲染 PNG 并 OCR 识别，合并结果添加到参考文件（最大 50 页）
- 新增表格检测模型转换脚本 `scripts/convert_table_det.py`（支持 PIR 格式）
### Changed
- 删除废弃的 `FormulaRecognizer` 类（~130 行），清理相关引用（公式识别模型均为自回归架构，DirectML 不可用）
- 解压导入加速：优先使用 Windows 原生 `tar.exe` 替代纯 JS `extract-zip`，速度提升数倍
- 更新 OCR 技术文档，新增公式识别模型全面调研结论

## v1.1.2
### Added
- 新增OCR支持使用GPU推理加速，使用```DirectML```，对windows平台具有通用性
### Changed
- 调整了OCR功能，取消了此前版本中的PaddleOCR-VL，改采用流水线OCR模式(使用```layout_det.onnx,text_det.onnx,text_rec.onnx```并辅以```ppocr_keys_v1.txt```字典)

## v1.1.1
### Added
- 新增 OCR 在线推理功能，用户可以在“设置-高级-OCR 图片识别”中，手动选择指定服务商和视觉模型用于OCR识别，且识别结果支持手动修正更改。
### Changed
- 调整了模型选择功能，从手动填入改变为可以获取模型列表，支持搜索模型名称，最近使用模型名称。

## v1.1.0
### Added
- 新增 OCR 功能，引入了 PaddleOCR，用户可以选择或拖拽图片进行识别。
- OCR 功能为可选功能，需在“设置-高级-OCR 图片识别引擎”中手动选择 zip 包进行导入。

## v1.0.18
### Fixed
- 修复了标题栏处 UI 显示覆盖、错位问题。

## Pre-1.0.17 (Legacy Versions)
### Added
- 新增附件文档上传功能（支持转为 markdown/txt 进行上传）。
- 新增用户自定义提示词功能，可固定提示词在每次对话时默认发送。
- 新增历史记录界面，支持查看对话具体调试信息。
- 新增渲染窗口独立放大功能。
- UI 样式与核心功能初始化构建。