# pack-ocr-engine.ps1
# Packs the full OCR engine (python + site-packages + models) into a distributable zip.
# Output: wordsmith-ocr-engine.zip
#
# Usage: pwsh scripts/pack-ocr-engine.ps1

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$sourceDir = Join-Path $projectRoot "ocr_engine"
$outputZip = Join-Path $projectRoot "wordsmith-ocr-engine.zip"

if (-not (Test-Path $sourceDir)) {
    Write-Error "Source directory not found: $sourceDir"
    exit 1
}

# Remove old zip if exists
if (Test-Path $outputZip) {
    Remove-Item $outputZip -Force
}

Write-Host "Packing OCR engine from: $sourceDir"
Write-Host "Output: $outputZip"

# Create a temp staging directory
$tempStaging = Join-Path $env:TEMP "wordsmith-ocr-engine-pack-$(Get-Random)"
$destEngine = Join-Path $tempStaging "ocr_engine"
New-Item -ItemType Directory -Path $destEngine -Force | Out-Null

# Copy python/
$pythonDir = Join-Path $sourceDir "python"
if (Test-Path $pythonDir) {
    Write-Host "Copying python/..."
    robocopy $pythonDir (Join-Path $destEngine "python") /E /NFL /NDL /NJH /NJS /NC /NS /NP
}

# Copy site-packages/
$sitePackagesDir = Join-Path $sourceDir "site-packages"
if (Test-Path $sitePackagesDir) {
    Write-Host "Copying site-packages/..."
    robocopy $sitePackagesDir (Join-Path $destEngine "site-packages") /E /NFL /NDL /NJH /NJS /NC /NS /NP
}

# Copy paddlex_home/ (excluding .cache)
$paddlexHomeDir = Join-Path $sourceDir "paddlex_home"
if (Test-Path $paddlexHomeDir) {
    Write-Host "Copying paddlex_home/..."
    robocopy $paddlexHomeDir (Join-Path $destEngine "paddlex_home") /E /XD ".cache" /NFL /NDL /NJH /NJS /NC /NS /NP
}

# Copy ocr_cli.py
$ocrCli = Join-Path $sourceDir "ocr_cli.py"
if (Test-Path $ocrCli) {
    Copy-Item $ocrCli (Join-Path $destEngine "ocr_cli.py")
}

# Copy onnx_engine.py (ONNX 推理入口脚本)
$onnxEngine = Join-Path $sourceDir "onnx_engine.py"
if (Test-Path $onnxEngine) {
    Write-Host "Copying onnx_engine.py..."
    Copy-Item $onnxEngine (Join-Path $destEngine "onnx_engine.py")
}

# Copy hw_accel.py (硬件加速检测脚本)
$hwAccel = Join-Path $sourceDir "hw_accel.py"
if (Test-Path $hwAccel) {
    Write-Host "Copying hw_accel.py..."
    Copy-Item $hwAccel (Join-Path $destEngine "hw_accel.py")
}

# Copy onnx_pipeline.py (模块化 ONNX OCR 流水线脚本)
$onnxPipeline = Join-Path $sourceDir "onnx_pipeline.py"
if (Test-Path $onnxPipeline) {
    Write-Host "Copying onnx_pipeline.py..."
    Copy-Item $onnxPipeline (Join-Path $destEngine "onnx_pipeline.py")
}

# Copy pdf_converter.py (PDF → PNG 转换脚本)
$pdfConverter = Join-Path $sourceDir "pdf_converter.py"
if (Test-Path $pdfConverter) {
    Write-Host "Copying pdf_converter.py..."
    Copy-Item $pdfConverter (Join-Path $destEngine "pdf_converter.py")
}

# Copy onnx_models/ (ONNX 流水线模型，排除废弃的 formula_rec.onnx 和 tokenizer)
$onnxModelsDir = Join-Path $sourceDir "onnx_models"
if (Test-Path $onnxModelsDir) {
    Write-Host "Copying onnx_models/..."
    robocopy $onnxModelsDir (Join-Path $destEngine "onnx_models") /E /XF "formula_rec.onnx" "formula_tokenizer.json" /XD "PaddleOCR-VL-0.9B" "_temp_old_format" /NFL /NDL /NJH /NJS /NC /NS /NP
}

# Copy requirements.txt if exists
$requirements = Join-Path $sourceDir "requirements.txt"
if (Test-Path $requirements) {
    Copy-Item $requirements (Join-Path $destEngine "requirements.txt")
}

# Create zip
Write-Host "Creating zip archive (this may take a while)..."
Compress-Archive -Path (Join-Path $tempStaging "*") -DestinationPath $outputZip -CompressionLevel Optimal

# Clean up
Write-Host "Cleaning up temp files..."
Remove-Item $tempStaging -Recurse -Force

$size = (Get-Item $outputZip).Length / 1GB
Write-Host "Done! Output: $outputZip ($([math]::Round($size, 2)) GB)"
