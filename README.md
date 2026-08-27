# htmlstars（双模运行版）

本目录由 `py+cad` 复制而来，增加了**「纯前端运行（Pyodide / Python-WASM）」与「后端服务器（Flask）」双模自动切换**能力。

- **后端模式（Flask）**：用 `python app.pyw` 启动，`runtime.js` 探测到 `/api/health` 后直接放行，行为与原 `py+cad` 完全一致。
- **纯前端模式（静态托管）**：部署到 GitHub Pages 等静态站点时，没有 `/api/health`，`static/js/runtime.js` 自动加载 Pyodide，把 `pysub` 包与数据注入浏览器虚拟文件系统，并把 `/auth /dxf /search` 三类请求转交给 `pysub/browser_server.py` 在浏览器内执行。

前端 `index_app.js` 及各子页面**未改动任何业务逻辑**，只是通过全局 `fetch` 拦截实现双模。

## 与 py+cad 的差异（最小改动清单）

1. `pages/index.html` 移动到根目录 `index.html`，链接改为相对路径。
2. 新增 `static/js/runtime.js`：双模运行时（探测后端 + Pyodide 启动 + fetch 拦截）。**父页只加载「一份」Pyodide，各 iframe 子页通过 `window.parent.__RUNTIME__` 复用，不再各自加载**。
3. 新增 `pysub/browser_server.py`：无 Flask 的纯 Python 版后端，复用同一套逻辑（登录/权限/用户管理/dxf 生成/搜索）。
4. `app.pyw` 增加 `/api/health` 探测路由，及根目录静态文件路由（让 `runtime.js` 也能被后端模式加载）。**不影响原有功能。**
5. 7 个会调接口的 iframe 子页（`led-design.html`、`led-design-plus.html`、`led-design-plusA.html`、`led-design20260807.html`、`search.html`、`settings.html`、`welcome.html`）在 `<head>` 注入 `<script src="../static/js/runtime.js"></script>`。前端模式下它们复用父页的 Pyodide；后端模式下只透传，无副作用。

> 登录与权限继续沿用原方案：`static/data/users.json`（明文密码）+ `static/data/menus.json`。按你的要求不考虑泄露问题。

## 本地运行

### 后端模式（推荐开发时使用）
```bash
cd htmlstars
python app.pyw        # 自动开浏览器，托盘可退出
```
首次需安装依赖：`pip install flask waitress pystray pillow requests jieba ezdxf matplotlib qrcode python-barcode`

### 纯前端模式（验证静态部署效果）
静态服务器即可（Pyodide 与扩展包均已本地托管，无需联网）：
```bash
cd htmlstars
python -m http.server 8009
# 浏览器打开 http://localhost:8009
```
打开后会自动进入纯前端模式（控制台可见 `[runtime] 运行模式: frontend` 及 Pyodide 就绪日志）。登录账号同 `users.json`（如 `zgs378530220 / 378530220`）。

### 纯前端模式·一键预览
直接双击 **`预览-前端.bat`**（Windows）或运行 **`bash 预览-前端.sh`**（Linux/macOS），脚本会自动从 8080 起寻找空闲端口、启动静态服务器并打开浏览器；关闭窗口即停止服务器。无需安装 Flask 等后端依赖。

## 部署到静态站点（GitHub Pages 等）

直接把 `htmlstars/` 全部内容提交即可。要点：
- **支持子路径部署**（如 `https://user.github.io/repo/`）：所有真实文件引用已相对化，`runtime.js` 还会根据 `location` 自动推导 `BASE` 来加载 `pysub/`、`static/data/` 并探测 `/api/health`，因此根路径与子路径均可正常运行。
- 改了某个 `.py` 后想强制刷新浏览器缓存：在文件名加版本号并同步 `browser_server.py` 里 `PYSUB_FILES` 引用，或让用户强刷（Ctrl+Shift+R）。
- 数据文件 `users.json` / `menus.json` / `excel_search.db` 随站点下发，任何人可下载读取——仅适合「软权限」展示，不适合保密。

## 已知限制（纯前端模式）

- **Pyodide 核心已本地托管于 `static/pyodide/`**（约 14MB 随仓库下发），首屏无需联网，不受 jsdelivr 等 CDN 被墙影响。**DXF/搜索依赖的纯 Python 包也已离线打包**（`static/pyodide/packages/*.whl`、`static/pyodide/jieba.zip`），前端模式无需联网即可生成 DXF、二维码与搜索。
- DXF 生成依赖 `ezdxf / qrcode / python-barcode / pyparsing`，搜索依赖 `jieba`，由 `runtime.js` 在 Pyodide 就绪后从**本地离线包**安装（不走 PyPI/CDN）；安装失败仅告警，不影响登录/菜单。
- 前端模式下 **matplotlib 未离线打包（wasm 构建过重）**，因此「生成预览 PDF / 打包 ZIP」选项会降级：仍生成 DXF 文件，但不会输出预览 PDF；如需完整预览，请使用后端模式（Flask）。
- 前端模式下**父页（index.html）只加载「一份」Pyodide**，并暴露在 `window.__RUNTIME__`，各 iframe 子页优先复用（通过 `window.parent.__RUNTIME__`），不再各自加载，省流量。若子页被单独打开（无父页），则自动兜底自行加载。
- 子页面若新增调用 `/auth /dxf /search` 的逻辑，需在其 `<head>` 加入 `<script src="../runtime.js"></script>`（相对路径按层级调整）。

## 文件结构

```
htmlstars/
├─ index.html              # 主页（由 pages/index.html 上移，链接已改相对）
├─ static/js/runtime.js    # 双模运行时（新增；父页统一加载一份 Pyodide，iframe 复用）
├─ app.pyw                 # Flask 入口（仅加 /api/health 与根文件路由）
├─ pysub/
│  ├─ browser_server.py    # 纯 Python 后端（新增，供 Pyodide 调用）
│  ├─ auth.py / dxf.py / search.py / utils.py ...  # 原蓝图，后端模式照常
│  └─ dxf_generator.py / profile_engine.py ...
├─ static/                 # 原静态资源与数据（users.json / menus.json / *.db）
└─ pages/                  # 子页面（led-design / search 等已注入 ../static/js/runtime.js）
```

## 文件路径约定（重要）

所有**真实的文件引用**（CSS / JS / 图片 / 数据）已全部改为**相对路径**，以便部署在任意子路径（如 `github.io/仓库名/`）也能正确加载：

- 根目录 `index.html` 用 `static/...`、`static/js/runtime.js`。
- `pages/*.html` 在子目录，必须用 `../static/...`、`../static/js/runtime.js`（上跳一层到根）。
- 原 `pages/FillRectangle.html`、`led-design-plusA.html` 里失效的 `/js/...` 已映射到 `../static/js/...`（根上不存在 `js/` 目录）。

> **特别注意：登录/接口调用（`/auth`、`/dxf`、`/search`）刻意保持「绝对路径」，不要改成相对。**
> 原因：这些不是真实文件，而是被 `runtime.js` 拦截的虚拟接口；保持绝对路径反而让它在「后端模式」和「子路径静态部署」下都能正确被拦截/路由。真实文件引用才需要相对化。

## 纯前端模式下的两个已知限制

1. **前端模式下 Pyodide 由父页统一加载一份，各 iframe 复用**（`window.parent.__RUNTIME__`）；单独打开子页时才自行兜底加载。已修正此前「每 iframe 各自一份」的浪费。
2. **DXF / 搜索依赖的纯 Python 包（ezdxf、qrcode、python-barcode、jieba）已随仓库离线打包于 `static/pyodide/`**，前端模式无需联网即可使用；首次生成 DXF 或搜索时浏览器内会有一点安装耗时（一次性）。

## 已注入 `../static/js/runtime.js` 的页面（调后端接口的 iframe 子页）

`led-design.html`、`led-design-plus.html`、`led-design-plusA.html`、`led-design20260807.html`、`search.html`、`settings.html`、`welcome.html`。
其余只引用静态资源、不调接口的页面无需注入。
