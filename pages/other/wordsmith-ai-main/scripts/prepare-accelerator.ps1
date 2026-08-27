# prepare-accelerator.ps1
# 自动下载 ONNX Runtime DirectML + DirectML.dll 并打包加速补丁 zip
#
# 用法: pwsh scripts/prepare-accelerator.ps1

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$accelDir = Join-Path $projectRoot "accelerator"
$outputZip = Join-Path $projectRoot "wordsmith-accelerator.zip"

# NuGet 包版本
$ortVersion = "1.20.1"
$dmlVersion = "1.15.1"

$ortNugetUrl = "https://www.nuget.org/api/v2/package/Microsoft.ML.OnnxRuntime.DirectML/$ortVersion"
$ortNugetPkg = Join-Path $env:TEMP "onnxruntime-directml-$ortVersion.nupkg"

$dmlNugetUrl = "https://www.nuget.org/api/v2/package/Microsoft.AI.DirectML/$dmlVersion"
$dmlNugetPkg = Join-Path $env:TEMP "directml-$dmlVersion.nupkg"

Write-Host "=== WordSmith AI 加速补丁准备工具 ==="
Write-Host ""

# 1. 下载 ORT NuGet 包
if (Test-Path $ortNugetPkg) {
    Write-Host "[OK] ORT NuGet 包已缓存: $ortNugetPkg"
} else {
    Write-Host "[1/5] 正在下载 ONNX Runtime DirectML v$ortVersion ..."
    Invoke-WebRequest -Uri $ortNugetUrl -OutFile $ortNugetPkg -UseBasicParsing
    Write-Host "[OK] 下载完成: $([math]::Round((Get-Item $ortNugetPkg).Length / 1MB, 1)) MB"
}

# 2. 下载 DirectML NuGet 包
if (Test-Path $dmlNugetPkg) {
    Write-Host "[OK] DirectML NuGet 包已缓存: $dmlNugetPkg"
} else {
    Write-Host "[2/5] 正在下载 Microsoft.AI.DirectML v$dmlVersion ..."
    Invoke-WebRequest -Uri $dmlNugetUrl -OutFile $dmlNugetPkg -UseBasicParsing
    Write-Host "[OK] 下载完成: $([math]::Round((Get-Item $dmlNugetPkg).Length / 1MB, 1)) MB"
}

# 3. 解压 NuGet 包
$ortExtractDir = Join-Path $env:TEMP "ort-directml-extract"
$dmlExtractDir = Join-Path $env:TEMP "directml-extract"
if (Test-Path $ortExtractDir) { Remove-Item $ortExtractDir -Recurse -Force }
if (Test-Path $dmlExtractDir) { Remove-Item $dmlExtractDir -Recurse -Force }

Write-Host "[3/5] 正在解压 NuGet 包..."

# 解压 ORT
$ortZip = "$ortNugetPkg.zip"
Rename-Item $ortNugetPkg $ortZip -ErrorAction SilentlyContinue
try { Expand-Archive -Path $ortZip -DestinationPath $ortExtractDir -Force }
finally { Rename-Item $ortZip $ortNugetPkg -ErrorAction SilentlyContinue }

# 解压 DirectML
$dmlZip = "$dmlNugetPkg.zip"
Rename-Item $dmlNugetPkg $dmlZip -ErrorAction SilentlyContinue
try { Expand-Archive -Path $dmlZip -DestinationPath $dmlExtractDir -Force }
finally { Rename-Item $dmlZip $dmlNugetPkg -ErrorAction SilentlyContinue }

# 4. 提取 DLL 到 accelerator/
if (Test-Path $accelDir) { Remove-Item $accelDir -Recurse -Force }
New-Item -ItemType Directory -Path $accelDir -Force | Out-Null

$ortRuntimeDir = Join-Path $ortExtractDir "runtimes\win-x64\native"
if (-not (Test-Path $ortRuntimeDir)) {
    Write-Error "ORT NuGet 包结构异常：未找到 runtimes\win-x64\native\"
    exit 1
}

Write-Host "[4/5] 正在提取 DLL 文件..."

# 复制 ORT DLL
$ortDlls = Get-ChildItem $ortRuntimeDir -Filter "*.dll"
foreach ($dll in $ortDlls) {
    Copy-Item $dll.FullName $accelDir
    Write-Host "      + $($dll.Name) ($([math]::Round($dll.Length / 1MB, 1)) MB)"
}

# 复制 DirectML.dll
$dmlDll = $null
$dmlCandidates = @(
    (Join-Path $dmlExtractDir "bin\x64-win\DirectML.dll"),
    (Join-Path $dmlExtractDir "bin\x86-64\DirectML.dll"),
    (Join-Path $dmlExtractDir "runtimes\win-x64\native\DirectML.dll")
)
foreach ($candidate in $dmlCandidates) {
    if (Test-Path $candidate) { $dmlDll = $candidate; break }
}
if (-not $dmlDll) {
    $found = Get-ChildItem $dmlExtractDir -Recurse -Filter "DirectML.dll" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $dmlDll = $found.FullName }
}
if (-not $dmlDll) {
    Write-Error "DirectML NuGet 包中未找到 DirectML.dll"
    exit 1
}
Copy-Item $dmlDll $accelDir
Write-Host "      + DirectML.dll ($([math]::Round((Get-Item $dmlDll).Length / 1MB, 1)) MB)"

# 校验必要文件
$required = @("DirectML.dll")
foreach ($f in $required) {
    if (-not (Test-Path (Join-Path $accelDir $f))) {
        Write-Error "缺少必要文件: $f"
        exit 1
    }
}

# 5. 打包 zip
if (Test-Path $outputZip) { Remove-Item $outputZip -Force }
Write-Host "[5/5] 正在打包 zip..."

$tempStaging = Join-Path $env:TEMP "wordsmith-accel-staging-$(Get-Random)"
$destAccel = Join-Path $tempStaging "accelerator"
New-Item -ItemType Directory -Path $destAccel -Force | Out-Null
Copy-Item "$accelDir\*" $destAccel -Recurse
Compress-Archive -Path "$tempStaging\*" -DestinationPath $outputZip -CompressionLevel Optimal
Remove-Item $tempStaging -Recurse -Force

# 清理解压目录
Remove-Item $ortExtractDir -Recurse -Force
Remove-Item $dmlExtractDir -Recurse -Force

$size = [math]::Round((Get-Item $outputZip).Length / 1MB, 1)
Write-Host ""
Write-Host "=== 完成 ==="
Write-Host "  加速补丁目录: $accelDir"
Write-Host "  分发包: $outputZip ($size MB)"
Write-Host "  用户操作: 设置 -> 高级 -> GPU 加速 -> 导入 GPU 加速包 -> 选择此 zip"
