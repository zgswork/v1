#!/usr/bin/env python3
"""
RT-DETR-L 表格单元格检测模型 → ONNX 转换脚本

将 PaddleX 的 RT-DETR-L_wired/wireless_table_cell_det 模型转为 ONNX。
纯检测模型（DETR 架构），无自回归算子，DirectML 完全兼容。

=== 环境要求 ===
    conda activate paddle_convert
    # PaddlePaddle 3.1.1 + paddle2onnx 2.1.0（其他版本不兼容）

=== 用法 ===
    python scripts/convert_table_det.py \
        --wired-dir <RT-DETR-L_wired_table_cell_det模型目录> \
        --wireless-dir <RT-DETR-L_wireless_table_cell_det模型目录> \
        --output-dir ocr_engine/onnx_models/pipeline/

=== 输出 ===
    table_wired_det.onnx    (~124MB)
    table_wireless_det.onnx (~124MB)
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path


def find_model_files(model_dir: Path) -> tuple[Path, Path] | None:
    """在模型目录中查找 .pdmodel/.json 和 .pdiparams 文件"""
    # 尝试 inference.pdmodel（旧格式）
    pdmodel = model_dir / "inference.pdmodel"
    pdiparams = model_dir / "inference.pdiparams"
    if pdmodel.exists() and pdiparams.exists():
        return pdmodel, pdiparams

    # 尝试 inference.json（PIR 格式，PaddlePaddle 3.x）
    pir_model = model_dir / "inference.json"
    if pir_model.exists() and pdiparams.exists():
        return pir_model, pdiparams

    # 尝试目录内任意 .pdmodel
    for f in model_dir.glob("*.pdmodel"):
        params = f.with_suffix(".pdiparams")
        if params.exists():
            return f, params

    # 尝试目录内任意 .json（PIR）
    for f in model_dir.glob("*.json"):
        params = model_dir / (f.stem + ".pdiparams")
        if params.exists():
            return f, params

    return None


def convert_model(
    model_dir: Path,
    output_path: Path,
    opset: int = 13,
) -> bool:
    """转换单个 PaddleDetection DETR 模型"""
    import paddle2onnx

    files = find_model_files(model_dir)
    if not files:
        print(f"[ERROR] 未找到模型文件: {model_dir}")
        return False

    pdmodel, pdiparams = files
    print(f"\n{'='*60}")
    print(f"[转换] {model_dir.name}")
    print(f"  输入:  {pdmodel}")
    print(f"  输出:  {output_path}")
    print(f"  Opset: {opset}")
    print(f"{'='*60}")

    start = time.time()

    try:
        # paddle2onnx 2.1.0 API: export(model_filename, params_filename, save_file=...)
        paddle2onnx.export(
            str(pdmodel),
            str(pdiparams),
            save_file=str(output_path),
            opset_version=opset,
            enable_onnx_checker=True,
        )

        elapsed = time.time() - start
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"[OK] 转换完成 ({elapsed:.1f}s, {size_mb:.1f} MB)")
        return True

    except Exception as e:
        print(f"[ERROR] 转换失败: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="RT-DETR-L 表格单元格检测模型 → ONNX 转换",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--wired-dir",
        type=Path,
        default=None,
        help="有线表格检测模型目录 (RT-DETR-L_wired_table_cell_det)",
    )
    parser.add_argument(
        "--wireless-dir",
        type=Path,
        default=None,
        help="无线表格检测模型目录 (RT-DETR-L_wireless_table_cell_det)",
    )
    parser.add_argument(
        "--output-dir", "-o",
        type=Path,
        default=Path("ocr_engine/onnx_models/pipeline"),
        help="ONNX 输出目录（默认: ocr_engine/onnx_models/pipeline/）",
    )
    parser.add_argument(
        "--opset",
        type=int,
        default=13,
        help="ONNX opset 版本（默认: 13）",
    )

    args = parser.parse_args()

    if not args.wired_dir and not args.wireless_dir:
        print("[ERROR] 请至少指定 --wired-dir 或 --wireless-dir")
        sys.exit(1)

    # 检查依赖
    try:
        import paddle2onnx
        print(f"paddle2onnx 版本: {paddle2onnx.__version__}")
    except ImportError:
        print("[ERROR] 缺少 paddle2onnx，请安装: pip install paddle2onnx==2.1.0")
        sys.exit(1)

    args.output_dir.mkdir(parents=True, exist_ok=True)

    success_count = 0

    if args.wired_dir:
        output = args.output_dir / "table_wired_det.onnx"
        if convert_model(args.wired_dir.resolve(), output, args.opset):
            success_count += 1

    if args.wireless_dir:
        output = args.output_dir / "table_wireless_det.onnx"
        if convert_model(args.wireless_dir.resolve(), output, args.opset):
            success_count += 1

    print(f"\n转换完成: {success_count} 个模型")
    if success_count == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
