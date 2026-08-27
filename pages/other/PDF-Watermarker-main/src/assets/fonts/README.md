# 水印中文字体

- `heiti.ttf` — 黑体，来自 **Noto Sans SC**
- `songti.ttf` — 宋体，来自 **Noto Serif SC**

授权：SIL Open Font License 1.1（可自由嵌入/商用）。

## 为什么是这样处理的（重要）

水印文字用 `pdf-lib` 嵌入。**不能用 `pdf-lib` 自带的 `subset: true`**：它对大型 CJK 字体（尤其 CFF/OTF 轮廓）的子集化会损坏字形，生成的 PDF 在 WPS 能显示，但在 Chrome/PDFium、系统预览、打印时水印不显示或错位。

因此采用的方案：
1. 使用 **glyf 轮廓的 TrueType** 字体（不是 CFF 的 .otf）。
2. **预先**用 fonttools 把字体裁剪到 GB2312 + ASCII + 常用标点（覆盖几乎所有水印文本），把体积从 ~8–12MB 降到 ~2–3MB。
3. 引擎用 **`subset: false`** 整体嵌入这份预子集字体，完全绕开 pdf-lib 的子集器。

输出 PDF 约 1.5–2MB（字体只嵌一次，与页数无关），在所有阅读器和打印中都能正确显示。

## 如何重新生成 / 更新字体

需要 `fonttools`（`python3 -m pip install fonttools`）。

```bash
# 1. 下载 Noto Sans/Serif SC 变量 TTF（glyf 轮廓）
curl -L -o /tmp/notosc.ttf    "https://github.com/google/fonts/raw/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf"
curl -L -o /tmp/notoserifsc.ttf "https://github.com/google/fonts/raw/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf"

# 2. 实例化为 Regular（wght=400）静态字体
python3 -m fontTools.varLib.instancer /tmp/notosc.ttf    wght=400 --update-name-table -o /tmp/heiti-reg.ttf
python3 -m fontTools.varLib.instancer /tmp/notoserifsc.ttf wght=400 --update-name-table -o /tmp/songti-reg.ttf

# 3. 裁剪到 GB2312 + ASCII + 标点（charset 见 scripts/build-fonts，约 7700 字）
#    pyftsubset <in> --text-file=charset.txt --layout-features='*' --no-hinting --desubroutinize --output-file=<out>
```

字符集构造：ASCII(0x20–0x7E) + CJK 标点(0x3000–0x303F) + 全角(0xFF00–0xFFEF) + GB2312 一二级汉字。
