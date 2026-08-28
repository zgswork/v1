# pysub/browser_server.py
# =============================================================================
# 纯前端模式（Pyodide / Python-WASM）下的“后端”实现。
# 与 pysub/auth.py、pysub/dxf.py、pysub/search.py 的接口一一对应，
# 但不依赖 Flask，可在浏览器里直接被 runtime.js 调用。
#
# 设计目标：
#   1) 后端模式（Flask）完全不受影响 —— 本文件不被 app.pyw 引用。
#   2) 前端模式复用同一套业务逻辑（读 users.json / menus.json、
#      dxf_generator.create_dxf、sqlite 检索等），只是数据来源从
#      服务器文件系统变成 Pyodide 虚拟文件系统（由 runtime.js 注入）。
#   3) 任何异常都转成 JSON 返回，绝不让 Pyodide 崩溃。
# =============================================================================
import os
import json
import base64
import traceback
import hashlib

# 应用根目录（Pyodide 虚拟文件系统里的 /app），由 runtime.js 通过
# pyodide.globals.set('APP_ROOT', ...) 设置；默认 '/app'。
APP_ROOT = "/app"

USERS_FILE = None
MENUS_FILE = None
SESSION_USER = None  # 内存会话（前端模式无 cookie，等价 Flask session）

# dxf 表单字段定义，与 pysub/dxf.py 保持一致
DXF_FIELD_CONFIG = [
    ("snhw", str, None), ("cpxl", str, None), ("cpxh", str, None),
    ("azys", str, None), ("dycd", float, 0.0), ("plls", int, 1),
    ("dygd", float, 0.0), ("plhs", int, 1), ("xscd", float, 0.0),
    ("xsgd", float, 0.0), ("dyhd", float, 0.0), ("pthd", float, 100.0),
    ("jlwd", float, 0.0), ("ldgd", float, 0.0), ("pdjj", float, 0.0),
    ("bbsb", float, 0.0), ("bbxb", float, 0.0), ("bbcb", float, 0.0),
    ("mjhj", float, 0.0), ("mjsj", float, 0.0), ("dybt", str, ""),
    ("bthg", str, ""), ("ntlg", str, ""), ("sphg", str, ""),
    ("flmj", str, ""), ("xmqy", str, ""), ("psyt", bool, False),
    ("pggt", bool, False), ("cltj", bool, False), ("dxft", bool, False),
    ("pdft", bool, False), ("lkjx", float, 0.0), ("zcsg", str, ""),
]


def _paths():
    global USERS_FILE, MENUS_FILE
    if USERS_FILE is None:
        USERS_FILE = os.path.join(APP_ROOT, "static", "data", "users.json")
        MENUS_FILE = os.path.join(APP_ROOT, "static", "data", "menus.json")


def load_users():
    _paths()
    with open(USERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_users(users):
    _paths()
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)


def load_menus():
    _paths()
    with open(MENUS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# 统一响应结构：返回 dict，由 runtime.js 还原成 fetch 的 Response
# ---------------------------------------------------------------------------
def _ok(json_obj=None, headers=None, content=None, filename=None, status=200):
    out = {"status": status, "headers": headers or {}, "json": json_obj,
           "content_b64": None, "filename": None}
    if content is not None:
        out["content_b64"] = base64.b64encode(content).decode("ascii")
        out["filename"] = filename
    return out


def _err(message, status=500):
    return _ok(json_obj={"success": False, "message": message}, status=status)


# ---------------------------------------------------------------------------
# 鉴权 / 权限（对应 pysub/auth.py）
# ---------------------------------------------------------------------------
def _hash_password(pwd):
    # 与 pysub/auth.py 完全一致：SHA-256(密码 + 盐"zgs")
    return hashlib.sha256((pwd + "zgs").encode("utf-8")).hexdigest()

def _guest_menus(users):
    return users.get("guest", {}).get("menus", [])


def auth_user():
    users = load_users()
    if SESSION_USER and SESSION_USER in users:
        return _ok({"logged_in": True, "username": SESSION_USER,
                    "menus": users[SESSION_USER].get("menus", [])})
    return _ok({"logged_in": False, "menus": _guest_menus(users)})


def auth_menus():
    return _ok(load_menus())


def auth_login(body):
    username = (body or {}).get("username")
    password = (body or {}).get("password")
    users = load_users()
    if username in users and users[username].get("password") == _hash_password(password):
        global SESSION_USER
        SESSION_USER = username
        return _ok({"success": True, "menus": users[username].get("menus", [])})
    return _err("用户名或密码错误", status=401)


def auth_logout():
    global SESSION_USER
    SESSION_USER = None
    return _ok({"success": True})


def auth_create_user(body):
    data = body or {}
    new_username = data.get("new_username")
    password = data.get("password")
    new_menus = data.get("menus", [])
    if not new_username or not password:
        return _err("用户名和密码不能为空", status=400)
    if SESSION_USER is None:
        return _err("未登录", status=401)
    users = load_users()
    if new_username in users:
        return _err("用户名已存在", status=400)
    current_menus = users.get(SESSION_USER, {}).get("menus", [])
    if not ("管理" in current_menus or "创建" in current_menus):
        return _err("当前用户无权限创建用户", status=403)
    if not set(new_menus).issubset(set(current_menus)):
        return _err("新用户权限不能超过当前用户权限", status=403)
    users[new_username] = {"password": _hash_password(password), "menus": new_menus}
    save_users(users)
    return _ok({"success": True, "message": f"用户 {new_username} 创建成功"})


def auth_list_users():
    if SESSION_USER is None:
        return _err("未登录", status=401)
    users = load_users()
    if "管理" not in users.get(SESSION_USER, {}).get("menus", []):
        return _err("无权限", status=403)
    user_list = [{"username": u, "menus": i.get("menus", []),
                  "has_password": bool(i.get("password"))}
                 for u, i in users.items()]
    return _ok(user_list)


def auth_update_user(body):
    data = body or {}
    target = data.get("username")
    if SESSION_USER is None:
        return _err("未登录", status=401)
    users = load_users()
    if "管理" not in users.get(SESSION_USER, {}).get("menus", []):
        return _err("无权限", status=403)
    if not target or target not in users:
        return _err("用户不存在", status=404)
    if target == SESSION_USER and "menus" in data:
        return _err("不能修改自己的权限", status=403)
    if "password" in data and data["password"]:
        users[target]["password"] = _hash_password(data["password"])
    if "menus" in data and target != SESSION_USER:
        cur = users[SESSION_USER].get("menus", [])
        if not set(data["menus"]).issubset(set(cur)):
            return _err("分配的权限不能超过您的权限", status=403)
        users[target]["menus"] = data["menus"]
    save_users(users)
    return _ok({"success": True, "message": "更新成功"})


def auth_delete_user(body):
    data = body or {}
    target = data.get("username")
    if SESSION_USER is None:
        return _err("未登录", status=401)
    users = load_users()
    if "管理" not in users.get(SESSION_USER, {}).get("menus", []):
        return _err("无权限", status=403)
    if not target:
        return _err("用户名缺失", status=400)
    if target == SESSION_USER:
        return _err("不能删除自己", status=403)
    if target == "guest":
        return _err("不能删除内置游客账号", status=403)
    if target not in users:
        return _err("用户不存在", status=404)
    del users[target]
    save_users(users)
    return _ok({"success": True, "message": f"用户 {target} 已删除"})


def auth_change_password(body):
    data = body or {}
    old_pwd = data.get("old_password")
    new_pwd = data.get("new_password")
    if not old_pwd or not new_pwd:
        return _err("旧密码和新密码不能为空", status=400)
    if SESSION_USER is None:
        return _err("未登录", status=401)
    users = load_users()
    if SESSION_USER not in users:
        return _err("用户不存在", status=404)
    if users[SESSION_USER].get("password") != _hash_password(old_pwd):
        return _err("旧密码错误", status=401)
    users[SESSION_USER]["password"] = _hash_password(new_pwd)
    save_users(users)
    return _ok({"success": True, "message": "密码修改成功"})


# ---------------------------------------------------------------------------
# DXF 生成（对应 pysub/dxf.py）—— 包由 runtime.js 提前装好
# ---------------------------------------------------------------------------
def dxf_generate(body):
    try:
        params = {}
        for key, typ, default in DXF_FIELD_CONFIG:
            raw = (body or {}).get(key, default)
            if typ is int:
                try:
                    params[key] = int(raw)
                except Exception:
                    params[key] = default
            elif typ is float:
                try:
                    params[key] = float(raw)
                except Exception:
                    params[key] = default
            elif typ is bool:
                params[key] = raw in ("on", "1", "true", True)
            else:
                params[key] = raw
        # 延迟导入：避免前端模式启动时就必须加载重型依赖
        from .dxf_generator import create_dxf
        file_obj, filename = create_dxf(**params, client_info={})
        if isinstance(file_obj, str):
            with open(file_obj, "rb") as f:
                data = f.read()
        elif isinstance(file_obj, (bytes, bytearray)):
            data = bytes(file_obj)
        else:
            data = file_obj.read()
        from urllib.parse import quote
        headers = {
            "Content-Type": "application/dxf",
            "Content-Disposition": f'attachment; filename="{quote(filename)}"',
        }
        return _ok(headers=headers, content=data, filename=filename)
    except Exception as e:
        return _err(f"生成失败：{e}\n{traceback.format_exc()}", status=500)


# ---------------------------------------------------------------------------
# 搜索（对应 pysub/search.py）—— 需要 jieba + sqlite3
# ---------------------------------------------------------------------------
def search_api(query):
    try:
        import sqlite3
        q = (query or {}).get("q", "")
        if not q:
            return _ok([])
        db_path = os.path.join(APP_ROOT, "static", "data", "excel_search.db")
        if not os.path.exists(db_path):
            return _err(f"数据库文件不存在: {db_path}", status=500)
        import jieba
        words = [w.strip() for w in jieba.cut(q) if w.strip()]
        if not words:
            return _ok([])
        and_query = " ".join(words)
        or_query = " OR ".join(words)
        phrase_query = f'"{q}"'
        prefix_query = " ".join([w + "*" for w in words])
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        sql = """
            SELECT r.* FROM fts_sentences f
            JOIN excel_rows r ON f.rowid = r.id
            WHERE f.content MATCH ?
            ORDER BY f.rank
        """
        rows = []
        for attempt in [and_query, or_query, phrase_query, prefix_query]:
            c.execute(sql, (attempt,))
            rows = c.fetchall()
            if rows:
                break
        if not rows:
            c.execute("SELECT * FROM excel_rows WHERE 标底内容 LIKE ? OR 备注 LIKE ?",
                      (f"%{q}%", f"%{q}%"))
            rows = c.fetchall()
        results = []
        for r in rows:
            item = dict(r)
            item["file"] = os.path.basename(item.get("filepath", ""))
            results.append(item)
        conn.close()
        return _ok(results)
    except Exception as e:
        return _err(f"搜索失败：{e}\n{traceback.format_exc()}", status=500)


# ---------------------------------------------------------------------------
# 统一分发入口（runtime.js 调用）
# ---------------------------------------------------------------------------
def dispatch(method, path, query_json=None, body_json=None):
    try:
        query = json.loads(query_json) if query_json else {}
        body = json.loads(body_json) if body_json else {}
        # 归一化路径：去掉查询串、保证以 / 开头
        path = path.split("?")[0]
        if not path.startswith("/"):
            path = "/" + path
        parts = [p for p in path.split("/") if p]
        if not parts:
            return _err("未知路径", status=404)
        seg1, seg2 = parts[0], (parts[1] if len(parts) > 1 else "")

        if seg1 == "auth":
            if seg2 == "user":
                return auth_user() if method == "GET" else _err("方法不允许", 405)
            if seg2 == "menus":
                return auth_menus() if method == "GET" else _err("方法不允许", 405)
            if seg2 == "login":
                return auth_login(body) if method == "POST" else _err("方法不允许", 405)
            if seg2 == "logout":
                return auth_logout() if method == "POST" else _err("方法不允许", 405)
            if seg2 == "create_user":
                return auth_create_user(body) if method == "POST" else _err("方法不允许", 405)
            if seg2 == "list_users":
                return auth_list_users() if method == "GET" else _err("方法不允许", 405)
            if seg2 == "update_user":
                return auth_update_user(body) if method == "POST" else _err("方法不允许", 405)
            if seg2 == "delete_user":
                return auth_delete_user(body) if method == "POST" else _err("方法不允许", 405)
            if seg2 == "change_password":
                return auth_change_password(body) if method == "POST" else _err("方法不允许", 405)
            return _err(f"未知 auth 接口: {seg2}", status=404)

        if seg1 == "dxf":
            if method == "POST":
                return dxf_generate(body)
            return _err("方法不允许", status=405)

        if seg1 == "search":
            if seg2 == "api" and parts[2] == "search" and method == "GET":
                return search_api(query)
            if method == "GET":  # /search 主页
                return _ok({"ok": True})
            return _err("方法不允许", status=405)

        return _err(f"未知接口: {path}", status=404)
    except Exception as e:
        return _err(f"服务器内部错误：{e}\n{traceback.format_exc()}", status=500)
