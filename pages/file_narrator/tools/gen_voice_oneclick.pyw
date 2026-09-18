# -*- coding: utf-8 -*-
"""
pdf_narrator 解说语音 —— 一键生成（双击运行）
============================================================================
双击本文件即可（Windows 的 .pyw 关联 pythonw.exe，不弹黑色控制台窗口）。
一键做完三件事：

  ① 提取文案：自动读取 js/narration_data.js，取出每个触点要朗读的文字
     （用 tools/narration_manifest.py 解析，**不需要装 Node**）；
  ② 比对现状：与 file/voice/ 里已有的音频、上次清单的文案「指纹」逐条比对，
     算出哪些要新生成、哪些文案改了要重生成、哪些可以跳过；
  ③ 合成音频：调用 tools/gen_voice_files.py（edge-tts）按规则文件名生成 mp3：
        file/voice/<pdfId>/p<页码>-<触点序号>.mp3      （页码、序号均从 1 起）
     与 js/main.js 播放时拼的路径完全一致。

★ 改了 js/narration_data.js 的文案或增删触点后，双击本脚本一次即可 —— 只有变动的
  那几条会重新合成，其余跳过，几秒就能完成。

界面上的按钮
    🚀 一键生成        智能增量：只生成「缺的」和「文案改过的」
    ♻ 全部重新生成     忽略增量，23 条全部重做（换音色 / 语速后用）
    📋 仅导出清单      只更新 tools/voice_manifest.json，不合成音频
    🔧 安装/修复 edge-tts   给选中的 Python 装 edge-tts（只装一次，需联网）
    📂 打开音频目录    在资源管理器中打开 file/voice
    🛑 停止            中途终止合成（已生成的音频保留，可再次一键续做）

命令行用法（不弹窗，便于排查问题；日志与界面完全一致）
    python gen_voice_oneclick.pyw --auto              # 智能增量生成
    python gen_voice_oneclick.pyw --auto --force      # 全部重新生成
    python gen_voice_oneclick.pyw --auto --dry-run    # 只分析，不生成（演练）
    python gen_voice_oneclick.pyw --list              # 列出全部条目
    python gen_voice_oneclick.pyw --auto --only demo  # 只做某个 PDF（pdfs[].id）
    python gen_voice_oneclick.pyw --check             # 检查本机 Python / edge-tts 环境

排查用：界面上的日志同时写入 tools/voice_build.log，出问题可直接把这个文件发出来。
界面自检（不显示窗口，仅验证界面与统计是否正常）：设环境变量 PDFN_GUI_SELFTEST=1 后运行本脚本。

运行环境：Python 3.8+；edge-tts 只需装在**任意一个** Python 里（脚本会自动寻找，
         找不到时界面上点「安装/修复 edge-tts」）。合成时联网，产物本身完全离线。
============================================================================
"""

import glob
import importlib.util
import os
import re
import shutil
import subprocess
import sys
import threading
import time

# ---------------------------------------------------------------- 基本路径

HERE = os.path.dirname(os.path.abspath(__file__))          # 本脚本所在目录（tools/）
ROOT = os.path.dirname(HERE)                               # 项目根目录（tools 的上一级）
DATA_FILE = os.path.join(ROOT, "js", "narration_data.js")
MANIFEST_FILE = os.path.join(ROOT, "tools", "voice_manifest.json")
GEN_SCRIPT = os.path.join(ROOT, "tools", "gen_voice_files.py")
MANIFEST_PY = os.path.join(ROOT, "tools", "narration_manifest.py")
VOICE_DIR = os.path.join(ROOT, "file", "voice")
BUILD_LOG = os.path.join(ROOT, "tools", "voice_build.log")

DEFAULT_VOICE = "zh-CN-YunxiNeural"
DEFAULT_RATE = "-5%"
VOICE_CHOICES = [
    "zh-CN-YunxiNeural",        # 云希·男声（自然播报，当前默认）
    "zh-CN-YunyangNeural",      # 云扬·男声（新闻播报）
    "zh-CN-YunjianNeural",      # 云健·男声（浑厚）
    "zh-CN-XiaoxiaoNeural",     # 晓晓·女声
    "zh-CN-XiaoyiNeural",       # 晓伊·女声
    "zh-CN-liaoning-XiaobeiNeural",   # 晓北·东北口音女声
]
RATE_CHOICES = ["-15%", "-10%", "-5%", "+0%", "+5%", "+10%"]
ONLY_ALL = "（全部 PDF）"

# pythonw.exe 下没有控制台，stdout/stderr 为 None，屏蔽掉避免第三方库 print 报错
if sys.stdout is None or sys.stderr is None:
    class _NullIO(object):
        def write(self, *_a, **_k):
            return 0

        def flush(self):
            return None

        def reconfigure(self, *_a, **_k):
            return None

        def isatty(self):
            return False

    if sys.stdout is None:
        sys.stdout = _NullIO()
    if sys.stderr is None:
        sys.stderr = _NullIO()


def child_env():
    """子进程环境：强制 UTF-8，避免 Windows 默认 GBK 把中文日志写崩"""
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    return env


def load_manifest_module():
    """按文件路径加载 tools/narration_manifest.py（不污染 sys.path）"""
    spec = importlib.util.spec_from_file_location("narration_manifest", MANIFEST_PY)
    if spec is None or spec.loader is None:
        raise RuntimeError("无法加载 %s，请确认 tools 目录完整" % MANIFEST_PY)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ---------------------------------------------------------------- 解释器探测

def find_pythons():
    """按优先级列出本机可能可用的 python.exe（含 WorkBuddy 隔离环境）"""
    found = []

    def add(path):
        if not path:
            return
        path = os.path.normpath(path)
        if not os.path.isfile(path):
            return
        if not os.path.basename(path).lower().startswith("python"):
            return
        if path.lower() not in [p.lower() for p in found]:
            found.append(path)

    exe = sys.executable or ""
    if exe:
        add(re.sub(r"(?i)pythonw\.exe$", "python.exe", exe))   # pythonw → python（要拿日志）
        add(exe)
    add(shutil.which("python"))
    add(shutil.which("python3"))

    home = os.path.expanduser("~")
    local = os.environ.get("LOCALAPPDATA", "")
    pf = os.environ.get("ProgramFiles", "")
    patterns = [
        os.path.join(home, ".workbuddy", "binaries", "python", "envs", "*", "Scripts", "python.exe"),
        os.path.join(home, ".workbuddy", "binaries", "python", "versions", "*", "python.exe"),
        os.path.join(local, "Programs", "Python", "*", "python.exe"),
        os.path.join(pf, "Python*", "python.exe"),
    ]
    for pat in patterns:
        for p in sorted(glob.glob(pat), reverse=True):
            add(p)
    return found


def probe_edge_tts(py, timeout=90):
    """检测指定解释器能否 import edge_tts，返回 (是否可用, 版本或错误信息)"""
    code = ("import sys;"
            "sys.stdout.reconfigure(encoding='utf-8', errors='replace');"
            "import edge_tts;"
            "print(getattr(edge_tts, '__version__', 'unknown'))")
    try:
        r = subprocess.run([py, "-X", "utf8", "-c", code],
                           capture_output=True, timeout=timeout, env=child_env(),
                           stdin=subprocess.DEVNULL)
    except (OSError, subprocess.TimeoutExpired) as e:
        return False, str(e)
    out = ((r.stdout or b"") + (r.stderr or b"")).decode("utf-8", "replace").strip()
    return r.returncode == 0, out


def pick_python(log):
    """挑一个装有 edge-tts 的解释器；没有则返回 None（界面会提示安装）"""
    cands = find_pythons()
    if not cands:
        log("× 本机没找到 python.exe，无法调用合成脚本。")
        return None
    for py in cands:
        ok, info = probe_edge_tts(py)
        if ok:
            log("  ✓ 使用解释器：%s（edge-tts %s）" % (py, info.splitlines()[-1] if info else "?"))
            return py
        log("  · 跳过 %s（未装 edge-tts）" % py)
    log("× 以上 Python 都没有 edge-tts —— 请点「🔧 安装/修复 edge-tts」。")
    return None


# ---------------------------------------------------------------- 核心流程

def _log_to(log, text):
    if log:
        log(text)


def run_pipeline(log, force=False, dry_run=False, only="", voice="", rate="",
                 concurrency=4, stop_event=None, python_exe=None,
                 export_only=False):
    """执行「解析 → 比对 → 生成」全流程；返回结果 dict（code: 0 成功 / 其它 失败）"""
    res = {"code": 0, "total": 0, "todo": 0, "ok": 0, "fail": 0, "missing": []}
    t0 = time.time()

    if not os.path.isfile(DATA_FILE):
        _log_to(log, "× 找不到数据文件：%s" % DATA_FILE)
        res["code"] = 2
        return res

    try:
        nm = load_manifest_module()
    except Exception as e:                                    # noqa: BLE001
        _log_to(log, "× 加载 tools/narration_manifest.py 失败：%s" % e)
        res["code"] = 2
        return res

    # ---- ① 解析解说数据 -------------------------------------------------
    _log_to(log, "[1/5] 读取解说数据：js/narration_data.js")
    try:
        data = nm.load_narration_data(DATA_FILE)
        manifest = nm.build_manifest(data)
    except Exception as e:                                    # noqa: BLE001
        _log_to(log, "× 解析失败：%s" % e)
        _log_to(log, "  提示：数据文件里请勿使用模板字符串（反引号）或函数表达式。")
        res["code"] = 2
        return res

    res["total"] = manifest["total"]
    _log_to(log, "      共 %d 个 PDF、%d 条解说文案；音频规则：%s/<pdfId>/p<页>-<序>.%s"
            % (len(manifest["pdfs"]), manifest["total"], manifest["dir"], manifest["ext"]))
    for p in manifest["pdfs"]:
        _log_to(log, "      · %-16s %-28s %d 条" % (p["id"], p["name"], p["total"]))
    if not manifest["total"]:
        _log_to(log, "× 没有任何带文字的触点，无需生成。")
        res["code"] = 2
        return res

    def in_scope(item):
        return (not only) or item["pdfId"] == only

    # ---- ② 与磁盘 / 旧清单指纹比对 --------------------------------------
    _log_to(log, "[2/5] 比对音频现状：%s" % manifest["dir"])
    old = nm.read_manifest(MANIFEST_FILE)
    if old is None:
        _log_to(log, "      未找到旧清单，本次按现有文件判定（只补缺，不重做已存在的）。")
    diff = nm.diff_with_disk(ROOT, manifest, old)
    todo = [it for it in (diff["missing"] + diff["changed"]) if in_scope(it)]
    res["todo"] = len(todo)

    _log_to(log, "      待生成（文件缺失）%d 条｜需重生成（文案已改）%d 条｜已就绪 %d 条"
            % (len(diff["missing"]), len(diff["changed"]), len(diff["ready"])))
    if diff["unknown"]:
        _log_to(log, "      首次建立文案指纹基线 %d 条（本次不重做，之后改动才会被检出）。"
                % len(diff["unknown"]))
    if diff["extra"]:
        _log_to(log, "      提示：磁盘上有 %d 个音频在数据里已无对应触点（不会自动删除）。"
                % len(diff["extra"]))
        for p in diff["extra"][:8]:
            _log_to(log, "        - %s" % p)
    for it in diff["changed"]:
        if in_scope(it):
            _log_to(log, "      ↻ 文案已变，将重新合成：%s" % it["file"])
    for it in diff["missing"]:
        if in_scope(it):
            _log_to(log, "      + 新增，将合成：%s" % it["file"])

    if export_only:
        nm.write_manifest(manifest, MANIFEST_FILE)
        _log_to(log, "      已写入清单：tools/voice_manifest.json（未合成音频）")
        _log_to(log, "完成（用时 %.1f 秒）。" % (time.time() - t0))
        return res

    if dry_run:
        _log_to(log, "      [演练模式] 不做任何改动。去掉「仅分析」即可真正生成。")
        _log_to(log, "完成（用时 %.1f 秒）。" % (time.time() - t0))
        return res

    if not todo and not force:
        nm.write_manifest(manifest, MANIFEST_FILE)          # 顺手刷新清单与指纹
        kb, cnt = nm.dir_size(ROOT, manifest)
        _log_to(log, "      ✓ 全部音频都是最新的，无需合成。当前 %d 个文件 / %.2f MB"
                % (cnt, kb / 1024.0))
        _log_to(log, "完成（用时 %.1f 秒）。" % (time.time() - t0))
        return res

    # ---- ③ 写清单 + 清掉要重做的旧音频 ----------------------------------
    _log_to(log, "[3/5] 更新清单：tools/voice_manifest.json")
    nm.write_manifest(manifest, MANIFEST_FILE)
    removed = 0
    for it in diff["changed"]:
        if not in_scope(it):
            continue
        full = nm.abs_path(ROOT, it["file"])
        try:
            os.remove(full)
            removed += 1
        except OSError as e:
            _log_to(log, "      ! 删除旧音频失败（将被覆盖）：%s（%s）" % (it["file"], e))
    if removed:
        _log_to(log, "      已清除 %d 个文案变动的旧音频，稍后重新合成。" % removed)

    # ---- ④ 准备运行环境 -------------------------------------------------
    _log_to(log, "[4/5] 检查 edge-tts 运行环境")
    py = python_exe or pick_python(log)
    if not py:
        res["code"] = 3
        return res
    if stop_event is not None and stop_event.is_set():
        _log_to(log, "已停止。")
        res["code"] = 130
        return res

    # ---- ⑤ 调用 gen_voice_files.py 合成 ----------------------------------
    cmd = [py, "-u", GEN_SCRIPT]
    if force:
        cmd.append("--force")
    if only:
        cmd += ["--only", only]
    if voice:
        cmd += ["--voice", voice]
    if rate:
        cmd += ["--rate", rate]
    cmd += ["--concurrency", str(max(1, int(concurrency)))]
    _log_to(log, "[5/5] 开始合成音频（edge-tts%s）…" % ("，全部重做" if force else "，增量"))
    _log_to(log, "      " + " ".join('"%s"' % c if " " in c else c for c in cmd[1:]))

    flags = 0
    if os.name == "nt":
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
    proc = None
    stopped = False
    try:
        proc = subprocess.Popen(cmd, cwd=ROOT, stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                                text=True, encoding="utf-8", errors="replace",
                                bufsize=1, env=child_env(), creationflags=flags)

        # 监视「停止」按钮：一旦点击就终止子进程
        def watchdog():
            if stop_event is None:
                return
            while proc.poll() is None:
                if stop_event.wait(0.3):
                    try:
                        proc.terminate()
                    except OSError:
                        pass
                    return

        if stop_event is not None:
            threading.Thread(target=watchdog, daemon=True).start()

        for line in iter(proc.stdout.readline, ""):
            line = line.rstrip("\r\n")
            if line:
                _log_to(log, "  " + line)
        proc.stdout.close()
        code = proc.wait()
        stopped = stop_event is not None and stop_event.is_set()
        res["code"] = code if not stopped else 130
    except Exception as e:                                    # noqa: BLE001
        _log_to(log, "× 调用合成脚本出错：%s" % e)
        res["code"] = 4
    finally:
        if proc is not None and proc.poll() is None:
            try:
                proc.terminate()
            except OSError:
                pass

    # ---- 收尾：磁盘校验 -------------------------------------------------
    missing = [it for it in manifest["files"]
               if not os.path.exists(nm.abs_path(ROOT, it["file"]))]
    res["missing"] = [it["file"] for it in missing]
    kb, cnt = nm.dir_size(ROOT, manifest)
    _log_to(log, "-" * 58)
    if stopped:
        _log_to(log, "已停止：已生成的音频保留，再次点「一键生成」会接着做没做完的。")
    elif missing:
        _log_to(log, "⚠ 仍有 %d 条没有音频（多半是网络中断）：" % len(missing))
        for f in res["missing"][:10]:
            _log_to(log, "   - %s" % f)
        _log_to(log, "  再点一次「一键生成」即可续做。")
    else:
        _log_to(log, "✓ 全部 %d 条解说音频齐备：%d 个文件 / %.2f MB"
                % (manifest["total"], cnt, kb / 1024.0))
        _log_to(log, "  网页刷新后即可听到新解说（浏览器能朗读的环境仍用实时朗读）。")
    _log_to(log, "完成（用时 %.1f 秒）。" % (time.time() - t0))
    return res


def install_edge_tts(py, log, stop_event=None):
    """给指定解释器安装 / 升级 edge-tts"""
    _log_to(log, "正在安装 edge-tts 到：%s" % py)
    cmd = [py, "-u", "-m", "pip", "install", "-U", "edge-tts"]
    flags = 0
    if os.name == "nt":
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
    try:
        proc = subprocess.Popen(cmd, cwd=ROOT, stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                                text=True, encoding="utf-8", errors="replace",
                                bufsize=1, env=child_env(), creationflags=flags)
        for line in iter(proc.stdout.readline, ""):
            line = line.rstrip("\r\n")
            if line:
                _log_to(log, "  " + line)
        proc.stdout.close()
        code = proc.wait()
    except Exception as e:                                    # noqa: BLE001
        _log_to(log, "× 安装失败：%s" % e)
        return False
    if code == 0:
        ok, info = probe_edge_tts(py)
        _log_to(log, "✓ 安装完成：edge-tts %s" % (info.splitlines()[-1] if info else "?"))
        return True
    _log_to(log, "× pip 返回 %d，安装未成功（可手动执行：%s -m pip install edge-tts）" % (code, py))
    return False


def open_voice_dir():
    if not os.path.isdir(VOICE_DIR):
        os.makedirs(VOICE_DIR, exist_ok=True)
    if os.name == "nt":
        os.startfile(VOICE_DIR)                               # noqa: S606
    elif sys.platform == "darwin":
        subprocess.Popen(["open", VOICE_DIR])
    else:
        subprocess.Popen(["xdg-open", VOICE_DIR])


# ---------------------------------------------------------------- 命令行模式

def now_str():
    return time.strftime("%Y-%m-%d %H:%M:%S")


def cli_logger(mirror_file=True):
    """命令行日志：写控制台（若有）+ 同步写入 tools/voice_build.log"""
    if mirror_file:
        try:
            with open(BUILD_LOG, "w", encoding="utf-8") as f:
                f.write("pdf_narrator 解说语音一键生成 —— %s\n\n" % now_str())
        except OSError:
            mirror_file = False

    def log(text):
        print(text)
        if mirror_file:
            try:
                with open(BUILD_LOG, "a", encoding="utf-8") as f:
                    f.write(text + "\n")
            except OSError:
                pass
    return log


def main_cli(argv):
    force = "--force" in argv
    dry = "--dry-run" in argv
    only = ""
    if "--only" in argv:
        i = argv.index("--only")
        if i + 1 < len(argv):
            only = argv[i + 1]
    voice = ""
    if "--voice" in argv:
        i = argv.index("--voice")
        if i + 1 < len(argv):
            voice = argv[i + 1]

    log = cli_logger()
    if "--check" in argv:
        log("项目目录：%s" % ROOT)
        log("数据文件：%s（%s）" % (DATA_FILE, "存在" if os.path.isfile(DATA_FILE) else "缺失"))
        log("本机 Python 解释器与 edge-tts 检测：")
        hit = None
        for py in find_pythons():
            ok, info = probe_edge_tts(py)
            log("  [%s] %s" % ("可用" if ok else "  - ", py))
            if ok:
                log("        edge-tts %s" % (info.splitlines()[-1] if info else "?"))
                hit = hit or py
        log("结论：%s" % ("可直接一键生成（将使用 %s）" % hit if hit
                          else "所有解释器都没装 edge-tts，请先点「🔧 安装/修复 edge-tts」"))
        return 0
    if "--list" in argv:
        nm = load_manifest_module()
        manifest = nm.build_manifest(nm.load_narration_data(DATA_FILE))
        print("共 %d 条：" % manifest["total"])
        for f in manifest["files"]:
            print("  %s  [%s]\n      %s" % (f["file"], f["hash"], f["text"]))
        return 0

    res = run_pipeline(log, force=force, dry_run=dry, only=only, voice=voice)
    return res["code"]


# ---------------------------------------------------------------- 图形界面

def main_gui():
    import queue

    try:
        import tkinter as tk
        from tkinter import ttk
        from tkinter.scrolledtext import ScrolledText
    except ImportError:
        msg = "本机 Python 缺少 tkinter，无法显示一键生成窗口。\n\n" \
              "可改用命令行：\n  python gen_voice_oneclick.pyw --auto\n\n" \
              "或安装带 tkinter 的 Python（安装时勾选 tcl/tk）。"
        if os.name == "nt":
            import ctypes
            ctypes.windll.user32.MessageBoxW(0, msg, "解说语音一键生成", 0x10)
        else:
            print(msg)
        return 2

    BG = "#f5f7fa"
    CARD = "#ffffff"
    FG = "#1f2937"
    MUTED = "#6b7280"
    ACCENT = "#2563eb"

    class App(object):
        def __init__(self, master):
            self.master = master
            self.q = queue.Queue()
            self.stop_event = threading.Event()
            self.worker = None
            self.nm = None
            self.summary = {}

            master.title("解说语音一键生成 · pdf_narrator")
            master.configure(bg=BG)
            master.geometry("900x640")
            master.minsize(760, 560)

            style = ttk.Style()
            try:
                style.theme_use("clam")
            except tk.TclError:
                pass
            style.configure("TFrame", background=BG)
            style.configure("TLabel", background=BG, foreground=FG, font=("Microsoft YaHei UI", 9))
            style.configure("Card.TLabel", background=CARD, foreground=FG,
                            font=("Microsoft YaHei UI", 9))
            style.configure("TLabelframe", background=BG, foreground=FG,
                            font=("Microsoft YaHei UI", 9, "bold"))
            style.configure("TLabelframe.Label", background=BG, foreground=FG,
                            font=("Microsoft YaHei UI", 9, "bold"))
            style.configure("TButton", font=("Microsoft YaHei UI", 9), padding=(6, 4))
            style.configure("TCombobox", font=("Microsoft YaHei UI", 9))
            style.configure("TCheckbutton", background=BG, foreground=FG,
                            font=("Microsoft YaHei UI", 9))

            # ---- 标题区 ----
            head = tk.Frame(master, bg=BG)
            head.pack(fill="x", padx=14, pady=(12, 6))
            tk.Label(head, text="解说语音一键生成", bg=BG, fg=FG,
                     font=("Microsoft YaHei UI", 15, "bold")).pack(anchor="w")
            tk.Label(head, text="读取 js/narration_data.js → 生成 file/voice/<pdfId>/p<页>-<序>.mp3"
                                "（浏览器不能再朗读时页面自动改播这些音频）",
                     bg=BG, fg=MUTED, font=("Microsoft YaHei UI", 9)).pack(anchor="w", pady=(2, 0))

            # ---- 状态卡片 ----
            card = tk.Frame(master, bg=CARD, highlightthickness=1, highlightbackground="#e5e7eb")
            card.pack(fill="x", padx=14, pady=(4, 8))
            self.lbl_state = tk.Label(card, text="正在统计…", bg=CARD, fg=FG,
                                      font=("Microsoft YaHei UI", 10), justify="left", anchor="w")
            self.lbl_state.pack(fill="x", padx=12, pady=(10, 4))
            self.lbl_files = tk.Label(card, text="", bg=CARD, fg=MUTED,
                                      font=("Microsoft YaHei UI", 9), justify="left", anchor="w")
            self.lbl_files.pack(fill="x", padx=12, pady=(0, 10))

            # ---- 选项区 ----
            opt = ttk.LabelFrame(master, text=" 生成选项 ")
            opt.pack(fill="x", padx=14, pady=(0, 8))

            row = ttk.Frame(opt)
            row.pack(fill="x", padx=10, pady=(8, 4))
            ttk.Label(row, text="音色：").pack(side="left")
            self.cmb_voice = ttk.Combobox(row, values=VOICE_CHOICES, width=26)
            self.cmb_voice.set(DEFAULT_VOICE)
            self.cmb_voice.pack(side="left")
            ttk.Label(row, text="   语速：").pack(side="left")
            self.cmb_rate = ttk.Combobox(row, values=RATE_CHOICES, width=7)
            self.cmb_rate.set(DEFAULT_RATE)
            self.cmb_rate.pack(side="left")
            ttk.Label(row, text="   范围：").pack(side="left")
            self.cmb_only = ttk.Combobox(row, width=26, state="readonly")
            self.cmb_only.set(ONLY_ALL)
            self.cmb_only.pack(side="left")

            row2 = ttk.Frame(opt)
            row2.pack(fill="x", padx=10, pady=(0, 8))
            self.var_force = tk.BooleanVar(value=False)
            self.var_dry = tk.BooleanVar(value=False)
            ttk.Checkbutton(row2, text="全部重新生成（忽略增量，换音色后用）",
                            variable=self.var_force).pack(side="left")
            ttk.Checkbutton(row2, text="仅分析不生成（演练）",
                            variable=self.var_dry).pack(side="left", padx=(16, 0))

            # ---- 按钮区 ----
            btns = ttk.Frame(master)
            btns.pack(fill="x", padx=14, pady=(0, 6))
            self.btn_run = tk.Button(btns, text="🚀 一键生成", command=self.on_run,
                                     bg=ACCENT, fg="#ffffff", activebackground="#1d4ed8",
                                     activeforeground="#ffffff", relief="flat", bd=0,
                                     font=("Microsoft YaHei UI", 10, "bold"), padx=18, pady=7,
                                     cursor="hand2")
            self.btn_run.pack(side="left")
            self.btn_force = ttk.Button(btns, text="♻ 全部重新生成", command=self.on_force)
            self.btn_force.pack(side="left", padx=(8, 0))
            self.btn_export = ttk.Button(btns, text="📋 仅导出清单", command=self.on_export)
            self.btn_export.pack(side="left", padx=(8, 0))
            self.btn_install = ttk.Button(btns, text="🔧 安装/修复 edge-tts", command=self.on_install)
            self.btn_install.pack(side="left", padx=(8, 0))
            self.btn_open = ttk.Button(btns, text="📂 打开音频目录", command=open_voice_dir)
            self.btn_open.pack(side="left", padx=(8, 0))
            self.btn_stop = ttk.Button(btns, text="🛑 停止", command=self.on_stop, state="disabled")
            self.btn_stop.pack(side="left", padx=(8, 0))

            # ---- 日志区 ----
            logf = ttk.LabelFrame(master, text=" 运行日志 ")
            logf.pack(fill="both", expand=True, padx=14, pady=(0, 6))
            self.txt = ScrolledText(logf, height=14, wrap="word", bg="#0f172a", fg="#e5e7eb",
                                    insertbackground="#e5e7eb", relief="flat", bd=0,
                                    font=("Consolas", 9))
            self.txt.pack(fill="both", expand=True, padx=8, pady=8)

            self.status = tk.Label(master, text="就绪", bg=BG, fg=MUTED, anchor="w",
                                   font=("Microsoft YaHei UI", 9))
            self.status.pack(fill="x", padx=14, pady=(0, 10))

            master.protocol("WM_DELETE_WINDOW", self.on_close)
            self.refresh_state()
            self.q.put(("log", "项目目录：%s" % ROOT))
            self.q.put(("log", "提示：合成需要联网（edge-tts），生成后的音频可完全离线使用。"))
            self.q.put(("log", "首次使用若提示缺少 edge-tts，点「🔧 安装/修复 edge-tts」即可。"))
            self.master.after(120, self.pump)

        # ---------- 日志 ----------
        def pump(self):
            try:
                while True:
                    kind, payload = self.q.get_nowait()
                    if kind == "log":
                        self.txt.insert("end", payload + "\n")
                        self.txt.see("end")
                    elif kind == "status":
                        self.status.config(text=payload)
                    elif kind == "refresh":
                        self.refresh_state()
                    elif kind == "busy":
                        self.set_busy(payload)
                    elif kind == "done":
                        self.set_busy(False)
                        self.refresh_state()
            except queue.Empty:
                pass
            self.master.after(120, self.pump)

        def set_busy(self, busy):
            state = "disabled" if busy else "normal"
            for b in (self.btn_run, self.btn_force, self.btn_export, self.btn_install):
                try:
                    b.config(state=state)
                except tk.TclError:
                    pass
            self.btn_stop.config(state="normal" if busy else "disabled")

        # ---------- 状态统计 ----------
        def refresh_state(self):
            try:
                if self.nm is None:
                    self.nm = load_manifest_module()
                manifest = self.nm.build_manifest(self.nm.load_narration_data(DATA_FILE))
                old = self.nm.read_manifest(MANIFEST_FILE)
                diff = self.nm.diff_with_disk(ROOT, manifest, old)
                kb, cnt = self.nm.dir_size(ROOT, manifest)
                self.summary = {"manifest": manifest, "diff": diff}
                self.lbl_state.config(
                    text="共 %d 条解说（%d 个 PDF）　｜　待生成 %d 条　｜　需重生成 %d 条　｜　已就绪 %d 条"
                         % (manifest["total"], len(manifest["pdfs"]),
                            len(diff["missing"]), len(diff["changed"]), len(diff["ready"])))
                extra = "，另有 %d 个音频已无对应触点" % len(diff["extra"]) if diff["extra"] else ""
                self.lbl_files.config(
                    text="音频目录：%s　（%d 个文件 / %.2f MB%s）"
                         % (manifest["dir"], cnt, kb / 1024.0, extra))
                values = [ONLY_ALL] + ["%s — %s" % (p["id"], p["name"]) for p in manifest["pdfs"]]
                if list(self.cmb_only["values"]) != values:
                    self.cmb_only["values"] = values
                    self.cmb_only.set(ONLY_ALL)
            except Exception as e:                            # noqa: BLE001
                self.lbl_state.config(text="统计失败：%s" % e)

        # ---------- 动作 ----------
        def on_run(self):
            self.start(force=self.var_force.get(), dry=self.var_dry.get())

        def on_force(self):
            self.var_force.set(True)
            self.start(force=True, dry=False)

        def start(self, force=False, dry=False, export_only=False):
            if self.worker and self.worker.is_alive():
                return
            self.stop_event.clear()
            only = ""
            sel = self.cmb_only.get()
            if sel and sel != ONLY_ALL:
                only = sel.split(" — ")[0].strip()
            voice = self.cmb_voice.get().strip()
            rate = self.cmb_rate.get().strip()
            self.txt.delete("1.0", "end")
            self.begin_build_log()
            self.q.put(("busy", True))
            self.q.put(("status", "运行中…"))

            def job():
                try:
                    res = run_pipeline(self.log, force=force, dry_run=dry, only=only,
                                       voice=voice, rate=rate, stop_event=self.stop_event)
                    code = res.get("code", 0)
                    tail = {0: "完成", 2: "数据/环境有误", 3: "缺少 edge-tts",
                            4: "调用合成脚本失败", 130: "已停止"}.get(code, "结束(%s)" % code)
                except Exception as e:                        # noqa: BLE001
                    self.log("× 未预期的错误：%s" % e)
                    tail = "出错"
                self.q.put(("status", tail))
                self.q.put(("done", True))
            self.worker = threading.Thread(target=job, daemon=True)
            self.worker.start()

        def on_export(self):
            if self.worker and self.worker.is_alive():
                return
            self.txt.delete("1.0", "end")
            self.begin_build_log()
            self.q.put(("busy", True))

            def job():
                try:
                    run_pipeline(self.log, export_only=True, stop_event=self.stop_event)
                except Exception as e:                        # noqa: BLE001
                    self.log("× 导出失败：%s" % e)
                self.q.put(("done", True))
            self.worker = threading.Thread(target=job, daemon=True)
            self.worker.start()

        def on_install(self):
            if self.worker and self.worker.is_alive():
                return
            cands = find_pythons()
            if not cands:
                self.log("× 本机没有找到 python.exe。")
                return
            py = cands[0]
            self.q.put(("busy", True))
            self.q.put(("status", "正在安装 edge-tts…"))

            def job():
                install_edge_tts(py, self.log, self.stop_event)
                self.q.put(("done", True))
            self.worker = threading.Thread(target=job, daemon=True)
            self.worker.start()

        def on_stop(self):
            self.stop_event.set()
            self.log("已请求停止，正在结束合成进程…")

        def on_close(self):
            self.stop_event.set()
            try:
                self.master.destroy()
            except tk.TclError:
                pass

        # ---------- 同步写日志文件，便于事后排查 ----------
        def begin_build_log(self):
            try:
                with open(BUILD_LOG, "w", encoding="utf-8") as f:
                    f.write("pdf_narrator 解说语音一键生成 —— %s\n\n" % now_str())
            except OSError:
                pass

        def log(self, text):                                  # noqa: F811
            self.q.put(("log", text))
            try:
                with open(BUILD_LOG, "a", encoding="utf-8") as f:
                    f.write(text + "\n")
            except OSError:
                pass

    root = tk.Tk()
    app = App(root)
    if os.environ.get("PDFN_GUI_SELFTEST") == "1":
        # 自检模式：构建界面 → 跑一次状态统计 → 立刻关闭（供自动化测试调用，窗口不显示）
        root.withdraw()
        root.update_idletasks()
        root.update()
        print("GUI 自检 · 状态区：%s" % app.lbl_state.cget("text"))
        print("GUI 自检 · 音频区：%s" % app.lbl_files.cget("text"))
        print("GUI 自检 · 按钮：一键生成=%s / 停止=%s"
              % (app.btn_run.cget("state"), app.btn_stop.cget("state")))
        root.after(150, root.destroy)
        root.mainloop()
        return 0
    root.mainloop()
    return 0


# ---------------------------------------------------------------- 入口

def main():
    argv = sys.argv[1:]
    if argv:
        return main_cli(argv)
    return main_gui()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
