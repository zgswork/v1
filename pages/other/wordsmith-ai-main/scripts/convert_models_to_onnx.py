#!/usr/bin/env python3
"""
模块化 OCR 流水线 — PaddlePaddle PIR → ONNX 转换脚本

将 paddlex_home/official_models/ 下的 4 个 PaddlePaddle 模型转为 ONNX，
并提取字符字典、公式 tokenizer 等运行时所需配置。

=== 关键依赖 ===
    paddle2onnx >= 1.3.0   — PIR 格式 (inference.json) 支持
    onnxslim               — 图优化、冗余节点删除
    onnx                   — 模型加载与验证
    pyyaml                 — 解析 inference.yml（提取字典和预处理参数）
    numpy                  — dummy 推理验证

安装：
    pip install "paddle2onnx>=1.3.0" onnxslim onnx pyyaml numpy

=== 输出 ===
    onnx_models/pipeline/
    ├── layout_det.onnx          (PP-DocLayout_plus-L)
    ├── text_det.onnx            (PP-OCRv5_server_det)
    ├── text_rec.onnx            (PP-OCRv5_server_rec)
    ├── formula_rec.onnx         (PP-FormulaNet_plus-L)
    ├── ppocr_keys_v1.txt        (OCR 字典 — 从 inference.yml 提取)
    ├── formula_tokenizer.json   (公式 tokenizer — 从 inference.yml 提取)
    ├── layout_labels.txt        (版面标签列表)
    └── conversion_report.json   (转换报告)

=== 用法 ===
    python scripts/convert_models_to_onnx.py \
        --paddlex-home ocr_engine/paddlex_home \
        --output ocr_engine/onnx_models/pipeline/

=== 环境依赖提示 ===
    运行时使用 onnxruntime-directml（非普通 onnxruntime），
    本脚本仅在转换阶段运行，不依赖 onnxruntime。
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# 模型配置
# ---------------------------------------------------------------------------

@dataclass
class PipelineModelConfig:
    """单个流水线模型的转换配置"""
    name: str                   # 输出 ONNX 文件名（不含 .onnx）
    paddle_dir_name: str        # paddlex_home/official_models/ 下的目录名
    opset: int = 14             # ONNX opset 版本（14 兼容 DirectML 所有常见算子）
    description: str = ""       # 模型描述


PIPELINE_MODELS = [
    PipelineModelConfig(
        name="layout_det",
        paddle_dir_name="PP-DocLayout_plus-L",
        opset=14,
        description="版面分析（DETR，输入 800×800）",
    ),
    PipelineModelConfig(
        name="text_det",
        paddle_dir_name="PP-OCRv5_server_det",
        opset=14,
        description="文字检测（DB++，输入动态 H×W）",
    ),
    PipelineModelConfig(
        name="text_rec",
        paddle_dir_name="PP-OCRv5_server_rec",
        opset=14,
        description="文字识别（SVTR-CTC，输入 48×320）",
    ),
    PipelineModelConfig(
        name="formula_rec",
        paddle_dir_name="PP-FormulaNet_plus-L",
        opset=14,
        description="公式识别（UniMERNet，输入 768×768 灰度）",
    ),
]


# ---------------------------------------------------------------------------
# 依赖检查
# ---------------------------------------------------------------------------

def check_dependencies() -> bool:
    """检查所有必要的 Python 依赖，输出版本信息"""
    all_ok = True

    # paddle2onnx >= 1.3.0（PIR 格式支持）
    try:
        import paddle2onnx
        version = getattr(paddle2onnx, '__version__', 'unknown')
        print(f"  paddle2onnx: {version}")
        # 检查最低版本
        if version != 'unknown':
            parts = version.split('.')
            major, minor = int(parts[0]), int(parts[1])
            if (major, minor) < (1, 3):
                print(f"  [警告] paddle2onnx >= 1.3.0 才支持 PIR 格式（inference.json），当前版本 {version}")
                print(f"         请升级: pip install 'paddle2onnx>=1.3.0'")
                all_ok = False
    except ImportError:
        print("  [缺失] paddle2onnx — pip install 'paddle2onnx>=1.3.0'")
        all_ok = False

    # onnxslim — 图优化
    try:
        import onnxslim
        version = getattr(onnxslim, '__version__', 'unknown')
        print(f"  onnxslim: {version}")
    except ImportError:
        print("  [缺失] onnxslim — pip install onnxslim")
        all_ok = False

    # onnx — 模型加载与验证
    try:
        import onnx
        print(f"  onnx: {onnx.__version__}")
    except ImportError:
        print("  [缺失] onnx — pip install onnx")
        all_ok = False

    # pyyaml — 解析 inference.yml
    try:
        import yaml
        print(f"  pyyaml: {yaml.__version__}")
    except ImportError:
        print("  [缺失] pyyaml — pip install pyyaml")
        all_ok = False

    # numpy — dummy 推理验证
    try:
        import numpy
        print(f"  numpy: {numpy.__version__}")
    except ImportError:
        print("  [缺失] numpy — pip install numpy")
        all_ok = False

    return all_ok


# ---------------------------------------------------------------------------
# 字典与 Tokenizer 提取
# ---------------------------------------------------------------------------

def extract_ocr_dict(inference_yml_path: Path, output_path: Path) -> int:
    """
    从 PP-OCRv5_server_rec 的 inference.yml 中提取 CTC 字符字典，
    保存为 ppocr_keys_v1.txt（每行一个字符）。

    字典必须包含完整的中文字符、标点符号、英文字母、数字、
    以及特殊符号（包括 emoji）。缺失字符会导致 OCR 输出方框。

    返回提取的字符数量。
    """
    import yaml

    print(f"\n[字典] 从 {inference_yml_path.name} 提取字符字典...")

    with open(inference_yml_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)

    if not config or 'PostProcess' not in config:
        raise ValueError(f"inference.yml 格式异常：缺少 PostProcess 节")

    post_process = config['PostProcess']
    if 'character_dict' not in post_process:
        raise ValueError(f"inference.yml 格式异常：PostProcess 中缺少 character_dict")

    char_list = post_process['character_dict']
    if not isinstance(char_list, list) or len(char_list) == 0:
        raise ValueError(f"character_dict 为空或格式错误")

    # 写入文件：每行一个字符，保持原始顺序
    # 确保使用 UTF-8 编码（含 BOM-less），这对中文和 emoji 至关重要
    with open(output_path, 'w', encoding='utf-8', newline='\n') as f:
        for char in char_list:
            # YAML 解析后 char 是字符串，可能含前导/尾随空白
            # 但字符字典中的空白字符本身就是字典项，不能 strip
            f.write(str(char) + '\n')

    # 验证写入的文件
    with open(output_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    actual_count = len([l for l in lines if l.strip() != '' or l == '\n'])

    print(f"  提取 {len(char_list)} 个字符 → {output_path.name}")
    print(f"  验证: 文件包含 {actual_count} 行")

    # 检查关键字符是否存在
    char_set = set(str(c) for c in char_list)
    essential_checks = {
        '中': '常用汉字',
        'A': '英文大写',
        'a': '英文小写',
        '0': '数字',
        '，': '中文逗号',
        '。': '中文句号',
        '（': '中文括号',
        '℃': '特殊符号',
    }
    missing = []
    for char, desc in essential_checks.items():
        if char not in char_set:
            missing.append(f"{char}({desc})")

    if missing:
        print(f"  [警告] 以下关键字符未在字典中找到: {', '.join(missing)}")
        print(f"         这可能导致 OCR 输出中这些字符显示为方框")
    else:
        print(f"  [校验通过] 常用汉字、英文、数字、中文标点均已包含")

    return len(char_list)


def extract_formula_tokenizer(inference_yml_path: Path, output_path: Path) -> int:
    """
    从 PP-FormulaNet_plus-L 的 inference.yml 中提取 UniMERNet tokenizer 配置，
    保存为 formula_tokenizer.json。

    返回词汇表大小。
    """
    import yaml

    print(f"\n[Tokenizer] 从 {inference_yml_path.name} 提取公式 tokenizer...")

    with open(inference_yml_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)

    if not config or 'PostProcess' not in config:
        raise ValueError(f"inference.yml 格式异常：缺少 PostProcess 节")

    post_process = config['PostProcess']
    if 'character_dict' not in post_process:
        raise ValueError(f"inference.yml 格式异常：PostProcess 中缺少 character_dict")

    tokenizer_config = post_process['character_dict']

    # 保存完整 tokenizer 配置为 JSON
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(tokenizer_config, f, ensure_ascii=False, indent=2)

    # 统计词汇表大小
    vocab_size = 0
    if 'fast_tokenizer_file' in tokenizer_config:
        ftf = tokenizer_config['fast_tokenizer_file']
        if 'model' in ftf and 'vocab' in ftf['model']:
            vocab_size = len(ftf['model']['vocab'])
        added = len(ftf.get('added_tokens', []))
        print(f"  Tokenizer 类型: HuggingFace Fast Tokenizer")
        print(f"  词汇表大小: {vocab_size} + {added} 特殊 token")
    else:
        # 可能是简单字典列表格式
        if isinstance(tokenizer_config, list):
            vocab_size = len(tokenizer_config)
            print(f"  Tokenizer 类型: 字典列表")
            print(f"  词汇表大小: {vocab_size}")

    size_kb = output_path.stat().st_size / 1024
    print(f"  输出: {output_path.name} ({size_kb:.1f} KB)")

    return vocab_size


def extract_layout_labels(inference_yml_path: Path, output_path: Path) -> list[str]:
    """
    从 PP-DocLayout_plus-L 的 inference.yml 中提取版面标签列表。
    """
    import yaml

    print(f"\n[标签] 从 {inference_yml_path.name} 提取版面标签...")

    with open(inference_yml_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)

    labels = config.get('label_list', [])
    if not labels:
        raise ValueError("inference.yml 中缺少 label_list")

    with open(output_path, 'w', encoding='utf-8', newline='\n') as f:
        for label in labels:
            f.write(str(label) + '\n')

    print(f"  提取 {len(labels)} 个标签: {', '.join(labels[:5])}...")
    return labels


# ---------------------------------------------------------------------------
# 模型转换核心
# ---------------------------------------------------------------------------

def convert_single_model(
    cfg: PipelineModelConfig,
    model_dir: Path,
    output_dir: Path,
) -> Path | None:
    """
    将单个 PaddlePaddle PIR 模型转换为 ONNX。

    PIR 格式: inference.json (模型图) + inference.pdiparams (权重)
    paddle2onnx >= 1.3.0 通过文件扩展名自动识别 PIR 格式。
    """
    import paddle2onnx

    model_file = model_dir / "inference.json"
    params_file = model_dir / "inference.pdiparams"

    # PIR 格式检查
    if not model_file.exists():
        # 回退检查旧格式 .pdmodel
        pdmodel = model_dir / "inference.pdmodel"
        if pdmodel.exists():
            print(f"  [注意] 检测到旧格式 .pdmodel（非 PIR），使用旧格式")
            model_file = pdmodel
        else:
            print(f"  [跳过] {cfg.paddle_dir_name}: 未找到 inference.json 或 inference.pdmodel")
            return None

    if not params_file.exists():
        print(f"  [跳过] {cfg.paddle_dir_name}: 未找到 inference.pdiparams")
        return None

    output_path = output_dir / f"{cfg.name}.onnx"

    print(f"\n{'='*60}")
    print(f"[转换] {cfg.name} — {cfg.description}")
    print(f"  来源: {model_dir.name}/")
    print(f"  模型: {model_file.name} ({model_file.stat().st_size / 1024 / 1024:.1f} MB)")
    print(f"  权重: {params_file.name} ({params_file.stat().st_size / 1024 / 1024:.1f} MB)")
    print(f"  Opset: {cfg.opset}")
    print(f"{'='*60}")

    start = time.time()

    try:
        # paddle2onnx 1.3.x 使用 export()，2.x 使用 command.program2onnx()
        if hasattr(paddle2onnx, 'export'):
            paddle2onnx.export(
                model_filename=str(model_file),
                params_filename=str(params_file),
                save_file=str(output_path),
                opset_version=cfg.opset,
                enable_onnx_checker=True,
                deploy_backend='onnxruntime',
                auto_upgrade_opset=True,
                verbose=False,
            )
        elif hasattr(paddle2onnx, 'command'):
            paddle2onnx.command.program2onnx(
                model_file=str(model_file),
                params_file=str(params_file),
                save_file=str(output_path),
                opset_version=cfg.opset,
                enable_onnx_checker=True,
            )
        else:
            raise RuntimeError("paddle2onnx API not found (need export or command.program2onnx)")

        elapsed = time.time() - start
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"  [成功] {elapsed:.1f}s, {size_mb:.1f} MB")
        return output_path

    except Exception as e:
        elapsed = time.time() - start
        print(f"  [失败] ({elapsed:.1f}s) {e}")

        # 回退：尝试不同的 opset 版本
        for fallback_opset in [13, 12, 11]:
            if fallback_opset == cfg.opset:
                continue
            print(f"  [重试] opset={fallback_opset}...")
            try:
                if hasattr(paddle2onnx, 'export'):
                    paddle2onnx.export(
                        model_filename=str(model_file),
                        params_filename=str(params_file),
                        save_file=str(output_path),
                        opset_version=fallback_opset,
                        enable_onnx_checker=True,
                        deploy_backend='onnxruntime',
                        auto_upgrade_opset=True,
                        verbose=False,
                    )
                else:
                    paddle2onnx.command.program2onnx(
                        model_file=str(model_file),
                        params_file=str(params_file),
                        save_file=str(output_path),
                        opset_version=fallback_opset,
                        enable_onnx_checker=True,
                    )
                size_mb = output_path.stat().st_size / (1024 * 1024)
                print(f"  [成功] opset={fallback_opset}, {size_mb:.1f} MB")
                return output_path
            except Exception:
                continue

        print(f"  [错误] 所有 opset 版本均失败，跳过此模型")
        return None


# ---------------------------------------------------------------------------
# onnxslim 图优化
# ---------------------------------------------------------------------------

def optimize_model(onnx_path: Path) -> Path:
    """
    使用 onnxslim 对 ONNX 模型进行图优化：
    - 常量折叠
    - 冗余节点消除
    - 形状推理
    - 算子融合

    onnxslim 可大幅减少模型体积（尤其对 paddle2onnx 直出的模型，
    通常含大量冗余 Cast/Reshape 节点）。
    """
    import onnxslim

    original_size = onnx_path.stat().st_size / (1024 * 1024)
    print(f"\n[onnxslim] {onnx_path.name} ({original_size:.1f} MB)")

    start = time.time()
    optimized_path = onnx_path.with_suffix(".slim.onnx")

    try:
        # onnxslim 主 API
        onnxslim.slim(str(onnx_path), str(optimized_path))
    except TypeError:
        # 某些版本 API 不同：返回模型对象
        import onnx
        model = onnx.load(str(onnx_path))
        slimmed = onnxslim.slim(model)
        onnx.save(slimmed, str(optimized_path))

    # 替换原文件
    optimized_size = optimized_path.stat().st_size / (1024 * 1024)
    os.replace(optimized_path, onnx_path)

    elapsed = time.time() - start
    reduction = (1 - optimized_size / original_size) * 100 if original_size > 0 else 0
    print(f"  {original_size:.1f} MB → {optimized_size:.1f} MB (减少 {reduction:.1f}%, {elapsed:.1f}s)")

    return onnx_path


# ---------------------------------------------------------------------------
# FP16 量化（可选）
# ---------------------------------------------------------------------------

def convert_to_fp16(onnx_path: Path) -> Path:
    """
    将 ONNX 模型从 FP32 转为 FP16，体积减半。
    DirectML 原生支持 FP16 推理。

    使用 onnxconverter_common 或手动转换初始化器。
    """
    import onnx
    from onnx import numpy_helper, TensorProto
    import numpy as np

    original_size = onnx_path.stat().st_size / (1024 * 1024)
    print(f"\n[FP16] {onnx_path.name} ({original_size:.1f} MB)")

    start = time.time()

    # 优先使用 onnxconverter_common（更可靠）
    try:
        from onnxconverter_common import float16
        model = onnx.load(str(onnx_path))
        model_fp16 = float16.convert_float_to_float16(
            model,
            keep_io_types=True,  # 保持输入输出为 FP32（方便调用）
        )
        onnx.save(model_fp16, str(onnx_path))
        fp16_size = onnx_path.stat().st_size / (1024 * 1024)
        elapsed = time.time() - start
        print(f"  {original_size:.1f} MB → {fp16_size:.1f} MB ({elapsed:.1f}s, onnxconverter_common)")
        return onnx_path
    except ImportError:
        pass

    # 回退：手动转换初始化器中的 FP32 → FP16
    model = onnx.load(str(onnx_path))
    converted = 0
    for initializer in model.graph.initializer:
        if initializer.data_type == TensorProto.FLOAT:
            data = numpy_helper.to_array(initializer).astype(np.float16)
            new_init = numpy_helper.from_array(data, name=initializer.name)
            initializer.CopyFrom(new_init)
            converted += 1

    onnx.save(model, str(onnx_path))
    fp16_size = onnx_path.stat().st_size / (1024 * 1024)
    elapsed = time.time() - start
    print(f"  {original_size:.1f} MB → {fp16_size:.1f} MB ({elapsed:.1f}s, 转换 {converted} 个初始化器)")

    return onnx_path


# ---------------------------------------------------------------------------
# 验证：dummy 推理
# ---------------------------------------------------------------------------

def verify_model(onnx_path: Path, model_name: str) -> bool:
    """
    对转换后的 ONNX 模型执行一次 dummy 推理，确认模型可正确加载和运行。
    仅使用 CPUExecutionProvider（转换阶段不依赖 DirectML）。
    """
    import numpy as np

    print(f"\n[验证] {onnx_path.name}...")

    try:
        import onnxruntime as ort
    except ImportError:
        print(f"  [跳过] onnxruntime 未安装，无法验证（运行时需要 onnxruntime-directml）")
        return True  # 不阻断流程

    try:
        sess = ort.InferenceSession(
            str(onnx_path),
            providers=["CPUExecutionProvider"],
        )

        # 构造 dummy 输入
        inputs = {}
        for inp in sess.get_inputs():
            shape = []
            for dim in inp.shape:
                if isinstance(dim, int) and dim > 0:
                    shape.append(dim)
                else:
                    # 动态维度用最小合理值
                    shape.append(1)

            dtype = np.float32
            if inp.type == 'tensor(float16)':
                dtype = np.float16
            elif inp.type == 'tensor(int64)':
                dtype = np.int64
            elif inp.type == 'tensor(int32)':
                dtype = np.int32

            inputs[inp.name] = np.zeros(shape, dtype=dtype)

        # 运行推理
        outputs = sess.run(None, inputs)
        out_shapes = [str(o.shape) for o in outputs]
        print(f"  [通过] 输入: {len(inputs)} 张量, 输出: {len(outputs)} 张量 ({', '.join(out_shapes[:3])})")
        return True

    except Exception as e:
        print(f"  [警告] dummy 推理失败: {e}")
        print(f"         模型文件已生成，可能在 DirectML 下正常运行")
        return False


# ---------------------------------------------------------------------------
# 报告生成
# ---------------------------------------------------------------------------

def generate_report(converted_models: dict[str, Path]) -> list[dict]:
    """生成转换报告，包含输入/输出张量信息"""
    import onnx
    from onnx import TensorProto

    ELEM_TYPE_MAP = {
        TensorProto.FLOAT: "float32",
        TensorProto.FLOAT16: "float16",
        TensorProto.INT32: "int32",
        TensorProto.INT64: "int64",
        TensorProto.BOOL: "bool",
        TensorProto.UINT8: "uint8",
    }

    reports = []

    for name, onnx_path in converted_models.items():
        try:
            model = onnx.load(str(onnx_path))
            graph = model.graph

            def parse_shape(shape_proto):
                dims = []
                for d in shape_proto.dim:
                    if d.dim_param:
                        dims.append(d.dim_param)
                    elif d.dim_value > 0:
                        dims.append(d.dim_value)
                    else:
                        dims.append("dynamic")
                return dims

            def parse_tensor(vi):
                tt = vi.type.tensor_type
                return {
                    "name": vi.name,
                    "dtype": ELEM_TYPE_MAP.get(tt.elem_type, f"type({tt.elem_type})"),
                    "shape": parse_shape(tt.shape),
                }

            op_counts: dict[str, int] = {}
            for node in graph.node:
                op_counts[node.op_type] = op_counts.get(node.op_type, 0) + 1

            reports.append({
                "model": name,
                "file": onnx_path.name,
                "size_mb": round(onnx_path.stat().st_size / (1024 * 1024), 2),
                "opset": model.opset_import[0].version if model.opset_import else None,
                "inputs": [parse_tensor(i) for i in graph.input],
                "outputs": [parse_tensor(o) for o in graph.output],
                "total_nodes": len(graph.node),
                "top_ops": dict(sorted(op_counts.items(), key=lambda x: -x[1])[:10]),
            })
        except Exception as e:
            reports.append({"model": name, "error": str(e)})

    return reports


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="模块化 OCR 流水线 — PaddlePaddle → ONNX 转换",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--paddlex-home",
        type=Path,
        default=Path("ocr_engine/paddlex_home"),
        help="PaddleX home 目录（默认: ocr_engine/paddlex_home）",
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        default=Path("ocr_engine/onnx_models/pipeline"),
        help="ONNX 输出目录（默认: ocr_engine/onnx_models/pipeline/）",
    )
    parser.add_argument(
        "--fp16",
        action="store_true",
        help="将模型转为 FP16（体积减半，DirectML 原生支持）",
    )
    parser.add_argument(
        "--skip-optimize",
        action="store_true",
        help="跳过 onnxslim 优化（不推荐，模型体积会偏大）",
    )
    parser.add_argument(
        "--skip-verify",
        action="store_true",
        help="跳过 dummy 推理验证",
    )
    parser.add_argument(
        "--models",
        nargs="+",
        choices=[m.name for m in PIPELINE_MODELS],
        default=None,
        help="只转换指定模型（默认全部）",
    )

    args = parser.parse_args()

    print("=" * 60)
    print("  模块化 OCR 流水线 — PaddlePaddle → ONNX 转换")
    print("=" * 60)

    # 检查依赖
    print("\n[检查依赖]")
    if not check_dependencies():
        print("\n请安装缺失的依赖后重试:")
        print("  pip install 'paddle2onnx>=1.3.0' onnxslim onnx pyyaml numpy")
        sys.exit(1)

    # 检查路径
    paddlex_home = args.paddlex_home.resolve()
    models_dir = paddlex_home / "official_models"
    output_dir = args.output.resolve()

    if not models_dir.is_dir():
        print(f"\n[错误] 模型目录不存在: {models_dir}")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n[路径]")
    print(f"  模型来源: {models_dir}")
    print(f"  输出目录: {output_dir}")
    print(f"  FP16: {'是' if args.fp16 else '否'}")
    print(f"  onnxslim 优化: {'跳过' if args.skip_optimize else '启用'}")

    # 过滤要转换的模型
    target_models = PIPELINE_MODELS
    if args.models:
        target_models = [m for m in PIPELINE_MODELS if m.name in args.models]

    # 检查所有目标模型目录是否存在
    print(f"\n[扫描模型]")
    for cfg in target_models:
        model_dir = models_dir / cfg.paddle_dir_name
        model_file = model_dir / "inference.json"
        params_file = model_dir / "inference.pdiparams"

        has_pir = model_file.exists()
        has_pdmodel = (model_dir / "inference.pdmodel").exists()
        has_params = params_file.exists()

        status = "OK" if (has_pir or has_pdmodel) and has_params else "!!"
        fmt = "PIR" if has_pir else ("pdmodel" if has_pdmodel else "缺失")
        params_mb = params_file.stat().st_size / 1024 / 1024 if has_params else 0
        print(f"  {status} {cfg.paddle_dir_name:35s} 格式={fmt:8s} 权重={params_mb:.0f}MB — {cfg.description}")

    # ====================================================================
    # 阶段 1：提取字典和配置
    # ====================================================================
    print(f"\n{'='*60}")
    print("[阶段 1] 提取字典、Tokenizer、标签")
    print(f"{'='*60}")

    # OCR 字符字典（从 PP-OCRv5_server_rec）
    rec_yml = models_dir / "PP-OCRv5_server_rec" / "inference.yml"
    if rec_yml.exists():
        try:
            dict_count = extract_ocr_dict(rec_yml, output_dir / "ppocr_keys_v1.txt")
        except Exception as e:
            print(f"  [错误] 字典提取失败: {e}")
            dict_count = 0
    else:
        print(f"  [跳过] PP-OCRv5_server_rec/inference.yml 不存在")
        dict_count = 0

    # 公式 Tokenizer（从 PP-FormulaNet_plus-L）
    formula_yml = models_dir / "PP-FormulaNet_plus-L" / "inference.yml"
    if formula_yml.exists():
        try:
            extract_formula_tokenizer(formula_yml, output_dir / "formula_tokenizer.json")
        except Exception as e:
            print(f"  [错误] Tokenizer 提取失败: {e}")
    else:
        print(f"  [跳过] PP-FormulaNet_plus-L/inference.yml 不存在")

    # 版面标签（从 PP-DocLayout_plus-L）
    layout_yml = models_dir / "PP-DocLayout_plus-L" / "inference.yml"
    if layout_yml.exists():
        try:
            extract_layout_labels(layout_yml, output_dir / "layout_labels.txt")
        except Exception as e:
            print(f"  [错误] 标签提取失败: {e}")
    else:
        print(f"  [跳过] PP-DocLayout_plus-L/inference.yml 不存在")

    # ====================================================================
    # 阶段 2：paddle2onnx 转换
    # ====================================================================
    print(f"\n{'='*60}")
    print("[阶段 2] PaddlePaddle → ONNX 转换")
    print(f"{'='*60}")

    converted: dict[str, Path] = {}
    total_start = time.time()

    for cfg in target_models:
        model_dir = models_dir / cfg.paddle_dir_name
        result = convert_single_model(cfg, model_dir, output_dir)
        if result:
            converted[cfg.name] = result

    if not converted:
        print("\n[错误] 所有模型转换失败")
        sys.exit(1)

    # ====================================================================
    # 阶段 3：onnxslim 图优化
    # ====================================================================
    if not args.skip_optimize:
        print(f"\n{'='*60}")
        print("[阶段 3] onnxslim 图优化")
        print(f"{'='*60}")

        for name, onnx_path in converted.items():
            try:
                optimize_model(onnx_path)
            except Exception as e:
                print(f"  [警告] {name} 优化失败（保留未优化版本）: {e}")
    else:
        print(f"\n[跳过] onnxslim 优化")

    # ====================================================================
    # 阶段 4：FP16 量化（可选）
    # ====================================================================
    if args.fp16:
        print(f"\n{'='*60}")
        print("[阶段 4] FP16 量化")
        print(f"{'='*60}")

        for name, onnx_path in converted.items():
            try:
                convert_to_fp16(onnx_path)
            except Exception as e:
                print(f"  [警告] {name} FP16 转换失败（保留 FP32）: {e}")
    else:
        print(f"\n[跳过] FP16 量化（使用 --fp16 启用）")

    # ====================================================================
    # 阶段 5：验证
    # ====================================================================
    if not args.skip_verify:
        print(f"\n{'='*60}")
        print("[阶段 5] 模型验证（dummy 推理）")
        print(f"{'='*60}")

        for name, onnx_path in converted.items():
            verify_model(onnx_path, name)
    else:
        print(f"\n[跳过] 模型验证")

    # ====================================================================
    # 阶段 6：报告
    # ====================================================================
    print(f"\n{'='*60}")
    print("[阶段 6] 生成转换报告")
    print(f"{'='*60}")

    reports = generate_report(converted)
    report_path = output_dir / "conversion_report.json"
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(reports, f, indent=2, ensure_ascii=False)

    for r in reports:
        if 'error' in r:
            print(f"\n  {r['model']}: 报告生成失败 — {r['error']}")
            continue
        print(f"\n  {r['model']} ({r['file']}):")
        print(f"    大小: {r['size_mb']} MB, Opset: {r['opset']}, 节点: {r['total_nodes']}")
        for inp in r['inputs']:
            print(f"    输入: {inp['name']} [{inp['dtype']}] {inp['shape']}")
        for out in r['outputs'][:3]:
            print(f"    输出: {out['name']} [{out['dtype']}] {out['shape']}")

    # ====================================================================
    # 汇总
    # ====================================================================
    total_elapsed = time.time() - total_start
    total_size = sum(p.stat().st_size for p in converted.values()) / (1024 * 1024)

    print(f"\n{'='*60}")
    print(f"  转换完成!")
    print(f"  成功: {len(converted)}/{len(target_models)} 个模型")
    print(f"  总大小: {total_size:.1f} MB")
    if dict_count:
        print(f"  字符字典: {dict_count} 字符 (ppocr_keys_v1.txt)")
    print(f"  总耗时: {total_elapsed:.1f}s")
    print(f"  输出目录: {output_dir}")
    print(f"{'='*60}")
    print()
    print("下一步:")
    print(f"  python ocr_engine/onnx_pipeline.py <图片路径> \\")
    print(f"      --model-dir {output_dir} --verbose")
    print()
    print("环境依赖提示:")
    print("  运行时请确保安装 onnxruntime-directml（非普通 onnxruntime）:")
    print("  pip install onnxruntime-directml")


if __name__ == "__main__":
    main()
