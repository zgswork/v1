class ProfileEngine:
    """
    ProfileEngine
    ------------
    型材参数化建模引擎（2D / 3D / 图块 / 多线 / 扫描）
    支持：
    - 方管 / 圆管 / 角钢 / 槽钢 / H钢 / 钢板
    - 多线偏移（jz 对齐）
    - 截面图块
    - 图块批量插入
    - 3D Sweep 扫描
    - 延米重量计算
    - ezdxf ≥ 1.0 + DXF R2010+ 自动校验
    """

    # 钢材密度（kg/m³）
    STEEL_DENSITY = 7850

    def __init__(self):
        """初始化引擎（延迟加载依赖）"""
        self._math = None
        self._re = None
        self._ezdxf = None
        self._Vec3 = None
        self._ezdxf_version = None

    # ============================================================
    # 内部工具
    # ============================================================
    def _lazy_load(self):
        """延迟加载数学库与 ezdxf"""
        if self._math is None:
            import math
            import re

            self._math = math
            self._re = re
        if self._ezdxf is None:
            try:
                import ezdxf
                from ezdxf.math import Vec3

                self._ezdxf = ezdxf
                self._Vec3 = Vec3
                self._ezdxf_version = tuple(int(x) for x in ezdxf.__version__.split(".")[:2])
            except Exception:
                self._ezdxf = None

    def _parse_profile(self, s: str):  # 解析型材字符串
        """
        解析型材字符串
        返回：[w, h, t, ptype] 或 None
        """
        self._lazy_load()
        re = self._re
        try:
            s = s.strip()
            nums = list(map(float, re.findall(r"\d+(?:\.\d+)?", s)))
            types = re.findall(r"[^\d\*]+", s)
            if not types:
                return None
            ptype = types[-1]
            if len(nums) == 3:
                return nums + [ptype]
            elif len(nums) == 2:
                return [nums[0], nums[0], nums[1], ptype]
            return None
        except Exception:
            return None

    def normalize_spec(self, spec: str) -> str:  # 将规格字符串标准化为统一格式
        """
        将规格字符串标准化为统一格式。
        例如：
        '40*20*2方管' -> '20*40*2方管'（数字排序）
        '20*40*2方管' -> '20*40*2方管'
        '50*30角钢'   -> '30*50角钢'
        """
        import re

        nums = list(map(int, re.findall(r"\d+", spec)))  # 1. 提取所有数字（整数）
        type_part = re.sub(r"[\d\*]+", "", spec).strip()  # 2. 提取非数字部分（类型后缀）#    用正则去掉数字和*，得到剩余字符串（如"方管"）
        nums.sort()  # 3. 对数字排序（升序）
        return "*".join(map(str, nums)) + type_part  # 4. 拼接成标准格式：数字用*连接，后面加类型

    def same_spec(self, specs: list) -> bool:  # 判断列表中所有规格是否可视为同一规格（忽略数字顺序）
        if not specs or len(specs) == 1:
            return True
        normalized = [self.normalize_spec(s) for s in specs]
        return all(s == normalized[0] for s in normalized)  # 所有元素是否都等于第一个

    def _profile_weight(self, w, h, t, ptype):
        """计算延米重量（kg/m）"""
        if ptype == "方管":
            area = (w + h) * 2 * t - 4 * t * t
            ymz= area / 1e6 * self.STEEL_DENSITY
        elif ptype == "圆管":
            area = self._math.pi * t * (w - t)
            ymz= area / 1e6 * self.STEEL_DENSITY
        elif ptype in ("角钢", "槽钢"):
            area = (w + h) * t - t * t
            ymz= area / 1e6 * self.STEEL_DENSITY
        elif ptype == "H钢":
            area = (h + 2 * w) * t - 2 * t * t
            ymz= area / 1e6 * self.STEEL_DENSITY
        elif any(k in ptype for k in ('板', '件')):
            area = w * h*t
            ymz= area / 1e9 * self.STEEL_DENSITY
        else:
            ymz = 0
        return ymz

    def _unique_points(self, pts):
        seen = set()
        res = []
        for p in pts or []:
            key = tuple(round(c, 6) for c in p)
            if key not in seen:
                seen.add(key)
                res.append(p)
        return res

    def ensure_linetypes(self, msp):  # 确保 CONTINUOUS / DASHED / CENTER 线型存在
        lt = msp.doc.linetypes
        xx = [
            ["CONTINUOUS", [1.0, 0.0, -1.0], "Continuous line"],
            ["DASHED", [0.6, 0.3, -0.2, 0.0, -0.2], "Dashed line"],
            ["CENTER", [1.25, 0.8, -0.2, 0.0, -0.2, 0.0, -0.2], "Center line"],
        ]
        for p in xx:
            if p[0] not in lt:
                lt.add(name=p[0], pattern=p[1], dxfattribs={"description": p[2]})
            if p[0] not in lt:
                lt.new(name=p[0], dxfattribs={"pattern": p[1], "description": p[2]})

    def _offset(self, layout, entity, dist):  # 统一封装偏移调用
        """
        统一封装偏移调用
        -------------------------------------------------------
        layout : ezdxf Layout 对象（如 msp 或 block）
        entity  : 要偏移的实体（LWPOLYLINE / CIRCLE 等）
        dist    : 偏移距离（正值/负值控制偏移方向）
        返回     : 偏移生成的新实体列表，失败时返回空列表
        """
        """
        result = []
        try:
            #if hasattr(layout, "add_offset_entities"):
            #    for e in layout.add_offset_entities([entity], dist):
            #        layout.add_entity(e)
            #       result.append(e)
            if hasattr(entity, "offset"):
                new_entities = entity.offset(dist)
                for e in new_entities:
                    layout.add_entity(e)
                    result.append(e)
        except Exception:pass
        return result

        对已有的直线或轻量多段线进行偏移，并返回新创建的实体列表。
        参数：
            layout: 模型空间对象
            entity: 要偏移的实体（LINE 或 LWPOLYLINE）
            dist: 偏移距离（正值左偏，负值右偏）
            closed: 是否闭合（仅对 LWPOLYLINE 有效）
        返回：
            新创建的实体列表（可能包含多个实体，但直线只有一条）
        """
        from ezdxf.math import offset_vertices_2d

        if entity.dxftype() == "LINE":
            # 提取直线的起点和终点
            start = entity.dxf.start
            end = entity.dxf.end
            vertices = [(start.x, start.y), (end.x, end.y)]
            new_verts = list(offset_vertices_2d(vertices, dist))
            if len(new_verts) >= 2:
                new_line = layout.add_line(new_verts[0], new_verts[1])
                return [new_line]
            else:
                return []

        elif entity.dxftype() == "LWPOLYLINE":
            # 提取多段线的所有顶点（忽略凸度，只处理直线段）
            vertices = [(v[0], v[1]) for v in entity.get_points()]
            # 是否闭合由参数决定，也可以从实体自身读取：entity.closed
            new_verts = list(offset_vertices_2d(vertices, dist))
            if len(new_verts) >= 2:
                new_poly = layout.add_lwpolyline(new_verts)
                return [new_poly]
            else:
                return []
        else:
            print("不支持的实体类型")
            return []

    def mirror_entities(self, entities, p1, p2, delete_original=False, layout=None):  # 镜像实体列表
        """
        镜像实体列表。
        Args:
            entities: 实体列表或单个实体。
            p1, p2: 镜像直线两点。
            delete_original: 是否删除原实体。
            layout: 指定布局，若为 None 则自动使用第一个实体的文档的模型空间。

        Returns:
            结果实体列表。
        """
        import math
        import ezdxf
        from ezdxf.math import Vec3, Matrix44
        from ezdxf import transform

        # 统一转换为列表
        if not hasattr(entities, "__iter__"):
            entities = [entities]
        entities = list(entities)
        if not entities:
            return []

        p1 = Vec3(p1)
        p2 = Vec3(p2)
        if (p2 - p1).is_null:
            raise ValueError("镜像直线两点不能重合")

        is_2d = p1.z == 0 and p2.z == 0

        # 构造矩阵
        if is_2d:
            u = (p2 - p1).normalize()
            angle = -math.atan2(u.y, u.x)
            T_neg = Matrix44.translate(-p1.x, -p1.y, 0)
            R = Matrix44.z_rotate(angle)
            S = Matrix44.scale(-1, 1, 1)
            R_inv = Matrix44.z_rotate(-angle)
            T_pos = Matrix44.translate(p1.x, p1.y, 0)
            M = T_pos @ R_inv @ S @ R @ T_neg
        else:
            u = (p2 - p1).normalize()
            T_neg = Matrix44.translate(-p1)
            R = Matrix44.axis_rotate(u, math.radians(180))
            T_pos = Matrix44.translate(p1)
            M = T_pos @ R @ T_neg

        if delete_original:
            for e in entities:
                e.transform(M)
            return entities
        else:
            log, new_entities = transform.copies(entities, M)
            if new_entities:
                # 确定布局：如果未指定，则从第一个实体获取文档并取模型空间
                if layout is None:
                    layout = entities[0].doc.modelspace()
                # 逐个添加副本
                for e in new_entities:
                    layout.add_entity(e)
            return entities + new_entities

    # ============================================================
    # 主接口
    # ============================================================
    def add(self, msp, s: str, typeX: int = 0, points=None, angle: float = 0, jz: int = 0, scale: float = 1.0):
        """
        参数说明
        msp : ezdxf.modelspace()
            模型空间
        s : str
            型材字符串，如 "40*60*3方管"
        typeX : int
            0  = 2D 多线（偏移 + 端头封闭）
            10  = 创建截面图块
            11  = 插入图块（points 去重）
            31 = 返回宽度 w
            32 = 返回高度 h
            33 = 返回壁厚 t
            34 = 返回型材类型
            35 = 返回延米重量 kg/m
            4  = 3D 型材扫描
        points : list[tuple]
            点列表
        angle : float
            图块旋转角度（度）
        jz : int
            -1 = 底对齐
             0 = 中心对齐
             1 = 顶对齐
        scale : float
            型材缩放倍率（尺寸 / 偏移）
        返回:根据 typeX 返回实体、列表、字符串或数值
        环境不满足时返回 None
        """
        self._lazy_load()
        s = s.replace(" ", "")
        params = self._parse_profile(s)
        if params is None:
            return (0.0 if typeX in (31, 32, 33, 34, 35) else None)
        w, h, t, ptype = params
        angle = 0.0 if angle is None else float(angle)
        scale = 1.0 if scale is None or scale <= 0 else float(scale)
        w *= scale
        h *= scale
        t *= scale
        # ========= 查询类（不依赖 ezdxf） =========
        if typeX in (31, 32, 33, 34, 35):
            if angle != 0:
                w, h = h, w
            if typeX == 31:
                return w / scale
            elif typeX == 32:
                return h / scale
            elif typeX == 33:
                return t / scale
            elif typeX == 34:
                return ptype
            elif typeX == 35:
                return round(self._profile_weight(w, h, t, ptype), 3)
            else:
                return None

        # ========= ezdxf 可用性检查 =========
        # if self._ezdxf is None:return None
        #
        # ========= typeX=10 创建截面图块 =========
        elif typeX == 10:
            bw, bh, bt, block_name = w, h, t, s.replace("*", "x")
            # bw, bh,block_name = h, w,f"{int(h)}x{int(w)}x{int(t)}{ptype}"
            if ptype == "埋件":
                block_name = f"埋件{jz}"
            if block_name in msp.doc.blocks:
                return block_name
            b = msp.doc.blocks.new(block_name)

            if ptype == "方管":
                b.add_lwpolyline([(bw * -0.5, bh * -0.5), (bw * 0.5, bh * -0.5), (bw * 0.5, bh * 0.5), (bw * -0.5, bh * 0.5)], close=True)
                b.add_lwpolyline([(bw * -0.5 + t, bh * -0.5 + t), (bw * 0.5 - t, bh * -0.5 + t), (bw * 0.5 - t, bh * 0.5 - t), (bw * -0.5 + t, bh * 0.5 - t)], close=True)
            elif ptype == "圆管":
                b.add_circle((0, 0), bw * 0.5)
                b.add_circle((0, 0), bw * 0.5 - t)
            elif ptype == "角钢":
                b.add_lwpolyline([(bw * -0.5, bh * -0.5), (bw * 0.5, bh * -0.5), (bw * 0.5, bh * -0.5 + t), (bw * -0.5 + t, bh * -0.5 + t), (bw * -0.5 + t, bh * 0.5), (bw * -0.5, bh * 0.5)], close=True)
            elif ptype == "槽钢":
                b.add_lwpolyline([(bw * -0.5, bh * -0.5), (bw * 0.5, bh * -0.5), (bw * 0.5, bh * -0.5 + t), (bw * -0.5 + t, bh * -0.5 + t), (bw * -0.5 + t, bh * 0.5 - t), (bw * 0.5, bh * 0.5 - t), (bw * 0.5, bh * 0.5), (bw * -0.5, bh * 0.5)], close=True)
            elif ptype == "H钢":
                b.add_lwpolyline(
                    [
                        (bw * -0.5, bh * -0.5),
                        (bw * 0.5, bh * -0.5),
                        (bw * 0.5, bh * -0.5 + t),
                        (t * 0.5, bh * -0.5 + t),
                        (t * 0.5, bh * 0.5 - t),
                        (bw * 0.5, bh * 0.5 - t),
                        (bw * 0.5, bh * 0.5),
                        (bw * -0.5, bh * 0.5),
                        (bw * -0.5, bh * 0.5 - t),
                        (t * -0.5, bh * 0.5 - t),
                        (t * -0.5, bh * -0.5 + t),
                        (bw * -0.5, bh * 0.5 + t),
                    ],
                    close=True,
                )
            elif ptype == "埋件":
                if jz == 0:
                    b.add_lwpolyline([(bw * -0.5, bh * -0.5), (bw * 0.5, bh * -0.5), (bw * 0.5, bh * 0.5), (bw * -0.5, bh * 0.5)], close=True)
                    b.add_circle((bw * -0.5 + bt * 2.5, bh * -0.5 + bt * 2.5), radius=(bt + 2) * 0.5)
                    b.add_circle((bw * 0.5 - bt * 2.5, bh * -0.5 + bt * 2.5), radius=(bt + 2) * 0.5)
                    b.add_circle((bw * 0.5 - bt * 2.5, bh * 0.5 - bt * 2.5), radius=(bt + 2) * 0.5)
                    b.add_circle((bw * -0.5 + bt * 2.5, bh * 0.5 - bt * 2.5), radius=(bt + 2) * 0.5)
                elif jz == 1:
                    b.add_lwpolyline([(bw * -0.5, -bt), (bw * 0.5, -bt), (bw * 0.5, 0), (bw * -0.5, 0)], close=True)
                    x = b.add_lwpolyline(
                        [
                            (bw * -0.5 + bt * 2.5, bt * 1.8),
                            (bw * -0.5 + bt * 2.5 - bt * 0.5, bt * 1.8),
                            (bw * -0.5 + bt * 2.5 - bt * 0.5, bt * 1.1),
                            (bw * -0.5 + bt * 2.5 - bt, bt * 1.1),
                            (bw * -0.5 + bt * 2.5 - bt, bt * 0.25),
                            (bw * -0.5 + bt * 2.5 - bt * 1.3, bt * 0.25),
                            (bw * -0.5 + bt * 2.5 - bt * 1.3, 0),
                            (bw * -0.5 + bt * 2.5 - bt * 0.5, 0),
                            (bw * -0.5 + bt * 2.5 - bt * 0.5, bt * -10),
                            (bw * -0.5 + bt * 2.5 - bt * 0.8, bt * -12),
                            (bw * -0.5 + bt * 2.5 + bt * 0.8, bt * -12),
                            (bw * -0.5 + bt * 2.5 + bt * 0.5, bt * -10),
                            (bw * -0.5 + bt * 2.5 + bt * 0.5, 0),
                            (bw * -0.5 + bt * 2.5 + bt * 1.3, 0),
                            (bw * -0.5 + bt * 2.5 + bt * 1.3, bt * 0.25),
                            (bw * -0.5 + bt * 2.5 + bt, bt * 0.25),
                            (bw * -0.5 + bt * 2.5 + bt, bt * 1.1),
                            (bw * -0.5 + bt * 2.5 + bt * 0.5, bt * 1.1),
                            (bw * -0.5 + bt * 2.5 + bt * 0.5, bt * 1.8),
                        ],
                        close=True,
                    )
                    x = x.copy()
                    x.translate(bw - bt * 5, 0, 0)
                    b.add_entity(x)
                    x = b.add_lwpolyline([(bw * -0.5 + bt * 2.5 - bt * 0.5, bt * 1.1), (bw * -0.5 + bt * 2.5 + bt * 0.5, bt * 1.1)])
                    x = x.copy()
                    x.translate(bw - bt * 5, 0, 0)
                    b.add_entity(x)
                    x = b.add_lwpolyline([(bw * -0.5 + bt * 2.5 - bt, bt * 0.25), (bw * -0.5 + bt * 2.5 + bt, bt * 0.25)])
                    x = x.copy()
                    x.translate(bw - bt * 5, 0, 0)
                    b.add_entity(x)

                else:
                    b.add_lwpolyline([(bh * -0.5, -bt), (bh * 0.5, -bt), (bh * 0.5, 0), (bh * -0.5, 0)], close=True)
                    x = b.add_lwpolyline(
                        [
                            (bh * -0.5 + bt * 2.5, bt * 1.8),
                            (bh * -0.5 + bt * 2.5 - bt * 0.5, bt * 1.8),
                            (bh * -0.5 + bt * 2.5 - bt * 0.5, bt * 1.1),
                            (bh * -0.5 + bt * 2.5 - bt, bt * 1.1),
                            (bh * -0.5 + bt * 2.5 - bt, bt * 0.25),
                            (bh * -0.5 + bt * 2.5 - bt * 1.3, bt * 0.25),
                            (bh * -0.5 + bt * 2.5 - bt * 1.3, 0),
                            (bh * -0.5 + bt * 2.5 - bt * 0.5, 0),
                            (bh * -0.5 + bt * 2.5 - bt * 0.5, bt * -10),
                            (bh * -0.5 + bt * 2.5 - bt * 0.8, bt * -12),
                            (bh * -0.5 + bt * 2.5 + bt * 0.8, bt * -12),
                            (bh * -0.5 + bt * 2.5 + bt * 0.5, bt * -10),
                            (bh * -0.5 + bt * 2.5 + bt * 0.5, 0),
                            (bh * -0.5 + bt * 2.5 + bt * 1.3, 0),
                            (bh * -0.5 + bt * 2.5 + bt * 1.3, bt * 0.25),
                            (bh * -0.5 + bt * 2.5 + bt, bt * 0.25),
                            (bh * -0.5 + bt * 2.5 + bt, bt * 1.1),
                            (bh * -0.5 + bt * 2.5 + bt * 0.5, bt * 1.1),
                            (bh * -0.5 + bt * 2.5 + bt * 0.5, bt * 1.8),
                        ],
                        close=True,
                    )
                    x = x.copy()
                    x.translate(bh - bt * 5, 0, 0)
                    b.add_entity(x)

                    x = b.add_lwpolyline([(bh * -0.5 + bt * 2.5 - bt * 0.5, bt * 1.1), (bh * -0.5 + bt * 2.5 + bt * 0.5, bt * 1.1)], close=True)
                    x = x.copy()
                    x.translate(bh - bt * 5, 0, 0)
                    b.add_entity(x)
                    x = b.add_lwpolyline([(bh * -0.5 + bt * 2.5 - bt, bt * 0.25), (bh * -0.5 + bt * 2.5 + bt, bt * 0.25)], close=True)
                    x = x.copy()
                    x.translate(bh - bt * 5, 0, 0)
                    b.add_entity(x)

            return block_name
        # ========= typeX=11 插入图块 =========
        elif typeX == 11:
            pts = self._unique_points(points)
            if not pts:
                return None
            block_name = s.replace("*", "x")
            if ptype == "埋件":
                block_name = f"埋件{jz}"
            if block_name not in msp.doc.blocks:
                self.add(msp, s, typeX=10, jz=jz)
            refs = []
            for pt in pts:
                ref = msp.add_blockref(block_name, pt, dxfattribs={"rotation": angle, "xscale": scale, "yscale": scale})
                refs.append(ref)
            if len(refs) == 1:
                refs = refs[0]
            return refs
        # ========= typeX=0 2D 多线 =========
        elif typeX == 0:
            if not points or len(points) < 2:
                return None
            if ptype == "钢板":
                return None
            style_name = s.replace("*", "x")
            self.ensure_linetypes(msp)
            if style_name not in msp.doc.mline_styles:  # 创建新的多线样式
                style = msp.doc.mline_styles.new(style_name)
                # 添加线
                style.elements.append(offset=w * 0.5, color=256)  # 外线（随层）
                if ptype in ("方管", "圆管"):
                    style.elements.append(offset=w * 0.5 - t, color=256, linetype="DASHED")  # 虚线
                    style.elements.append(offset=0, color=1, linetype="CENTER")  # 中心线
                    style.elements.append(offset=w * -0.5 + t, color=256, linetype="DASHED")
                elif ptype in ("角钢", "槽钢"):
                    style.elements.append(offset=w * 0.5 - t, color=256, linetype="DASHED")
                elif ptype in ("H钢"):
                    style.elements.append(offset=t * 0.5, color=256, linetype="DASHED")
                    style.elements.append(offset=0, color=1, linetype="CENTER")
                    style.elements.append(offset=t * -0.5, color=256, linetype="DASHED")
                else:
                    return None
                style.elements.append(offset=w * -0.5, color=256)  # 内线
                style.dxf.flags = 272  # flags（组码 70，位掩码）：1填充开、2显示连接（斜接）、16起点直线封口、32起点内弧封口、64起点外圆弧封口、256终点直线封口、512终点内弧封口、1024终点外圆弧封口
                style.dxf.start_angle = 90  # 可选：封口角度（90° = 直线封口）
                style.dxf.end_angle = 90
            mline = msp.add_mline(
                vertices=points, close=(self._math.hypot(points[0][0] - points[-1][0], points[0][1] - points[-1][1]) < 1e-6), dxfattribs={"style_name": style_name, "scale_factor": scale if angle == 0 else h / w * scale, "justification": jz + 1}
            )  # 对齐方式：0为顶部、1为居中、2为底部#'layer': '多线层',#'color': 1
            return mline
        # ========= typeX=4 3D 型材 =========
        elif typeX == 4:
            Vec3 = self._Vec3
            if not hasattr(msp.doc, "dxfversion") or msp.doc.dxfversion < "R2010":
                return None
            if not points or len(points) < 2:
                return None
            pts = self._unique_points(points)
            if ptype == "钢板":
                profile = msp.add_lwpolyline([(-w / 2, 0), (w / 2, 0), (w / 2, t), (-w / 2, t), (-w / 2, 0)], close=True)
                return msp.add_3dsolid_from_profiles([profile], extrusion=Vec3(0, 0, h))
            if jz == 0:
                offset_y = -h / 2
            elif jz == 1:
                offset_y = 0
            else:
                offset_y = -h
            path = msp.add_polyline3d([Vec3(p) for p in pts])
            if len(pts) >= 3:
                v1 = Vec3(pts[1]) - Vec3(pts[0])
                v2 = Vec3(pts[2]) - Vec3(pts[1])
                normal = v1.cross(v2).normalize()
            else:
                v1 = Vec3(pts[1]) - Vec3(pts[0])
                normal = v1.cross(Vec3(0, 0, 1)).normalize()
            profile = msp.add_lwpolyline([(0, offset_y), (w, offset_y), (w, offset_y + h), (0, offset_y + h), (0, offset_y)], close=True, dxfattribs={"normal": normal})
            return msp.add_3dsolid_from_profiles([profile], sweep_path=path)
        else:
            return None
