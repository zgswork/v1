# -*- coding: utf-8 -*-
"""
pdf_narrator 解说文案清单导出（纯 Python 版，无需 Node）
============================================================
作用：读取 js/narration_data.js，把每个触点要朗读的文案导出为 tools/voice_manifest.json，
      供 tools/gen_voice_files.py 批量合成 mp3；同时为每条文案记录「指纹」（hash），
      供 tools/gen_voice_oneclick.pyw 判断文案是否改过 —— 只重新生成变动的那几条，
      没改的照旧跳过，省时又不会漏。

与 tools/export_voice_manifest.mjs 的关系
------------------------------------------------------------
· 两者输出结构一致：pdfId / page(1起) / index(1起) / file / text；
· 音频文件名规则必须与 js/main.js 拼路径逻辑一致：
      <offlineVoice.dir>/<pdfId>/p<页码>-<触点序号>.<offlineVoice.ext>
· 本脚本额外写入 text 指纹 hash 与 pdfs 摘要，且**不依赖 Node**
  （一键脚本要在只装了 Python 的机器上也能跑）；
· ★ 改其中一个导出器时，务必同步另一个，避免两套清单不一致。

用法（在项目目录下）
------------------------------------------------------------
    python tools/narration_manifest.py             # 导出并打印全部条目
    python tools/narration_manifest.py --quiet     # 只导出，不打印明细
    python tools/narration_manifest.py --list      # 只打印，不写文件

数据文件语法限制：为免引入 Node 依赖，这里用一个小型 JS→JSON 转换器解析
`const NARRATION_DATA = { ... }` 对象字面量，支持 // 与 /* */ 注释、无引号 key、
单/双引号字符串、尾随逗号、true/false/null。请勿在数据文件里使用模板字符串
（反引号）或函数表达式。
"""

import argparse
import datetime
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA_FILE = os.path.join(ROOT, "js", "narration_data.js")
OUT_FILE = os.path.join(HERE, "voice_manifest.json")

DATA_MARKER = "NARRATION_DATA"          # 数据变量名（与 js/main.js 一致）
DEFAULT_DIR = "file/voice"
DEFAULT_EXT = "mp3"

_IDENT_START = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$")
_IDENT_CHARS = _IDENT_START | set("0123456789")
_WS = " \t\r\n"


# ---------------------------------------------------------------- JS → JSON

def _read_string(src, i):
    """从 src[i]（引号字符）读出一个字符串，返回 (JSON 字符串字面量, 下一位置)"""
    quote = src[i]
    n = len(src)
    i += 1
    buf = ['"']
    while i < n:
        c = src[i]
        if c == "\\":                                   # 转义序列原样保留语义
            if i + 1 >= n:
                break
            nxt = src[i + 1]
            if nxt == "u" and i + 6 <= n:
                buf.append(src[i:i + 6])                # \uXXXX 原样搬运（JSON 同义）
                i += 6
                continue
            buf.append({"n": "\\n", "t": "\\t", "r": "\\r",
                        "b": "\\b", "f": "\\f"}.get(nxt, "\\" + nxt))
            i += 2
            continue
        if c == quote:
            i += 1
            break
        if c == '"':
            buf.append('\\"')
        elif c == "\n":
            buf.append("\\n")
        elif c == "\r":
            pass
        else:
            buf.append(c)
        i += 1
    buf.append('"')
    return "".join(buf), i


def js_object_to_json(src):
    """把 JS 对象字面量文本转成标准 JSON 文本（去注释 / 补 key 引号 / 去尾随逗号）"""
    out = []
    i, n = 0, len(src)
    while i < n:
        c = src[i]
        if c == "/" and i + 1 < n and src[i + 1] == "/":             # 行注释
            j = src.find("\n", i)
            i = n if j < 0 else j
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "*":             # 块注释
            j = src.find("*/", i + 2)
            i = n if j < 0 else j + 2
            continue
        if c in "\"'":                                              # 字符串
            s, i = _read_string(src, i)
            out.append(s)
            continue
        if c == "`":
            raise ValueError("数据文件里出现了模板字符串（反引号），请改用双引号字符串")
        if c in _IDENT_START:                                       # 标识符 / 无引号 key
            j = i
            while j < n and src[j] in _IDENT_CHARS:
                j += 1
            word = src[i:j]
            k = j
            while k < n and src[k] in _WS:
                k += 1
            out.append('"%s"' % word if (k < n and src[k] == ":") else word)
            i = j
            continue
        if c in "]}":                                               # 去掉尾随逗号
            while out and out[-1].strip() == "":
                out.pop()
            if out and out[-1].strip() == ",":
                out.pop()
            out.append(c)
            i += 1
            continue
        out.append(c)
        i += 1
    return "".join(out)


def extract_object(src, marker=DATA_MARKER):
    """取出 marker 之后第一个配平的 { ... } 子串（跳过注释与字符串）"""
    pos = src.find(marker)
    if pos < 0:
        raise ValueError("数据文件里找不到 %s，请确认 js/narration_data.js 是否完整" % marker)
    start = src.find("{", pos)
    if start < 0:
        raise ValueError("找不到对象起始花括号 {")
    depth, i, n = 0, start, len(src)
    while i < n:
        c = src[i]
        if c == "/" and i + 1 < n and src[i + 1] == "/":
            j = src.find("\n", i)
            i = n if j < 0 else j
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            j = src.find("*/", i + 2)
            i = n if j < 0 else j + 2
            continue
        if c in "\"'":
            _, i = _read_string(src, i)
            continue
        if c in "{[":
            depth += 1
        elif c in "}]":
            depth -= 1
            if depth == 0:
                return src[start:i + 1]
        i += 1
    raise ValueError("对象字面量未闭合（少了 } 或 ]）")


def load_narration_data(data_file=DATA_FILE):
    """解析 js/narration_data.js，返回 dict"""
    with open(data_file, encoding="utf-8") as f:
        src = f.read()
    return json.loads(js_object_to_json(extract_object(src)))


# ---------------------------------------------------------------- 清单构建

def text_hash(text):
    """文案指纹（12 位）—— 用于判断某条解说是否改过，决定要不要重生成音频"""
    return hashlib.md5(text.encode("utf-8")).hexdigest()[:12]


def audio_name(pdf_id, page_no, idx, ext):
    """音频文件名规则（**必须**与 js/main.js 的拼路径逻辑保持一致）"""
    return "p%d-%d.%s" % (page_no, idx, ext)


def build_manifest(data, source="js/narration_data.js",
                   generator="tools/narration_manifest.py"):
    """把解说数据整理成清单；无文案的触点不生成音频（与 mjs 版规则一致）"""
    cfg = data.get("offlineVoice") or {}
    dir_ = str(cfg.get("dir") or DEFAULT_DIR).rstrip("/")
    ext = str(cfg.get("ext") or DEFAULT_EXT).lstrip(".")

    files, pdfs = [], []
    for pdf in data.get("pdfs") or []:
        pid = str(pdf.get("id") or "").strip()
        count = 0
        for pi, page in enumerate(pdf.get("pages") or []):
            for hi, hs in enumerate(page.get("hotspots") or []):
                text = str(hs.get("text") or "").strip()
                if not text or not pid:
                    continue                    # 无文案 / 无 id 的条目跳过
                page_no, idx = pi + 1, hi + 1
                files.append({
                    "pdfId": pid,
                    "page": page_no,
                    "index": idx,
                    "name": audio_name(pid, page_no, idx, ext),
                    "file": "%s/%s/%s" % (dir_, pid, audio_name(pid, page_no, idx, ext)),
                    "text": text,
                    "hash": text_hash(text),
                })
                count += 1
        if pid:
            pdfs.append({"id": pid, "name": str(pdf.get("name") or pid), "total": count})

    return {
        "generatedAt": datetime.datetime.now().isoformat(timespec="seconds"),
        "source": source,
        "generator": generator,
        "dir": dir_,
        "ext": ext,
        "total": len(files),
        "offlineVoice": {
            "enabled": bool(cfg.get("enabled", True)),
            "voiceLabel": cfg.get("voiceLabel", ""),
        },
        "pdfs": pdfs,
        "files": files,
    }


# ---------------------------------------------------------------- 磁盘比对

def read_manifest(path=OUT_FILE):
    """读取既有清单（不存在 / 损坏时返回 None）"""
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (ValueError, OSError):
        return None


def write_manifest(manifest, path=OUT_FILE):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    return path


def abs_path(root, rel):
    return os.path.join(root, rel.replace("/", os.sep))


def scan_disk(root, manifest):
    """扫描音频目录，返回目录下现有音频的相对路径集合（'/' 分隔）"""
    base = abs_path(root, manifest.get("dir") or DEFAULT_DIR)
    found = set()
    for dirpath, _dirs, names in os.walk(base):
        for fn in names:
            full = os.path.join(dirpath, fn)
            found.add(os.path.relpath(full, root).replace(os.sep, "/"))
    return found


def diff_with_disk(root, manifest, old_manifest=None):
    """比对「当前清单」与「磁盘现状 + 旧清单指纹」，分类出待办条目

    返回 dict：
      missing  文件不存在 → 需要新生成
      changed  文件在、但旧清单里的文案指纹与新清单不同 → 删掉重生成
      unknown  文件在、但旧清单没有指纹（早期 mjs 清单）→ 无法判断，按“就绪”处理，
               只把指纹补写进清单作为此后判断的基线（日志会提示）
      ready    文件在且指纹一致 → 跳过
      extra    磁盘上多出来的音频（清单里已无对应触点）→ 只报告，不自动删
    """
    old_map = {}
    if old_manifest:
        for it in old_manifest.get("files") or []:
            if it.get("file"):
                old_map[it["file"]] = it

    on_disk = scan_disk(root, manifest)
    res = {"missing": [], "changed": [], "unknown": [], "ready": [], "extra": []}

    for item in manifest["files"]:
        old = old_map.get(item["file"])
        if not os.path.exists(abs_path(root, item["file"])):
            res["missing"].append(item)
        elif old and old.get("hash") and old["hash"] != item["hash"]:
            res["changed"].append(item)
        elif old and not old.get("hash"):
            res["unknown"].append(item)          # 老清单无指纹，本次只补基线
        else:
            res["ready"].append(item)

    known = {it["file"] for it in manifest["files"]}
    res["extra"] = sorted(p for p in on_disk - known if p.lower().endswith(
        "." + str(manifest.get("ext") or DEFAULT_EXT).lower()))
    return res


def dir_size(root, manifest):
    """音频目录总体积（KB）与文件个数"""
    base = abs_path(root, manifest.get("dir") or DEFAULT_DIR)
    total, count = 0, 0
    for dirpath, _dirs, names in os.walk(base):
        for fn in names:
            try:
                total += os.path.getsize(os.path.join(dirpath, fn))
                count += 1
            except OSError:
                pass
    return total / 1024.0, count


# ---------------------------------------------------------------- 对外入口

def export(data_file=DATA_FILE, out_file=OUT_FILE, write=True, quiet=False):
    """解析数据 → 构建清单 →（可选）写盘，返回 manifest"""
    data = load_narration_data(data_file)
    src_label = os.path.relpath(data_file, ROOT).replace(os.sep, "/")
    manifest = build_manifest(data, source=src_label)
    if write:
        write_manifest(manifest, out_file)
        if not quiet:
            print("已导出清单：%s" % os.path.relpath(out_file, ROOT).replace(os.sep, "/"))
            print("  条目数：%d，音频目录：%s，扩展名：%s"
                  % (manifest["total"], manifest["dir"], manifest["ext"]))
    return manifest


def main():
    p = argparse.ArgumentParser(description="pdf_narrator 解说文案清单导出（纯 Python）")
    p.add_argument("--data", default=DATA_FILE, help="数据文件（默认 js/narration_data.js）")
    p.add_argument("--out", default=OUT_FILE, help="输出清单（默认 tools/voice_manifest.json）")
    p.add_argument("--quiet", action="store_true", help="不打印条目明细")
    p.add_argument("--list", action="store_true", help="只打印，不写文件")
    args = p.parse_args()

    try:
        manifest = export(args.data, args.out, write=not args.list)
    except Exception as e:                                    # noqa: BLE001
        print("解析失败：%s" % e)
        return 2

    if not args.quiet:
        for f in manifest["files"]:
            print("  %s  ← %s" % (f["file"], f["text"][:30] + ("…" if len(f["text"]) > 30 else "")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
