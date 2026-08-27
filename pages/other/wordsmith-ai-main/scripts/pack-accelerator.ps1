# pack-accelerator.ps1
# Packs the ONNX Runtime + DirectML accelerator patch into a distributable zip.
# Output: wordsmith-accelerator.zip
#
# Usage: pwsh scripts/pack-accelerator.ps1

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$sourceDir = Join-Path $projectRoot "accelerator"
$outputZip = Join-Path $projectRoot "wordsmith-accelerator.zip"

if (-not (Test-Path $sourceDir)) {
    Write-Error "Source directory not found: $sourceDir"
    exit 1
}

# Validate required files
$requiredFiles = @("DirectML.dll", "onnxruntime_providers_shared.dll")
foreach ($file in $requiredFiles) {
    $filePath = Join-Path $sourceDir $file
    if (-not (Test-Path $filePath)) {
        Write-Error "Required file missing: $filePath"
        exit 1
    }
}

# Remove old zip if exists
if (Test-Path $outputZip) {
    Remove-Item $outputZip -Force
}

Write-Host "Packing accelerator patch from: $sourceDir"
Write-Host "Output: $outputZip"

# Create a temp staging directory
$tempStaging = Join-Path $env:TEMP "wordsmith-accelerator-pack-$(Get-Random)"
$destAccel = Join-Path $tempStaging "accelerator"
New-Item -ItemType Directory -Path $destAccel -Force | Out-Null

# Copy all files from accelerator/
Write-Host "Copying accelerator files..."
robocopy $sourceDir $destAccel /E /NFL /NDL /NJH /NJS /NC /NS /NP

# Create zip
Write-Host "Creating zip archive..."
Compress-Archive -Path (Join-Path $tempStaging "*") -DestinationPath $outputZip -CompressionLevel Optimal

# Clean up
Write-Host "Cleaning up temp files..."
Remove-Item $tempStaging -Recurse -Force

$size = (Get-Item $outputZip).Length / 1MB
Write-Host "Done! Output: $outputZip ($([math]::Round($size, 2)) MB)"
