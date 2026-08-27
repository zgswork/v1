#!/usr/bin/env python3
"""
PaddleOCR-VL-0.9B → ONNX 转换脚本

将 PaddlePaddle 格式的 PaddleOCR-VL-0.9B 模型转换为 ONNX 格式，
包含动态形状处理、算子融合优化和张量信息校验。

依赖安装：
    pip install paddle2onnx onnxslim onnx paddlepaddle

用法：
    python scripts/convert_paddle_to_onnx.py --model-dir <paddle模型目录> --output-dir <输出目录>

示例：
    python scripts/convert_paddle_to_onnx.py \
        --model-dir ./paddlex_home/official_models/PaddleOCR-VL-0.9B \
        --output-dir ./onnx_models/PaddleOCR-VL-0.9B
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

# ---------------------------------------------------------------------------
# 子模型配置：每个子模型的名称、文件前缀、动态轴定义
# ---------------------------------------------------------------------------

@dataclass
class SubModelConfig:
    """单个子模型的转换配置"""
    name: str                          # 子模型显示名称
    prefix: str                        # Paddle 模型文件前缀（不含 .pdmodel/.pdiparams）
    opset: int = 13                    # ONNX opset 版本
    input_shape_dict: dict = field(default_factory=dict)   # paddle2onnx 的 input_shape_dict
    dynamic_axes: dict = field(default_factory=dict)       # 用于校验报告的动态轴描述


# PaddleOCR-VL-0.9B 通常包含以下子模型：
# 1) Visual Encoder — 处理文档图像
# 2) Text Tokenizer/Embedding — ERNIE 文本编码
# 3) Multimodal Fusion / Decoder — VL 融合解码

DEFAULT_SUBMODELS = [
    SubModelConfig(
        name="visual_encoder",
        prefix="visual_encoder",
        opset=13,
        # 动态图像输入: batch=1, channels=3, height/width 可变
        input_shape_dict={
            "pixel_values": [1, 3, -1, -1],
        },
        dynamic_axes={
            "pixel_values": {2: "height", 3: "width"},
        },
    ),
    SubModelConfig(
        name="text_encoder",
        prefix="text_encoder",
        opset=13,
        # 动态 token 序列: batch=1, seq_len 可变
        input_shape_dict={
            "input_ids": [1, -1],
            "attention_mask": [1, -1],
            "token_type_ids": [1, -1],
        },
        dynamic_axes={
            "input_ids": {1: "seq_len"},
            "attention_mask": {1: "seq_len"},
            "token_type_ids": {1: "seq_len"},
        },
    ),
    SubModelConfig(
        name="multimodal_decoder",
        prefix="multimodal_decoder",
        opset=13,
        input_shape_dict={
            "encoder_hidden_states": [1, -1, -1],
            "input_ids": [1, -1],
            "attention_mask": [1, -1],
        },
        dynamic_axes={
            "encoder_hidden_states": {1: "visual_seq_len", 2: "hidden_dim"},
            "input_ids": {1: "seq_len"},
            "attention_mask": {1: "seq_len"},
        },
    ),
]


def find_submodels(model_dir: Path) -> list[SubModelConfig]:
    """
    自动扫描模型目录，匹配可用的子模型。
    支持两种目录结构：
      1) 扁平结构: model_dir/visual_encoder.pdmodel + visual_encoder.pdiparams
      2) 嵌套结构: model_dir/visual_encoder/inference.pdmodel + inference.pdiparams
      3) 单模型结构: model_dir/inference.pdmodel + inference.pdiparams
    """
    found: list[SubModelConfig] = []

    for cfg in DEFAULT_SUBMODELS:
        # 尝试扁平结构
        if (model_dir / f"{cfg.prefix}.pdmodel").exists() and \
           (model_dir / f"{cfg.prefix}.pdiparams").exists():
            found.append(cfg)
            continue

        # 尝试嵌套结构
        subdir = model_dir / cfg.prefix
        if subdir.is_dir() and \
           (subdir / "inference.pdmodel").exists() and \
           (subdir / "inference.pdiparams").exists():
            # 更新 prefix 为子目录路径
            nested = SubModelConfig(
                name=cfg.name,
                prefix=str(subdir / "inference"),
                opset=cfg.opset,
                input_shape_dict=cfg.input_shape_dict,
                dynamic_axes=cfg.dynamic_axes,
            )
            found.append(nested)
            continue

    # 单模型结构（整体推理模型）
    if not found:
        if (model_dir / "inference.pdmodel").exists() and \
           (model_dir / "inference.pdiparams").exists():
            print("[INFO] 检测到单模型结构 (inference.pdmodel)，将作为整体模型转换")
            # 对于单模型，使用 visual_encoder 的动态形状配置
            # 因为 VL 模型的主要输入通常包含图像
            single = SubModelConfig(
                name="paddleocr_vl",
                prefix=str(model_dir / "inference"),
                opset=13,
                input_shape_dict={},  # 留空，让 paddle2onnx 自动推断
                dynamic_axes={},
            )
            found.append(single)

    return found


# ---------------------------------------------------------------------------
# 核心转换逻辑
# ---------------------------------------------------------------------------

def convert_single_model(
    cfg: SubModelConfig,
    model_dir: Path,
    output_dir: Path,
) -> Path | None:
    """
    将单个 Paddle 子模型转换为 ONNX 格式。
    返回输出的 ONNX 文件路径，失败返回 None。
    """
    import paddle2onnx

    # 解析模型文件路径
    if os.sep in cfg.prefix or "/" in cfg.prefix:
        # 已是绝对/相对路径（嵌套结构）
        pdmodel = Path(f"{cfg.prefix}.pdmodel")
        pdiparams = Path(f"{cfg.prefix}.pdiparams")
    else:
        pdmodel = model_dir / f"{cfg.prefix}.pdmodel"
        pdiparams = model_dir / f"{cfg.prefix}.pdiparams"

    if not pdmodel.exists() or not pdiparams.exists():
        print(f"[SKIP] {cfg.name}: 模型文件不存在")
        print(f"       期望: {pdmodel}")
        return None

    output_path = output_dir / f"{cfg.name}.onnx"

    print(f"\n{'='*60}")
    print(f"[转换] {cfg.name}")
    print(f"  输入:  {pdmodel}")
    print(f"  输出:  {output_path}")
    print(f"  Opset: {cfg.opset}")
    if cfg.input_shape_dict:
        print(f"  动态形状: {json.dumps(cfg.input_shape_dict, indent=4)}")
    print(f"{'='*60}")

    start = time.time()

    try:
        # 读取 Paddle 模型文件
        with open(pdmodel, "rb") as f:
            model_content = f.read()
        with open(pdiparams, "rb") as f:
            params_content = f.read()

        # 构建 paddle2onnx 转换参数
        convert_kwargs: dict = {
            "model_file": str(pdmodel),
            "params_file": str(pdiparams),
            "save_file": str(output_path),
            "opset_version": cfg.opset,
            "enable_onnx_checker": True,
        }

        # 设置动态输入形状
        if cfg.input_shape_dict:
            convert_kwargs["input_shape_dict"] = cfg.input_shape_dict

        # 执行转换
        paddle2onnx.command.program2onnx(**convert_kwargs)

        elapsed = time.time() - start
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"[OK] {cfg.name} 转换完成 ({elapsed:.1f}s, {size_mb:.1f} MB)")
        return output_path

    except Exception as e:
        print(f"[ERROR] {cfg.name} 转换失败: {e}")

        # 回退：尝试不带 input_shape_dict 的基础转换
        if cfg.input_shape_dict:
            print(f"[RETRY] 尝试不指定动态形状的基础转换...")
            try:
                paddle2onnx.command.program2onnx(
                    model_file=str(pdmodel),
                    params_file=str(pdiparams),
                    save_file=str(output_path),
                    opset_version=cfg.opset,
                    enable_onnx_checker=True,
                )
                elapsed = time.time() - start
                size_mb = output_path.stat().st_size / (1024 * 1024)
                print(f"[OK] {cfg.name} 基础转换完成 ({elapsed:.1f}s, {size_mb:.1f} MB)")
                return output_path
            except Exception as e2:
                print(f"[ERROR] {cfg.name} 基础转换也失败: {e2}")

        return None


# ---------------------------------------------------------------------------
# onnxslim 优化
# ---------------------------------------------------------------------------

def optimize_model(onnx_path: Path) -> Path:
    """
    使用 onnxslim 对 ONNX 模型进行图优化和冗余节点删除。
    输出文件覆盖原文件（优化后体积通常更小）。
    """
    import onnxslim

    original_size = onnx_path.stat().st_size / (1024 * 1024)
    print(f"\n[优化] {onnx_path.name} (原始: {original_size:.1f} MB)")

    start = time.time()

    # onnxslim 核心优化
    optimized_path = onnx_path.with_suffix(".optimized.onnx")
    try:
        onnxslim.slim(
            str(onnx_path),
            str(optimized_path),
        )
    except TypeError:
        # 某些版本的 onnxslim API 不同，尝试备用调用方式
        import onnx
        model = onnx.load(str(onnx_path))
        slimmed = onnxslim.slim(model)
        onnx.save(slimmed, str(optimized_path))

    # 替换原文件
    optimized_size = optimized_path.stat().st_size / (1024 * 1024)
    os.replace(optimized_path, onnx_path)

    elapsed = time.time() - start
    reduction = (1 - optimized_size / original_size) * 100 if original_size > 0 else 0
    print(f"[OK] 优化完成: {original_size:.1f} MB → {optimized_size:.1f} MB "
          f"(减少 {reduction:.1f}%, 耗时 {elapsed:.1f}s)")

    return onnx_path


# ---------------------------------------------------------------------------
# 张量信息报告
# ---------------------------------------------------------------------------

def generate_report(onnx_path: Path) -> dict:
    """
    解析 ONNX 模型，生成输入/输出张量信息报告。
    方便后续在 ONNX Runtime 中对接。
    """
    import onnx
    from onnx import TensorProto

    # numpy dtype 名称映射
    ELEM_TYPE_MAP = {
        TensorProto.FLOAT: "float32",
        TensorProto.UINT8: "uint8",
        TensorProto.INT8: "int8",
        TensorProto.UINT16: "uint16",
        TensorProto.INT16: "int16",
        TensorProto.INT32: "int32",
        TensorProto.INT64: "int64",
        TensorProto.STRING: "string",
        TensorProto.BOOL: "bool",
        TensorProto.FLOAT16: "float16",
        TensorProto.DOUBLE: "float64",
        TensorProto.UINT32: "uint32",
        TensorProto.UINT64: "uint64",
        TensorProto.BFLOAT16: "bfloat16",
    }

    model = onnx.load(str(onnx_path))
    graph = model.graph

    def _parse_shape(shape_proto) -> list:
        dims = []
        for d in shape_proto.dim:
            if d.dim_param:
                dims.append(d.dim_param)  # 动态维度名称
            elif d.dim_value > 0:
                dims.append(d.dim_value)
            else:
                dims.append("dynamic")
        return dims

    def _parse_tensor_info(value_info) -> dict:
        tensor_type = value_info.type.tensor_type
        return {
            "name": value_info.name,
            "dtype": ELEM_TYPE_MAP.get(tensor_type.elem_type, f"unknown({tensor_type.elem_type})"),
            "shape": _parse_shape(tensor_type.shape),
        }

    inputs = [_parse_tensor_info(inp) for inp in graph.input]
    outputs = [_parse_tensor_info(out) for out in graph.output]

    # 统计节点信息
    op_counts: dict[str, int] = {}
    for node in graph.node:
        op_counts[node.op_type] = op_counts.get(node.op_type, 0) + 1

    report = {
        "file": str(onnx_path),
        "file_size_mb": round(onnx_path.stat().st_size / (1024 * 1024), 2),
        "opset_version": model.opset_import[0].version if model.opset_import else None,
        "ir_version": model.ir_version,
        "inputs": inputs,
        "outputs": outputs,
        "total_nodes": len(graph.node),
        "op_type_distribution": dict(sorted(op_counts.items(), key=lambda x: -x[1])),
        "total_initializers": len(graph.initializer),
    }

    return report


def print_report(report: dict) -> None:
    """格式化打印张量信息报告"""
    print(f"\n{'─'*60}")
    print(f"  模型报告: {Path(report['file']).name}")
    print(f"{'─'*60}")
    print(f"  文件大小:    {report['file_size_mb']} MB")
    print(f"  Opset 版本:  {report['opset_version']}")
    print(f"  IR 版本:     {report['ir_version']}")
    print(f"  节点总数:    {report['total_nodes']}")
    print(f"  初始化器数:  {report['total_initializers']}")

    print(f"\n  输入张量 ({len(report['inputs'])}):")
    for t in report["inputs"]:
        print(f"    - {t['name']:30s}  dtype={t['dtype']:10s}  shape={t['shape']}")

    print(f"\n  输出张量 ({len(report['outputs'])}):")
    for t in report["outputs"]:
        print(f"    - {t['name']:30s}  dtype={t['dtype']:10s}  shape={t['shape']}")

    # 打印 Top-10 算子分布
    print(f"\n  算子分布 (Top 10):")
    for i, (op, count) in enumerate(report["op_type_distribution"].items()):
        if i >= 10:
            break
        print(f"    {op:25s}  ×{count}")
    print(f"{'─'*60}")


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------

def check_dependencies() -> bool:
    """检查必要的 Python 依赖"""
    missing = []
    for pkg in ["paddle2onnx", "onnxslim", "onnx"]:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)

    if missing:
        print(f"[ERROR] 缺少依赖包: {', '.join(missing)}")
        print(f"        请运行: pip install {' '.join(missing)}")
        return False
    return True


def main():
    parser = argparse.ArgumentParser(
        description="PaddleOCR-VL-0.9B → ONNX 转换脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--model-dir", "-m",
        type=Path,
        required=True,
        help="Paddle 模型目录（包含 .pdmodel + .pdiparams 文件）",
    )
    parser.add_argument(
        "--output-dir", "-o",
        type=Path,
        default=None,
        help="ONNX 输出目录（默认: <model-dir>/onnx/）",
    )
    parser.add_argument(
        "--opset",
        type=int,
        default=13,
        help="ONNX opset 版本（默认: 13）",
    )
    parser.add_argument(
        "--skip-optimize",
        action="store_true",
        help="跳过 onnxslim 优化步骤",
    )
    parser.add_argument(
        "--report-json",
        type=Path,
        default=None,
        help="将张量报告保存为 JSON 文件（默认: <output-dir>/conversion_report.json）",
    )

    args = parser.parse_args()

    # 检查依赖
    if not check_dependencies():
        sys.exit(1)

    model_dir = args.model_dir.resolve()
    if not model_dir.is_dir():
        print(f"[ERROR] 模型目录不存在: {model_dir}")
        sys.exit(1)

    output_dir = (args.output_dir or model_dir / "onnx").resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    report_path = args.report_json or output_dir / "conversion_report.json"

    print(f"PaddleOCR-VL-0.9B → ONNX 转换")
    print(f"  模型目录: {model_dir}")
    print(f"  输出目录: {output_dir}")
    print(f"  Opset:    {args.opset}")

    # 自动发现子模型
    submodels = find_submodels(model_dir)
    if not submodels:
        print(f"\n[ERROR] 在 {model_dir} 中未找到任何 Paddle 模型文件")
        print(f"  期望的文件结构:")
        print(f"    {model_dir}/visual_encoder.pdmodel + .pdiparams")
        print(f"    {model_dir}/text_encoder.pdmodel + .pdiparams")
        print(f"  或:")
        print(f"    {model_dir}/visual_encoder/inference.pdmodel + .pdiparams")
        print(f"  或:")
        print(f"    {model_dir}/inference.pdmodel + .pdiparams")
        sys.exit(1)

    print(f"\n发现 {len(submodels)} 个子模型: {', '.join(c.name for c in submodels)}")

    # 覆盖 opset 版本
    if args.opset != 13:
        for cfg in submodels:
            cfg.opset = args.opset

    # 逐个转换
    converted: list[Path] = []
    all_reports: list[dict] = []
    total_start = time.time()

    for cfg in submodels:
        result = convert_single_model(cfg, model_dir, output_dir)
        if result:
            converted.append(result)

    if not converted:
        print("\n[ERROR] 所有子模型转换失败，中止")
        sys.exit(1)

    # onnxslim 优化
    if not args.skip_optimize:
        print(f"\n{'='*60}")
        print("[阶段] onnxslim 图优化与冗余节点删除")
        print(f"{'='*60}")
        for onnx_path in converted:
            try:
                optimize_model(onnx_path)
            except Exception as e:
                print(f"[WARN] {onnx_path.name} 优化失败（保留未优化版本）: {e}")

    # 生成报告
    print(f"\n{'='*60}")
    print("[阶段] 张量信息校验报告")
    print(f"{'='*60}")

    for onnx_path in converted:
        try:
            report = generate_report(onnx_path)
            all_reports.append(report)
            print_report(report)
        except Exception as e:
            print(f"[WARN] {onnx_path.name} 报告生成失败: {e}")

    # 保存 JSON 报告
    if all_reports:
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(all_reports, f, indent=2, ensure_ascii=False)
        print(f"\n[OK] 张量报告已保存: {report_path}")

    # 汇总
    total_elapsed = time.time() - total_start
    total_size = sum(p.stat().st_size for p in converted) / (1024 * 1024)

    print(f"\n{'='*60}")
    print(f"  转换完成!")
    print(f"  成功: {len(converted)}/{len(submodels)} 个子模型")
    print(f"  总大小: {total_size:.1f} MB")
    print(f"  总耗时: {total_elapsed:.1f}s")
    print(f"  输出目录: {output_dir}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
