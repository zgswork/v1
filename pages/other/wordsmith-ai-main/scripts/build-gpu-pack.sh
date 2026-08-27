#!/bin/bash
# build-gpu-pack.sh — 打包 GPU 加速包 zip
# 包含: accelerator DLLs + ONNX 流水线模型 + onnxruntime-directml Python 包

set -e

PROJECT_ROOT="D:/vscode/project_aiword"
ACCEL_DIR="$PROJECT_ROOT/accelerator"
ONNX_DIR="$PROJECT_ROOT/ocr_engine/onnx_models/pipeline"
SITE_PKG="$PROJECT_ROOT/ocr_engine/site-packages"
OUTPUT_ZIP="$PROJECT_ROOT/wordsmith-gpu-pack.zip"
STAGING="$PROJECT_ROOT/.gpu-pack-staging"

# onnxruntime-directml 及其必要依赖（排除 numpy/packaging 等 OCR 引擎已有的包）
ORT_PACKAGES=(
  onnxruntime
  onnxruntime_directml-1.23.0.dist-info
  coloredlogs
  coloredlogs-15.0.1.dist-info
  coloredlogs.pth
  humanfriendly
  humanfriendly-10.0.dist-info
  flatbuffers
  flatbuffers-25.12.19.dist-info
  sympy
  sympy-1.14.0.dist-info
  mpmath
  mpmath-1.3.0.dist-info
  pyreadline3
  pyreadline3-3.5.4.dist-info
  protobuf
  protobuf-7.34.0.dist-info
)

echo "=== 构建 GPU 加速包（模块化 OCR 流水线）==="

# 清理
rm -rf "$STAGING" "$OUTPUT_ZIP" 2>/dev/null

# 创建目录结构
mkdir -p "$STAGING/accelerator"
mkdir -p "$STAGING/onnx_models/pipeline"
mkdir -p "$STAGING/site-packages"

# 复制 DLLs
echo "[1/4] 复制加速补丁 DLL..."
cp "$ACCEL_DIR/DirectML.dll" "$STAGING/accelerator/"
if [ -f "$ACCEL_DIR/onnxruntime.dll" ]; then
    cp "$ACCEL_DIR/onnxruntime.dll" "$STAGING/accelerator/"
    echo "  + onnxruntime.dll ($(du -h "$ACCEL_DIR/onnxruntime.dll" | cut -f1))"
fi
echo "  + DirectML.dll ($(du -h "$ACCEL_DIR/DirectML.dll" | cut -f1))"

# 复制 ONNX 流水线模型
echo "[2/4] 复制 OCR 流水线模型..."
for f in layout_det.onnx text_det.onnx text_rec.onnx formula_rec.onnx \
         ppocr_keys_v1.txt formula_tokenizer.json layout_labels.txt; do
    if [ -f "$ONNX_DIR/$f" ]; then
        cp "$ONNX_DIR/$f" "$STAGING/onnx_models/pipeline/"
        echo "  + $f ($(du -h "$ONNX_DIR/$f" | cut -f1))"
    else
        echo "  ! 未找到: $f (跳过)"
    fi
done

# 复制 onnxruntime-directml Python 包
echo "[3/4] 复制 onnxruntime-directml 运行时..."
for pkg in "${ORT_PACKAGES[@]}"; do
    src="$SITE_PKG/$pkg"
    if [ -e "$src" ]; then
        cp -r "$src" "$STAGING/site-packages/"
        echo "  + $pkg"
    else
        echo "  ! 未找到: $pkg (跳过)"
    fi
done

# 打包
echo "[4/4] 打包 zip..."
cd "$STAGING"
if command -v 7z &>/dev/null; then
    7z a -tzip -mx=1 "$OUTPUT_ZIP" accelerator/ onnx_models/ site-packages/
else
    powershell.exe -Command "Compress-Archive -Path '$STAGING/*' -DestinationPath '$OUTPUT_ZIP' -CompressionLevel Fastest"
fi

# 清理
cd "$PROJECT_ROOT"
rm -rf "$STAGING"

if [ -f "$OUTPUT_ZIP" ]; then
    SIZE=$(du -h "$OUTPUT_ZIP" | cut -f1)
    echo ""
    echo "=== 完成 ==="
    echo "  GPU 加速包: $OUTPUT_ZIP ($SIZE)"
    echo "  内容: DLL + OCR 流水线模型 + onnxruntime-directml"
else
    echo "ERROR: zip 打包失败"
    exit 1
fi
