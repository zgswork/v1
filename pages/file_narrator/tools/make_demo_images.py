# -*- coding: utf-8 -*-
"""
pdf_narrator 图片解说示例 —— 示意图生成脚本（纯 Python，零依赖）
============================================================
作用：生成两张"屏体示意图"PNG，供 js/narration_data.js 里的**图片类型条目**
      （type: "image"）作演示数据，页面效果与 PDF 条目完全一致（触点、弹窗、语音、巡讲、离线音频）。

产出（写入 file/）：
    demo-screen-front.png   屏体正立面示意（模组网格 + 横向/纵向尺寸标注）
    demo-screen-side.png    屏体侧立面示意（墙体 / 背杆 / 屏体 与离墙距离标注）

用法（在项目目录下执行）：
    python tools/make_demo_images.py

说明：
· 只用标准库 zlib 手写 PNG（灰蓝底 + 几何图形 + 七段数字），不引入 Pillow 等依赖；
· 画完会在控制台打印各标注元素的**页面比例坐标**（x/宽, y/高），
  填到 narration_data.js 时用「比例坐标 − basePoint」即得触点偏移量；
· 图片尺寸固定 1280×720（生成后不再改），改图形只需改本脚本后重新生成。
"""

import os
import struct
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ASSETS = os.path.join(ROOT, "file")

W, H = 1280, 720                      # 画布尺寸（固定）
BG = (15, 23, 42)                     # 背景：深蓝灰
GRID = (51, 65, 85)                   # 网格线
FRAME = (56, 189, 248)                # 屏体边框（亮蓝）
DIM = (148, 163, 184)                 # 标注线与数字
HILIGHT = (250, 204, 21)              # 强调色（黄）
WALL = (71, 85, 105)                  # 墙体
BODY = (30, 41, 59)                   # 实体填充


# ---------------------------------------------------------------- 基础画布

class Canvas(object):
    def __init__(self, w, h, bg):
        self.w, self.h = w, h
        self.px = bytearray(bg * (w * h))

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            i = (y * self.w + x) * 3
            self.px[i:i + 3] = bytes(c)

    def rect(self, x, y, w, h, c):
        """实心矩形（自动裁剪到画布内）"""
        x0, y0 = max(0, int(x)), max(0, int(y))
        x1, y1 = min(self.w, int(x + w)), min(self.h, int(y + h))
        if x1 <= x0 or y1 <= y0:
            return
        row = bytes(c) * (x1 - x0)
        for yy in range(y0, y1):
            i = (yy * self.w + x0) * 3
            self.px[i:i + (x1 - x0) * 3] = row

    def frame(self, x, y, w, h, c, t=2):
        """空心矩形边框"""
        self.rect(x, y, w, t, c)
        self.rect(x, y + h - t, w, t, c)
        self.rect(x, y, t, h, c)
        self.rect(x + w - t, y, t, h, c)

    def hline(self, x0, x1, y, c, t=1):
        self.rect(min(x0, x1), y, abs(x1 - x0) + 1, t, c)

    def vline(self, x, y0, y1, c, t=1):
        self.rect(x, min(y0, y1), t, abs(y1 - y0) + 1, c)

    def arrow(self, x, y, direction, c, size=12):
        """箭头的三角近似（direction: 'l' / 'r' / 'u' / 'd'）"""
        for i in range(size):
            k = size - i
            if direction == "l":
                self.rect(x + i, y - k // 2, 1, k, c)
            elif direction == "r":
                self.rect(x - i, y - k // 2, 1, k, c)
            elif direction == "u":
                self.rect(x - k // 2, y + i, k, 1, c)
            else:
                self.rect(x - k // 2, y - i, k, 1, c)


# ---------------------------------------------------------------- 七段数字

SEG = {   # 段序：a 上 / b 右上 / c 右下 / d 下 / e 左下 / f 左上 / g 中
    "0": (1, 1, 1, 1, 1, 1, 0), "1": (0, 1, 1, 0, 0, 0, 0),
    "2": (1, 1, 0, 1, 1, 0, 1), "3": (1, 1, 1, 1, 0, 0, 1),
    "4": (0, 1, 1, 0, 0, 1, 1), "5": (1, 0, 1, 1, 0, 1, 1),
    "6": (1, 0, 1, 1, 1, 1, 1), "7": (1, 1, 1, 0, 0, 0, 0),
    "8": (1, 1, 1, 1, 1, 1, 1), "9": (1, 1, 1, 1, 0, 1, 1),
}


def digit_width(h):
    return int(h * 0.58)


def draw_digit(cv, x, y, h, ch, color):
    """画一个七段数字（ch 为 '0'~'9'，其余字符忽略）"""
    if ch not in SEG:
        return digit_width(h)
    t = max(3, h // 8)
    w = digit_width(h)
    half = (h - t) // 2
    a, b, c, d, e, f, g = SEG[ch]
    if a:
        cv.rect(x + t, y, w - 2 * t, t, color)
    if f:
        cv.rect(x, y + t, t, half, color)
    if b:
        cv.rect(x + w - t, y + t, t, half, color)
    if g:
        cv.rect(x + t, y + t + half, w - 2 * t, t, color)
    if e:
        cv.rect(x, y + t + half, t, half, color)
    if c:
        cv.rect(x + w - t, y + t + half, t, half, color)
    if d:
        cv.rect(x + t, y + h - t, w - 2 * t, t, color)
    return w


def draw_number(cv, x, y, h, text, color, gap=None, dot=False):
    """画一串七段数字，支持 '.'（小数点）与 '-'（分隔线）"""
    gap = gap if gap is not None else max(4, h // 5)
    cx = x
    for ch in text:
        if ch == ".":
            cv.rect(cx, y + h - max(4, h // 6), max(4, h // 6), max(4, h // 6), color)
            cx += max(4, h // 6) + gap
        elif ch == "-":
            cv.rect(cx, y + h // 2, max(6, h // 3), max(3, h // 10), color)
            cx += max(6, h // 3) + gap
        else:
            cx += draw_digit(cv, cx, y, h, ch, color) + gap
    return cx - x


def number_width(h, text, gap=None):
    """预估七段数字串的宽度（用于居中）"""
    gap = gap if gap is not None else max(4, h // 5)
    total = 0
    for ch in text:
        if ch == ".":
            total += max(4, h // 6) + gap
        elif ch == "-":
            total += max(6, h // 3) + gap
        else:
            total += digit_width(h) + gap
    return total - gap


# ---------------------------------------------------------------- 3×7 点阵字母

FONT37 = {
    "L": ["100", "100", "100", "100", "100", "100", "111"],
    "E": ["111", "100", "100", "111", "100", "100", "111"],
    "D": ["110", "101", "101", "101", "101", "101", "110"],
}


def text_width(scale, text):
    return len(text) * 4 * scale


def draw_text37(cv, x, y, scale, text, color):
    """画 3×7 点阵大写字母（当前字库只有 L / E / D，用于 "LED" 字样）"""
    cx = x
    for ch in text.upper():
        pat = FONT37.get(ch)
        if pat:
            for r, row in enumerate(pat):
                for c, bit in enumerate(row):
                    if bit == "1":
                        cv.rect(cx + c * scale, y + r * scale, scale, scale, color)
        cx += 4 * scale


# ---------------------------------------------------------------- PNG 输出

def save_png(path, cv):
    raw = bytearray()
    stride = cv.w * 3
    for y in range(cv.h):
        raw.append(0)                                # 每行滤波类型 0（None）
        raw.extend(cv.px[y * stride:(y + 1) * stride])

    def chunk(typ, data):
        return (struct.pack(">I", len(data)) + typ + data +
                struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF))

    png = (b"\x89PNG\r\n\x1a\n" +
           chunk(b"IHDR", struct.pack(">IIBBBBB", cv.w, cv.h, 8, 2, 0, 0, 0)) +
           chunk(b"IDAT", zlib.compress(bytes(raw), 9)) +
           chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)
    return len(png)


# ---------------------------------------------------------------- 标注定位线

MARKS = []          # [(说明, x, y)] —— 收集各标注元素中心，最后换算比例坐标打印


def mark(label, x, y):
    MARKS.append((label, x, y))


# ---------------------------------------------------------------- 图一：正立面

def make_front(path):
    cv = Canvas(W, H, BG)
    x0, y0, x1, y1 = 200, 120, 1080, 620          # 屏体区域（880×500）

    # 屏体底与边框
    cv.rect(x0, y0, x1 - x0, y1 - y0, BODY)
    cols, rows = 12, 8
    for i in range(1, cols):
        cv.vline(x0 + (x1 - x0) * i // cols, y0, y1, GRID, 1)
    for j in range(1, rows):
        cv.hline(x0, x1, y0 + (y1 - y0) * j // rows, GRID, 1)
    cv.frame(x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6, FRAME, 3)

    # 顶部横向尺寸标注（带端箭头）
    yd = 70
    cv.hline(x0 - 3, x1 + 3, yd, DIM, 2)
    cv.vline(x0 - 3, yd - 8, yd + 8, DIM, 2)
    cv.vline(x1 + 3, yd - 8, yd + 8, DIM, 2)
    cv.hline(x0 - 3, x0 + 26, yd, HILIGHT, 3)
    cv.hline(x1 - 26, x1 + 3, yd, HILIGHT, 3)
    num = "2560"
    nh = 26
    draw_number(cv, (x0 + x1) // 2 - number_width(nh, num) // 2, 34, nh, num, DIM)

    # 左侧纵向尺寸标注
    xd = 140
    cv.vline(xd, y0 - 3, y1 + 3, DIM, 2)
    cv.hline(xd - 8, xd + 8, y0 - 3, DIM, 2)
    cv.hline(xd - 8, xd + 8, y1 + 3, DIM, 2)
    cv.vline(xd, y0 - 3, y0 + 26, HILIGHT, 3)
    cv.vline(xd, y1 - 26, y1 + 3, HILIGHT, 3)
    num2 = "1440"
    nh2 = 22
    cv.rect(xd - number_width(nh2, num2) - 16, (y0 + y1) // 2 - nh2 // 2 - 6,
            number_width(nh2, num2) + 10, nh2 + 12, BG)      # 让数字压在标注线之上
    draw_number(cv, xd - number_width(nh2, num2) - 12, (y0 + y1) // 2 - nh2 // 2, nh2, num2, DIM)

    # 左下：模组规格"320-160" + 一个高亮小方块示意模组单元
    cell_w = (x1 - x0) // cols
    cell_h = (y1 - y0) // rows
    cv.frame(x0, y0, cell_w, cell_h, HILIGHT, 2)             # 左上第一块模组高亮
    num3 = "320-160"
    nh3 = 22
    draw_number(cv, 230, 660, nh3, num3, HILIGHT)
    mark("模组高亮块（左上第一个模组）", x0 + cell_w // 2, y0 + cell_h // 2)
    mark("模组规格数字 320-160", 230 + number_width(nh3, num3) // 2, 660 + nh3 // 2)

    # 右下：LED 字样 + 点间距 2.5
    tw = text_width(6, "LED")
    draw_text37(cv, 990, 676, 6, "LED", FRAME)
    num4 = "2.5"
    nh4 = 22
    draw_number(cv, 990 + tw + 16, 672, nh4, num4, DIM)
    mark("LED 字样与点间距 2.5", 990 + tw // 2 + 30, 672 + nh4 // 2)

    # 屏体中心
    mark("屏体区域中心", (x0 + x1) // 2, (y0 + y1) // 2)
    mark("顶部横向尺寸标注 2560", (x0 + x1) // 2, yd)
    mark("左侧纵向尺寸标注 1440", xd, (y0 + y1) // 2)

    return save_png(path, cv)


# ---------------------------------------------------------------- 图二：侧立面

def make_side(path):
    cv = Canvas(W, H, BG)
    SX = 250                                       # 整体右移，使构图居中

    # 墙体（左侧带纹理）
    wx0, wx1 = 120 + SX, 220 + SX
    cv.rect(wx0, 60, wx1 - wx0, 600, WALL)
    for i in range(60, 660, 18):
        cv.hline(wx0, wx1, i, BG, 1)
    cv.rect(wx1 - 8, 60, 8, 600, (100, 116, 139))

    # 背杆（两根横杆 + 立柱连接）
    bx0, bx1 = wx1, 300 + SX
    for cy in (200, 430):
        cv.rect(bx0, cy, bx1 - bx0, 22, (203, 213, 225))
        cv.frame(bx0, cy, bx1 - bx0, 22, (148, 163, 184), 2)
    cv.rect(bx1 - 8, 190, 16, 270, (148, 163, 184))

    # 屏体（侧视：一块薄板）
    sx0, sx1 = 300 + SX, 372 + SX
    cv.rect(sx0, 110, sx1 - sx0, 500, BODY)
    cv.frame(sx0 - 3, 110 - 3, sx1 - sx0 + 6, 500 + 6, FRAME, 3)
    # 屏体表面（面向观众的一侧）
    cv.rect(sx1 - 10, 110, 10, 500, (30, 64, 175))

    # 顶部：屏体厚度标注 80
    yd = 60
    cv.hline(sx0, sx1, yd, DIM, 2)
    cv.vline(sx0, yd - 8, yd + 8, DIM, 2)
    cv.vline(sx1, yd - 8, yd + 8, DIM, 2)
    num = "80"
    nh = 24
    draw_number(cv, (sx0 + sx1) // 2 - number_width(nh, num) // 2, 24, nh, num, DIM)

    # 底部：离墙距离标注 120（墙体右面 → 屏体背面）
    yd2 = 640
    cv.hline(wx1 - 8, sx0, yd2, DIM, 2)
    cv.vline(wx1 - 8, yd2 - 8, yd2 + 8, DIM, 2)
    cv.vline(sx0, yd2 - 8, yd2 + 8, DIM, 2)
    cv.hline(wx1 - 8, wx1 + 26, yd2, HILIGHT, 3)
    cv.hline(sx0 - 26, sx0, yd2, HILIGHT, 3)
    num2 = "120"
    nh2 = 22
    draw_number(cv, (wx1 + sx0) // 2 + 4, yd2 + 16, nh2, num2, HILIGHT)

    # 右下：LED 字样
    draw_text37(cv, 1000, 300, 6, "LED", FRAME)

    mark("墙体（结构面）", (wx0 + wx1) // 2, 360)
    mark("背杆（立柱连接件）", (bx0 + bx1) // 2, 211)
    mark("屏体侧视（厚度方向）", (sx0 + sx1) // 2, 360)
    mark("屏体面向观众的一侧", sx1 - 5, 360)
    mark("顶部厚度标注 80", (sx0 + sx1) // 2, yd)
    mark("底部离墙距离标注 120", (wx1 + sx0) // 2, yd2)
    mark("LED 字样", 1030, 310)

    return save_png(path, cv)


# ---------------------------------------------------------------- 入口

def main():
    if not os.path.isdir(ASSETS):
        os.makedirs(ASSETS, exist_ok=True)
    front = os.path.join(ASSETS, "demo-screen-front.png")
    side = os.path.join(ASSETS, "demo-screen-side.png")

    print("=" * 64)
    size1 = make_front(front)
    print("已生成：file/demo-screen-front.png   （%d×%d，%.1f KB）"
          % (W, H, size1 / 1024.0))
    for label, x, y in MARKS:
        print("   %-24s 比例坐标 x=%.3f  y=%.3f   → 相对中心偏移 x=%+.3f  y=%+.3f"
              % (label, x / W, y / H, x / W - 0.5, y / H - 0.5))

    MARKS.clear()
    print("-" * 64)
    size2 = make_side(side)
    print("已生成：file/demo-screen-side.png    （%d×%d，%.1f KB）"
          % (W, H, size2 / 1024.0))
    for label, x, y in MARKS:
        print("   %-24s 比例坐标 x=%.3f  y=%.3f   → 相对中心偏移 x=%+.3f  y=%+.3f"
              % (label, x / W, y / H, x / W - 0.5, y / H - 0.5))
    print("=" * 64)
    print("把上面的偏移量填进 js/narration_data.js 的图片条目 hotspots（basePoint = 中心 0.5,0.5）。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
