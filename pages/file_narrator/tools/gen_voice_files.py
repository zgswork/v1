# -*- coding: utf-8 -*-
"""
pdf_narrator 离线语音 —— 解说音频批量合成脚本
============================================================
作用：把 js/narration_data.js 里每个触点要朗读的文案，用微软 Edge 在线语音
      （edge-tts，音质接近真人播报）合成 mp3 文件，放到 file/voice/<pdfId>/ 下。
      生成后的音频是**完全本地**的：网页播放时不需要网络，也不需要浏览器支持
      文字转语音（Web Speech API）。用于手机 / 微信内置浏览器等不支持朗读的环境兜底。

用法（在项目目录下执行）：
    python tools/gen_voice_files.py                 # 增量生成（已存在则跳过）
    python tools/gen_voice_files.py --force         # 全部重新生成
    python tools/gen_voice_files.py --only demo     # 只生成某个 PDF（对应 pdfs[].id）
    python tools/gen_voice_files.py --voice zh-CN-YunxiNeural --rate -5%
    python tools/gen_voice_files.py --list          # 只列出将生成的文件，不实际生成

依赖：Python 3.8+，pip install edge-tts（生成时需要联网；生成完即可离线使用）
      首次运行若 tools/voice_manifest.json 不存在，脚本会调用同目录的
      narration_manifest.py 自动导出（纯 Python，无需 node）。

★ 改了 js/narration_data.js 的文案或增删触点后，必须重新跑本脚本（或加 --force），
  否则离线音频会与页面文字不一致。
============================================================
"""

import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MANIFEST = os.path.join(HERE, "voice_manifest.json")
MANIFEST_PY = os.path.join(HERE, "narration_manifest.py")   # V1.0.0：清单导出统一用纯 Python 版（mjs 版已删除）

# 默认音色：中文男声（自然播报），与页面默认模板“男播音”对应
DEFAULT_VOICE = "zh-CN-YunxiNeural"
DEFAULT_RATE = "-5%"
DEFAULT_VOLUME = "+0%"


def find_node():
    """定位 node 可执行文件（PATH 优先，其次 WorkBuddy 隔离运行时）"""
    cands = [
        shutil.which("node"),
        r"C:\Users\2405064\.workbuddy\binaries\node\versions\22.22.2-3\node.exe",
    ]
    for cand in cands:
        if not cand:
            continue
        if os.path.isabs(cand):
            if os.path.exists(cand):
                return cand
        elif shutil.which(cand):
            return cand
    return None


def ensure_manifest(quiet=False):
    """确保清单存在；不存在时调用同目录 narration_manifest.py 导出（纯 Python）"""
    if os.path.exists(MANIFEST):
        return True
    py = sys.executable or "python"
    if not quiet:
        print("清单不存在，正在调用 tools/narration_manifest.py 导出 …")
    r = subprocess.run([py, MANIFEST_PY], cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(MANIFEST):
        print("导出清单失败：\n" + (r.stderr or r.stdout or ""))
        return False
    return True


async def synth_one(edge_tts, sem, item, voice, rate, volume, force, out_root, results):
    """合成单条音频（带并发信号量与重试）"""
    rel = item["file"].replace("/", os.sep)
    out_path = os.path.join(out_root, rel)
    if os.path.exists(out_path) and not force:
        results.append((item, "skip", os.path.getsize(out_path)))
        return
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    async with sem:
        last_err = None
        for attempt in (1, 2, 3):
            tmp = out_path + ".part"
            try:
                comm = edge_tts.Communicate(item["text"], voice, rate=rate, volume=volume)
                try:
                    await comm.save(tmp)                     # edge-tts 7.x
                except AttributeError:                        # 兼容旧版本：手动写流
                    with open(tmp, "wb") as f:
                        async for chunk in comm.stream():
                            if chunk.get("type") == "audio":
                                f.write(chunk["data"])
                if not os.path.exists(tmp) or os.path.getsize(tmp) < 512:
                    raise RuntimeError("生成的音频过小，可能被服务端拒绝")
                os.replace(tmp, out_path)
                results.append((item, "ok", os.path.getsize(out_path)))
                print("  [OK ] %-42s %6.1f KB" % (item["file"], os.path.getsize(out_path) / 1024))
                return
            except Exception as e:                            # noqa: BLE001
                last_err = e
                if os.path.exists(tmp):
                    try:
                        os.remove(tmp)
                    except OSError:
                        pass
                if attempt < 3:
                    await asyncio.sleep(1.5 * attempt)        # 网络抖动重试
        results.append((item, "fail", 0))
        print("  [FAIL] %-42s %s" % (item["file"], last_err))


async def run(args):
    try:
        import edge_tts
    except ImportError:
        print("缺少 edge-tts。请先执行：pip install edge-tts")
        return 2

    with open(MANIFEST, encoding="utf-8") as f:
        manifest = json.load(f)

    items = manifest["files"]
    if args.only:
        items = [it for it in items if it["pdfId"] == args.only]
        if not items:
            print("没有匹配 --only=%s 的条目。" % args.only)
            return 2

    print("=" * 62)
    print("音色：%s   语速：%s   音量：%s" % (args.voice, args.rate, args.volume))
    print("待处理条目：%d（--force=%s）" % (len(items), args.force))
    print("=" * 62)
    if args.list:
        for it in items:
            print("  %s\n      %s" % (it["file"], it["text"]))
        return 0

    sem = asyncio.Semaphore(max(1, args.concurrency))
    results = []
    await asyncio.gather(*[
        synth_one(edge_tts, sem, it, args.voice, args.rate, args.volume,
                  args.force, ROOT, results)
        for it in items
    ])

    ok = sum(1 for _, s, _ in results if s == "ok")
    skip = sum(1 for _, s, _ in results if s == "skip")
    fail = sum(1 for _, s, _ in results if s == "fail")
    total_kb = sum(sz for _, _, sz in results) / 1024

    # 把生成信息写回清单，便于追溯
    manifest["voice"] = args.voice
    manifest["rate"] = args.rate
    manifest["volume"] = args.volume
    manifest["generatedCount"] = {"ok": ok, "skip": skip, "fail": fail}
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print("=" * 62)
    print("生成完成：成功 %d / 跳过 %d / 失败 %d，本次涉及音频共 %.1f KB" % (ok, skip, fail, total_kb))
    if fail:
        print("提示：失败条目可重跑本脚本（已存在的会自动跳过），或检查网络后重试。")
    print("输出目录：" + os.path.join("file", "voice"))
    return 1 if fail else 0


def main():
    p = argparse.ArgumentParser(description="pdf_narrator 解说音频批量合成（edge-tts）")
    p.add_argument("--voice", default=DEFAULT_VOICE, help="音色（默认 %s）" % DEFAULT_VOICE)
    p.add_argument("--rate", default=DEFAULT_RATE, help="语速，如 -5%% / +10%%（默认 %s）" % DEFAULT_RATE)
    p.add_argument("--volume", default=DEFAULT_VOLUME, help="音量，如 +0%%（默认 %s）" % DEFAULT_VOLUME)
    p.add_argument("--force", action="store_true", help="已存在的音频也重新生成")
    p.add_argument("--only", default="", help="只生成指定 pdfId 的条目")
    p.add_argument("--concurrency", type=int, default=4, help="并发数（默认 4）")
    p.add_argument("--list", action="store_true", help="只列出将生成的文件，不实际合成")
    args = p.parse_args()

    if not ensure_manifest():
        return 2
    try:
        return asyncio.run(run(args))
    except KeyboardInterrupt:
        print("\n已中断。已生成的音频保留，可重跑脚本继续。")
        return 130


if __name__ == "__main__":
    sys.exit(main())
