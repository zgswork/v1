/* runtime.js — 双模运行时（纯前端 Pyodide / 后端 Flask 自动切换）
 * ---------------------------------------------------------------------------
 * 本文件放在 static/js/ 下，由 index.html（父页）和各需要调接口的 iframe 子页引用。
 * 它会：
 *   1) 探测后端：访问 <BASE>/api/health，200 则认为有 Flask 后端 → 后端模式，原样放行 fetch。
 *   2) 否则 → 前端模式：
 *        - 父页（index.html）只加载“一份” Pyodide，并把浏览器端后端 pysub.browser_server
 *          挂到 window.__RUNTIME__ 上；
 *        - 各 iframe 子页优先复用父页的 Pyodide（通过 window.parent.__RUNTIME__），
 *          不再各自加载一份（省流量）；若父页不可用（如单独打开子页），则自行加载兜底。
 *        - 拦截 /auth /dxf /search 三类请求，转交给 pysub.browser_server.dispatch 处理。
 *
 * 前端 JS（index_app.js / 子页脚本）无需任何改动，仍可照常 fetch。
 * 后端模式下本文件零副作用（直接透传 fetch），不影响现有功能。
 *
 * 子路径部署支持：通过 location 推导 BASE（如 GitHub Pages 的 /repo/），
 * 资源与接口探测均基于 BASE，避免绝对根路径在 /repo/ 下失效。
 * ------------------------------------------------------------------------- */
(function () {
  "use strict";
  var ORIGINAL_FETCH = (typeof window.fetch === "function") ? window.fetch.bind(window) : null;
  if (!ORIGINAL_FETCH) return; // 极老浏览器，放弃拦截

  var API_PREFIXES = ["/auth", "/dxf", "/search"];
  var PYODIDE_VERSION = "0.26.4";
  // 版本号：与各 HTML 中 runtime.js?v=... 保持一致，改动本文件后一并升级以击穿浏览器缓存
  var RUNTIME_VERSION = "20260827q";
  var MODE = "detecting";
  var _pyReady = null;
  var pyodide = null;
  window.__APP_MODE = MODE;

  /* ---------- BASE：应用根目录（支持 /repo/ 这类子路径部署）---------- */
  function computeBase() {
    var p = location.pathname;
    // iframe 子页位于 /pages/ 下时，应用根目录是 /pages/ 的上一级
    if (p.indexOf("/pages/") !== -1) return p.substring(0, p.indexOf("/pages/") + 1);
    // 根 index.html：取目录部分
    return p.substring(0, p.lastIndexOf("/") + 1);
  }
  var BASE = computeBase();

  // 部署基准路径探测：GitHub Pages / 任意子目录部署时，依赖文件(pysub/、static/)的位置可能与
  // 当前页面 pathname 推算的不一致（例如站点根在 /v1/ 但文件实际在 /v1/htmlstars/ 下，
  // 或 pysub 目录未随仓库提交/被 .gitignore 忽略）。这里用 runtime.js 自身 URL 反推应用根，
  // 并对若干候选根逐一探测 pysub/__init__.py，选出第一个真实存在的位置，最大化“任意子路径部署”兼容性。
  function resolveBase() {
    var roots = [];
    try {
      var s = document.currentScript;
      if (s && s.src) {
        var ci = s.src.indexOf("/static/js/runtime.js");
        if (ci !== -1) roots.push(s.src.substring(0, ci + 1)); // 含 origin 的绝对 URL
      }
    } catch (e) {}
    var ap = location.pathname;
    if (ap.indexOf("/pages/") !== -1) roots.push(location.origin + ap.substring(0, ap.indexOf("/pages/") + 1));
    else roots.push(location.origin + ap.substring(0, ap.lastIndexOf("/") + 1));
    // 由每个根“逐级向上”派生候选（兼容多嵌套一层的情况），全部基于同一 origin
    var cands = [];
    roots.forEach(function (r) {
      var pathPart = (r.indexOf("//") !== -1) ? r.substring(r.indexOf("/", 8)) : r;
      if (pathPart.charAt(0) !== "/") pathPart = "/" + pathPart;
      var segs = pathPart.split("/").filter(Boolean);
      for (var k = segs.length; k >= 0; k--) {
        cands.push(location.origin + "/" + segs.slice(0, k).join("/") + (k > 0 ? "/" : ""));
      }
    });
    var seen = {}, uniq = [];
    cands.forEach(function (c) { if (!seen[c]) { seen[c] = 1; uniq.push(c); } });
    cands = uniq;
    function check(b) {
      return ORIGINAL_FETCH(b + "pysub/__init__.py", { method: "GET", cache: "no-store" })
        .then(function (rr) { return rr.ok; })
        .catch(function () { return false; });
    }
    var seq = Promise.resolve(null);
    cands.forEach(function (b) {
      seq = seq.then(function (found) {
        if (found) return found;
        return check(b).then(function (ok) { return ok ? b : null; });
      });
    });
    return seq.then(function (found) {
      if (found) {
        if (found !== BASE) console.warn("[runtime] 基准路径已自动校正为:", found);
        BASE = found;
        return found;
      }
      console.error("[runtime] 未能自动定位 pysub/ 目录，已尝试的基准路径：\n  " + cands.join("\n  "));
      return BASE;
    });
  }

  function apiPath(url) {
    try { return new URL(url, location.href).pathname; }
    catch (e) { return String(url); }
  }
  function isApiPath(p) {
    return API_PREFIXES.some(function (x) { return p === x || p.indexOf(x + "/") === 0; });
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.onload = function () { res(); };
      s.onerror = function () { rej(new Error("脚本加载失败: " + src)); };
      document.head.appendChild(s);
    });
  }

  /* ---------- 后端探测（基于 BASE，兼容子路径）---------- */
  function detect() {
    return new Promise(function (resolve) {
      ORIGINAL_FETCH(BASE + "api/health", { method: "GET", cache: "no-store" })
        .then(function (r) {
          if (!r.ok) { MODE = "frontend"; return; }
          return r.json().then(function (j) {
            MODE = (j && j.ok === true) ? "backend" : "frontend";
          }).catch(function () { MODE = "frontend"; });
        })
        .catch(function () { MODE = "frontend"; })
        .then(function () {
          window.__APP_MODE = MODE;
          // console.log("[runtime] 运行模式:", MODE, "(BASE=" + BASE + ")");
          resolve();
        });
    });
  }

  /* ---------- 把站点资源写进 Pyodide 虚拟文件系统（基于 BASE）---------- */
  function ensureDir(dir) {
    // 逐级创建目录（Pyodide 的 writeFile 不会自动建父目录）
    if (!dir || dir === "/") return;
    var parts = dir.split("/").filter(Boolean);
    var cur = "";
    parts.forEach(function (p) {
      cur += "/" + p;
      try { if (!pyodide.FS.analyzePath(cur).exists) pyodide.FS.mkdir(cur); }
      catch (e) { /* 已存在则忽略 */ }
    });
  }
  function writeFromFetch(relPath, fsPath, binary) {
    return ORIGINAL_FETCH(BASE + relPath, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("读取资源失败: " + relPath + " (" + r.status + ")");
      var write = function (data) {
        var dir = fsPath.substring(0, fsPath.lastIndexOf("/"));
        ensureDir(dir);
        pyodide.FS.writeFile(fsPath, data);
      };
      if (binary) return r.arrayBuffer().then(function (b) { write(new Uint8Array(b)); });
      return r.text().then(function (t) { write(t); });
    });
  }

  // 兜底：loadPackage 无法识别本地 wheel URL 时，直接把 wheel（本质是 zip）解压到 site-packages
  // 直接把 wheel 解压到 sysconfig purelib（离线、不解析依赖），多个包用独立临时文件避免并发覆盖
  // 离线安装：纯 python 包（wheel 本质为 zip）解压到 Pyodide 实际搜索的 site-packages。
  // 解压目标取 sys.path 中第一个以 site-packages 结尾的目录，确保解压后即可被 import。
  function extractWheelsToSyspath(urls) {
    var chain = Promise.resolve();
    urls.forEach(function (u) {
      chain = chain.then(function () {
        return ORIGINAL_FETCH(u, { cache: "no-store" })
          .then(function (r) { if (!r.ok) throw new Error(u + " (" + r.status + ")"); return r.arrayBuffer(); })
          .then(function (buf) {
            var tmp = "/tmp/_w_" + Date.now() + "_" + Math.floor(Math.random() * 1e6) + ".whl";
            pyodide.FS.writeFile(tmp, new Uint8Array(buf));
            pyodide.runPython(
              "import zipfile, os, sys\n" +
              "sp = next((p for p in sys.path if p.endswith('site-packages')), None) or sys.path[0]\n" +
              "os.makedirs(sp, exist_ok=True)\n" +
              "zipfile.ZipFile('" + tmp + "').extractall(sp)\n"
            );
          });
      });
    });
    return chain;
  }

  function boot() {
    return resolveBase().then(function () {
    var PYODIDE_BASE = BASE + "static/pyodide/";
    return loadScript(PYODIDE_BASE + "pyodide.js?v=" + RUNTIME_VERSION)
      .then(function () { return window.loadPyodide({ indexURL: PYODIDE_BASE }); })
      .then(function (py) {
        pyodide = py;
        // 先用 Python 标准库把目标目录建好：FS.writeFile 不会自动创建父目录，
        // 父目录缺失会抛 ErrnoError(errno 44 / ENOENT)，导致模块写不进去、import pysub 失败。
        pyodide.runPython(
          "import os\n" +
          "for _d in ['/pysub', '/app/static/data']:\n" +
          "    os.makedirs(_d, exist_ok=True)\n"
        );
      })
      .then(function () {
        // 启动只拉“登录/菜单”必需的最小集；重型依赖（ezdxf 链、sqlite3/jieba/db）
        // 由 ensureFeature 在首次使用绘图/搜索时再按需 GET（见下方懒加载逻辑）。
        // 说明：pysub 下除 __init__.py / browser_server.py 外的 *.py（dxf.py、search.py、
        // utils.py、profile_engine.py、dxf_generator.py）是 Flask 后端专用或在 browser_server
        // 内被延迟 import，不会在导入 browser_server 时触发，前端启动无需下载。
        var tasks = [
          ["pysub/__init__.py", "/pysub/__init__.py", false, true],
          ["pysub/browser_server.py", "/pysub/browser_server.py", false, true],
          // 以下两个是前端绘图（browser_server.dxf_generate）实际会延迟导入的纯 python 源文件，
          // 体积小（几十 KB），随启动写入可保证首次绘图即能 import，避免懒加载写入被静默失败时
          // 出现 No module named 'pysub.dxf_generator'；重型离线包（numpy/ezdxf 链）仍按需加载。
          ["pysub/dxf_generator.py", "/pysub/dxf_generator.py", false, false],
          ["pysub/profile_engine.py", "/pysub/profile_engine.py", false, false],
          ["static/data/users.json", "/app/static/data/users.json", false, true],
          ["static/data/menus.json", "/app/static/data/menus.json", false, true]
        ];
        // 可选资源缺失只告警；必需资源（第 4 项为 true）写入失败则立即抛出真实原因
        var p = Promise.resolve();
        tasks.forEach(function (t) {
          p = p.then(function () {
            return writeFromFetch(t[0], t[1], t[2]).catch(function (e) {
              var reason = (e && (e.message || e.name)) || String(e);
              if (t[3]) throw new Error("必需资源写入失败: " + t[0] + " -> " + t[1] + " (" + reason + ")");
              console.warn("[runtime] 可选资源跳过:", t[0], reason);
            });
          });
        });
        return p;
      })
      .then(function () {
        pyodide.globals.set("APP_ROOT", "/app");
        // 把虚拟文件系统根目录 / 加入 sys.path，否则 import pysub 会报 ModuleNotFoundError；
        // 导入前先自检文件是否真的落盘，避免 import 报错时看不出真实原因。
        pyodide.runPython(
          "import sys, os\n" +
          "if '/' not in sys.path:\n" +
          "    sys.path.insert(0, '/')\n" +
          "_missing = [p for p in ['/pysub/__init__.py', '/pysub/browser_server.py',\n" +
          "                        '/pysub/dxf_generator.py', '/pysub/profile_engine.py',\n" +
          "                        '/app/static/data/users.json', '/app/static/data/menus.json']\n" +
          "            if not os.path.exists(p)]\n" +
          "if _missing:\n" +
          "    raise RuntimeError('虚拟文件系统缺少必需文件: ' + ', '.join(_missing))\n" +
          "import pysub.browser_server\n"
        );
        // console.log("[runtime] Pyodide 就绪（前端模式）");
      });
    });
  }

  /* ---------- 按需（懒）加载：仅在首次使用某功能时才拉取对应离线包/数据 ----------
   * 启动阶段只写入 pysub 源码与 users/menus（登录/菜单必需），
   * 其余重型依赖（ezdxf/numpy、sqlite3/jieba、excel_search.db）推迟到
   * 用户真正点击“绘图”或“搜索”时才 GET 并安装，从而大幅减少启动时的网络请求。
   * 新增功能时：在 manifest.json 的 features 里登记该功能所需的包名即可。 */
  var _installed = {};
  var _manifestCache = null;

  function pyodideBase() { return BASE + "static/pyodide/"; }

  function loadManifest() {
    if (_manifestCache) return Promise.resolve(_manifestCache);
    return ORIGINAL_FETCH(pyodideBase() + "packages/manifest.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("找不到 packages/manifest.json (" + r.status + ")"); return r.json(); })
      .then(function (mf) { _manifestCache = mf; return mf; });
  }

  // 安装一组 wheel/zip（features 登记的文件名，直接拼本地 packages URL）：
  //  - 仅 Pyodide 编译的原生 wheel（如 numpy 的 .whl 含编译 .so）必须用
  //    pyodide.loadPackage 让 Pyodide 正确注册原生模块；仅解压文件无法被 import。
  //  - sqlite3 的 .zip 是“平铺的原生模块压缩包”，根目录直接是 _sqlite3.so + sqlite3/，
  //    解压到 site-packages 后 `import sqlite3` 即可生效（历史版本验证可用）。
  //    注意：它**不能**走 loadPackage——loadPackage 只认标准 Pyodide 包归档，装这个原始 zip
  //    会失败，导致 ensureSearch 整体 reject、搜索回退成 404。
  //  - 其余纯 python 包（ezdxf/typing_extensions/fonttools/pyparsing/qrcode/python_barcode/jieba）
  //    直接解压到 site-packages 即可，离线不联网、不解析依赖。
  //  任一步失败都直接抛出，避免“链已 resolve 但包没进 sys.path”的静默失败。
  function installWheels(names) {
    return loadManifest().then(function (mf) {
      var base = pyodideBase() + "packages/";
      var urls = (names || []).map(function (n) { return base + n; });
      if (!urls.length) return;
      // 只把 Pyodide 原生 wheel（文件名含 pyodide）判为需要 loadPackage；其余（含 sqlite3 的 zip）一律解压
      var nativeRex = /pyodide.*\.whl$/i;
      var nativeUrls = urls.filter(function (u) { return nativeRex.test(u); });
      var pureUrls = urls.filter(function (u) { return nativeUrls.indexOf(u) === -1; });
      var chain = Promise.resolve();
      nativeUrls.forEach(function (nu) {
        chain = chain.then(function () {
          return pyodide.loadPackage([nu]).catch(function (e) {
            console.error("[runtime] 原生包 loadPackage 失败（DXF/搜索将不可用）:", nu, e);
            throw e;
          });
        });
      });
      if (pureUrls.length) {
        chain = chain.then(function () {
          return extractWheelsToSyspath(pureUrls).catch(function (e) {
            console.error("[runtime] 纯 python 包解压失败（DXF 将不可用）:", e);
            throw e;
          });
        });
      }
      return chain;
    });
  }

  // 搜索功能：sqlite3（原生）+ excel_search.db（大文件，按需写入 FS）+ jieba（按需注入 /jieba）
  function ensureSearch() {
    if (_installed.search) return Promise.resolve();
    return loadManifest().then(function (mf) {
      var names = (mf.features && mf.features.search) || [];
      var chain = names.length ? installWheels(names) : Promise.resolve();
      chain = chain.then(function () {
        // excel_search.db 约 9.6MB，仅搜索时写入，避免启动即下载
        return writeFromFetch(
          "static/data/excel_search.db", "/app/static/data/excel_search.db", true
        ).catch(function (e) {
          // console.warn("[runtime] 搜索数据库写入跳过:", e);
        });
      });
      chain = chain.then(function () {
        var jiebaName = (mf.jieba) || "jieba.zip";
        return ORIGINAL_FETCH(pyodideBase() + jiebaName, { cache: "no-store" })
          .then(function (r) { if (!r.ok) throw new Error(jiebaName + " (" + r.status + ")"); return r.arrayBuffer(); })
          .then(function (buf) {
            pyodide.FS.writeFile("/jieba.zip", new Uint8Array(buf));
            pyodide.runPython("import zipfile; zipfile.ZipFile('/jieba.zip').extractall('/')");
          })
          .catch(function (e) {
            // jieba 是搜索必需依赖，注入失败必须显式抛出，否则搜索会以 500/静默失败收场，难定位
            console.error("[runtime] jieba 注入失败（搜索将不可用）:", e);
            throw new Error("jieba 离线包注入失败，请检查 static/pyodide/packages/jieba.zip 是否完整");
          });
      });
      // 安装后校验：确认 sqlite3 / jieba 真的可被 import，避免“安装链已 resolve 但包没进 sys.path”
      // 时，把问题闷到 dispatch 的 import 才以模糊的 ModuleNotFoundError 暴露（甚至回退成 404）。
      chain = chain.then(function () {
        try {
          pyodide.runPython("import sqlite3, jieba");
        } catch (e) {
          console.error("[runtime] 搜索依赖安装后校验失败（搜索不可用）:", e);
          throw new Error("搜索依赖(sqlite3/jieba)安装失败，请检查 static/pyodide/packages 下相关文件是否完整");
        }
      });
      return chain;
    }).then(function () { _installed.search = true; });
  }

  // 统一入口：根据功能名按需安装；已安装过则直接返回
  function ensureFeature(feature) {
    if (_installed[feature]) return Promise.resolve();
    if (feature === "dxf") {
      // pysub/dxf_generator.py 与 profile_engine.py 已在 boot 启动时写入（体积小、属绘图必需），
      // 此处只按需安装重型离线包（numpy/ezdxf 等 wheel），避免启动即下载大文件。
      return loadManifest().then(function (mf) {
        var names = (mf.features && mf.features.dxf) || [];
        if (!names.length) return;
        return installWheels(names);
      }).then(function () {
        // 安装后校验：确认 ezdxf 真的可被 import，避免“安装链已 resolve 但 wheel 没进 sys.path”
        // 时，把问题闷到 dispatch 的 import 才以模糊的 ModuleNotFoundError 暴露。
        try { pyodide.runPython("import ezdxf"); }
        catch (e) {
          console.error("[runtime] ezdxf 离线包安装后校验失败（DXF 不可用）:", e);
          throw new Error("DXF 依赖(ezdxf/numpy)安装失败，请检查 static/pyodide/packages 下相关 wheel 是否完整");
        }
      }).then(function () { _installed.dxf = true; });
    }
    if (feature === "search") {
      return ensureSearch();
    }
    return Promise.resolve();
  }

  /* ---------- 页面可见的错误横幅（boot 失败时无需开控制台即可看到原因）---------- */
  function showRuntimeError(msg) {
    try {
      var el = document.getElementById("__runtime_error__");
      if (!el) {
        el = document.createElement("div");
        el.id = "__runtime_error__";
        el.style.cssText = "position:fixed;left:12px;bottom:12px;max-width:90vw;z-index:99999;" +
          "background:#b00020;color:#fff;font:13px/1.5 monospace;padding:10px 14px;border-radius:8px;" +
          "white-space:pre-wrap;box-shadow:0 2px 10px rgba(0,0,0,.3)";
        document.body.appendChild(el);
      }
      el.textContent = "[runtime] 启动失败：\n" + msg;
    } catch (e) {}
  }

  function ensureReady() {
    if (MODE === "backend") return Promise.resolve();
    if (!_pyReady) {
      _pyReady = boot().catch(function (e) {
        console.error("[runtime] Pyodide 启动失败:", e);
        var msg = (e && e.message ? e.message : String(e));
        var hint = "\n（纯前端模式需联网首次加载 Pyodide 及依赖；如环境无外网，DXF/搜索不可用，但登录应正常）";
        if (/pysub|static\/data|404|必需资源/.test(msg)) {
          hint = "\n\n[部署排查] 站点未能取到 pysub/ 等静态资源（GitHub Pages 常见）。请确认：\n" +
                 "  1) 仓库中 pysub/、static/data/、static/pyodide/ 已与 static/js/ 处于同一目录层级并提交推送；\n" +
                 "  2) 它们未被 .gitignore 忽略（尤其 pysub/ 目录与 *.py 文件）；\n" +
                 "  3) 在仓库根放置 .nojekyll 以关闭 Jekyll 处理；\n" +
                 "  4) GitHub Pages 的 Source 指向正确的分支与目录。";
        }
        showRuntimeError(msg + hint);
        throw e;
      });
    }
    return _pyReady;
  }

  /* ---------- 前端模式：调用 browser_server.dispatch（串行化，避免并发覆盖全局变量）---------- */
  var _chain = Promise.resolve();
  function pyDispatch(method, path, query, body) {
    var run = function () {
      return ensureReady().then(function () {
        // 仅在首次真正用到某功能时，按需拉取并安装对应离线包（绘图→ezdxf 链；搜索→sqlite3/jieba/db）
        // 注意：前端请求路径可能带尾斜杠（如 fetch('/dxf/')），必须剥离后再比对，否则 feature 始终为
        // null、离线包永不安装，表现就是“No module named 'ezdxf'”等依赖缺失错误。
        var normPath = path.replace(/\/+$/, "");
        var feature = null;
        if (method === "POST" && normPath === "/dxf") feature = "dxf";
        else if (normPath === "/search/api/search") feature = "search";
        var pre = feature ? ensureFeature(feature) : Promise.resolve();
        return pre.then(function () {
        pyodide.globals.set("_m", method);
        pyodide.globals.set("_p", path);
        pyodide.globals.set("_q", JSON.stringify(query || {}));
        pyodide.globals.set("_b", JSON.stringify(body === undefined ? null : body));
        // 直接让 Python 返回 JSON 字符串：Pyodide 会把 str 自动转成 JS string，
        // 避开 PyProxy(dict) 不支持 .status/.json 属性访问的坑（曾导致登录拿到 null）。
        return pyodide.runPythonAsync(
          "import pysub.browser_server as _bs, json\n" +
          "json.dumps(_bs.dispatch(_m, _p, _q, _b))"
        );
      }).then(function (jsonStr) {
        if (jsonStr == null) return null;
        try { return JSON.parse(jsonStr); }
        catch (e) { console.warn("[runtime] 响应 JSON 解析失败:", e); return null; }
      });
      });
    };
    var result = _chain.then(run);
    _chain = result.then(function () {}, function () {}); // 保持链存活
    return result;
  }

  /* ---------- 把 Python 返回的 dict 还原成 fetch Response ---------- */
  function makeResponse(res, url) {
    var status = res && res.status ? res.status : 200;
    var headers = new Map();
    if (res && res.headers) {
      for (var k in res.headers) { if (res.headers.hasOwnProperty(k)) headers.set(k.toLowerCase(), res.headers[k]); }
    }
    var jsonObj = (res && res.json) || null;
    var contentB64 = (res && res.content_b64) || null;
    function toBlob() {
      if (contentB64) {
        var bin = atob(contentB64), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        var ct = headers.get("content-type") || "application/octet-stream";
        return new Blob([arr], { type: ct });
      }
      return new Blob([], { type: "application/octet-stream" });
    }
    return {
      ok: status >= 200 && status < 400,
      status: status,
      url: url,
      headers: { get: function (n) { return headers.has(String(n).toLowerCase()) ? headers.get(String(n).toLowerCase()) : null; } },
      json: function () { return Promise.resolve(jsonObj); },
      text: function () {
        if (jsonObj) return Promise.resolve(jsonObj.message ? jsonObj.message : JSON.stringify(jsonObj));
        return Promise.resolve("");
      },
      blob: function () { return Promise.resolve(toBlob()); },
      arrayBuffer: function () { return toBlob().arrayBuffer(); }
    };
  }

  /* ---------- 父页运行时（供 iframe 复用）---------- */
  window.__RUNTIME__ = {
    mode: "detecting",
    ready: false,
    dispatch: function (m, p, q, b) { return pyDispatch(m, p, q, b); }
  };

  /* ---------- iframe：优先复用父页 Pyodide ---------- */
  function getParentRuntime() {
    try {
      if (window.parent && window.parent !== window && window.parent.__RUNTIME__) {
        return window.parent.__RUNTIME__;
      }
    } catch (e) {}
    return null;
  }
  function waitParentReady(pr) {
    return new Promise(function (resolve, reject) {
      var tries = 0;
      (function loop() {
        if (pr.ready) { resolve(); return; }
        if (tries++ > 100) { reject(new Error("父页 Pyodide 未就绪")); return; }
        setTimeout(loop, 100);
      })();
    });
  }

  function fallbackOwn(method, path, query, body, url, opts) {
    return pyDispatch(method, path, query, body)
      .then(function (res) { return makeResponse(res, url); })
      .catch(function (e) {
        try { return ORIGINAL_FETCH(url, opts); }
        catch (_) { return makeResponse({ status: 500, json: { success: false, message: String(e) } }, url); }
      });
  }

  /* ---------- 统一入口 ---------- */
  async function handle(method, url, opts) {
    // 等待后端探测完成，避免在 detecting 阶段误判而提前启动 Pyodide
    if (MODE === "detecting") { try { await _detectPromise; } catch (e) {} }
    var path = apiPath(url);
    if (MODE === "backend" || !isApiPath(path)) {
      return ORIGINAL_FETCH(url, opts);
    }
    var query = {}, body = null;
    try {
      new URL(url, location.href).searchParams.forEach(function (v, k) { query[k] = v; });
    } catch (e) {}
    if (opts && opts.body != null) {
      var bd = opts.body;
      if (typeof bd === "string") { try { body = JSON.parse(bd); } catch (e) { body = bd; } }
      else if (typeof FormData !== "undefined" && bd instanceof FormData) { body = {}; bd.forEach(function (v, k) { body[k] = v; }); }
      else if (bd && typeof bd.forEach === "function") { body = {}; bd.forEach(function (v, k) { body[k] = v; }); }
      else { body = bd; }
    }
    var pr = getParentRuntime();
    if (pr) {
      return waitParentReady(pr)
        .then(function () { return pr.dispatch(method, path, query, body); })
        .then(function (res) { return makeResponse(res, url); })
        .catch(function () { return fallbackOwn(method, path, query, body, url, opts); });
    }
    return fallbackOwn(method, path, query, body, url, opts);
  }

  window.fetch = function (url, opts) {
    opts = opts || {};
    var method = (opts.method || "GET").toUpperCase();
    return handle(method, url, opts);
  };

  /* ---------- 启动探测；前端模式下父页主动预热一份 Pyodide 供各 iframe 复用 ---------- */
  var _detectPromise = detect().then(function () {
    window.__RUNTIME__.mode = MODE;
    if (MODE === "frontend") {
      ensureReady()
        .then(function () { window.__RUNTIME__.ready = true; /* console.log("[runtime] 父页 Pyodide 已就绪，可服务各 iframe"); */ })
        .catch(function (e) { console.error("[runtime] Pyodide 启动失败:", e); });
    }
  });
})();
