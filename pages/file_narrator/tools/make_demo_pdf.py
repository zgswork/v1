# -*- coding: utf-8 -*-
"""生成演示用多页 PDF（5 页），纯 Python 无第三方依赖。"""
import os

PAGE_W, PAGE_H = 595, 842  # A4 (pt)

pages_content = [
    ("LED Display Structure Design", "Chapter 1: Overview",
     ["This is a demo document for the PDF narrator webpage.",
      "Each blue dot on the page is a narration hotspot.",
      "Move your mouse over a dot to see a popup and",
      "hear the voice narration. Touch works on mobile."]),
    ("Module Layout Rules", "Chapter 2: Module Grid",
     ["LED modules are arranged in a grid of columns and rows.",
      "Standard module sizes: 320x160 mm, 256x128 mm.",
      "Pitch options: P2.5, P3, P4, P5, P6, P8, P10.",
      "Cabinet size = module size x count per row / column."]),
    ("Steel Structure Basics", "Chapter 3: Steel Frame",
     ["Frame weight per meter = section area (mm2) x 0.00785 kg/m.",
      "Common sections: 40*20*2 square tube, 50*50*3 angle bar.",
      "Slenderness ratio lambda default = 150, mu = 1, Q235.",
      "Welding and bolting rules follow GB standards."]),
    ("Power and Cabling", "Chapter 4: Electrical",
     ["Power budget: peak power = area x max W/m2.",
      "Wire gauge selection depends on voltage, length and load.",
      "Common cables: YJV for fixed wiring, RVV for flexible.",
      "Always keep 20% spare capacity in power design."]),
    ("Summary", "Chapter 5: Wrap-up",
     ["This is the last page of the demo PDF.",
      "Hotspot positions are defined in js/narration_data.js.",
      "You can add, edit or remove hotspots there easily.",
      "Auto page-turn and voice templates are in the toolbar."]),
]

objs = {}
obj_num = 1
font_r = obj_num; objs[obj_num] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"; obj_num += 1
font_b = obj_num; objs[obj_num] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"; obj_num += 1

page_ids = []
content_ids = []
for title, chapter, lines in pages_content:
    content_ids.append(obj_num); obj_num += 1
    page_ids.append(obj_num); obj_num += 1

pages_id = obj_num; obj_num += 1
catalog_id = obj_num; obj_num += 1

for i, (title, chapter, lines) in enumerate(pages_content):
    esc = lambda s: s.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
    ops = []
    ops.append("0.96 0.97 1.0 rg 0 0 %d %d re f" % (PAGE_W, PAGE_H))
    ops.append("0.85 0.87 0.95 rg 0 %d %d 46 re f" % (PAGE_H - 46, PAGE_W))
    ops.append("BT /F2 22 Tf 0.1 0.15 0.35 rg 50 %d Td (%s) Tj ET" % (PAGE_H - 90, esc(title)))
    ops.append("BT /F1 12 Tf 0.3 0.35 0.5 rg 50 %d Td (%s) Tj ET" % (PAGE_H - 115, esc(chapter)))
    ops.append("0.2 0.5 0.9 RG 3 w 50 %d m 545 %d l S" % (PAGE_H - 125, PAGE_H - 125))
    y = PAGE_H - 170
    for ln in lines:
        ops.append("BT /F1 13 Tf 0.15 0.15 0.2 rg 60 %d Td (%s) Tj ET" % (y, esc(ln)))
        y -= 26
    ops.append("BT /F1 10 Tf 0.5 0.5 0.55 rg 50 40 Td (Demo PDF - Page %d / %d) Tj ET" % (i + 1, len(pages_content)))
    stream = ("\n".join(ops)).encode("latin-1")
    objs[content_ids[i]] = b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream)
    objs[page_ids[i]] = ("<< /Type /Page /Parent %d 0 R /MediaBox [0 0 %d %d] "
                         "/Resources << /Font << /F1 %d 0 R /F2 %d 0 R >> >> /Contents %d 0 R >>"
                         % (pages_id, PAGE_W, PAGE_H, font_r, font_b, content_ids[i])).encode("latin-1")

kids = " ".join("%d 0 R" % pid for pid in page_ids)
objs[pages_id] = ("<< /Type /Pages /Kids [%s] /Count %d >>" % (kids, len(page_ids))).encode("latin-1")
objs[catalog_id] = ("<< /Type /Catalog /Pages %d 0 R >>" % pages_id).encode("latin-1")

out = bytearray()
out += b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
offsets = {}
for n in sorted(objs):
    offsets[n] = len(out)
    out += b"%d 0 obj\n" % n
    out += objs[n]
    out += b"\nendobj\n"
xref_pos = len(out)
out += b"xref\n0 %d\n" % (obj_num)
out += b"0000000000 65535 f \n"
for n in sorted(objs):
    out += b"%010d 00000 n \n" % offsets[n]
out += b"trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (obj_num, catalog_id, xref_pos)

dst = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "file", "demo.pdf")
with open(dst, "wb") as f:
    f.write(bytes(out))
print("OK:", dst, len(out), "bytes")
