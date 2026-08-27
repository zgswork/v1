# pysub/dxf.py
from flask import Blueprint, request, send_file, render_template
import importlib, gc, os, sys
from urllib.parse import quote
from .utils import collect_client_info  # 使用绝对导入，从根目录开始

# 从当前包（pysub）导入 dxf_generator 模块中的 create_dxf 函数
# from .dxf_generator import create_dxf
# 从上级目录（项目根目录）导入 utils 模块中的 collect_client_info,加个.意味着从当前


bp = Blueprint("dxf", __name__, url_prefix="/dxf")


@bp.route("/", methods=["GET", "POST"])
def dxf_page():
    if request.method == "POST":
        try:
            client_info = collect_client_info(request)
            dxf_generator_module = importlib.import_module(".dxf_generator", __package__)  # 第一个参数是相对当前包的路径，第二个参数是当前包名
            importlib.reload(dxf_generator_module)  # 重载模块
            from .dxf_generator import create_dxf  # 再导入需要的函数# 动态导入 dxf_generator（支持热重载）

            # 获取表单参数（与原来一致）
            field_config = [
                ("snhw", str, None),
                ("cpxl", str, None),
                ("cpxh", str, None),
                ("azys", str, None),
                ("dycd", float, 0.0),
                ("plls", int, 1),
                ("dygd", float, 0.0),
                ("plhs", int, 1),
                ("xscd", float, 0.0),
                ("xsgd", float, 0.0),
                ("dyhd", float, 0.0),
                ("pthd", float, 100.0),
                ("jlwd", float, 0.0),
                ("ldgd", float, 0.0),
                ("pdjj", float, 0.0),
                ("bbsb", float, 0.0),
                ("bbxb", float, 0.0),
                ("bbcb", float, 0.0),
                ("mjhj", float, 0.0),
                ("mjsj", float, 0.0),
                ("dybt", str, ""),
                ("bthg", str, ""),
                ("ntlg", str, ""),
                ("sphg", str, ""),
                ("flmj", str, ""),
                ("xmqy", str, ""),
                ("psyt", bool, False),
                ("pggt", bool, False),
                ("cltj", bool, False),
                ("dxft", bool, False),
                ("pdft", bool, False),
                ("lkjx", float, 0.0),  # 留空间隙
                ("zcsg", str, ""),  # 主承竖杆
            ]
            params = {}
            for key, typ, default in field_config:
                raw = request.form.get(key, default)
                if typ is int:
                    try:params[key] = int(raw)
                    except:params[key] = default
                elif typ is float:
                    try:params[key] = float(raw)
                    except:params[key] = default
                elif typ is bool:
                    params[key] = raw in ("on", "1", "true")
                else:
                    params[key] = raw
            file_obj, filename = create_dxf(**params, client_info=client_info)
            gc.collect()
            filename = quote(filename)  # 对含中文文件名做URL编码（RFC 5987标准格式，所有浏览器都认）
            return send_file(file_obj, mimetype="application/dxf", as_attachment=True, download_name=filename)
        except Exception as e:
            return f"<h2>生成失败</h2><pre>{e}</pre>", 500
    # GET 请求：显示该子页面的HTML（独立模板）
    # 你可以将 dxf 的表单页面单独放在 pages/dxf.html 中
    # 或者直接渲染字符串模板。这里演示返回一个简单表单。
    # return render_template("dxf.html")  # 需在 templates 目录创建
