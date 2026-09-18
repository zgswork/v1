# -*- coding: utf-8 -*-
"""生成「内容解说」页的示例素材（纯 Python 标准库，零依赖）
================--------------------------------------------
产出（全部写入 ../file/）：
    demo-notes.txt      施工要点（3 页，用 \\f 换页符显式分页）
    demo-report.docx    施工方案 Word 文档（3 页，用分页符显式分页）
    demo-slides.pptx    技术交底 PPT（3 张幻灯片）
    demo-plan.dxf       钢结构正立面示意 DXF（1 页，含块参照 / 圆 / 文字）

用法：
    python tools/make_demo_docs.py            # 生成全部
    python tools/make_demo_docs.py --list     # 只列出将生成的文件

说明：
    · docx / pptx 都是 ZIP 包，这里用 zipfile 手写「最小可用包」，
      正好可以验证网页端 js/loaders.js 自写的 ZIP 解包 + inflate 解析链路。
    · DXF 用文本型（ASCII DXF，AC1015）书写，包含 LINE / LWPOLYLINE /
      CIRCLE / ARC / TEXT / BLOCK+INSERT 等常见实体，
      用来验证网页端的 DXF 解析与绘制。
    · 换页/幻灯片的划分是显式写死的，因此页数与 js/narration_data.js 里
      配置的触点页数严格一一对应。
"""

import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, os.pardir, "file")


# ================--------------------------------------------
# 工具
# ================--------------------------------------------
def esc(s):
    """XML 转义"""
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def write_bytes(name, data):
    path = os.path.abspath(os.path.join(ASSETS, name))
    with open(path, "wb") as f:
        f.write(data)
    return path, len(data)


def write_text(name, text):
    return write_bytes(name, text.replace("\n", "\r\n").encode("utf-8"))


def write_zip(name, members):
    """members: [(条目名, 文本内容)] —— 全部用 deflate 压缩（走真实压缩路径）"""
    path = os.path.abspath(os.path.join(ASSETS, name))
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for entry, content in members:
            z.writestr(entry, content.encode("utf-8"))
    return path, os.path.getsize(path)


# ================--------------------------------------------
# 一、TXT：施工要点（3 页，\f 显式分页）
# ================--------------------------------------------
NOTES = """施工要点（一）安装准备
--------------------------------------------
一、进场条件
1. 墙体或钢结构基层应已完成验收，预埋件、锚栓位置偏差不大于 10 毫米。
2. 现场实测净空尺寸，与图纸尺寸核对无误后方可下料，严禁按图纸尺寸直接下料。
3. 屏体安装前应复核供电容量与接地电阻，接地电阻应小于 4 欧姆。

二、材料核对
1. 主体杆件采用 40 乘 20 乘 2 毫米方管，按精确截面计算延米重约 1.76 千克每米。
2. 立柱型钢规格 150 乘 150 乘 8，用于立柱与底座的连接节点。
3. 紧固件、挂件、包边材料按图纸清单逐一核对，缺件应及时补齐。

三、工具准备
1. 激光水平仪、靠尺、卷尺、力矩扳手、电锤、切割机、角磨机。
2. 高处作业须搭设脚手架或使用合规的高空作业平台。
"""

NOTES += """\f""" + """施工要点（二）安装工艺
--------------------------------------------
一、放线定位
1. 以墙体轴线为基准放出屏体中心线，用激光水平仪投出屏体上沿与下沿。
2. 找出屏体四角位置，用记号笔标注，并用十字线复测对角线误差。

二、背杆安装
1. 背杆正面须与托杆水平面保持垂直，垂直度偏差每米不大于 1 毫米。
2. 屏体底部通长找平托杆每米水平误差不超过 0.15 毫米。
3. 背杆与墙体锚栓连接处应加设平垫与弹垫，力矩按锚栓规格执行。

三、屏体拼装
1. 模组按 12 列 8 行排布，单块模组尺寸 320 乘 160 毫米。
2. 自下而上、自中间向两侧拼装，拼缝误差累计不得超过 0.5 毫米。
3. 拼装过程中随时用靠尺检查屏面平整度，平整度偏差不大于 0.5 毫米。

四、包边与收口
1. 装饰包边材料与颜色以客户确认为准，实际尺寸以现场实测为准。
2. 包边与屏体的缝隙应均匀，误差不超过 1 毫米。
"""

NOTES += """\f""" + """施工要点（三）验收与维护
--------------------------------------------
一、通电调试
1. 上电前用兆欧表检测屏体与钢结构之间绝缘电阻，应大于 2 兆欧。
2. 分级上电：先配电箱，再屏体主电，最后点亮测试。
3. 逐块检查模组亮暗线、色差，发现问题记录位置并更换。

二、结构复检
1. 复核立柱长细比：默认限值 150，计算长度系数取 1，材料 Q235。
2. 复核焊缝外观质量与螺栓紧固力矩，并做好记录。
3. 检查屏体与背杆连接件的防松措施是否到位。

三、验收资料
1. 钢结构材料合格证、型钢材质单。
2. 隐蔽工程验收记录、焊缝外观检查记录。
3. 通电测试记录与最终验收单。

四、后期维护
1. 每半年检查一次紧固件是否松动，特别是背杆与墙体连接处。
2. 每年检查一次防腐涂层，发现锈蚀应及时除锈补漆。
3. 屏体前维护需预留正面操作空间，维护前务必断电。
"""


# ================--------------------------------------------
# 二、DOCX：施工方案（3 页，分页符）
# ================--------------------------------------------
DOCX_CT = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>"""

DOCX_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>"""


def docx_para(text, style="", page_break=False):
    """生成一个 w:p 段落；style 可为 Heading1 / Heading2"""
    out = ["<w:p>"]
    if style:
        out.append('<w:pPr><w:pStyle w:val="%s"/></w:pPr>' % style)
    if page_break:
        out.append('<w:r><w:br w:type="page"/></w:r>')
    if text:
        out.append('<w:r><w:t xml:space="preserve">%s</w:t></w:r>' % esc(text))
    out.append("</w:p>")
    return "".join(out)


def build_docx():
    body = []
    # ---- 第 1 页 ----
    body.append(docx_para("LED 显示屏钢结构施工方案", "Heading1"))
    body.append(docx_para("一、工程概况"))
    for t in [
        "本工程为室内壁挂前维护 LED 显示屏钢结构，屏体尺寸 2560 乘 1440 毫米，",
        "由 320 乘 160 毫米模组按 12 列 8 行拼装，显示面积 3.6864 平方米。",
        "屏体安装背杆正面须与托杆水平面垂直，屏体底部通长找平托杆每米水平误差",
        "不超过 0.15 毫米。",
    ]:
        body.append(docx_para(t))
    body.append(docx_para("二、编制依据"))
    for t in [
        "1. 建设单位提供的建筑施工图与结构图；",
        "2. 现行钢结构工程施工质量验收规范；",
        "3. 现场实测的净空尺寸与基层验收记录。",
    ]:
        body.append(docx_para(t))

    # ---- 第 2 页 ----
    body.append(docx_para("三、主体材料与计算", "Heading2", page_break=True))
    for t in [
        "1. 主体横竖杆件：40 乘 20 乘 2 毫米方管。",
        "   延米重 = 截面积 × 0.00785，精确截面积约 224 平方毫米，",
        "   即每米约 1.76 千克。",
        "2. 立柱连接节点：150 乘 150 乘 8 型钢。",
        "   长细比 λ 默认取 150，计算长度系数 μ 取 1，材料 Q235。",
        "3. 挂件与锚栓按现场墙体材质选型，锚栓边距不小于 5 倍直径。",
    ]:
        body.append(docx_para(t))
    body.append(docx_para("四、施工工序", "Heading2"))
    for t in [
        "第一步：现场放线，确定屏体中心线与上下沿标高。",
        "第二步：安装背杆，校正垂直度后固定锚栓。",
        "第三步：拼装屏体，自下而上、自中间向两侧推进。",
        "第四步：安装装饰包边，控制缝隙均匀。",
        "第五步：通电调试与结构复检，整理验收资料。",
    ]:
        body.append(docx_para(t))

    # ---- 第 3 页 ----
    body.append(docx_para("五、质量控制要点", "Heading2", page_break=True))
    for t in [
        "1. 螺栓紧固力矩按规格执行，紧固后做防松标记；",
        "2. 屏面平整度偏差不大于 0.5 毫米，拼缝误差累计不超过 0.5 毫米；",
        "3. 屏体与钢结构之间绝缘电阻应大于 2 兆欧；",
        "4. 接地电阻小于 4 欧姆，接地干线连续可靠。",
    ]:
        body.append(docx_para(t))
    body.append(docx_para("六、安全与文明施工"))
    for t in [
        "高处作业须系挂安全带并搭设合规平台；动火作业须办理动火证；",
        "现场材料分类码放，做到工完料尽场地清。",
    ]:
        body.append(docx_para(t))

    xml = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
           '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
           "<w:body>" + "".join(body) + "<w:sectPr/></w:body></w:document>")
    return [
        ("[Content_Types].xml", DOCX_CT),
        ("_rels/.rels", DOCX_RELS),
        ("word/document.xml", xml),
    ]


# ================--------------------------------------------
# 三、PPTX：技术交底（3 张幻灯片）
# ================--------------------------------------------
PPTX_CT_HEAD = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>"""

PPTX_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>"""

PPTX_PRES_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">%s</Relationships>"""

PPTX_MASTER = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:sldMaster>"""

PPTX_LAYOUT = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="空白"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>"""


def pptx_sp(texts, title=True):
    """一个文本框形状；第 1 段作标题（带标题占位符）"""
    paras = []
    for i, t in enumerate(texts):
        paras.append("<a:p><a:r><a:rPr lang=\"zh-CN\"/><a:t>%s</a:t></a:r></a:p>" % esc(t))
    ph = ('<p:nvPr><p:ph type="title"/></p:nvPr>' if title
          else '<p:nvPr><p:ph idx="1"/></p:nvPr>')
    return ('<p:sp><p:nvSpPr><p:cNvPr id="2" name="内容"/>'
            '<p:cNvSpPr txBox="1"/>' + ph + "</p:nvSpPr>"
            '<p:spPr><a:xfrm><a:off x="838200" y="457200"/><a:ext cx="9144000" cy="4572000"/></a:xfrm>'
            '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
            "<p:txBody><a:bodyPr/><a:lstStyle/>" + "".join(paras) + "</p:txBody></p:sp>")


def pptx_slide(title, bullets):
    shapes = pptx_sp([title], True)
    if bullets:
        shapes += pptx_sp(bullets, False)
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
            ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
            ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
            '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>'
            "</p:nvGrpSpPr><p:grpSpPr/>" + shapes + "</p:spTree></p:cSld>"
            "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>")


SLIDES = [
    ("LED 显示屏钢结构技术交底",
     ["1. 屏体 2560×1440 毫米，模组 320×160 毫米，12 列 8 行拼装",
      "2. 主体杆件 40×20×2 方管，延米重约 1.76 千克每米",
      "3. 立柱连接节点采用 150×150×8 型钢"]),
    ("安装工艺要点",
     ["1. 背杆正面与托杆水平面垂直，每米偏差不大于 1 毫米",
      "2. 底部通长找平托杆每米水平误差不超过 0.15 毫米",
      "3. 屏面平整度偏差不大于 0.5 毫米，拼缝累计误差不超过 0.5 毫米"]),
    ("检查与验收",
     ["1. 绝缘电阻大于 2 兆欧，接地电阻小于 4 欧姆",
      "2. 长细比限值 150，计算长度系数 1，材料 Q235",
      "3. 资料齐全：材质单、隐蔽验收记录、通电测试记录"]),
]


def build_pptx():
    members = [("[Content_Types].xml", PPTX_CT_HEAD + "".join(
        '<Override PartName="/ppt/slides/slide%d.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' % (i + 1)
        for i in range(len(SLIDES))) + "</Types>"),
        ("_rels/.rels", PPTX_RELS),
        ("ppt/presentation.xml",
         '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
         '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
         ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
         ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
         '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>'
         "<p:sldIdLst>" + "".join(
             '<p:sldId id="%d" r:id="rId%d"/>' % (256 + i, i + 2) for i in range(len(SLIDES)))
         + "</p:sldIdLst>"
         '<p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/>'
         "</p:presentation>"),
        ("ppt/_rels/presentation.xml.rels", PPTX_PRES_RELS % (
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>' +
            "".join('<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide%d.xml"/>' % (i + 2, i + 1) for i in range(len(SLIDES))))),
        ("ppt/slideMasters/slideMaster1.xml", PPTX_MASTER),
        ("ppt/slideLayouts/slideLayout1.xml", PPTX_LAYOUT)]
    for i, (title, bullets) in enumerate(SLIDES):
        members.append(("ppt/slides/slide%d.xml" % (i + 1), pptx_slide(title, bullets)))
    return members


# ================--------------------------------------------
# 四、DXF：钢结构正立面示意（文本型 ASCII DXF，AC1015）
# ================--------------------------------------------
def dxf(*records):
    """把 (code, value) 依次写成 DXF 文本行"""
    lines = []
    for code, value in records:
        lines.append(str(code))
        lines.append(str(value))
    return "\n".join(lines) + "\n"


def g(code, value):
    return [(code, value)]


def ent_line(layer, x1, y1, x2, y2, color=7):
    return dxf(*([(0, "LINE"), (8, layer), (62, color)] +
                 [(10, "%.3f" % x1), (20, "%.3f" % y1), (30, "0.0")] +
                 [(11, "%.3f" % x2), (21, "%.3f" % y2), (31, "0.0")]))


def ent_lwpoly(layer, pts, closed=True, color=7):
    rec = [(0, "LWPOLYLINE"), (8, layer), (62, color), (90, len(pts)), (70, 1 if closed else 0)]
    for x, y in pts:
        rec += [(10, "%.3f" % x), (20, "%.3f" % y)]
    return dxf(*rec)


def ent_circle(layer, cx, cy, r, color=7):
    return dxf(*(g(0, "CIRCLE") + g(8, layer) + g(62, color) +
                 g(10, "%.3f" % cx) + g(20, "%.3f" % cy) + g(30, "0.0") + g(40, "%.3f" % r)))


def ent_arc(layer, cx, cy, r, a0, a1, color=7):
    return dxf(*(g(0, "ARC") + g(8, layer) + g(62, color) +
                 g(10, "%.3f" % cx) + g(20, "%.3f" % cy) + g(30, "0.0") +
                 g(40, "%.3f" % r) + g(50, "%.2f" % a0) + g(51, "%.2f" % a1)))


def ent_text(layer, x, y, h, txt, color=7, rot=0.0):
    return dxf(*(g(0, "TEXT") + g(8, layer) + g(62, color) +
                 g(10, "%.3f" % x) + g(20, "%.3f" % y) + g(30, "0.0") +
                 g(40, "%.2f" % h) + g(1, txt) + g(50, "%.2f" % rot)))


def ent_insert(layer, name, x, y, sx=1.0, sy=1.0, rot=0.0, color=7):
    return dxf(*(g(0, "INSERT") + g(8, layer) + g(62, color) + g(2, name) +
                 g(10, "%.3f" % x) + g(20, "%.3f" % y) + g(30, "0.0") +
                 g(41, "%.4f" % sx) + g(42, "%.4f" % sy) + g(43, "%.4f" % sx) +
                 g(50, "%.2f" % rot)))


def build_dxf():
    W, H = 2560.0, 1440.0          # 屏体尺寸 mm
    MX, MY = 320.0, 160.0          # 模组尺寸 mm
    OY = 600.0                     # 图形下沿（让出底部尺寸标注空间）

    body = []

    # ---- 屏体外框（屏体层，颜色 5 蓝） ----
    body.append(ent_lwpoly("屏体轮廓", [(0, OY), (W, OY), (W, OY + H), (0, OY + H)], True, 5))

    # ---- 模组网格（模组网格层，颜色 8 灰） ----
    cols, rows = int(W / MX), int(H / MY)
    for c in range(1, cols):
        body.append(ent_line("模组网格", c * MX, OY, c * MX, OY + H, 8))
    for r in range(1, rows):
        body.append(ent_line("模组网格", 0, OY + r * MY, W, OY + r * MY, 8))

    # ---- 主龙骨（结构层，颜色 3 绿，加粗示意用双线） ----
    for x in (0, W):
        body.append(ent_lwpoly("主龙骨", [(x - 20, OY - 60), (x + 20, OY - 60), (x + 20, OY + H + 60), (x - 20, OY + H + 60)], True, 3))
    for y in (OY, OY + H / 2, OY + H):
        body.append(ent_lwpoly("主龙骨", [(-60, y - 20), (W + 60, y - 20), (W + 60, y + 20), (-60, y + 20)], True, 3))

    # ---- 底部通长找平托杆（颜色 4 青） ----
    body.append(ent_lwpoly("找平托杆", [(-60, OY - 120), (W + 60, OY - 120), (W + 60, OY - 80), (-60, OY - 80)], True, 4))

    # ---- 穿线孔（独立 CIRCLE 实体，颜色 4 青） ----
    for cx in (W * 0.25, W * 0.5, W * 0.75):
        body.append(ent_circle("找平托杆", cx, OY - 100, 30, 4))

    # ---- 底部基准点（POINT，颜色 7） ----
    body.append(dxf(*(g(0, "POINT") + g(8, "标识") + g(62, 7) +
                      g(10, "%.3f" % (-60.0)) + g(20, "%.3f" % (OY - 100.0)) + g(30, "0.0"))))

    # ---- 顶部尺寸标注：2560 ----
    yd = OY + H + 200
    body.append(ent_line("标注", 0, yd, W, yd, 1))
    for x in (0, W):
        body.append(ent_line("标注", x, yd - 40, x, yd + 40, 1))
    body.append(ent_text("标注", W / 2 - 90, yd + 30, 60, "2560", 1))

    # ---- 左侧尺寸标注：1440 ----
    xd = -200
    body.append(ent_line("标注", xd, OY, xd, OY + H, 1))
    for y in (OY, OY + H):
        body.append(ent_line("标注", xd - 40, y, xd + 40, y, 1))
    body.append(ent_text("标注", xd - 230, OY + H / 2, 60, "1440", 1, 90))

    # ---- 单块模组标注 + 指引线 ----
    body.append(ent_line("标注", MX, OY + H, MX + 420, OY + H + 340, 2))
    body.append(ent_line("标注", MX + 420, OY + H + 340, MX + 1000, OY + H + 340, 2))
    body.append(ent_text("标注", MX + 460, OY + H + 380, 60, "模组 320X160", 2))

    # ---- 立柱节点（块参照：圆 + 十字线） ----
    nodes = [(0, OY), (W, OY), (0, OY + H), (W, OY + H), (W / 2, OY), (W / 2, OY + H)]
    for x, y in nodes:
        body.append(ent_insert("节点", "M10-4", x, y, 1.0, 1.0, 0.0, 6))

    # ---- 圆弧收边示意（顶部中间弧形缺口） ----
    body.append(ent_arc("收边", W / 2, OY + H + 780, 340, 205, 335, 6))

    # ---- 标题文字 ----
    body.append(ent_text("图框", 0, OY - 420, 110, "LED显示屏钢结构正立面图", 7))
    body.append(ent_text("图框", 0, OY - 560, 62, "主体杆件 40X20X2 方管 / 立柱节点 150X150X8 型钢 / 单位 mm", 8))

    header = dxf(
        (0, "SECTION"), (2, "HEADER"),
        (9, "$ACADVER"), (1, "AC1015"),
        (9, "$INSBASE"), (10, "0.0"), (20, "0.0"), (30, "0.0"),
        (9, "$EXTMIN"), (10, "-600.0"), (20, "0.0"), (30, "0.0"),
        (9, "$EXTMAX"), (10, "3200.0"), (20, "3000.0"), (30, "0.0"),
        (0, "ENDSEC"))

    tables = dxf(
        (0, "SECTION"), (2, "TABLES"),
        (0, "TABLE"), (2, "LAYER"), (70, 7),
        (0, "LAYER"), (2, "0"), (70, 0), (62, 7), (6, "CONTINUOUS"),
        (0, "LAYER"), (2, "屏体轮廓"), (70, 0), (62, 5), (6, "CONTINUOUS"),
        (0, "LAYER"), (2, "模组网格"), (70, 0), (62, 8), (6, "CONTINUOUS"),
        (0, "LAYER"), (2, "主龙骨"), (70, 0), (62, 3), (6, "CONTINUOUS"),
        (0, "LAYER"), (2, "找平托杆"), (70, 0), (62, 4), (6, "CONTINUOUS"),
        (0, "LAYER"), (2, "标注"), (70, 0), (62, 1), (6, "CONTINUOUS"),
        (0, "LAYER"), (2, "图框"), (70, 0), (62, 7), (6, "CONTINUOUS"),
        (0, "ENDTAB"),
        (0, "ENDSEC"))

    blocks = dxf(
        (0, "SECTION"), (2, "BLOCKS"),
        # 块：节点（基准点 0,0 → 圆心；圆 + 十字线）
        (0, "BLOCK"), (8, "0"), (2, "M10-4"), (70, 0), (10, "0.0"), (20, "0.0"), (30, "0.0"),
        (0, "CIRCLE"), (8, "节点"), (62, 6), (10, "0.0"), (20, "0.0"), (30, "0.0"), (40, "40.0"),
        (0, "LINE"), (8, "节点"), (62, 6), (10, "-80.0"), (20, "0.0"), (30, "0.0"), (11, "80.0"), (21, "0.0"), (31, "0.0"),
        (0, "LINE"), (8, "节点"), (62, 6), (10, "0.0"), (20, "-80.0"), (30, "0.0"), (11, "0.0"), (21, "80.0"), (31, "0.0"),
        (0, "ENDBLK"),
        (0, "ENDSEC"))

    # ENTITIES 段：直接拼接各实体记录（每条记录本身就是完整的 (code,value) 行组）
    entities = "0\nSECTION\n2\nENTITIES\n" + "".join(body) + "0\nENDSEC\n"

    return header + tables + blocks + entities + "0\nEOF\n"


# ================--------------------------------------------
# 主流程
# ================--------------------------------------------
def main():
    if "--list" in sys.argv:
        for n in ("demo-notes.txt", "demo-report.docx", "demo-slides.pptx", "demo-plan.dxf"):
            print("将生成：file/" + n)
        return 0

    os.makedirs(ASSETS, exist_ok=True)
    results = []
    results.append(write_text("demo-notes.txt", NOTES))
    results.append(write_zip("demo-report.docx", build_docx()))
    results.append(write_zip("demo-slides.pptx", build_pptx()))
    results.append(write_text("demo-plan.dxf", build_dxf()))

    total = 0
    for path, size in results:
        total += size
        print("已生成 %-42s %8.1f KB  %s" % (os.path.basename(path), size / 1024.0, path))
    print("\n合计 %d 个文件，%.1f KB" % (len(results), total / 1024.0))
    print("提示：DWG 示例请把一份真实 .dwg 复制为 file/demo-plan.dwg（本项目已随附）。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
