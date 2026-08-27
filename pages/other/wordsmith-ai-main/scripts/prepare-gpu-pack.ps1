# prepare-gpu-pack.ps1
# 一站式构建 GPU 加速包：下载 ONNX Runtime DirectML DLL + 打包 OCR 流水线模型
# 输出: wordsmith-gpu-pack.zip
#
# 前提：开发者需提前用 convert_models_to_onnx.py 将 Paddle 模型转为 ONNX 格式，
# 并放置在 ocr_engine/onnx_models/pipeline/ 目录下。
#
# 用法: pwsh scripts/prepare-gpu-pack.ps1

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$outputZip = Join-Path $projectRoot "wordsmith-gpu-pack.zip"

# NuGet 包版本
$ortVersion = "1.20.1"
$dmlVersion = "1.15.1"

# ONNX Runtime DirectML — 提供 onnxruntime.dll（含 DirectML 执行提供者）
$ortNugetUrl = "https://www.nuget.org/api/v2/package/Microsoft.ML.OnnxRuntime.DirectML/$ortVersion"
$ortNugetPkg = Join-Path $env:TEMP "onnxruntime-directml-$ortVersion.nupkg"

# Microsoft.AI.DirectML — 提供 DirectML.dll
$dmlNugetUrl = "https://www.nuget.org/api/v2/package/Microsoft.AI.DirectML/$dmlVersion"
$dmlNugetPkg = Join-Path $env:TEMP "directml-$dmlVersion.nupkg"

# ONNX 流水线模型目录
$onnxModelDir = Join-Path $projectRoot "ocr_engine\onnx_models\pipeline"
$requiredModels = @(
    "layout_det.onnx",
    "text_det.onnx",
    "text_rec.onnx",
    "ppocr_keys_v1.txt"
)
# 可选增强模型（不存在不报错）
$optionalModels = @(
    "table_wired_det.onnx",
    "table_wireless_det.onnx"
)

Write-Host "=== WordSmith AI GPU 加速包构建工具（模块化 OCR 流水线）==="
Write-Host ""

# -------------------------------------------------------
# 1. 检查 ONNX 模型是否存在
# -------------------------------------------------------
Write-Host "[1/6] 检查 ONNX 模型文件..."
if (-not (Test-Path $onnxModelDir)) {
    Write-Host ""
    Write-Host "ERROR: ONNX 模型目录不存在: $onnxModelDir" -ForegroundColor Red
    Write-Host ""
    Write-Host "请先完成以下步骤:" -ForegroundColor Yellow
    Write-Host "  1. 确保 ocr_engine/ 目录存在且包含 Python 环境"
    Write-Host "  2. 运行转换脚本: python scripts/convert_models_to_onnx.py"
    Write-Host "  3. 确认模型文件输出到 ocr_engine/onnx_models/pipeline/"
    Write-Host ""
    exit 1
}

$missingModels = @()
foreach ($model in $requiredModels) {
    $modelPath = Join-Path $onnxModelDir $model
    if (-not (Test-Path $modelPath)) {
        $missingModels += $model
    } else {
        $size = [math]::Round((Get-Item $modelPath).Length / 1MB, 1)
        Write-Host "      [OK] $model ($size MB)"
    }
}

if ($missingModels.Count -gt 0) {
    Write-Host ""
    Write-Host "ERROR: 缺少以下 ONNX 模型文件:" -ForegroundColor Red
    foreach ($m in $missingModels) {
        Write-Host "      - $m" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "请运行转换脚本: python scripts/convert_paddle_to_onnx.py" -ForegroundColor Yellow
    exit 1
}
Write-Host "      所有必需模型文件就绪。"

# 检查可选增强模型
foreach ($model in $optionalModels) {
    $modelPath = Join-Path $onnxModelDir $model
    if (Test-Path $modelPath) {
        $size = [math]::Round((Get-Item $modelPath).Length / 1MB, 1)
        Write-Host "      [OK] $model ($size MB) (可选增强)"
    } else {
        Write-Host "      [--] $model 未找到 (可选，跳过)" -ForegroundColor DarkGray
    }
}

# -------------------------------------------------------
# 2. 下载 ONNX Runtime DirectML NuGet 包
# -------------------------------------------------------
if (Test-Path $ortNugetPkg) {
    Write-Host "[2/6] ORT NuGet 包已缓存: $ortNugetPkg"
} else {
    Write-Host "[2/6] 正在下载 ONNX Runtime DirectML v$ortVersion ..."
    Invoke-WebRequest -Uri $ortNugetUrl -OutFile $ortNugetPkg -UseBasicParsing
    Write-Host "      下载完成: $([math]::Round((Get-Item $ortNugetPkg).Length / 1MB, 1)) MB"
}

# -------------------------------------------------------
# 3. 下载 Microsoft.AI.DirectML NuGet 包（提供 DirectML.dll）
# -------------------------------------------------------
if (Test-Path $dmlNugetPkg) {
    Write-Host "[3/6] DirectML NuGet 包已缓存: $dmlNugetPkg"
} else {
    Write-Host "[3/6] 正在下载 Microsoft.AI.DirectML v$dmlVersion ..."
    Invoke-WebRequest -Uri $dmlNugetUrl -OutFile $dmlNugetPkg -UseBasicParsing
    Write-Host "      下载完成: $([math]::Round((Get-Item $dmlNugetPkg).Length / 1MB, 1)) MB"
}

# -------------------------------------------------------
# 4. 解压两个 NuGet 包，提取 DLL
# -------------------------------------------------------
$ortExtractDir = Join-Path $env:TEMP "ort-directml-extract-gpu"
$dmlExtractDir = Join-Path $env:TEMP "directml-extract-gpu"
if (Test-Path $ortExtractDir) { Remove-Item $ortExtractDir -Recurse -Force }
if (Test-Path $dmlExtractDir) { Remove-Item $dmlExtractDir -Recurse -Force }

Write-Host "[4/6] 正在解压 NuGet 包..."

# 解压 ORT 包
$ortZip = "$ortNugetPkg.zip"
Rename-Item $ortNugetPkg $ortZip -ErrorAction SilentlyContinue
try {
    Expand-Archive -Path $ortZip -DestinationPath $ortExtractDir -Force
} finally {
    Rename-Item $ortZip $ortNugetPkg -ErrorAction SilentlyContinue
}

# 解压 DirectML 包
$dmlZip = "$dmlNugetPkg.zip"
Rename-Item $dmlNugetPkg $dmlZip -ErrorAction SilentlyContinue
try {
    Expand-Archive -Path $dmlZip -DestinationPath $dmlExtractDir -Force
} finally {
    Rename-Item $dmlZip $dmlNugetPkg -ErrorAction SilentlyContinue
}

# ORT DLL 目录
$ortRuntimeDir = Join-Path $ortExtractDir "runtimes\win-x64\native"
if (-not (Test-Path $ortRuntimeDir)) {
    Write-Error "ORT NuGet 包结构异常：未找到 runtimes\win-x64\native\"
    exit 1
}

# DirectML DLL 目录 — 尝试多个已知路径
$dmlDll = $null
$dmlCandidates = @(
    (Join-Path $dmlExtractDir "bin\x64-win\DirectML.dll"),
    (Join-Path $dmlExtractDir "bin\x86-64\DirectML.dll"),
    (Join-Path $dmlExtractDir "runtimes\win-x64\native\DirectML.dll")
)
foreach ($candidate in $dmlCandidates) {
    if (Test-Path $candidate) {
        $dmlDll = $candidate
        break
    }
}
# 兜底：递归搜索
if (-not $dmlDll) {
    $found = Get-ChildItem $dmlExtractDir -Recurse -Filter "DirectML.dll" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $dmlDll = $found.FullName }
}
if (-not $dmlDll) {
    Write-Error "DirectML NuGet 包中未找到 DirectML.dll"
    exit 1
}
Write-Host "      找到 DirectML.dll: $dmlDll"

# -------------------------------------------------------
# 5. 打包成统一 zip
# -------------------------------------------------------
Write-Host "[5/6] 正在打包 GPU 加速包..."

$tempStaging = Join-Path $env:TEMP "wordsmith-gpu-pack-staging-$(Get-Random)"

# accelerator/ 目录 — 放 DLL
$destAccel = Join-Path $tempStaging "accelerator"
New-Item -ItemType Directory -Path $destAccel -Force | Out-Null

# 复制 DirectML.dll
Copy-Item $dmlDll $destAccel
$dmlSize = [math]::Round((Get-Item $dmlDll).Length / 1MB, 1)
Write-Host "      + accelerator/DirectML.dll ($dmlSize MB)"

# 复制 ORT 的所有 DLL
$ortDlls = Get-ChildItem $ortRuntimeDir -Filter "*.dll"
foreach ($dll in $ortDlls) {
    Copy-Item $dll.FullName $destAccel
    Write-Host "      + accelerator/$($dll.Name) ($([math]::Round($dll.Length / 1MB, 1)) MB)"
}

# onnx_models/pipeline/ 目录 — 放流水线模型
$destModels = Join-Path $tempStaging "onnx_models\pipeline"
New-Item -ItemType Directory -Path $destModels -Force | Out-Null
robocopy $onnxModelDir $destModels /E /NFL /NDL /NJH /NJS /NC /NS /NP /XF "formula_rec.onnx" "formula_tokenizer.json"
foreach ($model in $requiredModels) {
    $size = [math]::Round((Get-Item (Join-Path $onnxModelDir $model)).Length / 1MB, 1)
    Write-Host "      + onnx_models/pipeline/$model ($size MB)"
}
foreach ($model in $optionalModels) {
    $modelPath = Join-Path $onnxModelDir $model
    if (Test-Path $modelPath) {
        $size = [math]::Round((Get-Item $modelPath).Length / 1MB, 1)
        Write-Host "      + onnx_models/pipeline/$model ($size MB) (增强)"
    }
}

# site-packages/ 目录 — 放 onnxruntime-directml Python 包
$sitePackagesDir = Join-Path $projectRoot "ocr_engine\site-packages"
$onnxrtDir = Join-Path $sitePackagesDir "onnxruntime"
if (Test-Path $onnxrtDir) {
    $destSitePackages = Join-Path $tempStaging "site-packages"
    New-Item -ItemType Directory -Path $destSitePackages -Force | Out-Null
    # 复制 onnxruntime 及其依赖
    $pyDeps = @("onnxruntime", "onnxruntime_directml.libs",
                "coloredlogs", "humanfriendly", "flatbuffers",
                "sympy", "mpmath", "protobuf")
    foreach ($dep in $pyDeps) {
        $depPath = Join-Path $sitePackagesDir $dep
        if (Test-Path $depPath) {
            $destDep = Join-Path $destSitePackages $dep
            robocopy $depPath $destDep /E /NFL /NDL /NJH /NJS /NC /NS /NP
            Write-Host "      + site-packages/$dep/"
        }
        # 也复制 .dist-info 目录
        $distInfo = Get-ChildItem $sitePackagesDir -Directory -Filter "$dep*dist-info" -ErrorAction SilentlyContinue
        foreach ($di in $distInfo) {
            $destDi = Join-Path $destSitePackages $di.Name
            robocopy $di.FullName $destDi /E /NFL /NDL /NJH /NJS /NC /NS /NP
        }
    }
    Write-Host "      onnxruntime Python 包已包含。"
} else {
    Write-Host "      警告: 未找到 onnxruntime Python 包，GPU 推理可能无法工作" -ForegroundColor Yellow
}

# 创建 zip
if (Test-Path $outputZip) { Remove-Item $outputZip -Force }
Compress-Archive -Path (Join-Path $tempStaging "*") -DestinationPath $outputZip -CompressionLevel Optimal

# -------------------------------------------------------
# 6. 清理
# -------------------------------------------------------
Write-Host "[6/6] 清理临时文件..."
Remove-Item $tempStaging -Recurse -Force
Remove-Item $ortExtractDir -Recurse -Force
Remove-Item $dmlExtractDir -Recurse -Force

$size = [math]::Round((Get-Item $outputZip).Length / 1MB, 1)
Write-Host ""
Write-Host "=== 完成 ===" -ForegroundColor Green
Write-Host "  GPU 加速包: $outputZip ($size MB)"
Write-Host "  用户操作: 设置 -> 高级 -> GPU 加速 -> 导入 GPU 加速包 -> 选择此 zip"
