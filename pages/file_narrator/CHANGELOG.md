# 版本说明（CHANGELOG）

## V1.2.3 — 2026-09-18

### 新增：「显示点位」复选框（小修改）

| 修改点 | 说明 |
|---|---|
| **★ 工具栏「显示点位」复选框** | 位于「自动巡讲」按钮之后；**该复选框（`#lblShowPoint` 整个 label）可整体注释停用**，JS 侧判空安全，注释后不影响其它功能 |
| **鼠标坐标实时反算** | 选中后鼠标在文件区内移动，鼠标左上角浮签（`#pointTip`，fixed 定位、`pointer-events:none` 不挡触点）实时显示该点相对条目基点 `basePoint` 的比例偏移，即 narration_data.js 中 hotspots 的 `x / y` 值（3 位小数，录入触点坐标用）；换算与 `buildHotspots` 互逆：x/y = 页面比例 − basePoint |
| **显隐规则** | 未勾选 / 鼠标移出文件区 / 取消勾选 → 浮签隐藏；内容元素与 showStage 一致（图片条目按 `<img>`、其余按 canvas 计算，未渲染时不显示） |

**验证**：jsdom 运行时冒烟 9/9（元素存在、初始隐藏、未勾选不显示、勾选后换算正确、基点处 x=y=0、移出/取消隐藏）；`verify_mount.py` 168/168。

## V1.2.2 — 2026-09-16

### 调整：两级筛选不设「全部」选项（小修改）

| 修改点 | 说明 |
|---|---|
| **删除两级下拉的「全部」选项** | 一级/二级下拉只列具体分类，始终按「一级 + 二级」双条件严格过滤文件下拉；级联关闭（`cascade.enabled:false` 或无分类数据）时整体隐藏，行为不变 |
| **默认选中第 1 个选项** | 打开页面时一级默认第 1 个分类、二级默认该分类下第 1 个子项，文件下拉即为其命中条目（不再默认展示全量文件） |
| **逻辑收敛** | 删除 `CASCADE_ALL` 常量；`filteredPdfList()` 改为双条件相等判断；`rebuildSubSelect()` / `buildCascadeSelects()` 去掉「全部」分支，默认落首个选项；当前条目筛选保护（命中保留、否则落第 1 个）不变 |

**验证**：jsdom 运行时冒烟 13/13（无「全部」、选项去重与默认选中、两级切换过滤、版本号）；`verify_mount.py` 168/168。

## V1.2.1 — 2026-09-16

### 调整：两级联动筛选不显示文字标签（小修改）

| 修改点 | 说明 |
|---|---|
| **删除 catLabel / subLabel 标签** | 工具栏不再显示「类别」「细分」两个文字标签，只保留两个筛选下拉；缓存参数同步 `?v=1.2.1`，标题更新为「文档解说 · V1.2.1」 |
| **主逻辑零改动** | JS 侧对两个标签的引用（`buildCascadeSelects()` 等）本就有空值保护（`if (catLabel)` / `if (n)`），元素删除后自动安全跳过，筛选行为不变 |

## V1.2.0 — 2026-09-16

### 新增：两级联动筛选下拉（中修改）

| 修改点 | 说明 |
|---|---|
| **★ 「文件」下拉前新增两级联动筛选** | 新增「类别」（一级）与「细分」（二级）两个下拉，位于「文件」下拉之前；选择一级后二级只显示该分类下的子项，文件下拉只列出被筛选命中的条目；任一级选「全部」表示该级不过滤 |
| **联动设定集中在 narration_data.js** | ① 顶层新增 `cascade: { enabled, labels }`（开关 + 两个下拉的显示名称）；② 每个 `pdfs[]` 条目新增可选字段 `cat`（一级分类）、`sub`（二级分类），未写的归入「未分类」；`enabled:false` 或条目均无分类时两个下拉自动隐藏，行为与旧版完全一致 |
| **文件下拉 value 改用条目 id** | 原 `option.value = 下标` 在筛选后下标错位，改为 `value = p.id`；`loadPdf()` 同步按 id 定位下拉，并保留空条目守卫 |
| **当前条目筛选保护** | 切换筛选时，若当前正在解说的条目仍被筛出则保持选中，否则自动落到筛选结果第 1 个并加载 |

**验证**：jsdom 运行时冒烟 15/15（级联选项生成、逐级过滤、当前条目保留、恢复全部）；`verify_mount.py` 168/168。

## V1.1.0 — 2026-09-16

### 新增：「在线语音」复选框 + 字幕条停用（中修改；基于用户手改的 index.html）

| 修改点 | 说明 |
|---|---|
| **★ 「在线语音」复选框** | 位于「语音说明」（chkVoice）之后，**默认勾选**。语义：勾选 = 使用**网站提供的语音文件**（`file/voice/`，音色固定）；取消 = 改用**本地语音引擎**（浏览器朗读，即「播音」下拉的音色模板） |
| **显示/禁用联动** | ① 未勾选「语音说明」→「在线语音」与「播音」下拉**都不显示**；② 勾选「在线语音」→「播音」**不可选**（网站语音音色固定）；③ 取消「在线语音」→「播音」可选 |
| **发声链路接线** | `speak()` 勾选在线语音时优先播 `file/voice/` 音频，该触点缺文件或播放失败时自动降级本地引擎（`allowFile` 参数防来回降级死循环）；`refreshVoiceUI()` 统一维护三者显示/可用性；原 `setVoiceTemplatesEnabled()` 删除 |
| **字幕条停用** | `#captionBar` HTML 块已注释（播放时不再显示触碰点文字内容）；JS 侧本就判空，恢复显示只需去掉注释 |

**验证**：jsdom 运行时冒烟 18/18（默认态、逐项切换、隐藏保留选择、降级分支）；`verify_mount.py` 168/168（资源清单已按用户替换后的真实文件更新：3 份钢结构信号配电系统图 PDF + 2 张 OA 申请单 PNG + steel-drawing0/1/2、screen-image 音频目录；中文文件名 HTTP 请求需 `quote()` 编码）。

## V1.0.0 — 2026-09-14

### 结构重构（大修改：目录重组；功能与 V0.5.1 完全一致，无任何行为变化）

文件夹由 `pdf_narrator_20260914` 改名为 `file_narrator`（菜单 id 同步 `pdf-narrator` → `file_narrator`，用户已改 `menus.json` / `users.json`）。

| 修改点 | 说明 |
|---|---|
| **★ CSS 与功能性 JS 全部内联进 index.html** | `css/style.css`、`js/loaders.js`（格式适配层）、`js/main.js`（主逻辑）三份文件合并内联进 `index.html`（3235 行），各段以分隔注释标出（样式段 / 格式适配层段 / 主逻辑段），**后期改样式 / 改逻辑只编辑这一个文件**；原三个文件已删除。外置脚本仅剩数据型 `js/narration_data.js` 与本地库 `js/lib/pdf.min.js` / `pdf.worker.min.js`（PDF.js 的 worker 必须是独立文件，无法内联） |
| **assets/ → file/** | 内容文件目录改名，`narration_data.js` 的 `offlineVoice.dir`、各条目 `url` / `src` 及页面兜底目录同步改为 `file/` |
| **工具全部归拢 tools/** | 根目录的 `gen_voice_oneclick.pyw` / `.bat` / `make_demo_pdf.py` 移入 `tools/`；`gen_voice_oneclick.pyw` 根目录定位改为「tools 的上一级」，全部工具脚本内 `assets/` → `file/` |
| **删除无关文件** | `tests/smoke_test.mjs`（依赖外置 js 结构，随重构失效）、`tools/export_voice_manifest.mjs`（与纯 Python 版 `narration_manifest.py` 功能重复；`gen_voice_files.py` 的清单兜底逻辑改为调用 Python 版） |
| **维护目标达成** | 日常维护三步：① `file/` 里加 / 删内容文件；② 改 `js/narration_data.js`（文案 / 触点 / 条目）；③ 必要时双击 `tools/gen_voice_oneclick.pyw` 重生成语音。其余文件无需手动修改 |

**验证**：内联脚本 Node 语法解析 2 段全过；jsdom 运行时冒烟——下拉 8 条目生成、默认语音勾选、TXT(1/3)/DOCX(1/3)/PPTX(1/3)/DXF(1/1 仅一页双禁)/图片(1/2) 全部经真实 `file/` 路径加载成功、边界禁用正确；`verify_mount.py` 更新后 **150 项 PASS / 0 FAIL**；`gen_voice_oneclick.pyw --auto --dry-run` 识别 8 条目 58 条音频全部就绪。

## V0.5.1 — 2026-09-14

### 缺陷修复（小修改：触点靠近文档边沿时弹窗被截断）
| 修改点 | 说明 |
|---|---|
| **★ 问题** | 触点（触碰点）靠近文档左 / 右（或上 / 下）边沿时，弹窗宽 300px 且以触点为中心弹出，**超出内容区的部分被 `.pdf-wrap` 的 `overflow:hidden` 裁掉**，靠边一侧的文字看不到（长文案尤其明显） |
| **★ 横向：整体平移回内容区** | `js/main.js` 新增 `placePopup(el, popup)`：显示弹窗前先量出弹窗自身宽高，按 `期望左边缘 = 触点中心 − 弹窗宽/2` 计算，再钳制到 `[8, 内容区宽 − 8 − 弹窗宽]` 区间，越界部分换算成平移量写入 CSS 变量 **`--popup-dx`**；`css/style.css` 的弹窗 transform 改为 `translateX(calc(-50% + var(--popup-dx)))`，**小箭头位置同步用 `left: calc(50% - var(--popup-dx))` 反向偏移**，因此弹窗平移后箭头依然准确指向触点，不出现"箭头飘走" |
| **★ 纵向：翻转 + 限高内滚** | 优先显示在触点上方；上方放不下（贴近顶部）就翻到下方（复用已有 `.flip` 类）；**上下都放不下**（超长文案 + 触点居中）时，选空间较大的一侧并给弹窗设 `max-height` + `overflow-y:auto`，**保证既不溢出内容区也不丢内容**（可滚动查看全文） |
| 窄屏自适应 | 先按内容区宽度收窄弹窗（`max-width = 内容区宽 − 16`，最小 160px），**再**测量高度——因为宽度会影响换行进而影响高度，顺序颠倒会算错；手机等窄屏下弹窗不会再横向溢出 |
| 无跳动 | 弹窗用 `visibility:hidden` 隐藏（**仍参与布局**），因此"显示之前"就能量到真实宽高，位置在显示的那一刻就是正确的，不会先溢出再被拉回来。若内容区尚未排版（宽或高为 0）则直接跳过，留待真正激活时再计算 |
| 缓存刷新 | `index.html` 的样式与脚本版本参数统一升到 `?v=0.5.1`（V0.2.1 的经验：手机浏览器会强缓存旧文件，改了 CSS/JS 必须换参数，否则修复不生效） |
| 回归防线 | `tests/smoke_test.mjs` 新增第 16 段 **18 项**断言（jsdom 无排版引擎，故对 `clientWidth/clientHeight/offsetLeft/offsetTop/offsetWidth/offsetHeight` 打桩出布局尺寸后直接调用 `placePopup()` 校验几何）：右边缘左移且刚好贴住留白 / 左边缘右移 / 居中不平移 / 上边缘翻转 / 下边缘仍在上方 / 超长弹窗限高内滚且不超可用空间 / 窄容器先收窄宽度；外加 4 项静态断言（CSS 变量、transform、箭头跟随、main.js 调用点），共 **202 项** |

### 涉及文件
`js/main.js`（新增 `placePopup()` 并在 `activateHotspot()` 显示前调用）、`css/style.css`（`--popup-dx` + transform + 箭头跟随）、`index.html`（注释 + 版本参数 `?v=0.5.1`）、`tests/smoke_test.mjs`、`README.md`、`CHANGELOG.md`、`文件依赖关系图.md`

### 验证
- `node tests/smoke_test.mjs .`：**202 项 PASS / 0 FAIL**（原 184 项）
- htmlstars 根目录 `verify_mount.py`：**168 项 PASS / 0 FAIL**（无新增文件，鉴权与挂载未受影响）
- 几何自检：内容区 860×1000、弹窗 300×200、触点中心 x=834 → 平移 **−132px**，右边缘刚好落在 852（= 860−8）；触点 x=26 → 平移 **+132px**，左边缘落在 8；两者都不再溢出

## V0.5.0 — 2026-09-14

### 新功能（中修改：可解说文件格式扩到 9 种 + 翻页边界态 + 默认开启语音 + 播放字幕条 + 巡讲严格「末段播完才翻页」）
| 修改点 | 说明 |
|---|---|
| **★ 零依赖格式适配层 `js/loaders.js`（新增）** | 纯 JavaScript 实现、**不引用任何第三方库 / CDN**，把 5 类新格式统一解析成同一种画布模型 `CanvasDoc = {kind, label, note, pages:[{w, h, draw(ctx)}]}`，交给 `js/main.js` 用它已有的画布渲染流程绘制。触点定位、弹窗、朗读、自动巡讲、离线音频**全部原样复用**，新格式与 PDF / 图片表现完全一致 |
| **★ 支持格式扩到 9 种** | `"pdf"` / `"image"` / `"text"`（txt·md·csv·log·ini·json…）/ `"docx"`（docx·docm）/ `"doc"`（旧版 Word）/ `"pptx"`（pptx·pptm）/ `"ppt"`（旧版 PPT）/ `"dxf"` / `"dwg"`。`type` 可省略，省略时按扩展名自动判定；判定后还会**按文件签名复核**——`.doc` 其实是 docx、`.dwg` 其实是文本 DXF，都会自动走正确路径 |
| **★ 自写 DEFLATE 解压（零依赖 Office 解析）** | docx / pptx 本质是 ZIP。`loaders.js` 自己解析 ZIP 中央目录（`readZip` / `zipRead`）并实现了 **DEFLATE inflate**（Huffman 解码 + LZ77 回溯复制），因此不需要任何解压库。已与 Python `zlib` **对拍 9 组数据全部一致**；实测解析「微信公众号安装说明.docx（17 KB）」「精通递归.docx（362 KB / 1386 段）」「CAD 培训.pptx（7.1 MB / 27 张）」均成功（7.1 MB 解包 + 提取约 14 ms） |
| **★ Word / PPT 内容提取** | `docxToBlocks`：读 `word/document.xml`，按段落样式识别标题、生成标题层级 + 正文块，再交给排版器分页；`pptxSlideParas`：读 `ppt/slides/slideN.xml`，**一张幻灯片 = 一页**，页数由文件内幻灯片数量决定；旧版二进制 `.doc` / `.ppt` 用 `legacyExtract` 尽力提取正文（不足时给提示页，不报错） |
| **★ DXF 解析与绘制** | `parseDxf` 解析 `ENTITIES` 与 `BLOCKS`，支持 `LINE` / `LWPOLYLINE` / `CIRCLE` / `ARC` / `ELLIPSE` / `TEXT` / `MTEXT` / `POINT` / `INSERT`（块参照自动展开）；`primsExtent` 求图形范围后等比缩放铺满画布。可用每页的 `view: {x0,y0,x1,y1}`（图形坐标）指定显示范围，做「总图 + 局部放大」多页讲解 |
| **★ DWG 引导页** | DWG 是专有二进制格式，浏览器无解析器。检测到真 DWG 签名时不再报错，而是渲染一页**转换指引**（说明三种处理办法：CAD 里另存 DXF / 另存 PDF / 截图输出 PNG）。若该 `.dwg` 实际是文本型 DXF，则自动按 DXF 正常画图 |
| **★ TXT 排版分页** | `textToBlocks` + `_layout`：按 `TEXT_LAYOUT`（760×1075，A4 比例，左边距 56）自动换行、分页；也支持在文本里用换页符 `\f`（或单独一行 `---`）**显式分页**。行宽用 `textWidth` 按中英文混排字宽估算，折行后总页数与 `pages` 数对齐 |
| **★ 翻页按钮边界态** | `js/main.js` 新增 `refreshControls()`：**第 1 页时「上一页」置灰不可用、最后一页时「下一页」置灰不可用、整份只有 1 页时两个都置灰**；页码变化（`updateIndicator`）与内容显示成功时自动刷新，无需手动干预 |
| **★ 默认开启「语音说明」** | 数据文件新增 `defaultVoiceOn`（默认 `true`），页面加载即勾选「🔊 语音说明」；设为 `false` 可改回默认关闭。原有 `defaultTemplate` / `defaultPdf` 语义不变 |
| **★ 播放字幕条（显示触碰点文字）** | `index.html` 新增固定底部字幕条 `.caption-bar`（`#captionBar`，含标题 / 页码·序号 / 正文），`js/main.js` 新增 `showCaption()` / `hideCaption()`：**语音播放期间始终完整显示当前触点（触碰点）的标题与文字全文**。触点弹窗贴着触点显示、靠近屏幕边缘可能被裁切，字幕条与屏幕尺寸无关，电脑 / 手机都看得清；播放结束或触点收起即自动隐藏，内容区同步留白（`body.has-caption`） |
| **★ 巡讲「末段播完才翻页」** | 自动巡讲严格等**本页最后一段语音播放完毕**才翻页（`tourContinue` 回调用 `state.speakSeq` 校验，被取代 / 被打断不触发）。**关键修正**：iOS / 部分浏览器的 `SpeechSynthesisUtterance.onerror` 会在「根本没发声」时也触发，旧逻辑一律当成「播完」，导致巡讲抢跑翻页；V0.5.0 改为**未发声就报错不再当播完**（`started` 标记位），语音引擎重试链路（浏览器朗读 → 离线音频）因此不会被误判截断 |
| **示例素材（新增）** | `tools/make_demo_docs.py`：**纯 Python 标准库生成**（零依赖）——`demo-notes.txt`（3 页，`\f` 分页）、`demo-report.docx`（3 页，用 `zipfile` 手写最小 Office 包）、`demo-slides.pptx`（3 张幻灯片）、`demo-plan.dxf`（46 个实体，覆盖 LINE / LWPOLYLINE / CIRCLE / ARC / TEXT / INSERT 与块定义）；`demo-plan.dwg` 为**真实屏钢结构图 DWG**（从工作文件夹复制，魔数 `AC1021`），用来演示引导页 |
| 数据与音频 | `js/narration_data.js` 新增 5 个条目：`notes-txt`（文本 3 页 / 6 触点）、`report-docx`（Word 3 页 / 6 触点）、`slides-pptx`（PPT 3 页 / 6 触点）、`plan-dxf`（DXF 1 页 / 3 触点）、`plan-dwg`（DWG 1 页 / 2 触点），共 **23 条新解说**；离线音频由 `gen_voice_oneclick.pyw --auto` 增量生成，总数 35 → **58 条 / 5.31 MB** |
| 回归防线 | `tests/smoke_test.mjs` 新增 **77 项**断言（五格式适配、翻页边界三种情形、默认语音开启、字幕条显示 / 收起、巡讲末段才翻页），共 **184 项**；`verify_mount.py` 资源清单加入 `js/loaders.js`、4 个新素材与 5 个新音频目录，共 **168 项**（`app.pyw` 零改动） |

### 涉及文件
`js/loaders.js`（新增）、`js/main.js`、`js/narration_data.js`、`index.html`（版本参数 `?v=0.5.0`）、`css/style.css`、`tools/make_demo_docs.py`（新增）、`assets/demo-notes.txt` / `demo-report.docx` / `demo-slides.pptx` / `demo-plan.dxf` / `demo-plan.dwg`（新增）、`assets/voice/{notes-txt,report-docx,slides-pptx,plan-dxf,plan-dwg}/*.mp3`（新增 23 个）、`tests/smoke_test.mjs`、`README.md`、`CHANGELOG.md`、`文件依赖关系图.md`

### 验证
- `node tests/smoke_test.mjs .`：**184 项 PASS / 0 FAIL**
- htmlstars 根目录 `verify_mount.py`：**168 项 PASS / 0 FAIL**（新增资源经 `/pages/` 鉴权路由正常 200，未授权 / 越界仍 403）
- 自写 inflate 与 Python `zlib` **对拍 9 组数据全部一致**；真实文件解析：安装说明.docx 17 KB、精通递归.docx 362 KB / 1386 段（30 ms）、CAD 培训.pptx 7.1 MB / 27 张（14 ms）
- 一键脚本增量：`gen_voice_oneclick.pyw --auto` 只补做新增的 23 条，音频 58/58 齐备

### 维护提醒
新增 / 更换素材后只需记住两件事：**① 文本类条目改了内容要重跑 `tools/make_demo_docs.py`；② 改了 `js/narration_data.js` 的文案后双击 `gen_voice_oneclick.pyw` 重生成音频**。文本 / Word 页的排版参数（页宽高、边距、字号、行距）集中在 `js/loaders.js` 的 `TEXT_LAYOUT`，幻灯片是 `SLIDE_LAYOUT`，CAD 图是 `CAD_LAYOUT`。

## V0.4.0 — 2026-09-14

### 新功能（中修改：条目不限于 PDF —— 图片文件同样可逐页解说）
| 修改点 | 说明 |
|---|---|
| **★ 图片类型条目** | `js/narration_data.js` 的条目新增 `type` 字段：`"pdf"`（默认，省略即按 PDF 处理）/ `"image"`。图片条目用 `pages[].src` 指定每一页的图片，页码 = `pages` 长度，翻页即换图。**原有 PDF 条目完全兼容**（不加 `type` 也能用） |
| **★ 独立的渲染分支** | `js/main.js` 新增 `entryKind()` / `currentKind()` / `pageTotal()` / `showStage()` / `renderImagePage()` / `enterStageError()`：图片条目**不走 PDF.js**，直接给新增的 `<img id="pdfImage">` 设 `src`；触点定位、弹窗、朗读、自动巡讲、离线音频全部沿用同一套逻辑，两种类型表现一致 |
| **★ 失败处理对齐** | 图片加载失败与「整份文件加载失败」表现完全一致：显示错误面板 + 上一页 / 下一页 / 自动翻页 / 语音复选框**全部置灰**。新增 `enterStageError()` 统一收尾，`showPage()` 也接入失败判定（换页遇图片缺失同样进入不可用状态，不再出现空白页却按钮照常可用） |
| 自适应与页码 | 图片宽度撑满容器、高度按原图比例自适应（新增 `#pdfImage` 样式），**缩放无需重渲染**（`resize` 时图片类型直接跳过）；页码在切图时即时更新，点翻页立刻有反馈 |
| 界面文案通用化 | 下拉标签「PDF 文件」→「**文件**」；加载提示、错误提示改为通用措辞（"文件加载失败或无法显示，请在上方下拉切换其它文件…"）；`<title>` 改为「内容解说 · V0.4.0」 |
| **示例图片（新增）** | `tools/make_demo_images.py`：**纯 Python 手写 PNG（只用 zlib / struct，零依赖）**生成两张「屏体示意图」——正立面（模组网格 + 横向 2560 / 纵向 1440 尺寸标注）与侧立面（墙体 / 背杆 / 屏体 + 厚度 80 与离墙 120 标注）。脚本会打印各标注元素的页面比例坐标，方便填写触点偏移 |
| 数据与音频 | 新增图片条目 `screen-image`（2 张图 × 6 触点 = 12 条解说），离线音频已由 `gen_voice_oneclick.pyw` 生成到 `assets/voice/screen-image/`；音频总数 23 → **35 条 / 2.97 MB** |
| 回归防线 | `tests/smoke_test.mjs` 新增 **29 项**断言（静态：类型声明 / 元素 / 样式 / 函数齐全 + 图片为合法 PNG；动态：切到图片条目 → `<img>` 显示且画布隐藏 / 页码 = 图片张数 / 触点定位 / 翻页换图 / 弹窗文案 / 加载失败禁用与隐藏破图 / 切回 PDF 恢复正常），共 **107 项**；`verify_mount.py` 资源清单加入 2 张 png（校验 `image/png`）与图片条目音频，共 **102 项** |

### 涉及文件
`js/main.js`、`js/narration_data.js`、`index.html`（版本参数 `?v=0.4.0`）、`css/style.css`、`tools/make_demo_images.py`（新增）、`assets/demo-screen-front.png`（新增）、`assets/demo-screen-side.png`（新增）、`assets/voice/screen-image/*.mp3`（新增 12 个）、`tools/voice_manifest.json`（随清单刷新）、`tests/smoke_test.mjs`、`README.md`、`CHANGELOG.md`、`文件依赖关系图.md`

### 验证
- `node tests/smoke_test.mjs .`：**107 项 PASS / 0 FAIL**
- htmlstars 根目录 `verify_mount.py`：**102 项 PASS / 0 FAIL**（png 经 `/pages/` 鉴权路由返回 `200 image/png`，未授权 / 越界仍 403）
- 图片资源：两张示例图均为合法 PNG（签名 `89 50 4E 47`），1280×720，分别约 11.1 KB 与 7.1 KB
- 音频：一键脚本识别到 12 条新增条目，**只合成这 12 条**（其余 23 条跳过），生成后 35/35 齐备

### 维护提醒
图片与 PDF 的维护方式相同，只有两点区别：条目写 `type: "image"`、每页用 `src` 指定图片。
改了文案后同样需要重新生成音频（双击 `gen_voice_oneclick.pyw` → 点「🚀 一键生成」）。

## V0.3.1 — 2026-09-14

### 新功能（小修改：一键生成解说语音的 .pyw）
| 修改点 | 说明 |
|---|---|
| **★ 一键脚本 `gen_voice_oneclick.pyw`（新增）** | 双击即用（Windows 下 `.pyw` 不弹黑窗口）：自动读取 `js/narration_data.js` 提取每个触点的文案 → 与 `assets/voice/` 现状及上次清单的**文案指纹**逐条比对 → 调用 `tools/gen_voice_files.py` 按 `assets/voice/<pdfId>/p<页>-<序>.mp3` 规则合成。只做「文件缺失」与「文案已改」的条目。界面含 一键生成 / 全部重新生成 / 仅导出清单 / 安装修复 edge-tts / 打开音频目录 / 停止；实时日志同时写入 `tools/voice_build.log`。另有兜底入口 `gen_voice_oneclick.bat`（`.pyw` 未关联 Python 的机器用它） |
| **★ 纯 Python 清单导出器（新增）** | `tools/narration_manifest.py`：内置小型 JS→JSON 转换器解析数据文件（支持 `//`、`/* */` 注释、无引号 key、单/双引号字符串、尾随逗号），**不要求装 Node**；输出的条目顺序、路径、文案与 `tools/export_voice_manifest.mjs` **完全一致**（已实测 23 条对拍全等），并额外为每条文案写入 12 位指纹 `hash` |
| 增量与一致性 | `hash` 作为「文案是否改过」的判据：指纹变化 → 先删除该条旧 mp3 再重新合成，杜绝「文字已改、声音还是旧的」；老清单没有指纹时，本次只补建基线、不盲目重做全部 |
| 环境自适应 | 自动在多个 Python（含 `.workbuddy` 虚拟环境）中挑出装了 edge-tts 的那个来跑合成，避免用户手动切换解释器；一个都没有时，界面上点一下即可 `pip install -U edge-tts`。子进程强制 UTF-8（中文日志不乱码）、Windows 下不闪控制台窗口 |
| 命令行入口 | `--auto`（智能增量）/ `--auto --force`（全量）/ `--auto --dry-run`（演练）/ `--auto --only <pdfId>`（限某个 PDF）/ `--check`（环境体检）/ `--list`（列条目与指纹）；另支持 `PDFN_GUI_SELFTEST=1` 界面自检（不显示窗口，供自动化验证） |
| 其他 | `js/narration_data.js` 注释同步指向一键脚本；`tools/voice_manifest.json` 新增 `hash` / `generator` / `pdfs` 字段（供网页与脚本共用，不影响页面逻辑） |

### 涉及文件
`gen_voice_oneclick.pyw`（新增）、`gen_voice_oneclick.bat`（新增，GBK 编码的兜底入口）、`tools/narration_manifest.py`（新增）、`js/narration_data.js`（仅注释）、`tools/voice_manifest.json`（新增字段）、`README.md`（第九章改为「方式 A 一键 / 方式 B 手动两步」）、`CHANGELOG.md`、`文件依赖关系图.md`

### 验证
- `python gen_voice_oneclick.pyw --auto --dry-run`：识别 2 个 PDF / **23 条**文案，23 条全部就绪、0 条待办
- 两个导出器对拍：Python 版与 Node 版输出的 (音频路径, 文案) **23 组完全一致**
- 改动闭环实测：临时改 1 条文案 → 检出「需重生成 1 条」→ 清除旧音频并只重合成该条；还原文案后再跑，再次只重做该条并恢复齐备（23/23）
- 解释器自适应实测：用**未装** edge-tts 的系统 Python 运行 `--check`，正确挑出虚拟环境里已装的 edge-tts 7.2.8
- 界面自检：`PDFN_GUI_SELFTEST=1` 下界面构建与状态统计正常（共 23 条 / 已就绪 23 条 / 23 个文件 1.93 MB）

### 维护提醒
改了 `js/narration_data.js` 的文案或增删触点后，**双击 `gen_voice_oneclick.pyw` → 点「🚀 一键生成」**即可，会自动只重做变动的那几条。

## V0.3.0 — 2026-09-14

### 新功能（中修改：预生成离线语音文件 + 浏览器不能朗读时改播音频 + 禁用声音模板）
| 修改点 | 说明 |
|---|---|
| **★ 离线语音文件** | 新增 `tools/export_voice_manifest.mjs`（从 `js/narration_data.js` 导出每条解说的文案清单）与 `tools/gen_voice_files.py`（用 edge-tts 批量合成 mp3）。已为 **23 条解说**生成音频，存放在 `assets/voice/<pdfId>/p<页>-<序>.mp3`，共约 2.0 MB，音色 `zh-CN-YunxiNeural`（云希·中文男声），语速 `-5%`。生成时联网，**生成后完全离线可用** |
| **★ 三类发声模式** | `js/main.js` 新增 `state.voiceMode`：`"tts"`（浏览器朗读，默认）/ `"file"`（离线音频）/ `"none"`（都不可用）。浏览器能朗读时仍用实时朗读（可切声音模板）；一旦判定发不出声（无引擎 / 无中文语音包 / 看门狗重发一次仍无 `onstart`）→ **自动改播音频文件**，不再直接关闭语音说明 |
| **★ 自动禁用声音模板** | 切到音频模式时调用 `setVoiceTemplatesEnabled(false)` 把「声音模板」下拉置灰禁用（音频音色是固定的，选了也没用），并在 `title` 与提示条说明原因；`css/style.css` 新增 `#voiceSelect:disabled` 置灰样式 |
| 音频播放器 | 全局复用同一个 `Audio` 元素（`ensureAudioEl()`）：移动端上同一元素在手势中播放成功过，后续自动播放通常不再被拦截；`unlockTTS()` 顺带在首次用户手势中用 20ms 静音 WAV 解锁媒体播放（iOS 同样受自动播放策略限制） |
| 巡讲完全兼容 | 音频播完触发 `ended` → `onEnd` → 巡讲 2 秒后进入下一条、页尾自动翻页，流程与 TTS 模式一致；`stopSpeech()` 同步暂停音频（上一触点声音立即停止的规则不变） |
| 两级降级 | 音频也播不出来（文件缺失 / 浏览器拦截自动播放）时，才回到 V0.2.3 行为：提示具体原因 + 自动取消「语音说明」勾选（关闭巡讲） |
| 误判防护 | 体检阶段（`warnIfNoTts`/`probeTts`）只提示"将自动改用离线语音文件播放"，**不切模式也不取消勾选**；真正切换发生在实际发声那一刻（有事实依据）。空语音列表仍重试 3 次，且 `ttsEverWorked`（曾成功发声过）永不被判为无法发音 |
| 数据配置 | `js/narration_data.js` 新增 `offlineVoice: { enabled, dir, ext, voiceLabel }`；`enabled: false` 可关闭兜底 |
| 回归防线 | `tests/smoke_test.mjs` 新增 **16 项**断言（音频桩 + 齐备性校验 + 模式切换 + 模板禁用 + 音频播完续播 + 音频失败降级），共 **78 项**；`verify_mount.py` 资源清单加入 mp3 与 MIME 校验，共 **84 项** |

### 涉及文件
`js/main.js`、`js/narration_data.js`、`index.html`（版本参数 `?v=0.3.0`）、`css/style.css`、`tests/smoke_test.mjs`、`tools/export_voice_manifest.mjs`（新增）、`tools/gen_voice_files.py`（新增）、`tools/voice_manifest.json`（新增）、`assets/voice/**`（新增 23 个 mp3）、`README.md`（新增第九章）、`CHANGELOG.md`、`文件依赖关系图.md`

### 验证
- `node tests/smoke_test.mjs .`：**78 项 PASS / 0 FAIL**
- htmlstars 根目录 `verify_mount.py`：**84 项 PASS / 0 FAIL**（mp3 经鉴权路由返回 `200 audio/mpeg`；未授权/越界仍 403）
- 音频有效性：23 个文件均为合法 MP3（帧同步头 `FFF3`），逐条与触点文案一一对应

### 维护提醒
改了 `js/narration_data.js` 的文案或增删触点后，**必须重新生成音频**，否则音频与页面文字不一致：
`node tools/export_voice_manifest.mjs` → `python tools/gen_voice_files.py`。

## V0.2.3 — 2026-09-14

### 变更（小修改：判定无法发音时自动取消「语音说明」勾选）
| 修改点 | 说明 |
|---|---|
| **★ 提示的同时自动关闭语音复选框** | 新增统一处理函数 `forceVoiceOff(msg)`：一旦判定当前浏览器无法发音，**在显示提示条的同时把「语音说明」复选框取消勾选**，并同步 `state.voiceOn = false`，避免出现“复选框已勾选、却始终没有声音”的矛盾状态。（直接改 `checked` 属性不会触发 `change` 事件，故该函数手动完成全部联动） |
| **巡讲联动** | 语音说明关闭后，巡讲（其节奏由“语音播完”事件驱动）按既有规则（“取消勾选语音 → 巡讲一并停止”）一并停止：按钮回到 `▶ 自动翻页`、关闭弹窗、清除触点朗读高亮，避免无声地快速翻弹窗。提示文案会追加说明：`（已自动取消「语音说明」勾选，并停止自动翻页）` |
| **三处判定点全部接入** | ① 浏览器完全没有语音引擎（`speechSynthesis` / `SpeechSynthesisUtterance` 缺失，含 `speak()` 调用时兜底）；② 系统没有中文语音包；③ 看门狗判定“引擎有反应但发不出声”（重发一次后仍无 `onstart`，改判失败并取消勾选，不再触发续播回调） |
| **降低误判：空列表重试** | `getVoices()` 返回空数组有可能只是“引擎尚未就绪”（安卓 / iOS 首次调用常见），故改为每 1.2 秒探测、最多重试 3 次后才判为“无引擎”，避免把可用环境误判成不可用 |
| **降低误判：成功过就不判死** | 新增 `ttsEverWorked` 标记（`onstart` 触发即置位）：只要曾经成功发声过，就永不判为“无法发音”，也就不会误关复选框 |
| 用户手动关闭优先 | `forceVoiceOff()` 在复选框本就未勾选时直接返回，不重复提示、不打断用户操作 |
| 回归防线 | `tests/smoke_test.mjs` 新增 **18 项**断言（含两组动态场景：完全无引擎、有引擎但静默失败），共 **62 项** |

### 涉及文件
`js/main.js`、`index.html`（版本参数 `?v=0.2.3`）、`tests/smoke_test.mjs`、`README.md`、`CHANGELOG.md`、`文件依赖关系图.md`

### 验证
- `node tests/smoke_test.mjs .`：**62 项 PASS / 0 FAIL**（其中动态验证：无引擎时勾选立即被取消；静默失败时 1 秒仍保持勾选（先重试）→ 约 3 秒后自动取消并停止巡讲）
- htmlstars 根目录 `verify_mount.py`：**78 项 PASS / 0 FAIL**

## V0.2.2 — 2026-09-14

### 修复（小修改：手机端没有语音声音）
| 修改点 | 说明 |
|---|---|
| **★ ① iOS 首次发声必须落在用户手势内** | iOS（Safari / 微信）要求**第一次 `speechSynthesis.speak()` 必须同步发生在用户手势的调用栈里**，否则本次及之后所有朗读全部静音 —— 这是"电脑有声、手机无声"最常见的原因。新增 `unlockTTS()`：在用户首次 `touchstart / touchend / pointerdown / click` 时同步播一个极短空朗读完成解锁；监听注册在**捕获阶段**，保证先于触点自身处理器执行（直接点触点也能解锁） |
| **★ ② utterance 被 GC 导致无声/断读** | iOS 上 `SpeechSynthesisUtterance` 若没有引用会被垃圾回收，表现为不发声或中途停止。新增 `liveUtterances` 数组持续持有朗读对象引用，朗读结束后释放 |
| **★ ③ 无中文 TTS 引擎时静默失败** | 部分安卓机（尤其微信/QQ 等内置浏览器）没有中文语音引擎，`speak()` 不报错但完全没有声音。新增**发声看门狗**：1.5 秒内没有收到 `onstart` → 取消并重发一次 → 仍无反应则显示提示条，并按文字长度估算时长收尾（**保证巡讲流程不被卡死**） |
| **页面内的原因提示条** | 新增 `#voiceHint` 提示条（工具栏下方，12 秒后自动消失），针对三种情况给出可操作的中文说明：完全无引擎（含"安卓设置→无障碍→文字转语音"指引与"改用系统浏览器、微信内置浏览器通常不支持"建议）、无中文语音包、有引擎但无声音（提示检查 iPhone 侧边静音开关 / 媒体音量） |
| **开启语音即体检** | 勾选「语音说明」或点击「自动翻页」时调用 `warnIfNoTts()`，延时 1.2 秒（等语音列表异步到达）检查引擎与中文语音，提前告知而不是让用户对着无声页面猜 |
| **语音列表轮询兜底** | 部分内核不触发 `onvoiceschanged`，新增 8 次 × 400ms 轮询补齐中文语音列表 |
| **取消/重发的时序** | `cancel()` 后紧接 `speak()` 在 iOS 上可能被吞掉，看门狗的重试路径覆盖了该情况；`stopSpeech()` 结束后清空引用数组，避免长期累积 |
| 回归防线 | `tests/smoke_test.mjs` 新增 7 项语音加固断言，共 **44 项** |

### 涉及文件
`js/main.js`、`index.html`、`css/style.css`、`tests/smoke_test.mjs`、`README.md`、`CHANGELOG.md`、`文件依赖关系图.md`

### 验证
- `node tests/smoke_test.mjs .`：**44 项 PASS / 0 FAIL**
- htmlstars 根目录 `verify_mount.py`：**78 项 PASS / 0 FAIL**
- 说明：语音效果取决于**手机系统是否装有中文 TTS 引擎**，代码层已做到"能发就一定发、不能发就在页面上说清原因"，最终发声效果需在真机确认

## V0.2.1 — 2026-09-14

### 修复（小修改：页面常驻"PDF 加载失败"提示 + 加载路径加固）
| 修改点 | 说明 |
|---|---|
| **★ 根因修复：遮罩 `hidden` 属性失效** | `css/style.css` 里 `.loading, .load-error { display: flex; }` 是**类选择器**规则，优先级高于浏览器默认样式表的 `[hidden] { display: none }`，使 HTML 上的 `hidden` 属性完全失效：两块白色遮罩（含红色"PDF 加载失败…"字样，`position:absolute; inset:0; background:#fff; z-index:30`）**一直盖在 PDF 上方**，与 PDF 是否真的加载成功无关。**该缺陷在电脑与手机上表现完全一致**（同一份 CSS 层叠规则），并非手机专有。修复：`css/style.css` 新增 `[hidden] { display: none !important; }` 兜底 |
| **失败原因直接可见** | 错误遮罩改为纵向排版，新增 `#loadErrorDetail` 面板，把**每一步的具体失败原因与已经尝试过的加载方案**列在页面上（手机没有控制台，只能靠页面呈现），便于截图反馈定位 |
| **多方案自动降级** | 单一加载路径改为四级降级：① URL 直连 → ② 整包下载后解析（绕开移动端流式读取兼容问题）→ ③ 整包 + `isEvalSupported:false`（部分移动内核禁止动态求值）→ ④ 整包 + **主线程解析**（把 worker 脚本当普通脚本载入，彻底不依赖 Worker 能力）。每级 20 秒超时，避免弱网下永久停在"加载中" |
| **引擎缺失可辨识** | 新增 `pdfjsLib` 存在性检查：浏览器过旧导致 PDF 引擎未加载时给出明确提示，不再抛晦涩错误 |
| **workerSrc 绝对化** | 一律以 `document.baseURI` 解析为绝对 URL，规避 iframe / 无 `<base>` 场景下的路径歧义（含主线程降级时的脚本加载） |
| **渲染兜底** | 容器宽度测不到（手机 iframe 布局未就绪等）时改用窗口宽度，避免缩放比为 0 出现"加载成功却一片空白"；`renderPage()` 改为返回成功/失败，首页渲染失败时同样正确置灰控件并给出原因 |
| 回归防线 | `tests/smoke_test.mjs` 新增 2 项断言（CSS 必须保留 `[hidden]` 兜底、错误面板必须含原因容器），共 **37 项** |

### 涉及文件
`css/style.css`、`index.html`、`js/main.js`、`tests/smoke_test.mjs`、`README.md`、`CHANGELOG.md`、`文件依赖关系图.md`

### 验证
- `node tests/smoke_test.mjs .`：**37 项 PASS / 0 FAIL**
- htmlstars 根目录 `verify_mount.py`：**78 项 PASS / 0 FAIL**
- CSS 层叠修复经 jsdom 计算样式断言（`hidden` 能真正隐藏遮罩）；真实浏览器视觉验证受本机无头浏览器策略限制未执行，请在设备上刷新确认

## V0.2.0 — 2026-09-14

### 变更（中修改：多 PDF 支持 + 语音模板更名）
| 修改点 | 说明 |
|---|---|
| **多 PDF 数据架构** | `narration_data.js` 由单 PDF 结构改为 `pdfs: [...]` 数组；每个 PDF 拥有独立的 `id` / `name` / `url` / `basePoint`（标准基点）/ `pages`（每页触点）。原 `pdfUrl` 字段废弃 |
| **PDF 文件下拉** | 工具栏最左、「上一页」按钮之前新增 `#pdfSelect` 下拉框，选项由 `pdfs` 数组生成（按 JS 解说的 PDF 显示）；选择后调用 `loadPdf()` 刷新为该 PDF 的**第 1 页** |
| **真实 PDF 接入** | 新增 `assets/steel-drawing-sample.pdf`：来自 `D:\朱国生\工作文件\华东(鲁苏沪浙)\…` 的 ZWCAD 出图真实施工图（5 页 A3 横版 420×297mm，图号 GJ2026070037，R2.5H 模组整屏室内壁挂前维护 2560×1440），并为其编写 11 条 demo 解说（触点偏移由 PDF 文字实际坐标换算） |
| **控件禁用** | 新增 `setControlsEnabled()`：PDF **无法显示时**（加载中 / 加载失败）上一页、下一页、自动翻页按钮与语音说明复选框全部 `disabled`；显示成功后恢复。加载失败时下拉框保持可用，便于切换其它 PDF |
| **声音模板更名** | 「女音」→「**女播音**」、「男音」→「**男播音**」；顺序调整为 男播音 / 女播音 / 萝莉音 / 大叔音，**默认男播音**（数据文件 `defaultTemplate: "male"`，改这一处即可换默认项） |
| 渲染健壮性 | `renderPage()` 记录文档句柄，切换 PDF 后丢弃在途的旧页渲染结果；`rendering` 标志改为 `try/finally` 释放，渲染异常不会卡死后续翻页 |
| 停止朗读 | `stopSpeech()` 增加 `speakSeq++`，使在途朗读回调失效，避免切换 PDF / 翻页时旧回调驱动巡讲 |
| 文档 | README 更新多 PDF 维护方式、控件禁用与声音模板说明；index.html 版本号 |

### 涉及文件
`index.html`、`js/main.js`、`js/narration_data.js`、`css/style.css`、`assets/steel-drawing-sample.pdf`（新增）、`tests/smoke_test.mjs`（新增）、`README.md`、`CHANGELOG.md`、`文件依赖关系图.md`

### 验证
- `node tests/smoke_test.mjs .`：jsdom 冒烟测试 **35 项 PASS / 0 FAIL**
- htmlstars 根目录 `verify_mount.py`：**78 项 PASS / 0 FAIL**（新增资源已纳入 5 账号×9 资源校验）
- 真实 HTTP：两个 PDF 均 200 `application/pdf`，`js/*` 200 `text/javascript`，越界/未授权仍 403

## V0.1.1 — 2026-09-14

### 变更（小修改：迁入工作台并挂载菜单）
| 修改点 | 说明 |
|---|---|
| 目录迁移 | 整个项目由 `html/htmlstars` 同级目录迁入 `htmlstars/pages/pdf_narrator_20260914/` |
| 菜单挂载 | htmlstars 侧新增菜单项 `id=pdf-narrator`（标题「内容解说」），`page=pages/pdf_narrator_20260914/index.html`；已为全部账号（含 guest）授权 |
| 鉴权纳入 | 目录型授权使 `js/`、`css/`、`assets/demo.pdf` 等资源一并受 `/pages/<path>` 权限保护，未授权账号 403 |
| 文档 | README 更新运行方式（方式 A 工作台集成 / 方式 B 独立 http 服务）、目录树；index.html 版本号 |
| 功能代码 | `js/main.js`、`js/narration_data.js`、`css/style.css` **零改动**（相对路径加载，迁入子目录后无需修改） |

## V0.1.0 — 2026-09-14

### 变更（中修改：自动翻页重构为"自动巡讲"模式）
| 修改点 | 说明 |
|---|---|
| 自动巡讲流程 | 点击"自动翻页"后按钮名称变为 **"⏹ 停止翻页"**，并**自动勾选语音说明** |
| 逐触点解说 | 从当前页第一个触点开始依次显示弹窗并朗读；当前触点**语音解说完毕后 2 秒**进入下一个触点（`TOUR_GAP = 2000`） |
| 语音驱动翻页 | 当前页所有触点解说完毕后**自动翻到下一页**继续解说；直至 PDF 解说完毕或点击"停止翻页"（不再使用固定间隔定时器） |
| 语音结束驱动 | `speak()` 新增 `onEnd` 回调与 `speakSeq` 会话序号：仅当本段朗读是"最后一次发起"且正常结束/失败时才驱动下一触点，避免被打断的旧朗读误触发续播 |
| 手动干扰兼容 | 巡讲中手动翻页 → 从新页第一个触点继续；巡讲中手动悬停某触点 → 该触点解说完后自动从该处衔接继续 |
| 取消语音联动 | 巡讲进行中取消勾选"语音说明"会同时停止巡讲（巡讲依赖语音结束事件驱动） |
| 兜底机制 | 设备无语音引擎时按文字长度估算朗读时长，巡讲流程不中断 |

## V0.0.1 — 2026-09-14

首个版本。

### 新增文件
| 文件 | 说明 |
|---|---|
| index.html | 入口页面：顶部一行工具栏（页码 / 上一页 / 下一页 / 自动翻页 / 语音说明复选框 / 右上角声音模板下拉）+ PDF 展示区 |
| css/style.css | 全部样式，含手机端适配（工具栏换行、触点加大、弹窗防超屏） |
| js/narration_data.js | 解说数据文件：标准基点 + 每页热点（偏移比例坐标、标题、解说文字），支持增删改 |
| js/main.js | 主逻辑：PDF.js 本地渲染、热点层构建、弹窗悬停/点按逻辑、Web Speech 语音合成与声音模板、自动翻页 |
| js/lib/pdf.min.js、pdf.worker.min.js | PDF.js 3.11.174 本地离线库 |
| assets/demo.pdf | 示例 5 页 PDF |
| make_demo_pdf.py | 示例 PDF 生成脚本（纯 Python 无依赖，可选） |
| README.md | 使用与维护说明 |
| 文件依赖关系图.md | Mermaid 文件依赖图 |

### 核心行为
- 悬停蓝点 → 弹窗立即显示；移离蓝点或弹窗约 0.2s 后弹窗自动消失。
- 勾选"语音说明"后：进入触点立即朗读；移开鼠标语音继续播完；进入下一个触点时上一段语音立即停止并开始新解说。
- 声音模板：女音 / 男音 / 萝莉音 / 大叔音（系统语音匹配 + pitch/rate 调整）。
- 自动翻页：末页回卷第 1 页；弹窗打开时该拍跳过。
