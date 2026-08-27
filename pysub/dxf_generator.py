import ezdxf, math, os, sys, datetime, random, string, io, json, time, gc, zipfile, importlib
import qrcode  # 二维码
import barcode  # 条形码需安装：pip install python-barcode
from ezdxf import bbox
from ezdxf.path import from_vertices
from ezdxf.bbox import extents
from ezdxf.tools.text import estimate_mtext_extents
from .profile_engine import ProfileEngine
from ezdxf.colors import rgb2int
from ezdxf import appsettings
from io import StringIO
from typing import Dict, Optional, Callable
from ezdxf.enums import TextEntityAlignment
from . import profile_engine

importlib.reload(profile_engine)

# matplotlib 为可选依赖：仅用于生成预览 PDF；前端 Pyodide 模式下若未安装则降级为仅生成 DXF
MPL_AVAILABLE = False
try:
    import matplotlib
    matplotlib.use("Agg")
    from ezdxf.addons.drawing.config import Configuration
    from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
    from ezdxf.addons.drawing import RenderContext, Frontend
    from matplotlib.backends.backend_pdf import PdfPages
    import matplotlib.pyplot as plt
    MPL_AVAILABLE = True
except Exception as _e:
    print("[dxf_generator] matplotlib 不可用，预览 PDF 将跳过（仍会生成 DXF）:", _e)


def get_base_dir():  # 获取 EXE 或脚本所在目录"""
    if getattr(sys, "frozen", False):
        # PyInstaller 打包后的 EXE
        return os.path.dirname(sys.executable)
    else:
        # 开发环境
        return os.path.dirname(os.path.abspath(__file__))


# ================= 基础 =================
def new_doc():
    return ezdxf.new(dxfversion="R2010")
    # return readfile('model20250828X.dxf')


def save_doc0(doc):
    # ✅ 使用 StringIO（ezdxf 只能写字符串）
    text_buffer = StringIO()
    doc.write(text_buffer)  # 默认 ANSI，中文被丢弃
    text_buffer.seek(0)
    # ✅ 转成 BytesIO（Flask send_file 需要 bytes）
    byte_buffer = io.BytesIO(text_buffer.getvalue().encode("utf-8"))
    byte_buffer.seek(0)
    return byte_buffer


def save_doc(doc, filename):
    return save_doc0(doc), filename


def draw_qr_on_target(target, data, x, y, size):  # 在指定的 DXF 目标（块、模型空间或布局）中绘制二维码。
    """
    :target: ezdxf 可添加实体的对象（如 Block、Modelspace、Layout）
    :data: 要编码的字符串
    :x: 二维码左下角 X 坐标mm
    :y: 二维码左下角 Y 坐标mm
    :size: 二维码总宽高mm
    """
    if not data:
        return
    # 1. 生成二维码矩阵
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=1, border=0)
    qr.add_data(data)
    qr.make(fit=True)
    matrix = qr.get_matrix()  # True=黑色
    n = len(matrix)
    if n == 0:
        return
    cell_size = size / n
    # 2. 逐行扫描，合并连续黑色模块
    for row_idx, row in enumerate(matrix):
        col = 0
        while col < n:
            if row[col]:
                start_col = col
                while col < n and row[col]:
                    col += 1
                end_col = col - 1
                count = end_col - start_col + 1
                x1 = x + start_col * cell_size
                y1 = y + row_idx * cell_size
                x2 = x1 + count * cell_size
                y2 = y1 + cell_size
                # 用带宽度的多段线绘制实心矩形
                cy = (y1 + y2) / 2
                height = y2 - y1
                target.add_lwpolyline([(x1, cy), (x2, cy)], dxfattribs={"color": 0, "const_width": height, "layer": "0"})
            else:
                col += 1
    # target.add_text("扫码", dxfattribs={"height": 2, "color": 4}).set_placement((x, y-2.5))# 可选：在二维码上方或旁边添加说明文字（如“扫码”）


def draw_barcode_on_target(target, data, x=0, y=0, height=10, module_width=0.25, quiet_zone=2):  # 在指定的 DXF 目标中绘制 Code128 条形码，本函数未正确生成，须调整优化。
    """
    target: ezdxf 可添加实体的对象（如 Block、Modelspace、Layout）
    data: 要编码的字符串（支持数字、字母、特殊字符）
    x: 条形码左下角 X 坐标（mm）
    y: 条形码左下角 Y 坐标（mm），即条的底部
    height: 条的高度（mm）
    module_width: 最窄条（模块）的宽度（mm）
    quiet_zone: 左右静区的模块数（默认 2）
    """
    if not data:
        return 0.0
    try:
        import barcode

        code128 = barcode.get_barcode_class("code128")
        code = code128(data)
        # 兼容不同版本的编码获取
        if hasattr(code, "get_full"):
            encoded = code.get_full()
        elif hasattr(code, "build"):
            encoded = "".join("1" if m else "0" for m in code.build())
        else:
            return 0.0
        if not encoded:
            return 0.0
    except Exception:
        return 0.0  # 编码失败（如不支持的字符）
    encoded = "0" * quiet_zone + encoded + "0" * quiet_zone  # 添加左右静区（白色）
    total_width = len(encoded) * module_width  # 总宽度
    # 遍历并合并连续相同字符
    cur_x = x
    i = 0
    while i < len(encoded):
        ch = encoded[i]
        j = i
        while j < len(encoded) and encoded[j] == ch:
            j += 1
        length = j - i  # 连续模块数量
        width = length * module_width
        if ch == "1":  # 黑色条
            center_x = cur_x + width / 2
            if width > 0 and height > 0:  # 画一条垂直线段，设置宽度为 width，形成实心矩形条
                target.add_lwpolyline([(center_x, y), (center_x, y + height)], dxfattribs={"color": 0, "const_width": width, "layer": "0"})
        cur_x += width
        i = j
    return total_width


# ================= 图层 =================
def add_layer(doc, name, color=7, linetype="CONTINUOUS"):
    if linetype not in doc.linetypes:
        try:
            doc.linetypes.load(linetype)
        except:
            linetype = "CONTINUOUS"
    doc.layers.add(name=name, color=int(color), linetype=linetype)
    return name


# ================= 实体 =================
def RelDis(p1, x, y):  # 相对坐标点
    p2 = (p1[0] + x, p1[1] + y)
    return p2


def draw_line(msp, p1, p2, layer="0"):  # 绘制直线
    ent = msp.add_line(p1, p2, dxfattribs={"layer": layer})
    return ent


def draw_rectangle(msp, p1, p2, layer="0"):  # 绘制矩形
    points = [p1, (p2[0], p1[1]), p2, (p1[0], p2[1])]
    ent = msp.add_lwpolyline(points, close=True, dxfattribs={"layer": layer})
    return ent


def draw_polyline(msp, points, closed=False, layer="0"):  # 多线段
    ent = msp.add_lwpolyline(points, close=closed, dxfattribs={"layer": layer})
    return ent


def draw_circle(msp, center, radius, layer="0"):  # 圆
    ent = msp.add_circle(center, radius, dxfattribs={"layer": layer})
    return ent


def draw_arc(msp, center, radius, start, end, layer="0"):  # 圆弧
    ent = msp.add_arc(
        center=center,
        radius=radius,
        start_angle=start,
        end_angle=end,
        dxfattribs={"layer": layer},
    )
    return ent


def draw_spline(msp, points, layer="0"):  # 样条曲线
    ent = msp.add_spline(fit_points=points, dxfattribs={"layer": layer})
    return ent


def draw_mline(msp, points, offset=0.5, layer="0"):  # 多线mline
    left, right = [], []
    for i in range(len(points) - 1):
        x1, y1 = points[i]
        x2, y2 = points[i + 1]
        dx, dy = x2 - x1, y2 - y1
        length = math.hypot(dx, dy)
        if length == 0:
            continue
        nx, ny = -dy / length * offset, dx / length * offset
        left.append((x1 + nx, y1 + ny))
        right.append((x1 - nx, y1 - ny))
    left.append((points[-1][0] + nx, points[-1][1] + ny))
    right.append((points[-1][0] - nx, points[-1][1] - ny))
    msp.add_lwpolyline(left, dxfattribs={"layer": layer})
    msp.add_lwpolyline(right, dxfattribs={"layer": layer})


def create_block(doc, name, builder):  # 创建图块
    block = doc.blocks.new(name=name)
    builder(block)
    return name


def insert_block_with_attrib(doc: ezdxf.document.Drawing, block_name: str, insert_point: tuple, attribs: Dict[str, str], create_block_func: Optional[Callable] = None, **blockref_kwargs) -> ezdxf.entities.Insert:  # 插入带属性的图块
    """
    插入带属性的图块。若图块不存在则先创建。
    Args:
        doc: DXF文档对象
        block_name: 图块名称
        insert_point: 插入点 (x, y) 或 (x, y, z)
        attribs: 属性字典 {tag: value}
        create_block_func: 创建图块的函数，接收(doc, block_name)参数
        **blockref_kwargs: 传递给add_blockref的参数(scale, rotation等)
    Returns:
        插入的INSERT实体
    # 第一次插入：图块不存在，会先创建
    insert1 = insert_block_with_attrib(
        doc=doc,
        block_name='FLAG',
        insert_point=(10, 10),
        attribs={'NAME': 'Pole-01', 'XPOS': '10', 'YPOS': '10'},
        create_block_func=create_flag_block,
        dxfattribs={'rotation': -15, 'xscale': 1.5, 'yscale': 1.5}
    )
    """
    msp = doc.modelspace()
    # 1. 检查图块是否存在
    if block_name not in doc.blocks:
        # 2. 不存在则创建图块
        if create_block_func is None:
            raise ValueError(f"图块 '{block_name}' 不存在，且未提供create_block_func")
        create_block_func(doc, block_name)  # 调用自定义函数创建图块
        print(f"已创建图块: {block_name}")
    insert = msp.add_blockref(block_name, insert_point, **blockref_kwargs)  # 3. 插入图块
    if attribs:
        insert.add_auto_attribs(attribs)  # 4. 添加属性
    return insert


def create_flag_block(doc: ezdxf.document.Drawing, block_name: str):  # 创建旗帜图块定义
    flag = doc.blocks.new(name=block_name)
    # 几何图形
    flag.add_lwpolyline([(0, 0), (0, 5), (4, 3), (0, 3)])
    flag.add_circle((0, 0), 0.4, dxfattribs={"color": 2})
    # 属性定义
    flag.add_attdef("NAME", (0.5, -0.5), dxfattribs={"height": 0.5, "color": 3})
    flag.add_attdef("XPOS", (0.5, -1.0), dxfattribs={"height": 0.25, "color": 4})
    flag.add_attdef("YPOS", (0.5, -1.5), dxfattribs={"height": 0.25, "color": 4})


def create_generic_block(doc: ezdxf.document.Drawing, block_name: str, geometry_func: Callable, attrib_defs: list):  # 通用图块创建函数
    """
    通用图块创建函数
    Args:
        doc: DXF文档
        block_name: 图块名
        geometry_func: 绘制几何图形的函数，接收(block)参数
        attrib_defs: 属性定义列表 [(tag, pos, height, color, text_style, align), ...]
        text_style: 文字样式名
        align: 对齐方式，如'MIDDLE_CENTER'（正中）
    """
    if block_name not in doc.blocks:
        block = doc.blocks.new(name=block_name)
        geometry_func(block)  # 绘制几何图形
        # 添加属性定义
        for item in attrib_defs:
            if len(item) == 4:
                tag, pos, height, color = item
                style, align = "ST", "MIDDLE_CENTER"
            elif len(item) == 6:
                tag, pos, height, color, style, align = item
            else:
                continue
            # 对齐方式 → DXF 72(halign) / 74(valign)
            align_map = {
                "LEFT": (0, 0),
                "CENTER": (1, 0),
                "RIGHT": (2, 0),
                "MIDDLE_LEFT": (0, 2),
                "MIDDLE_CENTER": (1, 2),  # ← 你要的"正中"
                "MIDDLE_RIGHT": (2, 2),
                "TOP_LEFT": (0, 3),
                "TOP_CENTER": (1, 3),
                "TOP_RIGHT": (2, 3),
                "BOTTOM_LEFT": (0, 1),
                "BOTTOM_CENTER": (1, 1),
                "BOTTOM_RIGHT": (2, 1),
            }
            halign, valign = align_map.get(align, (1, 2))
            attdef = block.add_attdef(
                tag,
                pos,
                dxfattribs={
                    "height": height,
                    "color": color,
                    "style": style,
                    "halign": halign,
                    "valign": valign,
                },
            )
            # ✅ 关键：72/74 ≠ 0 时，AutoCAD 用 11(align_point) 做对齐锚
            # 把 align_point 设成和 insert(pos) 同点，这样"正中"就以 pos 为中心
            attdef.dxf.align_point = pos
    return block_name


def create_equipment_block(doc, block_name, qr_data=None):  # 使用示例：创建设备图块
    # 确保文字样式"ST"存在
    if "ST" not in doc.styles:
        doc.styles.new("ST", dxfattribs={"font": "simsun.ttc"})

    def draw_geometry(block):
        # 画一个矩形设备
        block.add_lwpolyline([(0, 0), (-420, 0), (-420, 297), (0, 297)], close=True, dxfattribs={"layer": "0", "color": 4})
        block.add_lwpolyline([(-5, 5), (-405, 5), (-405, 292), (-5, 292)], close=True, dxfattribs={"layer": "0", "color": 4, "const_width": 0.7})
        block.add_lwpolyline([(-55, 5), (-55, 292)], close=False, dxfattribs={"layer": "0", "color": 4, "const_width": 0.7})
        for y in [18, 27, 36, 45, 54, 63, 72, 81, 90, 99, 108, 117, 136, 145, 164, 173, 190, 199, 252]:
            block.add_lwpolyline([(-55, y), (-5, y)], close=False, dxfattribs={"layer": "0", "color": 4})
        block.add_lwpolyline([(-30, 18), (-30, 27)], close=False, dxfattribs={"layer": "0", "color": 4})
        block.add_lwpolyline([(-38, 27), (-38, 117)], close=False, dxfattribs={"layer": "0", "color": 4})
        block.add_lwpolyline([(-22.5, 63), (-22.5, 117)], close=False, dxfattribs={"layer": "0", "color": 4})
        for x in [-407.5, -410, -412.5, -415]:
            block.add_lwpolyline([(x, 148), (x, 292)], close=False, dxfattribs={"layer": "会签栏框", "color": 4})
        for y in list(range(148, 293, 12)):
            block.add_lwpolyline([(-415, y), (-405, y)], close=False, dxfattribs={"layer": "会签栏框", "color": 4})
        # 中英文配对
        labels = [
            [28.6, "Design Date", "出图日期"],
            [37.6, "Scale", "比    例"],
            [46.6, "Draw NO", "图    号"],
            [55.5, "Des.Phase", "设计阶段"],
            [64.2, "Mapper", "制    图"],
            [73.2, "Designed", "设    计"],
            [82.1, "Checked", "校    对"],
            [91.1, "Audit", "审    核"],
            [100.1, "Approved", "审    定"],
            [109.7, "Project Manager", "项目负责人"],
            [137.8, "Drawing Name", "图    名"],
            [165.8, "Project Name", "工程名称"],
            [192.2, "Client'S Units", "建设单位"],
        ]
        for y in labels:
            block.add_text(y[1], dxfattribs={"height": 2, "color": 4, "layer": "0", "style": "ST"}).set_placement((-53.4, y[0]), align=TextEntityAlignment.LEFT)
            block.add_text(y[2], dxfattribs={"height": 2, "color": 4, "layer": "0", "style": "ST"}).set_placement((-53.4, y[0] + 3.2), align=TextEntityAlignment.LEFT)
        block.add_text("V26.07.07.1747", dxfattribs={"height": 2, "color": 4, "layer": "0", "style": "ST"}).set_placement((-25, 1.5), align=TextEntityAlignment.LEFT)
        block.add_text("202600000", dxfattribs={"height": 2, "color": 4, "layer": "0", "style": "ST", "rotation": 90}).set_placement((-1.5, 5), align=TextEntityAlignment.LEFT)
        labels = [[7, "BE ACCORDED TO DIMENSIONS"], [10.4, "ALL MEASUREMENTS MUST"], [13.7, "所有尺寸须以标注为准"]]
        for y in labels:
            block.add_text(y[1], dxfattribs={"height": 2, "color": 4, "layer": "0", "style": "ST"}).set_placement((-30, y[0]), align=TextEntityAlignment.CENTER)
        labels = [[-42.5, "共      页"], [-17.5, "第      页"]]
        for y in labels:
            block.add_text(y[1], dxfattribs={"height": 2, "color": 4, "layer": "0", "style": "ST"}).set_placement((y[0], 22.5), align=TextEntityAlignment.MIDDLE_CENTER)
        n = 150.6
        m = -405.5
        labels = [
            [(m, n), "结   构"],
            [(m - 2.5, n), "建   筑"],
            [(m - 2.5 * 2, n), "总   图"],
            [(m - 2.5 * 3, n), "专   业"],
            [(m - 2.5 * 3, n + 12), "实   名"],
            [(m - 2.5 * 3, n + 12 * 2), "签   名"],
            [(m - 2.5 * 3, n + 12 * 3), "日   期"],
            [(m, n + 12 * 4), "电   讯"],
            [(m - 2.5, n + 12 * 4), "电   气"],
            [(m - 2.5 * 2, n + 12 * 4), "给 排 水"],
            [(m - 2.5 * 3, n + 12 * 4), "专   业"],
            [(m - 2.5 * 3, n + 12 * 5), "实   名"],
            [(m - 2.5 * 3, n + 12 * 6), "签   名"],
            [(m - 2.5 * 3, n + 12 * 7), "日   期"],
            [(m - 2.5, n + 12 * 8), "空   调"],
            [(m - 2.5 * 2, n + 12 * 8), "燃   气"],
            [(m - 2.5 * 3, n + 12 * 8), "专   业"],
            [(m - 2.5 * 3, n + 12 * 9), "实   名"],
            [(m - 2.5 * 3, n + 12 * 10), "签   名"],
            [(m - 2.5 * 3, n + 12 * 11), "日   期"],
        ]
        for y in labels:
            block.add_text(y[1], dxfattribs={"height": 1.5, "color": 4, "layer": "会签栏框", "style": "ST", "rotation": 90}).set_placement(y[0], align=TextEntityAlignment.LEFT)
        text = "郑重声明：\n本图纸尺寸为参考尺寸，详细尺寸应以现场实际放样测量尺寸为准，施工单位应实际了解所有施工方法、施工内容方可进场施工。钢结构施工图的设计、制作应具有相关等级资质的专业技术人员进行设计、制作；因现场情况不明；无法以现场勘测为依据；故本公司所提供的资料仅作参考之用途，凡因基础或承托支架等造成的一切不良后果及损失，本公司及设计员概不负责！"
        block.add_mtext(text, dxfattribs={"char_height": 2.15, "color": 4, "layer": "0", "style": "ST", "width": 46.8}).set_location(insert=(-53.3, 250), attachment_point=1)
        text = "强力巨彩光电科技有限公司\nXiamen Qiangli Jucai Opto-Electronic Technology Co., Ltd."
        block.add_mtext(text, dxfattribs={"char_height": 2.15, "color": 4, "layer": "0", "style": "ST", "width": 50}).set_location(insert=(-30, 259.7), attachment_point=5)
        """
        MTEXT attachment_point 数字对照表
        数字        位置        枚举（如有）
        1        TOP_LEFT        TOP_LEFT
        2        TOP_CENTER        TOP_CENTER
        3        TOP_RIGHT        TOP_RIGHT
        4        MIDDLE_LEFT        MIDDLE_LEFT
        5        MIDDLE_CENTER        MIDDLE_CENTER
        6        MIDDLE_RIGHT        MIDDLE_RIGHT
        7        BOTTOM_LEFT        BOTTOM_LEFT
        8        BOTTOM_CENTER        BOTTOM_CENTER
        9        BOTTOM_RIGHT        BOTTOM_RIGHT
        """
        # ===== 新增：绘制二维码（左下角） =====
        qr_input = qr_data  # 使用新变量，避免在闭包内重新赋值
        if qr_input is not None:
            # 1. 归一化为列表
            if isinstance(qr_input, str):
                qr_list = [qr_input]
            elif isinstance(qr_input, list):
                qr_list = qr_input
            else:
                return
            # 2. 过滤非空字符串
            qr_list = [item for item in qr_list if isinstance(item, str) and item.strip()]
            if not qr_list:
                return
            # 生成二维码矩阵
            QR_SIZE = 12
            GAP = 2
            START_X = -420 + 1.5
            START_Y = 5
            if True:
                cur_x = START_X
                cur_y = START_Y
                for data in qr_list:
                    if not data:
                        continue
                    draw_qr_on_target(block, data, cur_x, cur_y, QR_SIZE)  # 调用二维码函数
                    cur_y += QR_SIZE + GAP
            if False:
                cur_x = START_X
                cur_y = START_Y - 4.5
                for data in qr_list:
                    if not data:
                        continue
                    barcode_width = draw_barcode_on_target(block, data, cur_x, cur_y, height=4, module_width=0.25, quiet_zone=2)  # 调用条形码函数,返回宽度
                    if barcode_width > 0:
                        cur_x += barcode_width + GAP

    attrib_defs = [
        ("建设单位", (-30, 181.5), 2.5, 4, "ST", "MIDDLE_CENTER"),
        ("工程名称1", (-30, 159.5), 2.5, 4, "ST", "MIDDLE_CENTER"),
        ("工程名称2", (-30, 154.5), 2.5, 4, "ST", "MIDDLE_CENTER"),
        ("工程名称3", (-30, 149.5), 2.5, 4, "ST", "MIDDLE_CENTER"),
        ("图名", (-30, 126.5), 2.5, 4, "ST", "MIDDLE_CENTER"),
        ("设计阶段", (-21.5, 58.5), 2.5, 4, "ST", "MIDDLE_CENTER"),
        ("图号", (-21.5, 49.5), 2.5, 4, "ST", "MIDDLE_CENTER"),
        ("比例", (-21.5, 40.5), 2.5, 4, "ST", "MIDDLE_CENTER"),
        ("出图日期", (-21.5, 31.5), 2.5, 4, "ST", "MIDDLE_CENTER"),
        ("总页", (-42.5, 22.5), 2.5, 4, "ST", "MIDDLE_CENTER"),
        ("页码", (-17.5, 22.5), 2.5, 4, "ST", "MIDDLE_CENTER"),
    ]
    create_generic_block(doc, block_name, draw_geometry, attrib_defs)


def insert_scaled_rotated_block_with_attrib(doc: ezdxf.document.Drawing, block_name: str, insert_point: tuple, attribs: dict, fdbs: float = 1.0, rotation: float = 0.0):  # 插入带属性的图块，支持放大和旋转
    """
    插入带属性的图块，支持放大和旋转
    Args:
        doc: DXF文档
        block_name: 图块名称
        insert_point: 插入点 (x, y)
        attribs: 属性字典 {tag: value}
        fdbs: 放大倍数（相对于原图块）
        rotation: 旋转角度（度，逆时针为正）
        create_block_func: 创建图块的函数
    """
    msp = doc.modelspace()
    if block_name in doc.blocks:  # 1. 检查图块是否存在
        # 2. 插入图块（带放大和旋转）
        insert = msp.add_blockref(block_name, insert_point, dxfattribs={"xscale": fdbs, "yscale": fdbs, "rotation": rotation})
        if attribs:
            insert.add_auto_attribs(attribs)  # 3. 添加属性
    return insert


def insert_block(msp, name, insert=(0, 0), scale=1.0, rotation=0, layer="0"):  # 插入图块
    ent = msp.add_blockref(name, insert, dxfattribs={"layer": layer, "xscale": scale, "yscale": scale, "rotation": rotation})
    return ent


def draw_linear_dim(msp, p1, p2, pos, layer="0"):  # 线性标注
    ent = msp.add_linear_dim(p1=p1, p2=p2, location=pos, dxfattribs={"layer": layer})
    return ent


def draw_angular_dim(msp, center, p1, p2, pos, layer="0"):  # 角度标注
    ent = msp.add_angular_dim(center=center, p1=p1, p2=p2, location=pos, dxfattribs={"layer": layer})
    return ent


def create_text_styles(doc):  # 创建 DXF 文字样式
    """
    创建 DXF 文字样式（Text Style）
    返回：
    dict  样式名映射
    ----------------------------------------
    使用示例
    text = msp.add_text(
        "40×40×2 方管",
        dxfattribs={
            "height": 5,
            "style": styles["cn"]   # 使用中文字体
        }
    )
    ----------------------------------------
    """
    if "ZGS_CH" not in doc.styles:  # 标准英文工程字（SHX）
        doc.styles.new("ZGS_CH", dxfattribs={"font": "gbenor.shx", "bigfont": "gbcbig.shx", "height": 0, "width": 1.0, "oblique": 0})
    if "ST" not in doc.styles:  # 中文宋体（TTF）
        doc.styles.new("ST", dxfattribs={"font": "simsun.ttf", "height": 0, "width": 0.75})
    if "DIM_TXT" not in doc.styles:  # 标注专用字体
        doc.styles.new("DIM_TXT", dxfattribs={"font": "isocp.shx", "height": 0, "width": 0.75})
    return {"txt": "ZGS_CH", "cn": "ST", "dim": "DIM_TXT"}


def create_dim_styles(doc, fdbs):  # 创建国标工程标注样式（简化版）
    style_name = f"{fdbs}"
    # ✅ 已存在直接返回
    if style_name in doc.dimstyles:
        return style_name

    def create_closed_block(doc, block_name="_MY_CLOSED"):
        if block_name not in doc.blocks:
            block = doc.blocks.new(block_name)
            # 绘制实心闭合箭头：三角形
            block.add_lwpolyline([(0, 0), (0.5, 0.25), (0.5, -0.25)], close=True)

    # ✅ 一次性创建并配置
    doc.dimstyles.new(
        style_name,
        dxfattribs={
            "dimtxt": 3.0,  # 文字高度
            "dimgap": 1.0,  # 文字与尺寸线间距
            "dimtad": 1,  # 1=文字在尺寸线上方，0=默认，4=上方不加引线
            "dimjust": 0,  # 0=居中，1=靠近第一端点，2=靠近第二端点，3=远离
            "dimtih": 0,  # 0=文字与尺寸线对齐（推荐）
            "dimtoh": 0,  # 0=文字与尺寸线对齐，1=文字水平
            "dimtix": 1,  # 文字始终保持在尺寸界线之间
            "dimtmove": 0,  # 文字不在默认位置时，放在 尺寸线上方，不加引线
            "dimtxsty": "ZGS_CH",  # 挂接文字样式
            # "dimblk": "OBLIQUE",    # 箭头样式
            # "dimldrblk":"CLOSED",   #引线箭头
            "dimasz": 2,  # 箭头大小
            "dimdsep": ord("."),  # 小数分隔符
            "dimexo": 1.5,  # 延伸线起点偏移
            "dimexe": 1.5,  # 延伸线超出
            "dimscale": fdbs,  # 全局比例
            "dimdec": 4,  # 小数位数
            "dimadec": 2,  # 角度精度
            "dimzin": 8,  # 显示前导零
            "dimclrd": 3,  # 尺寸线颜色
            "dimclrt": 7,  # 文字颜色
            "dimclre": 3,  # 延伸线颜色
            "dimdle": 1,  # 当使用小斜线代替箭头进行标注时，设置尺寸线超出尺寸界线的距离(超出标记)
        },
    )
    return style_name


def array_rect(target, source_entities, rows=1, cols=1, row_spacing=0, col_spacing=0):  # 矩形阵列函数（支持任意实体）
    """
    参数：
    target          : 目标空间（msp 或 block）
    source_entities : 单个实体或实体列表[,]
    rows            : 行数
    cols            : 列数
    row_spacing     : 行间距（正值向下，负值向上）
    col_spacing     : 列间距（正值向右，负值向左）
    返回：
    list            : 新创建的实体列表
    """
    # ==========================================================
    # 1. 如果只传入单个实体，转为列表
    if not isinstance(source_entities, (list, tuple)):
        source_entities = [source_entities]
    if rows <= 1 and cols <= 1:
        return source_entities
    # ==========================================================
    # 2. 遍历并复制实体
    new_entities = []
    for ent in source_entities:
        # ✅ 跳过 None
        if ent is None:
            continue
        # ✅ 确保实体有 copy 方法
        if not hasattr(ent, "copy"):
            continue
        for row in range(rows):
            for col in range(cols):
                dx = col * col_spacing
                dy = row * row_spacing
                if dx != 0 or dy != 0:
                    new_ent = ent.copy()
                    new_ent.translate(dx, dy, 0)
                    target.add_entity(new_ent)
                    new_entities.append(new_ent)
    # ==========================================================
    return new_entities


def polar_array(target, source_entity, center=(0, 0), count=6, radius=50, start_angle=0, erase_source=False):  # 环形阵列
    """
    环形阵列（极坐标阵列）
    参数：
    center        : 阵列中心
    count         : 数量
    radius        : 分布半径
    start_angle   : 起始角度（度）
    """
    new_entities = []
    angle_step = 360 / count
    for i in range(count):
        angle = math.radians(start_angle + i * angle_step)
        # 计算位置
        x = center[0] + radius * math.cos(angle)
        y = center[1] + radius * math.sin(angle)
        new_ent = source_entity.copy()
        new_ent.translate(x, y, 0)
        target.add_entity(new_ent)
        new_entities.append(new_ent)
    if erase_source:
        target.delete_entity(source_entity)
    return new_entities


def midpoint(p1, p2):  # 计算二维点 p1 和 p2 的中点
    return ((p1[0] + p2[0]) * 0.5, (p1[1] + p2[1]) * 0.5)


def format_real_number(x):  # 如果是浮点数且小数部分为 0，则转为整数字符串# 否则保留原样（或按需要格式化）
    if isinstance(x, float) and x.is_integer():
        return int(x)
    return x


def Layer_settings(str):  # 图层设定
    str = str.replace(" ", "")
    engine = ProfileEngine()  # 创建型材引擎
    params = engine._parse_profile(str)
    if params is None:
        return "0"
    w, h, t, ptype = params
    if (w == 40 and h == 20) or (w == 20 and h == 40) or (w == 50 and h == 30) or (w == 30 and h == 50):
        return "ZGS06"
    elif w == h == 40:
        return "ZGS01"
    elif (w == h == 50) or (w == h == 60):
        return "ZGS05"
    else:
        return "ZGS02"


def add_display_facade_title(msp, p0, text: str = "显示屏正立面图", fdbs: float = 1.0):  # 添加「显示屏正立面图」标题 + 双下划线
    # ✅ 创建多行文字（居中对齐）
    # from ezdxf.tools.text import estimate_mtext_extents
    # mtext = msp.add_mtext(text,dxfattribs={"char_height": 3 * fdbs,"style": "ZGS_CH"}).set_location(insert=p0,attachment_point=ezdxf.const.MTEXT_MIDDLE_CENTER)
    # w, h = estimate_mtext_extents(mtext)# ✅ 获取文字尺寸
    # ✅ 创建单行文字（居中对齐）
    if text and p0:
        fdbs = 1.0 if fdbs is None or fdbs <= 0 else float(fdbs)
        txt = msp.add_text(text, dxfattribs={"height": 3 * fdbs, "style": "ZGS_CH"}).set_placement(p0, align=TextEntityAlignment.MIDDLE_CENTER)  # ✅ 这才是 TEXT 的居中
        b = bbox.extents([txt])
        w = b.extmax.x - b.extmin.x
        h = b.extmax.y - b.extmin.y
        # ------------------------------------
        a = w * 0.5 + 3 * fdbs * 0.4
        b = h * 0.5 + 3 * fdbs * 0.2
        c = h * 0.5 + 3 * fdbs * 0.4
        # ✅ 双下划线（装饰线）
        msp.add_line(RelDis(p0, -a, -b), RelDis(p0, a, -b), dxfattribs={"color": 6})
        msp.add_line(RelDis(p0, -a, -c), RelDis(p0, a, -c), dxfattribs={"color": 6})
        return p0
    else:
        return None


def save_client_info_to_dxf(doc, client_info):  # 将客户端信息写入 DXF 根字典（100% 合规）
    if not client_info:
        return
    rootdict = doc.rootdict  # ✅ 根字典（命名对象字典）
    # 自定义字典名（建议带版本）
    dict_key = "CLIENT_INFO_V1"
    if dict_key not in rootdict:
        custom_dict = doc.objects.add_dictionary()
        rootdict[dict_key] = custom_dict
    else:
        custom_dict = rootdict[dict_key]
        custom_dict.clear()
    client_info["SAVE_TIME"] = time.strftime("%Y-%m-%d %H:%M:%S")  # 补充时间戳
    for key, value in client_info.items():
        if value is None:
            continue
        xrecord = doc.objects.add_xrecord()  # 创建 XRecord
        # ✅ 根据类型选择正确的 DXF 组码
        if isinstance(value, (dict, list)):
            xrecord.tags.append((1, json.dumps(value, ensure_ascii=False)))  # 组码 1: 字符串（JSON）
        elif isinstance(value, str):
            xrecord.tags.append((1, value))  # 组码 1: 字符串
        elif isinstance(value, (int, float)):
            xrecord.tags.append((40, float(value)))  # 组码 40: 实数
        elif isinstance(value, bool):
            xrecord.tags.append((70, 1 if value else 0))  # 组码 70: 整数（1=True, 0=False）
        else:
            xrecord.tags.append((1, str(value)))  # 其他类型转为字符串
        custom_dict[key.upper()] = xrecord


def load_client_info_from_dxf(dxf_path):  # 从 DXF 中读取客户端信息
    import ezdxf

    try:
        doc = ezdxf.readfile(dxf_path)
        rootdict = doc.rootdict
        dict_key = "CLIENT_INFO_V1"
        if dict_key not in rootdict:
            return None
        custom_dict = rootdict[dict_key]
        client_info = {}
        for key in custom_dict.keys():
            xrecord = custom_dict[key]
            # ✅ 遍历 tags 获取数据
            for tag in xrecord.tags:
                group_code, value = tag
                if group_code == 1:  # 字符串
                    try:
                        client_info[key] = json.loads(value)  # 尝试解析 JSON
                    except:
                        client_info[key] = value
                elif group_code == 40:  # 实数
                    client_info[key] = float(value)
                elif group_code == 70:  # 整数/布尔
                    client_info[key] = int(value)
                # 可根据需要添加更多组码处理
        return client_info
    except Exception as e:
        print(f"读取 DXF 信息失败: {e}")
        return None


def find_unreferenced_blocks_manual(doc):  # 手动查找所有未被引用的块定义名称（跳过匿名块）
    all_block_names = set()
    for block in doc.blocks:
        if not block.name.startswith("*"):
            all_block_names.add(block.name)
    referenced_blocks = set()
    entities = []
    entities.extend(doc.modelspace().query("*"))
    for layout in doc.layouts:
        if layout.name != "Model":
            entities.extend(layout.query("*"))
    for block in doc.blocks:
        if not block.name.startswith("*"):
            entities.extend(block.query("*"))
    for entity in entities:
        if entity.dxftype() == "INSERT":
            referenced_blocks.add(entity.dxf.name)
    return all_block_names - referenced_blocks


def purge_all_unused(doc):  # 清理 DXF 文档
    """
    清理 DXF 文档中所有未使用的对象：
    - 未使用的块定义
    - 未使用的图层
    - 未使用的线型
    - 未使用的文字样式
    - 未使用的标注样式（修正版）
    """
    # ----- 1. 收集所有实体（包括模型空间、所有布局、所有非匿名块）-----
    all_entities = []
    all_entities.extend(doc.modelspace().query("*"))
    for layout in doc.layouts:
        if layout.name != "Model":
            all_entities.extend(layout.query("*"))
    for block in doc.blocks:
        if not block.name.startswith("*"):
            all_entities.extend(block.query("*"))
    # ----- 2. 提取直接引用的资源名称 -----
    used_layers = set()
    used_linetypes = set()
    used_text_styles = set()
    used_dim_styles = set()
    for e in all_entities:
        if e.dxf.hasattr("layer"):
            used_layers.add(e.dxf.layer)
        if e.dxf.hasattr("linetype"):
            lt = e.dxf.linetype
            if lt and lt.upper() not in ("BYLAYER", "BYBLOCK"):
                used_linetypes.add(lt)
        if e.dxf.hasattr("style"):
            used_text_styles.add(e.dxf.style)
    # ----- 3. 处理标注样式（兼容句柄和名称）-----
    for e in all_entities:
        if e.dxftype() == "DIMENSION":
            dimstyle_val = getattr(e.dxf, "dimstyle", None)
            if dimstyle_val:
                # 尝试作为句柄处理
                obj = doc.entitydb.get(dimstyle_val)
                if obj and obj.dxftype() == "DIMSTYLE":
                    used_dim_styles.add(obj.dxf.name)
                else:
                    # 视为样式名称，但需验证是否存在于 DIMSTYLE 表中
                    if dimstyle_val in doc.dimstyles:
                        used_dim_styles.add(dimstyle_val)
                    # 否则忽略（可能是无效值）
    # ----- 4. 删除未使用的块定义（使用手动查找函数）-----
    unreferenced_blocks = find_unreferenced_blocks_manual(doc)
    for name in unreferenced_blocks:
        try:
            doc.blocks.delete_block(name, safe=True)
            print(f"Deleted block: {name}")
        except ezdxf.DXFBlockInUseError:
            pass
    # ----- 5. 删除未使用的图层（保留 0 和 DEFPOINTS）-----
    default_layers = {"0", "DEFPOINTS"}
    for layer in list(doc.layers):
        name = layer.dxf.name
        if name not in used_layers and name not in default_layers:
            try:
                doc.layers.remove(name)
                print(f"Deleted layer: {name}")
            except (ezdxf.DXFKeyError, ezdxf.DXFValueError):
                pass
    # ----- 6. 删除未使用的线型（保留 Continuous、ByLayer、ByBlock）-----
    default_linetypes = {"Continuous", "ByLayer", "ByBlock"}
    for lt in list(doc.linetypes):
        name = lt.dxf.name
        if name not in used_linetypes and name not in default_linetypes:
            try:
                doc.linetypes.remove(name)
                print(f"Deleted linetype: {name}")
            except (ezdxf.DXFKeyError, ezdxf.DXFValueError):
                pass
    # ----- 7. 删除未使用的文字样式（保留 Standard）-----
    default_text_styles = {"Standard"}
    for style in list(doc.styles):
        name = style.dxf.name
        if name not in used_text_styles and name not in default_text_styles:
            try:
                doc.styles.remove(name)
                print(f"Deleted text style: {name}")
            except (ezdxf.DXFKeyError, ezdxf.DXFValueError):
                pass
    # ----- 8. 删除未使用的标注样式（保留 Standard）-----
    default_dim_styles = {"Standard"}
    for ds in list(doc.dimstyles):
        name = ds.dxf.name
        if name not in used_dim_styles and name not in default_dim_styles:
            try:
                doc.dimstyles.remove(name)
                print(f"Deleted dimstyle: {name}")
            except (ezdxf.DXFKeyError, ezdxf.DXFValueError):
                pass
    # ----- 9. 清空垃圾箱 -----
    doc.entitydb.new_trashcan().clear()
    print("Purge completed.")


def ensure_point_list(p):  # 将单点转为点列表
    """
    确保 p 是一个点列表。
    - 如果 p 是 None 或空，返回空列表。
    - 如果 p 是单个点（数字元组或 Vec2/Vec3），转换为 [p]。
    - 如果 p 已经是点列表，原样返回。
    """
    if p is None:
        return []
    if isinstance(p, (list, tuple)):
        # 如果第一个元素是数值，说明这是单个点 (如 (10,20) 或 [10,20])
        if len(p) > 0 and isinstance(p[0], (int, float)):
            return [p]
        else:
            # 否则视为列表，直接返回（但可能包含 Vec2 等，这里不做深拷贝）
            return list(p)  # 浅拷贝，避免意外修改
    # 处理 Vec2/Vec3 等坐标对象
    # 由于它们不是 list/tuple，但可能是可迭代对象，可以尝试转为列表
    try:
        # 如果是 Vec2 或 Vec3，可以这样识别
        if hasattr(p, "x") and hasattr(p, "y"):
            return [p]
        # 如果是其他可迭代对象（如 numpy 数组），先转为列表再判断
        iterable = list(p)
        # 如果迭代后第一个元素是数字，说明是单个点，转为 [p]
        if len(iterable) > 0 and isinstance(iterable[0], (int, float)):
            return [p]
        else:
            # 否则认为是点列表，返回转换后的列表（但最好保留原始点类型）
            return iterable
    except TypeError:
        # 不可迭代，视为单个点
        return [p]


def inlenderX(msp, text: str = "引线", p0=None, p1=None, dim: str = "Standard"):  # 引线
    if p0 and p1 and text:
        p0 = ensure_point_list(p0)
        p0 = [x for x in p0 if x]  # 过滤掉所有“假值:所有“空”元素（如 ''、None、False、0 等”
        dims = msp.doc.dimstyles.get(dim)
        text_size = dims.dxf.dimtxt  # 尺寸文字的大小
        global_scale = dims.dxf.dimscale  # 全局比例因子
        text_style_name = dims.dxf.dimtxsty  # 获取该标注样式所使用的文字样式名称
        tf = True if p1[0] >= p0[0][0] else False
        mtext = msp.add_mtext(text, dxfattribs={"char_height": text_size * global_scale, "style": text_style_name}).set_location(insert=p1, attachment_point=7 if tf else 9)  # 7：ezdxf.const.MTEXT_BOTTOM_LEFT   9：ezdxf.const.MTEXT_BOTTOM_RIGHT
        b = bbox.extents([mtext])
        w = b.extmax.x - b.extmin.x
        if not tf:
            w = w * -1
        h = b.extmax.y - b.extmin.y
        for pt in p0:
            msp.add_leader([pt, p1, RelDis(p1, w, 0)], dxfattribs={"dimstyle": dim, "has_arrowhead": 1}).dxf.dimstyle = dim


# ----------------------------------------------------------------------------------#
"""示例
## 在模型空间添加一条直线
# 参数：(起点), (终点)
msp.add_line((0, 0), (100, 50))
## 添加一个圆
# 参数：圆心坐标，半径
msp.add_circle((50, 50), radius=30)
## 添加一个圆弧
# 参数：圆心，半径，起始角度，终止角度（单位：度）
msp.add_arc((50, 50), radius=30, start_angle=0, end_angle=90)
## 添加一个椭圆
# 参数：中心点，主轴向量，短轴比例
msp.add_ellipse(
    center=(50, 50),
    major_axis=(40, 0),   # 长轴方向向量
    ratio=0.6             # 短轴 / 长轴
)
## 添加轻量级多段线（AutoCAD 中最常用的轮廓线）
# points：顶点列表
# close=True：闭合
msp.add_lwpolyline(    [(0, 0), (100, 0), (100, 60), (0, 60)],    close=True)
## 添加 NURBS 样条曲线
# fit_points：拟合点
msp.add_spline(    fit_points=[(0, 0), (30, 50), (60, -20), (100, 40)])
## 创建一个新图层
# 参数：图层名，颜色（ezdxf.colors）
doc.layers.add("WALL", color=ezdxf.colors.BLUE)
doc.layers.add("DOOR", color=ezdxf.colors.RED)
## 在创建实体时，通过 dxfattribs 指定图层
msp.add_line(    (0, 0),    (100, 0),    dxfattribs={"layer": "WALL"})
## 添加虚线线型
doc.linetypes.add(    name="DASHED",    pattern=[5, -5] ) # 5 实线，-5 空白
# 使用线型
msp.add_line(    (0, 10),    (100, 10),    dxfattribs={"linetype": "DASHED"})
#单行文字 TEXT
text = msp.add_text(    "房间名称",    dxfattribs={"height": 5})  # 字高
# 设置文字位置和对齐方式
text.set_placement(    (50, 50),    align=ezdxf.enums.TextEntityAlignment.CENTER)
ezdxf.const.MTEXT_TOP_LEFT
ezdxf.const.MTEXT_TOP_CENTER
ezdxf.const.MTEXT_TOP_RIGHT
ezdxf.const.MTEXT_MIDDLE_LEFT
ezdxf.const.MTEXT_MIDDLE_CENTER   # ✅ 最常用
ezdxf.const.MTEXT_MIDDLE_RIGHT
ezdxf.const.MTEXT_BOTTOM_LEFT
ezdxf.const.MTEXT_BOTTOM_CENTER
ezdxf.const.MTEXT_BOTTOM_RIGHT
#多行文字 MTEXT（推荐）
msp.add_mtext(
    "宽度：100\n高度：60",
    dxfattribs={        "char_height": 3,        "width": 40    }
).set_location((10, 10))
## 创建线性标注样式
dim_style = doc.dimstyles.new("DS_1")
dim_style.dxf.dimtxt = 3  # 文字高度
# 添加线性标注
msp.add_linear_dim(
    base=(0, -10),        # 标注基准线
    p1=(0, 0),           # 第一点
    p2=(100, 0),         # 第二点
    dimstyle="DS_1",
    override={"dimtxsty": "Standard"}
)
## 创建填充
hatch = msp.add_hatch(color=ezdxf.colors.GREEN)
# 添加边界路径（必须是闭合多段线）
hatch.paths.add_polyline_path(    [(0, 0), (100, 0), (100, 60), (0, 60)],    is_closed=True)
# 设置填充图案
hatch.set_pattern_fill("ANSI31", scale=5)
## 在 blocks 中新建一个块
block = doc.blocks.new(name="DOOR_900")
# 在块内部画几何
block.add_lwpolyline([(0, 0), (0, 900)])
block.add_line((0, 0), (900, 0))
## 插入块
msp.add_blockref(    "DOOR_900",    insert=(100, 100),    dxfattribs={"rotation": 90})
## 创建带属性的块
block = doc.blocks.new("TAG")
block.add_attdef(    tag="NUMBER",    insert=(0, 0),    text="001",    dxfattribs={"height": 5})
# 插入并填写属性
blockref = msp.add_blockref("TAG", (50, 50))
blockref.add_auto_attribs({"NUMBER": "A102"})
##3D 面 3DFACE
msp.add_3dface(    [(0, 0, 0), (100, 0, 0), (100, 100, 0), (0, 100, 0)])
##网格 MESH
mesh = msp.add_mesh()
mesh.vertices = [(0,0,0), (10,0,0), (10,10,0), (0,10,0)]
mesh.faces = [(0,1,2,3)]
## 读取现有 DXF 文件
doc = ezdxf.readfile("input.dxf")
# 遍历模型空间所有实体
for e in doc.modelspace():
    print(e.dxftype(), e.dxf.layer)
## 设置单位为毫米
doc.header["$INSUNITS"] = 4     #1:英寸,4:毫米,6:米
"""


# ----------------------------------------------------------------------------------#
# ================= 对外接口 =================
def create_dxf(snhw, cpxl, cpxh, azys, dycd, plls, dygd, plhs, xscd, xsgd, dyhd, pthd, jlwd, ldgd, pdjj, bbsb, bbxb, bbcb, mjhj, mjsj, dybt, bthg, ntlg, sphg, flmj, xmqy, psyt, pggt, cltj, dxft, pdft, lkjx, zcsg, client_info=None):  # 主要逻辑程序
    # raise ValueError(f"cltj:{cltj}")#抛出异常,可用于参数调试
    # raise ValueError(f"{client_info}")#抛出异常,可用于参数调试
    # ===========================================================================================================
    try:
        doc = new_doc()
        doc.header["$INSUNITS"] = 4  # 1. 把图纸单位设为毫米# 4 = mm
        doc.header["$MEASUREMENT"] = 1  # 2. 可选：把模型空间单位也设为毫米# 1 = 公制
        rootdict = doc.rootdict  # 获取文档的根字典
        my_dict_name = "LED_ZGS"
        my_dict = doc.objects.add_dictionary(rootdict.dxf.handle, True)  # [reference:9]
        rootdict[my_dict_name] = my_dict
        my_dict.add_dict_var(my_dict_name, f"{client_info},by:zgs378530220")
        msp = doc.modelspace()
        ptcd = xscd + bbcb * 2
        ptgd = xsgd + bbsb + bbxb
        fdbs = (round(((max((ptcd * 2 / 350.0), (ptgd + ldgd + jlwd) * 2.5 / 287.0)) * 0.2) + 0.5)) * 5
        cjtcs = [
            ["ZGS00", 253, "continuous"],  #
            ["ZGS01", 4, "continuous"],  # 青色，主要放置40*40方管
            ["ZGS02", 2, "continuous"],  # 黄色，主要放置大于60*60方管
            ["ZGS03", 11, "continuous"],  # 深砖红色
            ["ZGS04", 1, "center2"],  # 红色中心线
            ["ZGS05", 3, "continuous"],  # 绿色，主要放置50*50/60*60方管
            ["ZGS06", 31, "continuous"],  # 砖红色，主要放置40*20/50*30方管
            ["ZGS07", 6, "continuous"],  # 浅洋红色，主要放置电缆线
            ["ZGS08", 7, "continuous"],  # 白色
            ["ZGS09", 8, "continuous"],  # 灰色，主要放置显示单元/土建
            ["公司标识", 5, "continuous"],
            ["会签栏框", 4, "continuous"],
            ["屏体设备", 8, "continuous"],
            ["设计签名", 8, "continuous"],
            ["审查签章", 4, "continuous"],
            ["箱体后门", 8, "continuous"],
        ]
        for cjtc in cjtcs:
            add_layer(doc, cjtc[0], cjtc[1], cjtc[2])
        create_text_styles(doc)
        create_dim_styles(doc, fdbs)
        appsettings.set_current_dimstyle(doc, f"{fdbs}")  # 指定标注样式置前
        appsettings.set_current_layer(doc, "0")  # 指定图层置前
        appsettings.set_current_textstyle(doc, "ZGS_CH")  # 指定文本样式置前
        # ✅ 生成文件名：当前日期 + 6位随机字符串
        today = datetime.datetime.now().strftime("%Y%m%d")
        random_str = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
        chart_type = "屏钢结构图" if pggt else "屏示意图"
        lang_suffix = "CH" if xmqy == "国内" else "EN"
        filename = f"{cpxh}{'磁吸模组' if dycd <= 320 else '箱体'}整屏{snhw}{azys}前维护({format_real_number(dycd)}x{format_real_number(dygd)}-{format_real_number(xscd)}x{format_real_number(xsgd)}){chart_type}V1.0-{today}_{lang_suffix}_{random_str.upper()}"
        # ================================================================
        p0 = (0, 0)
        block_name = "TK"
        create_equipment_block(doc, block_name, qr_data=[filename])
        if psyt:  # 示意图
            # 正立面图------------------------------------------------
            rectangle = draw_rectangle(msp, p0, RelDis(p0, dycd, dygd), layer="ZGS09")
            array_rect(msp, [rectangle], plhs, plls, dygd, dycd)
            draw_rectangle(msp, p0, RelDis(p0, xscd, xsgd))
            hatch = msp.add_hatch()
            hatch.dxf.true_color = rgb2int((0, 0, 255))  # 设置图案颜色为蓝色
            hatch.paths.add_polyline_path([p0, RelDis(p0, xscd, 0), RelDis(p0, xscd, xsgd), RelDis(p0, 0, xsgd)], is_closed=True)  # 边界路径（必须是闭合多段线）
            hatch.set_pattern_fill("ANSI37", scale=min(20, fdbs))  # 设置填充图案
            if bbcb > 0:
                draw_rectangle(msp, RelDis(p0, -bbcb, -bbxb), RelDis(p0, xscd + bbcb, xsgd + bbsb))
            if ldgd > 0:
                draw_rectangle(msp, RelDis(p0, -bbcb, -bbxb), RelDis(p0, xscd + bbcb, -bbxb - ldgd))
            if jlwd > 0:
                draw_rectangle(msp, RelDis(p0, -bbcb, xsgd + bbsb), RelDis(p0, xscd + bbcb, xsgd + bbsb + jlwd))
            n = 0
            p1 = RelDis(p0, 0, xsgd)
            p2 = RelDis(p1, dycd, 0)
            p3 = RelDis(midpoint(p1, p2), 0, bbsb + jlwd)
            # 标注
            n = n + 1
            msp.add_linear_dim(base=RelDis(p3, 0, 3 * fdbs * 1.5 * n), p1=p1, p2=p2, dimstyle=f"{fdbs}")
            p2 = RelDis(p1, xscd, 0)
            n += 1
            msp.add_linear_dim(base=RelDis(p3, 0, 3 * fdbs * 1.5 * n), p1=p1, p2=p2, dimstyle=f"{fdbs}")
            if bbcb > 0:
                p1 = RelDis(p0, -bbcb, xsgd + bbsb + jlwd)
                p2 = RelDis(p1, ptcd, 0)
                n += 1
                msp.add_linear_dim(base=RelDis(p3, 0, 3 * fdbs * 1.5 * n), p1=p1, p2=p2, dimstyle=f"{fdbs}")
            n = 0
            p1 = RelDis(p0, 0, dygd)
            p3 = RelDis(midpoint(p0, p1), -bbcb, 0)
            n = n + 1
            msp.add_linear_dim(base=RelDis(p3, -3 * fdbs * 1.5 * n, 0), p1=p0, p2=p1, dimstyle=f"{fdbs}", angle=90)
            p1 = RelDis(p0, 0, xsgd)
            n = n + 1
            msp.add_linear_dim(base=RelDis(p3, -3 * fdbs * 1.5 * n, 0), p1=p0, p2=p1, dimstyle=f"{fdbs}", angle=90)
            if bbsb > 0 or bbxb > 0:
                p1 = RelDis(p0, -bbcb, -bbxb)
                p2 = RelDis(p1, 0, ptgd)
                n = n + 1
                msp.add_linear_dim(base=RelDis(p3, -3 * fdbs * 1.5 * n, 0), p1=p1, p2=p2, dimstyle=f"{fdbs}", angle=90)
            if ldgd > 0:
                p1 = RelDis(p0, -bbcb, -bbxb)
                p2 = RelDis(p1, 0, -ldgd)
                msp.add_linear_dim(base=RelDis(p3, -3 * fdbs * 1.5 * n, 0), p1=p1, p2=p2, dimstyle=f"{fdbs}", angle=90)
            if jlwd > 0:
                p1 = RelDis(p0, -bbcb, xsgd + bbsb)
                p2 = RelDis(p1, 0, jlwd)
                msp.add_linear_dim(base=RelDis(p3, -3 * fdbs * 1.5 * n, 0), p1=p1, p2=p2, dimstyle=f"{fdbs}", angle=90)
            if ldgd > 0 or jlwd > 0:
                p1 = RelDis(p0, -bbcb, 0 - bbxb - ldgd)
                p2 = RelDis(p1, 0, ldgd + ptgd + jlwd)
                n = n + 1
                msp.add_linear_dim(base=RelDis(p3, -3 * fdbs * 1.5 * n, 0), p1=p1, p2=p2, dimstyle=f"{fdbs}", angle=90)
            p1 = RelDis(p0, xscd * 0.5, 0 - bbxb - ldgd - 3 * fdbs * 1.5)
            add_display_facade_title(msp, p1, text=("显示屏正立面图" if xmqy == "国内" else "LED display front elevation"), fdbs=fdbs)
            # 侧立面图------------------------------------------------
            p1 = RelDis(p0, xscd + bbcb + pthd + 3 * fdbs * 1.5 * 2 * 2, 0)
            rectangle = draw_rectangle(msp, RelDis(p1, pthd - dyhd, 0), RelDis(p1, pthd, dygd), layer="ZGS09")
            array_rect(msp, [rectangle], plhs, 1, dygd, dycd)
            draw_rectangle(msp, RelDis(p1, pthd - dyhd, 0), RelDis(p1, pthd, xsgd))
            hatch = msp.add_hatch()
            hatch.dxf.true_color = rgb2int((0, 0, 255))  # 设置图案颜色为蓝色
            hatch.paths.add_polyline_path([RelDis(p1, pthd - dyhd, 0), RelDis(p1, pthd, 0), RelDis(p1, pthd, xsgd), RelDis(p1, pthd - dyhd, xsgd)], is_closed=True)  # 边界路径（必须是闭合多段线）
            hatch.set_pattern_fill("ANSI37", scale=min(20, fdbs) * 0.5)  # 设置填充图案
            draw_rectangle(msp, RelDis(p1, 0, -bbxb - ldgd), RelDis(p1, pthd, xsgd + bbsb + jlwd))
            # 标注
            n = 0
            p2 = RelDis(p1, pthd, 0)
            p3 = RelDis(p2, 0, xsgd)
            p4 = RelDis(midpoint(p2, p3), 3 * fdbs * 1.5 * n, 0)
            n = n + 1
            msp.add_linear_dim(base=RelDis(p4, 3 * fdbs * 1.5 * n, 0), p1=p2, p2=p3, dimstyle=f"{fdbs}", angle=90)
            if ldgd > 0 or bbxb > 0:
                p3 = RelDis(p2, 0, -ldgd - bbxb)
                msp.add_linear_dim(base=RelDis(p4, 3 * fdbs * 1.5 * n, 0), p1=p2, p2=p3, dimstyle=f"{fdbs}", angle=90)
            if jlwd > 0:
                p3 = RelDis(p2, pthd, xsgd)
                p2 = RelDis(p3, 0, jlwd + bbsb)
                msp.add_linear_dim(base=RelDis(p4, 3 * fdbs * 1.5 * n, 0), p1=p2, p2=p3, dimstyle=f"{fdbs}", angle=90)
            n = n + 1
            p2 = RelDis(p1, pthd, -ldgd - bbxb)
            p3 = RelDis(p1, pthd, xsgd + jlwd + bbsb)
            msp.add_linear_dim(base=RelDis(p4, 3 * fdbs * 1.5 * n, 0), p1=p2, p2=p3, dimstyle=f"{fdbs}", angle=90)
            n = 0
            p2 = RelDis(p3, -dyhd, 0)
            p4 = RelDis(midpoint(p2, p3), 0, 3 * fdbs * 1.5 * n)
            n = n + 1
            msp.add_linear_dim(base=RelDis(p4, 0, 3 * fdbs * 1.5 * n), p1=p2, p2=p3, dimstyle=f"{fdbs}")
            p2 = RelDis(p3, -pthd, 0)
            n = n + 1
            msp.add_linear_dim(base=RelDis(p4, 0, 3 * fdbs * 1.5 * n), p1=p2, p2=p3, dimstyle=f"{fdbs}")
            p2 = RelDis(p1, pthd * 0.5, 0 - bbxb - ldgd - 3 * fdbs * 1.5)
            add_display_facade_title(msp, p2, text=("显示屏侧立面图" if xmqy == "国内" else "Display side elevation view"), fdbs=fdbs)
            # 平面图------------------------------------------------
            p2 = RelDis(p0, 0, -bbxb - ldgd - 3 * fdbs * 1.5 * 2 * 2 - pthd)
            rectangle = draw_rectangle(msp, p2, RelDis(p2, dycd, dyhd), layer="ZGS09")
            array_rect(msp, [rectangle], 1, plls, dygd, dycd)
            draw_rectangle(msp, p2, RelDis(p2, xscd, dyhd))
            hatch = msp.add_hatch()
            hatch.dxf.true_color = rgb2int((0, 0, 255))  # 设置图案颜色为蓝色
            hatch.paths.add_polyline_path([p2, RelDis(p2, xscd, 0), RelDis(p2, xscd, dyhd), RelDis(p2, 0, dyhd)], is_closed=True)  # 边界路径（必须是闭合多段线）
            hatch.set_pattern_fill("ANSI37", scale=min(20, fdbs) * 0.5)  # 设置填充图案
            draw_rectangle(msp, RelDis(p2, -bbcb, 0), RelDis(p2, xscd + bbcb, pthd))
            # 标注
            n = 0
            p3 = p2
            p4 = RelDis(p3, xscd, 0)
            p5 = RelDis(midpoint(p3, p4), 0, 3 * fdbs * 1.5 * n)
            n = n + 1
            msp.add_linear_dim(base=RelDis(p5, 0, -3 * fdbs * 1.5 * n), p1=p3, p2=p4, dimstyle=f"{fdbs}")
            if bbcb > 0:
                n = n + 1
                p3 = RelDis(p2, -bbcb, 0)
                p4 = RelDis(p3, ptcd, 0)
                msp.add_linear_dim(base=RelDis(p5, 0, -3 * fdbs * 1.5 * n), p1=p3, p2=p4, dimstyle=f"{fdbs}")
            p3 = RelDis(p2, xscd * 0.5, -3 * fdbs * 1.5 * (n + 1))
            add_display_facade_title(msp, p3, text="显示屏平面图" if xmqy == "国内" else "Display floor plan", fdbs=fdbs)
            n = 0
            p3 = RelDis(p2, -bbcb, 0)
            p4 = RelDis(p3, 0, pthd)
            p5 = RelDis(midpoint(p3, p4), 3 * fdbs * 1.5 * n, 0)
            n = n + 1
            msp.add_linear_dim(base=RelDis(p5, -3 * fdbs * 1.5 * n, 0), p1=p3, p2=p4, dimstyle=f"{fdbs}", angle=90)
            # 设计说明------------------------------------------------
            p3 = RelDis(p2, -bbcb - 3 * fdbs * 1.5 * 2, -3 * fdbs * 1.5 * 4)
            text = (
                f"设计说明：\n1、显示屏显示面积：\\C1;{xscd * 0.001}m*{xsgd * 0.001}m={xscd * xsgd * 0.000001}m2\\C0;；显示屏安装方式：\\C1;{azys}\\C0;安装；\n2、装饰包边：显示屏外装饰材料和颜色由客户指定,显示屏包边尺寸以实际为准；\n3、显示屏如需安装散热设备，可在两侧/背部预留散热通风口；\n4、矩管等型材相邻工件的焊缝不能处在同一水平面或垂直面内,且主结构体的对接焊缝必须加衬不小于焊材壁厚的钢板；开口构件的端口必须焊接封板,封板以构件壁厚为宜；\n5、屏体框架制作前请核对图纸是否与现场匹配；使用材料必须在制作前校直；\n6、框架两对角线之差±5.0mm；表面平整度达±2.0mm，无毛刺；结构整体要求平整，左右倾斜度≤0.5度；整屏左右倾斜度≤0.5度；\n7、屏体安装背杆正面需确保与托杆水平面垂直；屏体底部通长找平托杆每米水平误差≤0.15mm;\n8、所有焊缝要满焊焊接，焊接须确保牢固可靠，无虚焊，无砂眼，工艺参考《电焊标准节点》；\n9、施工人员可根据现场情况对结构的固定方式以及点位作适当调整，并确保牢固可靠；"
                if xmqy == "国内"
                else f"LED Display area:\\C1;{xscd * 0.001}m*{xsgd * 0.001}m={xscd * xsgd * 0.000001}m2\\C0;."
            )
            mtext = msp.add_mtext(text, dxfattribs={"char_height": 3 * fdbs, "style": "ZGS_CH"}).set_location(insert=p3, attachment_point=ezdxf.const.MTEXT_TOP_LEFT)
            w, h = estimate_mtext_extents(mtext)  # ✅ 获取文字尺寸
            p3 = RelDis(p3, 0, -h)
            p4 = RelDis(p1, pthd + 3 * fdbs * 1.5 * 2, xsgd + bbsb + jlwd + 3 * fdbs * 1.5 * 3)
            p5 = midpoint(p3, p4)
            p00 = RelDis(p5, 229.8309 * fdbs, -148.5 * fdbs)
            insert_scaled_rotated_block_with_attrib(doc, block_name=block_name, insert_point=p00, attribs={"图名": ("显示屏正立面图" if xmqy == "国内" else "LED display front elevation"), "比例": f"1:{fdbs}"}, fdbs=fdbs, rotation=0)
        if pggt:  # 钢结构图
            for s in [dybt]:
                if not s:
                    raise ValueError("钢构图型材规格不能为空，请填写背条。")
            p0 = RelDis(p0, 420 * fdbs, 0)
            if xmqy == "国内":
                p00sm = RelDis(p00, -420 * fdbs, 0)
                insert_scaled_rotated_block_with_attrib(doc, block_name=block_name, insert_point=p00sm, attribs={"图名": "钢结构设计说明", "比例": f"1:{fdbs}"}, fdbs=fdbs, rotation=0)
                if "钢结构设计说明" not in doc.blocks:  # 在 blocks 中新建一个块
                    block = doc.blocks.new(name="钢结构设计说明")
                    pl0 = (0, 0)
                    # 在块内部天机内容
                    block.add_text("钢 结 构 设 计 说 明", dxfattribs={"height": 7.6, "style": "ST"}).set_placement(pl0, align=TextEntityAlignment.BOTTOM_CENTER)
                    text = f"\\C0;一、本设计根据甲方提供的相关图纸及相关要求，参考显示屏使用要求进行设计\n\\C6;工程项目：{cpxh}全彩屏\n显示尺寸：见《显示屏正立面图》所示\n设计阶段：方案设计\n结构安全等级：二级\n主体钢结构设计使用年限：10年\\C0;\n二、主要荷载参数\n\\C6;2.1恒载(显示屏单元箱体自重)：0.3KN/M²\n2.2活载(施工或检修集中荷载)：-KN\n2.3地震(设防烈度)：7度(0.10G)\n2.4基本风压：-KN/M²(50年重现期)\\C0;\n三、本设计中主要参照以下国家现行规范及规程进行结构设计：\n3.1《建筑结构荷载规范》(GB50009-2012)；\n3.2《钢结构设计标准》(GB50017-2017)；\n3.3《冷弯型钢结构技术标准》(GB/T50018-2025)；\n3.4《建筑抗震设计标准》(2024年版)(GB/T50011-2010)；\n3.5《钢结构工程施工质量验收标准》(GB50205-2020)；\n3.6《钢结构焊接规范》(GB50661-2011)；\n3.7《钢筋焊接及验收规程》(JGJ18-2012)；\n3.8《户外广告设施钢结构技术规程》(CECS148-2003)；\n3.9《工程结构通用规范》(GB55001-2021)；\n3.10《钢结构通用规范》(GB55006-2021)；\n3.11《涂装前钢材表面锈蚀等级和除锈等级》(GB/T 8923.1-2011)；\n3.12《建筑结构可靠性设计统一标准》(GB50068-2018)；\n3.13《建筑钢结构防火技术规范》(GB51249-2017)；\n3.14《建筑与市政工程抗震通用规范》(GB55002-2021)。\n本工程施工涉及本表未列的规范、规程和规定时，尚应按相关规范要求执行；\n涉及到的规范、规程和标准截止到设计日期以最新发布日期版本内容要求为准；\n在工作年限内，未经技术鉴定或设计许可，不得改变结构用途和使用环境。\n四、建筑部分\n4.1除图中特别注明外，尺寸均以毫米(mm)为单位，标高均以米(m)为单位。\n4.2屏体装饰、装饰尺寸详见包边详图。\n4.3混凝土结构的环境类别本工程混凝土结构的环境类别为二类b。\n4.4材料\n4.4.1混凝土强度等级：本设计中垫层为素混凝土C15，基础及柱为混凝土C30，钢筋保护层为50mm。\n4.4.2钢筋：φ表示HPB235级钢；Φ表示HRB335级钢。\n钢筋抗拉强度实测值与屈服强度实测值的比值不应小于1.25；钢筋强度标准值应具有不小于95%的保证率；且钢筋的屈服强度实测值与强度标准值的比值不应大于1.3。\n4.5钢筋的混凝土保护层厚度钢筋的混凝土保护层厚度为50mm。\n4.6钢筋的锚固受拉钢筋的锚固长度详见G3291；受压钢筋的锚固长度为受拉锚固的0.7倍。\n4.7钢筋的连接\n4.7.1受拉钢筋搭接长度详见G3291。\n4.7.2钢筋搭接的接头率是在一个接头区段内搭接钢筋的截面面积与全部纵向钢筋截面面积的比值。计算接头率的区段长度为1.3倍的钢筋搭接长度。\n4.7.3受压钢筋搭接长度为受拉搭接长度的0.7倍，且不小于200。\n4.8室外日平均温度连续5天稳定低于5C°时，应采取冬季施工措施。\n4.9结构施工中必须密切配合建施、结施、电施等有关图纸施工。\n4.10混凝土工程质量应符合下列规范要求：\n4.10.1《混凝土结构工程施工质量验收规范》(GB50204-2015)\n4.10.2《钢筋焊接及验收规程》(JGJ18-2012)\n五、结构部分\n5.1材料要求\n5.1.1构件均采用Q235B钢，其力学性能及碳、硫、磷含量必符合《碳素结构钢》(GB/T700-2006)的规定。\n5.2焊接材料"
                    block.add_mtext(text, dxfattribs={"char_height": 2.5, "width": 144, "style": "ST"}).set_location(insert=RelDis(pl0, -158, -6.25), attachment_point=ezdxf.const.MTEXT_TOP_LEFT)
                    text = f"\\C0;5.2.1焊条、手工焊时为E43xx型焊条，其性能应符合《非合金钢及细晶粒钢焊条》(GB/T5117-2012)之相关规定。\n5.2.2自动焊或半自动焊时采用能符合《熔化焊用钢丝》(GB/T14957-94)规定的焊丝。\n5.3高强螺栓\n5.3.1本工程高强度螺栓均采用摩擦型连接设计。\n5.3.2在高强度螺栓连接范围内，构件接触面应做喷砂或喷丸处理。\n5.3.3高强度螺栓应符合《钢结构用高强度大六角头螺栓连接副》(GB/T1231-2024)的规定；\n5.3.4锚栓可采用《碳素结构钢》(GB/T700-2006)中规定的Q235钢或《低合金高强度结构钢》(GB/T1591-2018)中规定的Q345钢制成。\n5.4制作要求\n5.4.1结构制作严格按照《钢结构工程施工质量验收标准》进行，材料表中的构件长度仅供统计材料使用，各种构件必须放大1：1大样加以校核，尺寸无误后制作。\n5.4.2钢材加工前校正使之平直。\n5.4.3混凝土结构部分的施工严格按照《混凝土施工规范》制作施工。\n5.5焊接要求\n5.5.1施焊时应选择合理的焊接顺序，采用预热或其他方式减少焊接应力和焊接变形。\n5.5.2未注明的贴角焊缝，其焊接尺寸H等于较薄的构件厚度的1.2倍，焊缝长度沿构件搭接周边全长满焊。\n5.5.3焊缝及焊接材料与母材的匹配均应符合设计要求及国家现行标准《钢结构通用规范》(GB55006-2021)的规定。\n5.5.4焊缝表面不得有裂纹、焊瘤等缺陷。法兰盘应保证平整，不能发生翘曲且于立柱中轴线横竖两方向均保持垂直；法兰盘接合面和底座下基面应打磨平整。\n5.6钢结构安装要求\n5.6.1钢结构构件加工前需仔细核校尺寸无误后方可加工，施工。\n5.6.2钢结构构件在运输，吊装过程中，应采取加固措施防止变形和损坏。\n5.6.3钢结构受力后，不得在受力构件上焊接。\n5.6.4焊接柱底板加劲肋时，应采用回焊法避免起落弧缺陷发生在加劲肋的边缘。\n5.6.5任何螺栓孔不得随意割扩，不得更改螺栓直径。高强螺栓的安装应保证准确的预拉力，不得欠拉，更不得超拉。\n5.6.6当连接中采用栓焊混接时应先栓接后焊接。\n5.6.7单元箱安装框架对角和平面度应满足单元箱安装需要(±2mm)。\n5.6.8单元箱安装杆件弯曲不得大于长度的1/5000；局部弯曲不得大于被测长度的1/300。\n5.6.9遵循《钢结构工程施工质量验收标准》(GB50205-2020)。\n\\C4;5.7除锈防腐\n5.7.1钢结构构件采用手工除锈，除锈等级为：ST2.5，彻底的手工和动力工具除锈，钢材表面无可见的油脂和污垢，并且没有附着不牢的氧化皮、铁锈和油漆涂层等附着物。\n5.7.2钢结构制作完成后，所有钢结构表面采用铁红环氧酯底漆两遍+环氧硝基磁漆两遍；防锈底漆漆膜总厚度不小于125um，同时要求使用过程中应该及时对破环的涂装部位进行修补，防锈漆至多每隔5年均需要进行重新涂装，需进行维修的次数不少于2次/年(不含正常养护的次数)。\n5.7.3下列部位禁止涂漆：\n5.7.3.1高强度螺栓连接的摩擦接触面。\n5.7.3.2工地焊接部位及两侧100mm，但此部位需进行不影响焊接的除锈处理。\n5.7.4箱体螺栓在屏体调整完毕后，涂黄油保护，以便拆卸。\n\\C7;5.8防火要求\n5.8.1本工程防火等级为二级。\n5.8.2构件防火保护措施:构件表面喷涂膨胀型防火涂料,等效热阻0.36m2·℃/W。\n5.8.3防火材料性能要求及设计指标，防火涂料应满足《钢结构防火涂料》（GB14907-2018）的要求且应与防锈蚀油漆（涂料）相容，且防火涂料需经过当地消防部门认证。其余详见建筑专业说明。\n5.8.4室外、半室外钢结构采用膨胀型防火涂料时，应选用符合环境对其性能要求的产品。\n5.8.5非膨胀型防火涂料涂层的厚度不应小于25mm。\n5.8.6防火涂料与防腐涂料应相容、匹配。\\C0;\n六、其他\n6.1所有钢结构构件应根据实际情况定期维护，以保证其耐久性。\n6.2钢结构构件中的所有钢铁件(包括螺母、螺栓等)需热浸镀锌处理时，所用锌应为《锌锭》(GB/T470-2008)中规定的0号锌，其中：立柱、横梁、法兰盘的镀锌量为550g/m²，厚度≥78μm；紧固件(包括立柱的金属预埋件)镀锌量为350g/m²，厚度≥50μm。\n6.3本工程钢结构应可靠接地，工作接地电阻应≤4Ω，防雷地线≤10Ω，必要时须在结构顶端安装防雷避雷针，避雷针顶端部分，及其底部与柱顶板接触的面勿喷涂油漆。"
                    block.add_mtext(text, dxfattribs={"char_height": 2.5, "width": 144, "style": "ST"}).set_location(insert=RelDis(pl0, 0, -6.25), attachment_point=ezdxf.const.MTEXT_TOP_LEFT)
                msp.add_blockref("钢结构设计说明", insert=RelDis(p00sm, -219.43 * fdbs, 270 * fdbs), dxfattribs={"xscale": fdbs, "yscale": fdbs, "rotation": 0})
            p00fm = RelDis(p00sm if xmqy == "国内" else p00, -420 * fdbs, 0)
            insert_scaled_rotated_block_with_attrib(doc, block_name=block_name, insert_point=p00fm, attribs={"图名": "封面" if xmqy == "国内" else "Cover", "比例": f"1:{fdbs}"}, fdbs=fdbs, rotation=0)
            msp.add_mtext(f"\W1.0;{snhw if xmqy == '国内' else ('Indoors ' if snhw == '室内' else 'Outdoors ')}{cpxh}{'全彩屏' if xmqy == '国内' else ' LED display screen'}", dxfattribs={"char_height": 12 * fdbs, "style": "ST", "color": 4}).set_location(
                insert=RelDis(p00fm, -230 * fdbs, 252 * fdbs), attachment_point=ezdxf.const.MTEXT_MIDDLE_CENTER
            )
            msp.add_mtext("\W1.0;---", dxfattribs={"char_height": 12 * fdbs, "style": "ST", "color": 4}).set_location(insert=RelDis(p00fm, -230 * fdbs, 222 * fdbs), attachment_point=ezdxf.const.MTEXT_MIDDLE_CENTER)
            msp.add_mtext(f'\W1.0;{"方案设计"if xmqy == "国内" else "Solution design"} V1.0', dxfattribs={"char_height": 12 * fdbs, "style": "ST", "color": 4}).set_location(insert=RelDis(p00fm, -230 * fdbs, 192 * fdbs), attachment_point=ezdxf.const.MTEXT_MIDDLE_CENTER)
            msp.add_line(RelDis(p00fm, -350 * fdbs, 70.8 * fdbs), RelDis(p00fm, -110 * fdbs, 70.8 * fdbs), dxfattribs={"color": 4})
            msp.add_mtext(f'强力巨彩光电科技有限公司\nXiamen Qiangli Jucai Opto-Electronic Technology Co., Ltd.\n日期：{datetime.datetime.now().strftime("%Y-%m-%d")}', dxfattribs={"char_height": 7.5 * fdbs, "style": "ST", "color": 4}).set_location(
                insert=RelDis(p00fm, -230 * fdbs, 94.5 * fdbs), attachment_point=ezdxf.const.MTEXT_TOP_CENTER
            )
            insert_scaled_rotated_block_with_attrib(doc, block_name=block_name, insert_point=RelDis(p00, 420 * fdbs, 0), attribs={"图名": ("显示屏正立面结构图" if xmqy == "国内" else "LED display front elevation"), "比例": f"1:{fdbs}"}, fdbs=fdbs, rotation=0)
            draw_rectangle(msp, RelDis(p0, -bbcb, -bbxb - ldgd), RelDis(p0, xscd + bbcb, xsgd + bbsb + jlwd))
            # ==========
            engine = ProfileEngine()  # 创建型材引擎
            # 正立面结构图==========
            if cltj:
                cltjlst = []
            p1 = RelDis(p0, (0 if engine.add(msp, dybt, typeX=31) * 0.5 < bbcb else (engine.add(msp, dybt, typeX=31) * 0.5 - bbcb)), -bbxb - ldgd)
            p2 = RelDis(p0, (0 if engine.add(msp, dybt, typeX=31) * 0.5 < bbcb else (engine.add(msp, dybt, typeX=31) * 0.5 - bbcb)), xsgd + bbsb + jlwd)
            bt = engine.add(msp, dybt, typeX=0, points=[p1, p2], jz=0, scale=1.0)  # 绘制多线
            bt.dxf.layer = Layer_settings(dybt)
            # bt.dxf.color = 256
            if engine.add(msp, dybt, typeX=31) * 0.5 > bbcb:
                bt = engine.add(msp, dybt, typeX=0, points=[RelDis(p0, dycd, -bbxb - ldgd), RelDis(p0, dycd, xsgd + bbsb + jlwd)], jz=0, scale=1.0)
                bt.dxf.layer = Layer_settings(dybt)
                array_rect(msp, bt, 1, plls - 1, dygd, dycd)
                engine.add(msp, dybt, typeX=0, points=[RelDis(p0, ptcd - max(engine.add(msp, dybt, typeX=31) * 0.5, bbcb), -bbxb - ldgd), RelDis(p0, ptcd - max(engine.add(msp, dybt, typeX=31) * 0.5, bbcb), xsgd + bbsb + jlwd)], jz=0, scale=1.0).dxf.layer = Layer_settings(dybt)
            else:
                array_rect(msp, bt, 1, plls + 1, dygd, dycd)
            if cltj:
                cltjlst.extend([("第一背条", dybt, bbxb + ldgd + xsgd + bbsb + jlwd)] * (plls + 1))
            if bthg:
                qy = engine.add(msp, bthg, typeX=32) * 0.5 - bbxb - ldgd
                if dycd == 600 and (engine.add(msp, bthg, typeX=32) - bbxb - ldgd) < 0:
                    qy = dygd * 0.5
                qylst = [qy]
                qy = xsgd + bbsb + jlwd - engine.add(msp, bthg, typeX=32) * 0.5
                if dycd == 600 and (engine.add(msp, bthg, typeX=32) - bbxb - ldgd) < 0:
                    qy = qy - dygd * 0.5
                qylst.append(qy)
                n = int(round((ptgd + ldgd + jlwd) / mjsj + 0.1, 0)) - 1
                if n > 0:
                    p1 = RelDis(p0, -bbcb, (ptgd + ldgd + jlwd) / (n + 1) - bbxb - ldgd)
                    if dycd == 600 and ((abs(p1[1] - p0[1])) % dygd) == 0:
                        p1 = RelDis(p1, 0, dygd * 0.5)
                    qylst.append(p1[1])
                    for _ in range(n - 1):
                        qylst.append(qylst[-1] + (ptgd + ldgd + jlwd) / (n + 1))
                qylst = list(dict.fromkeys(qylst))
                qylst.sort(reverse=False)  # False为升序，True为降序
                if azys == "嵌入" and engine.add(msp, flmj, typeX=32) > 0:
                    if (abs(qylst[0] + bbxb + ldgd)) < engine.add(msp, flmj, typeX=32) * 0.5:
                        qylst[0] = engine.add(msp, flmj, typeX=32) * 0.5 - bbxb - ldgd
                    if (abs(qylst[-1] - xsgd - bbsb - jlwd)) < engine.add(msp, flmj, typeX=32) * 0.5:
                        qylst[-1] = xsgd + bbsb + jlwd - engine.add(msp, flmj, typeX=32) * 0.5
                for qy in qylst:
                    engine.add(msp, bthg, typeX=0, points=[RelDis(p0, -bbcb, qy), RelDis(p0, xscd + bbcb, qy)], jz=0, scale=1.0, angle=90).dxf.layer = Layer_settings(bthg)
                for qy in list(zip(qylst, qylst[1:])):
                    msp.add_linear_dim(base=RelDis(p0, -bbcb - 3 * fdbs * 1.5 * 1, 0), p1=RelDis(p0, 0, qy[0]), p2=RelDis(p0, 0, qy[1]), dimstyle=f"{fdbs}", angle=90)
                msp.add_linear_dim(base=RelDis(p1, -3 * fdbs * 1.5 * 2, 0), p1=RelDis(p0, -bbcb, -bbxb - ldgd), p2=RelDis(p0, -bbcb, xsgd + bbsb + jlwd), dimstyle=f"{fdbs}", angle=90)
                if cltj:
                    cltjlst.extend([("(顶底+中)背条横杆", bthg, ptcd)] * len(qylst))
            else:
                msp.add_linear_dim(base=RelDis(p0, -bbcb - 3 * fdbs * 1.5 * 1, 0), p1=RelDis(p0, -bbcb, -bbxb - ldgd), p2=RelDis(p0, -bbcb, xsgd + bbsb + jlwd), dimstyle=f"{fdbs}", angle=90)
            m = int(mjhj / dycd) * dycd
            qxlst = [xscd % m * 0.5]
            for _ in range(int(xscd / m)):
                qxlst.append(qxlst[-1] + m)
            qxlst = list(dict.fromkeys(qxlst))
            qxlst.sort(reverse=False)  # False为升序，True为降序
            if azys == "嵌入" and engine.add(msp, flmj, typeX=31) > 0:
                if (abs(qxlst[0] + bbcb)) < engine.add(msp, flmj, typeX=31) * 0.5:
                    qxlst[0] = engine.add(msp, flmj, typeX=31) * 0.5 + bbcb
                if (abs(qxlst[-1] - xscd - bbcb)) < engine.add(msp, flmj, typeX=31) * 0.5:
                    qxlst[-1] = xscd + bbcb - engine.add(msp, flmj, typeX=31) * 0.5
            flmj1 = engine.add(msp, flmj, typeX=31) if flmj else 0
            if ldgd > 0 and flmj1 > 0:
                for qx in qxlst:
                    engine.add(msp, flmj, points=[RelDis(p0, qx, -bbxb - ldgd)], typeX=11, jz=1)
                p1 = RelDis(p0, xscd % m * 0.5, -bbxb - ldgd)
                inlenderX(msp, flmj, p0=[RelDis(p1, 0, engine.add(msp, dybt, typeX=33) * -0.5)], p1=RelDis(p1, 3 * fdbs * 1.5, -3 * fdbs * 1.5), dim=f"{fdbs}")  # 引线
                if cltj:
                    cltjlst.extend([("地面法兰埋板", flmj, len(qxlst))] * 1)
            if jlwd > 0 and flmj1 > 0:
                for qx in qxlst:
                    engine.add(msp, flmj, points=[RelDis(p0, qx, xsgd + bbsb + jlwd)], typeX=11, jz=1, angle=180)
                p1 = RelDis(p0, xscd % m * 0.5, xsgd + bbsb + jlwd)
                if ldgd == 0:
                    inlenderX(msp, flmj, p0=[RelDis(p1, 0, engine.add(msp, dybt, typeX=33) * 0.5)], p1=RelDis(p1, 3 * fdbs * 1.5, 3 * fdbs * 1.5), dim=f"{fdbs}")  # 引线
                if cltj:
                    cltjlst.extend([("顶部法兰埋板", flmj, len(qxlst))] * 1)
            if sphg and ldgd + bbxb > engine.add(msp, sphg, typeX=32):
                engine.add(msp, sphg, typeX=0, points=[RelDis(p0, -bbcb, 0), RelDis(p0, xscd + bbcb, 0)], jz=-1, angle=90).dxf.layer = Layer_settings(sphg)
                if cltj:
                    cltjlst.extend([("水平横杆", sphg, ptcd)] * 1)
            # 标注
            n = 0
            p1 = RelDis(p0, 0, xsgd + bbsb + jlwd)
            p2 = RelDis(p1, dycd, 0)
            p3 = midpoint(p1, p2)
            n = n + 1
            msp.add_linear_dim(base=RelDis(p3, 0, 3 * fdbs * 1.5 * n), p1=p1, p2=p2, dimstyle=f"{fdbs}")
            p1 = RelDis(p0, -bbcb, xsgd + bbsb + jlwd)
            p2 = RelDis(p1, ptcd, 0)
            n += 1
            msp.add_linear_dim(base=RelDis(p3, 0, 3 * fdbs * 1.5 * n), p1=p1, p2=p2, dimstyle=f"{fdbs}")
            p1 = RelDis(p0, xscd * 0.5, 0 - bbxb - ldgd - 3 * fdbs * 1.5)
            add_display_facade_title(msp, p1, text=("显示屏正立面结构图" if xmqy == "国内" else "LED display front elevation"), fdbs=fdbs)
            # 增加A-A标识
            n += 1
            msp.add_text("A", dxfattribs={"height": 3 * fdbs, "style": "ZGS_CH"}).set_placement(RelDis(p0, 0, 0 - bbxb - ldgd - 3 * fdbs * 1.5), align=TextEntityAlignment.MIDDLE_CENTER)
            msp.add_lwpolyline([RelDis(p0, -1.5 * fdbs, 0 - bbxb - ldgd - 3 * fdbs * 1.5 + 1.5 * fdbs), RelDis(p0, -1.5 * fdbs, 0 - bbxb - ldgd - 3 * fdbs * 1.5 - 2 * fdbs), RelDis(p0, 1.5 * fdbs, 0 - bbxb - ldgd - 3 * fdbs * 1.5 - 2 * fdbs)], dxfattribs={"const_width": 0.2 * fdbs, "color": 6})
            msp.add_text("A", dxfattribs={"height": 3 * fdbs, "style": "ZGS_CH"}).set_placement(RelDis(p0, 0, xsgd + bbsb + jlwd + n * 3 * fdbs * 1.5), align=TextEntityAlignment.MIDDLE_CENTER)
            msp.add_lwpolyline(
                [RelDis(p0, -1.5 * fdbs, xsgd + bbsb + jlwd + n * 3 * fdbs * 1.5 - 1.5 * fdbs), RelDis(p0, -1.5 * fdbs, xsgd + bbsb + jlwd + n * 3 * fdbs * 1.5 + 1.5 * fdbs), RelDis(p0, 1.5 * fdbs, xsgd + bbsb + jlwd + n * 3 * fdbs * 1.5 + 1.5 * fdbs)],
                dxfattribs={"const_width": 0.2 * fdbs, "color": 6},
            )
            p1 = RelDis(p0, dycd * int(plls * 0.7), engine.add(msp, sphg, typeX=32) * -0.5) if (sphg and engine.same_spec([dybt, sphg])) else ""
            inlenderX(msp, dybt, p0=[RelDis(p0, dycd * int(plls * 0.7), 0 - bbxb - ldgd + 40), p1], p1=RelDis(p0, dycd * int(plls * 0.7) + 3 * fdbs * 1.5, 0 - bbxb - ldgd - 3 * fdbs * 1.5), dim=f"{fdbs}")  # 引线
            # raise ValueError(f"调试1")#抛出异常,可用于参数调试
            # 侧立面结构图------------------------------------------------
            p1 = RelDis(p0, xscd + bbcb + pthd + 3 * fdbs * 1.5 * 2 * 2, 0)
            rectangle = draw_rectangle(msp, RelDis(p1, pthd - dyhd, 0), RelDis(p1, pthd, dygd), layer="ZGS09")
            array_rect(msp, [rectangle], plhs, 1, dygd, dycd)
            draw_rectangle(msp, RelDis(p1, pthd - dyhd, 0), RelDis(p1, pthd, xsgd))
            hatch = msp.add_hatch()
            hatch.dxf.true_color = rgb2int((0, 0, 255))  # 设置图案颜色为蓝色
            hatch.paths.add_polyline_path([RelDis(p1, pthd - dyhd, 0), RelDis(p1, pthd, 0), RelDis(p1, pthd, xsgd), RelDis(p1, pthd - dyhd, xsgd)], is_closed=True)  # 边界路径（必须是闭合多段线）
            hatch.set_pattern_fill("ANSI37", scale=min(20, fdbs) * 0.5)  # 设置填充图案
            draw_rectangle(msp, RelDis(p1, 0, -bbxb - ldgd), RelDis(p1, pthd, xsgd + bbsb + jlwd))
            if sphg and dyhd >= engine.add(msp, sphg, typeX=31) and bbxb + ldgd >= engine.add(msp, sphg, typeX=32):
                bt = engine.add(msp, sphg, points=[RelDis(p1, pthd - dyhd + engine.add(msp, sphg, typeX=31) * 0.5, engine.add(msp, sphg, typeX=32) * -0.5)], typeX=11).dxf.layer = Layer_settings(sphg)
            engine.add(msp, dybt, points=[RelDis(p1, pthd - dyhd, -bbxb - ldgd), RelDis(p1, pthd - dyhd, xsgd + bbsb + jlwd)], typeX=0, jz=1, angle=90).dxf.layer = Layer_settings(dybt)
            bt0 = (engine.add(msp, zcsg, typeX=32) * 0.5) if zcsg else (pthd - dyhd - engine.add(msp, dybt, typeX=32) * 0.5)
            if flmj:
                if azys in ["顶天立地", "落地拉墙"]:
                    engine.add(msp, flmj, points=[RelDis(p1, bt0, -bbxb - ldgd)], typeX=11, jz=1)
                if azys in ["顶天立地", "吊装"]:
                    engine.add(msp, flmj, points=[RelDis(p1, bt0, xsgd + bbsb + jlwd)], typeX=11, jz=1, angle=180)
            bt0 = dyhd + engine.add(msp, dybt, typeX=32) + engine.add(msp, bthg, typeX=31)
            if bthg and pthd >= bt0:
                for qy in qylst:
                    engine.add(msp, bthg, points=[RelDis(p1, pthd - bt0 + engine.add(msp, bthg, typeX=31) * 0.5, qy)], typeX=11).dxf.layer = Layer_settings(bthg)
                    if azys in ["壁挂", "嵌入", "落地拉墙"] and flmj and not (azys == "落地拉墙" and qy == qylst[0]):
                        engine.add(msp, flmj, points=[RelDis(p1, 0, qy)], typeX=11, jz=-1, angle=-90)
                    if ntlg and pthd - bt0 - engine.add(msp, zcsg, typeX=32) > 0 and not (engine.add(msp, zcsg, typeX=32) == 0 and azys == "落地拉墙" and qy == qylst[0]):
                        engine.add(msp, ntlg, points=[RelDis(p1, engine.add(msp, zcsg, typeX=32), qy), RelDis(p1, pthd - bt0, qy)], typeX=0, jz=0, angle=90).dxf.layer = Layer_settings(ntlg)
                if cltj and azys in ["壁挂", "嵌入", "落地拉墙"] and flmj:
                    cltjlst.extend([("墙面法兰埋板", flmj, (len(qylst) - (1 if azys == "落地拉墙" else 0)) * len(qxlst))] * 1)
                if cltj and ntlg and pthd - bt0 - engine.add(msp, zcsg, typeX=32) > 0:
                    cltjlst.extend([("墙面牛腿横杆", ntlg, pthd - bt0 - engine.add(msp, zcsg, typeX=32))] * len(qylst) * len(qxlst))
            if zcsg:
                engine.add(msp, zcsg, points=[RelDis(p1, 0, -bbxb - ldgd), RelDis(p1, 0, xsgd + bbsb + jlwd)], typeX=0, jz=-1, angle=90).dxf.layer = Layer_settings(zcsg)
                if cltj:
                    cltjlst.extend([("主承竖杆", zcsg, bbxb + ldgd + xsgd + bbsb + jlwd)] * (int(xscd / (int(mjhj / dycd) * dycd)) + 1))
            # 标注
            n = 0
            p2 = RelDis(p1, pthd, 0)
            p3 = RelDis(p2, 0, xsgd)
            p4 = RelDis(midpoint(p2, p3), 3 * fdbs * 1.5 * n, 0)
            n = n + 1
            msp.add_linear_dim(base=RelDis(p4, 3 * fdbs * 1.5 * n, 0), p1=p2, p2=p3, dimstyle=f"{fdbs}", angle=90)
            if ldgd > 0 or bbxb > 0:
                p3 = RelDis(p2, 0, -ldgd - bbxb)
                msp.add_linear_dim(base=RelDis(p4, 3 * fdbs * 1.5 * n, 0), p1=p2, p2=p3, dimstyle=f"{fdbs}", angle=90)
            if jlwd > 0:
                p3 = RelDis(p2, pthd, xsgd)
                p2 = RelDis(p3, 0, jlwd + bbsb)
                msp.add_linear_dim(base=RelDis(p4, 3 * fdbs * 1.5 * n, 0), p1=p2, p2=p3, dimstyle=f"{fdbs}", angle=90)
            n = n + 1
            p2 = RelDis(p1, pthd, -ldgd - bbxb)
            p3 = RelDis(p1, pthd, xsgd + jlwd + bbsb)
            msp.add_linear_dim(base=RelDis(p4, 3 * fdbs * 1.5 * n, 0), p1=p2, p2=p3, dimstyle=f"{fdbs}", angle=90)
            n = 0
            p2 = RelDis(p3, -dyhd, 0)
            p4 = RelDis(midpoint(p2, p3), 0, 3 * fdbs * 1.5 * n)
            n = n + 1
            msp.add_linear_dim(base=RelDis(p4, 0, 3 * fdbs * 1.5 * n), p1=p2, p2=p3, dimstyle=f"{fdbs}")
            p2 = RelDis(p3, -pthd, 0)
            n = n + 1
            msp.add_linear_dim(base=RelDis(p4, 0, 3 * fdbs * 1.5 * n), p1=p2, p2=p3, dimstyle=f"{fdbs}")
            p2 = RelDis(p1, pthd * 0.5, 0 - bbxb - ldgd - 3 * fdbs * 1.5)
            add_display_facade_title(msp, p2, text="A-A", fdbs=fdbs)
            # raise ValueError(f"调试2")#抛出异常,可用于参数调试
            # 平面结构图------------------------------------------------
            p2 = RelDis(p0, 0, -bbxb - ldgd - 3 * fdbs * 1.5 * 2 * 2 - pthd)
            rectangle = draw_rectangle(msp, p2, RelDis(p2, dycd, dyhd), layer="ZGS09")
            array_rect(msp, [rectangle], 1, plls, dygd, dycd)
            draw_rectangle(msp, p2, RelDis(p2, xscd, dyhd))
            hatch = msp.add_hatch()
            hatch.dxf.true_color = rgb2int((0, 0, 255))  # 设置图案颜色为蓝色
            hatch.paths.add_polyline_path([p2, RelDis(p2, xscd, 0), RelDis(p2, xscd, dyhd), RelDis(p2, 0, dyhd)], is_closed=True)  # 边界路径（必须是闭合多段线）
            hatch.set_pattern_fill("ANSI37", scale=min(20, fdbs) * 0.5)  # 设置填充图案
            draw_rectangle(msp, RelDis(p2, -bbcb, 0), RelDis(p2, xscd + bbcb, pthd))
            #
            if bbcb >= engine.add(msp, dybt, typeX=31) * 0.5:
                bt = engine.add(msp, dybt, points=[RelDis(p2, 0, dyhd + engine.add(msp, dybt, typeX=32) * 0.5)], typeX=11, jz=1)
                bt.dxf.layer = Layer_settings(dybt)
                array_rect(msp, bt, 1, plls + 1, dygd, dycd)
            else:
                engine.add(msp, dybt, points=[RelDis(p2, -bbcb + engine.add(msp, dybt, typeX=31) * 0.5, dyhd + engine.add(msp, dybt, typeX=32) * 0.5)], typeX=11).dxf.layer = Layer_settings(dybt)
                engine.add(msp, dybt, points=[RelDis(p2, xscd + bbcb - engine.add(msp, dybt, typeX=31) * 0.5, dyhd + engine.add(msp, dybt, typeX=32) * 0.5)], typeX=11).dxf.layer = Layer_settings(dybt)
                bt = engine.add(msp, dybt, points=[RelDis(p2, dycd, dyhd + engine.add(msp, dybt, typeX=32) * 0.5)], typeX=11)
                bt.dxf.layer = Layer_settings(dybt)
                array_rect(msp, bt, 1, plls - 1, dygd, dycd)
            if bthg:
                engine.add(msp, bthg, points=[RelDis(p2, -bbcb, dyhd + engine.add(msp, dybt, typeX=32)), RelDis(p2, xscd + bbcb, dyhd + engine.add(msp, dybt, typeX=32))], typeX=0, jz=1).dxf.layer = Layer_settings(bthg)
                for qx in qxlst:
                    if azys in ["壁挂", "落地拉墙", "嵌入"] and flmj:
                        engine.add(msp, flmj, points=[RelDis(p2, qx, pthd)], typeX=11, jz=1, angle=180)
                    if zcsg:
                        engine.add(msp, zcsg, points=[RelDis(p2, qx, pthd - engine.add(msp, zcsg, typeX=32) * 0.5)], typeX=11, jz=1).dxf.layer = Layer_settings(zcsg)
                    if ntlg and (pthd - dyhd - engine.add(msp, dybt, typeX=32) - engine.add(msp, bthg, typeX=31) - engine.add(msp, zcsg, typeX=32)) > 0:
                        engine.add(msp, ntlg, points=[RelDis(p2, qx, pthd - engine.add(msp, zcsg, typeX=32)), RelDis(p2, qx, dyhd + engine.add(msp, dybt, typeX=32) + engine.add(msp, bthg, typeX=31))], typeX=0, jz=0, angle=90).dxf.layer = Layer_settings(bthg)
                if azys in ["壁挂", "落地拉墙", "嵌入"] and flmj:
                    p3 = RelDis(p2, qxlst[0], pthd)
                    inlenderX(msp, flmj, p0=[RelDis(p3, 0, engine.add(msp, flmj, typeX=33) * 0.5)], p1=RelDis(p3, 3 * fdbs * 1.5, 3 * fdbs * 1.5), dim=f"{fdbs}")  # 引线
            # 标注
            n = 0
            p3 = p2
            p4 = RelDis(p3, xscd, 0)
            p5 = RelDis(midpoint(p3, p4), 0, 3 * fdbs * 1.5 * n)
            n = n + 1
            msp.add_linear_dim(base=RelDis(p5, 0, -3 * fdbs * 1.5 * n), p1=p3, p2=p4, dimstyle=f"{fdbs}")
            msp.add_linear_dim(base=RelDis(p2, -bbcb - 3 * fdbs * 1.5 * 1, 0.5 * pthd), p1=RelDis(p2, -bbcb, 0), p2=RelDis(p2, -bbcb, pthd), dimstyle=f"{fdbs}", angle=90)
            if bbcb > 0:
                n = n + 1
                p3 = RelDis(p2, -bbcb, 0)
                p4 = RelDis(p3, ptcd, 0)
                msp.add_linear_dim(base=RelDis(p5, 0, -3 * fdbs * 1.5 * n), p1=p3, p2=p4, dimstyle=f"{fdbs}")
            p3 = RelDis(p2, xscd * 0.5, -3 * fdbs * 1.5 * (n + 1))
            add_display_facade_title(msp, p3, text=("显示屏平面结构图" if xmqy == "国内" else "Display panel planar structure diagram"), fdbs=fdbs)
            # 此处插入材料统计，增加说明等
            # raise ValueError(f"调试")#抛出异常,可用于参数调试
            # raise ValueError(f"cltjlst 内容如下:\n{repr(cltjlst)}")
            p4 = (p2[0], p3[1] - 3 * fdbs)
            if cltj and cltjlst:
                aggregated = []  # [(标题, 合计值)]
                for clbnstr, title, value in cltjlst:
                    foundx = False
                    for i, (agg_title, agg_value) in enumerate(aggregated):
                        if engine.same_spec([agg_title, title]):  # 在已有聚合结果中找是否有"相同规格"
                            aggregated[i] = (agg_title, agg_value + value)
                            foundx = True
                            break
                    if not foundx:
                        aggregated.append((title, value))
                aggregatedZ = 0
                for title, value in aggregated:
                    aggregatedZ = aggregatedZ + engine.add(msp, title, typeX=35) * (value if any(k in title for k in ("板", "件")) else value * 0.001)
                text = "\n".join(f"{title}: {int (value) if int (value) == value else value}" for title, value in aggregated)  # 输出
                text = f"材料统计:\n{text}\n钢结构重量：{aggregatedZ:.2f}kg"
                mtext = msp.add_mtext(text, dxfattribs={"char_height": 3 * fdbs, "style": "ZGS_CH"}).set_location(insert=p4, attachment_point=ezdxf.const.MTEXT_TOP_LEFT)
        # =======================================
        if xmqy != "国内":
            layer = doc.layers.get("会签栏框")
            if layer is not None:
                layer.off()

        purge_all_unused(doc)  # 清理垃圾
        # 图框属性块排序
        inserts = list(msp.query(f'INSERT[name=="{block_name}"]'))  # 查找指定名称的所有图块引用 (INSERT 实体)#query 语法: 'INSERT[name=="块名"]'
        if inserts:
            inserts.sort(key=lambda ins: ins.dxf.insert[0])  # 按插入点的 X 坐标从左到右排序#插入点坐标在 entity.dxf.insert 中，是一个 (x, y, z) 元组
            for idx, insert in enumerate(inserts, start=1):  # 遍历排序后的图块，递增修改属性值
                for att in ["建设单位", "工程名称1", "工程名称2", "工程名称3", "设计阶段", "图号", "出图日期", "总页", "页码"]:  # 通过标签获取属性
                    attrib = insert.get_attrib(att)
                    attva = ""
                    # if att=='建设单位':attva=''
                    if att == "工程名称1":
                        attva = f"{snhw if xmqy == '国内' else ('Indoors' if snhw == '室内' else 'Outdoors')}{'全彩屏' if xmqy == '国内' else ' LED display screen'}"
                    if att == "工程名称2":
                        attva = cpxh
                    # if att=='工程名称3':attva=''
                    if att == "设计阶段":
                        attva = "方案设计" if xmqy == "国内" else "Solution design"
                    if att == "图号":
                        attva = f"FA{str(idx)}"
                    if att == "出图日期":
                        attva = datetime.datetime.now().strftime("%Y/%m/%d")
                    if att == "总页":
                        attva = str(len(inserts))
                    if att == "页码":
                        attva = str(idx)
                    if (attrib is not None) and attva:
                        attrib.dxf.text = attva
        # dxf文件流
        dxf_bytes_io = save_doc0(doc)
        o, n = dxf_bytes_io, f"{filename}.dxf"
        # pdf文件流以及zip文件流
        if pdft and MPL_AVAILABLE:  # 生成多页 PDF（需 matplotlib，前端模式缺失时降级为仅 DXF）
            A0_W_MM = 841.0
            A0_H_MM = 1189.0
            MARGIN_RATIO = 0.05  # 1% 边距
            pdf_io = io.BytesIO()
            ctx = RenderContext(doc)
            with PdfPages(pdf_io) as pdf:
                for idx, insert in enumerate(inserts, start=1):
                    virtual_entities = list(insert.virtual_entities())
                    if not virtual_entities:
                        continue
                    # 1. 计算包围盒（毫米）
                    try:
                        minx, miny, maxx, maxy = extents(virtual_entities)
                    except Exception:  # 如果 extents 失败，手动计算
                        all_points = []
                        for e in virtual_entities:
                            # 对于有顶点或边界框的实体，可以尝试获取几何
                            # 简单方法：如果实体有 .vertices 或 .get_points() 之类，但不同类型差异大
                            # 这里简化：如果无法计算，使用插入点周围的默认范围
                            # 但我们可以尝试用 ezdxf.path 转换
                            try:
                                paths = from_vertices([e])
                                for path in paths:
                                    for vertex in path.vertices():
                                        all_points.append((vertex.x, vertex.y))
                            except:
                                pass
                        if all_points:
                            xs = [p[0] for p in all_points]
                            ys = [p[1] for p in all_points]
                            minx, maxx = min(xs), max(xs)
                            miny, maxy = min(ys), max(ys)
                        else:
                            x, y, _ = insert.dxf.insert
                            minx, miny = x - 420 * fdbs, y
                            maxx, maxy = x, y + 297 * fdbs
                    W = maxx - minx
                    H = maxy - miny
                    if W <= 0 or H <= 0:
                        continue
                    # 2. 添加边距
                    margin_x = 0  # W * MARGIN_RATIO
                    margin_y = 0  # H * MARGIN_RATIO
                    # page_w_mm = W + 2 * margin_x
                    # page_h_mm = H + 2 * margin_y
                    page_w_mm = A0_H_MM
                    page_h_mm = A0_W_MM
                    # 3. 创建图形（单位：英寸）#后续添加限制最大200英寸
                    fig_w_inch = page_w_mm / 25.4
                    fig_h_inch = page_h_mm / 25.4
                    fig, ax = plt.subplots(figsize=(fig_w_inch, fig_h_inch))
                    ax.set_xlim(minx - margin_x, maxx + margin_x)
                    ax.set_ylim(miny - margin_y, maxy + margin_y)
                    ax.set_aspect("equal")
                    ax.axis("off")
                    # 9. 绘制
                    out = MatplotlibBackend(ax)
                    config = Configuration.defaults()
                    frontend = Frontend(ctx, out, config)
                    frontend.draw_entities(virtual_entities)
                    # 10. 保存（固定尺寸，不裁剪）
                    pdf.savefig(fig, bbox_inches=None, pad_inches=0)
                    plt.close(fig)
            pdf_io.seek(0)
            o, n = pdf_io, f"{filename}.pdf"
            if dxft:
                zip_io = io.BytesIO()  # 打包 ZIP
                with zipfile.ZipFile(zip_io, "w", zipfile.ZIP_DEFLATED) as zf:
                    zf.writestr(f"{filename}.dxf", dxf_bytes_io.getvalue())
                    zf.writestr(f"{filename}.pdf", pdf_io.getvalue())
                zip_io.seek(0)
                o, n = zip_io, f"{filename}.zip"
        gc.collect()
        return o, n
    except Exception as e:
        print("DXF 生成器 内部报错,请反馈至 378530220@qq.com ,以便及时修正")
        raise
