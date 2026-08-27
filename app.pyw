# app.py
from flask import Flask, send_from_directory
import threading, webbrowser, os, sys, time, pystray, subprocess, socket, logging
from PIL import Image, ImageDraw
from logging.handlers import TimedRotatingFileHandler
from waitress import serve

# from flask_cors import CORS  # 新增导入，用于search.py
# 导入公共工具
from pysub.utils import get_local_ip

# 导入所有蓝图（后续新增子页面只需在这里添加注册）
from pysub.dxf import bp as dxf_bp
from pysub.search import bp as search_bp  # 新增导入
from pysub.auth import bp as auth_bp

# ================= Flask 应用 =================
app = Flask(__name__)
app.secret_key = "your-secret-key-here"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 注册蓝图
app.register_blueprint(dxf_bp)  # 子页面 /dxf
app.register_blueprint(search_bp, url_prefix="/search")  # /search
app.register_blueprint(auth_bp)


# ================= 路由：主页 =================
@app.route("/")
def index():
    # 返回主页面（已移到项目根目录）
    return send_from_directory(BASE_DIR, "index.html")


# ================= 路由：健康检查（供前端双模探测）=================
# 仅返回 {ok:true}，不改变任何现有功能；纯静态托管站点无此路由 → 前端自动切 Pyodide。
@app.route("/api/health")
def health():
    return {"ok": True}


# ================= 路由：根目录前端文件（runtime.js 等）=================
# 让后端模式下也能直接加载项目根目录的 runtime.js / index.html，
# 仅放行白名单扩展名，绝不暴露 .py / .pyw 源码。
_ALLOWED_EXT = (".js", ".css", ".html", ".htm", ".ico", ".png", ".jpg", ".json", ".svg", ".woff2")
@app.route("/<path:filename>")
def serve_root(filename):
    import os as _os
    if filename.endswith(_ALLOWED_EXT):
        full = _os.path.join(BASE_DIR, filename)
        if _os.path.isfile(full):
            return send_from_directory(BASE_DIR, filename)
    # 兜底：仍尝试从 pages 目录返回（保持原有行为）
    return send_from_directory(f"{BASE_DIR}/pages", filename)


# ================= 路由：静态资源 =================
@app.route("/pages/<path:filename>")
def serve_pages(filename):
    pages_dir = os.path.join(BASE_DIR, "pages")
    return send_from_directory(pages_dir, filename)


@app.route("/static/<path:filename>")
def serve_static(filename):
    static_dir = os.path.join(BASE_DIR, "static")
    return send_from_directory(static_dir, filename)


# ================= 端口检测函数 =================
def find_free_port(start_port):  # 从 start_port 开始依次尝试绑定，返回第一个可用端口
    port = start_port
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("0.0.0.0", port))
                return port
            except OSError:
                port += 1


# ================= 系统托盘图标（不变） =================
def resource_path(relative_path):
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)


def create_image():
    try:
        ico_path = resource_path("static/images/app.ico")
        return Image.open(ico_path)
    except Exception:
        width, height = 64, 64
        image = Image.new("RGB", (width, height), "dodgerblue")
        dc = ImageDraw.Draw(image)
        dc.rectangle((width // 4, height // 4, width * 3 // 4, height * 3 // 4), fill="white")
        return image


def open_browser():
    local_ip = get_local_ip()
    webbrowser.open_new(f"http://{local_ip if local_ip else '127.0.0.1'}:{pc_port}")


def on_show(icon, item):
    open_browser()


def on_restart(icon, item):
    icon.stop()
    # 构建新环境，移除 PyInstaller 内部变量
    env = os.environ.copy()
    env.pop("_MEIPASS", None)
    env.pop("PYTHONHOME", None)
    env.pop("PYTHONPATH", None)
    # 使用 execve 替换当前进程，新进程将使用清理后的环境
    os.execve(sys.executable, [sys.executable] + sys.argv[1:], env)


def on_quit(icon, item):
    icon.stop()
    os._exit(0)


# ================= 程序入口 =================
if __name__ == "__main__":
    # ---------- 1. 获取可用端口 ----------
    global pc_port
    pc_port = find_free_port(5000)  # 初始端口5000

    # ---------- 日志配置（新增） ----------
    log_dir = os.path.join(BASE_DIR, "static", "log")  # 确保日志目录存在
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "access.log")  # 当前日志文件名（固定为 access.log，始终写入最新）

    def namer(default_name):  # 定义 namer 函数：将轮转生成的备份文件改名,default_name 格式改为：/path/to/access_2026-08-21.log
        dirname, basename = os.path.split(default_name)
        # 分割基础文件名和日期后缀 例如 basename = "access.log.2026-08-21"
        parts = basename.split(".")
        # parts = ['access', 'log', '2026-08-21']
        if len(parts) >= 3:  # 将日期部分移到文件名中间，并把 .log 放回末尾
            new_basename = f"{parts[0]}_{parts[-1]}.{parts[1]}"
            return os.path.join(dirname, new_basename)
        else:  # 如果格式不符，直接返回原名
            return default_name

    handler = TimedRotatingFileHandler(filename=log_file, when="midnight", interval=1, backupCount=0, encoding="utf-8")  # 每天午夜轮转  # 间隔1天  # 保留
    handler.suffix = "%Y-%m-%d"
    handler.namer = namer
    formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
    handler.setFormatter(formatter)
    handler.setLevel(logging.INFO)
    # 若不想同时输出到控制台，可取消下面注释（但控制台输出便于调试）
    # werkzeug_logger.propagate = False
    # ---------- 系统托盘 ----------
    menu = pystray.Menu(
        pystray.MenuItem("显示窗口", on_show, default=True),
        pystray.MenuItem(f"打开网页{pc_port}", on_show),
        # pystray.MenuItem("重启", on_restart),
        pystray.MenuItem("退出", on_quit),
    )
    icon = pystray.Icon("flask_tray_demo", create_image(), "LED显示屏设计工具集", menu)
    if 1 == 1: #开发服务器               
        werkzeug_logger = logging.getLogger("werkzeug")        
        werkzeug_logger.addHandler(handler)
        werkzeug_logger.setLevel(logging.INFO)
        flask_thread = threading.Thread(target=lambda: app.run(host="0.0.0.0", port=pc_port, debug=False, use_reloader=False))
    else:#启动方式从 Flask 内置开发服务器替换为生产级 WSGI 服务器:Waitress
        waitress_logger = logging.getLogger("waitress")
        waitress_logger.addHandler(handler)
        waitress_logger.setLevel(logging.INFO)   # 根据需要调整级别
        flask_thread = threading.Thread(target=lambda: serve(app, host="0.0.0.0", port=pc_port))
    flask_thread.daemon = True
    flask_thread.start()
    threading.Timer(1.0, open_browser).start()
    print(f"Flask 服务已启动，访问 http://127.0.0.1:{pc_port}")
    icon.run()
