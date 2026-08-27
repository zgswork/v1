# 创建测试分类文件夹
$shareFolderPath = "d:\phpstudy_pro\WWW\分享文件"
$testCategoryName = "自动测试分类_" + (Get-Date -Format "yyyyMMddHHmmss")
$testCategoryPath = Join-Path $shareFolderPath $testCategoryName

New-Item -ItemType Directory -Path $testCategoryPath -Force
Write-Host "成功创建测试分类文件夹: $testCategoryName"

# 调用getCategories接口测试
$url = "http://127.0.0.1/admin/category_management.php?action=getCategories"
$response = Invoke-WebRequest -Uri $url -UseBasicParsing
$data = $response.Content | ConvertFrom-Json

if ($data.code -eq 200) {
    Write-Host "成功获取分类列表"
    
    # 检查新分类是否在返回列表中
    $found = $false
    foreach ($category in $data.data) {
        if ($category.name -eq $testCategoryName) {
            $found = $true
            Write-Host "新分类 $testCategoryName 已正确添加到分类列表"
            break
        }
    }
    
    if (-not $found) {
        Write-Host "警告: 新分类 $testCategoryName 未在分类列表中找到"
    }
} else {
    Write-Host "获取分类列表失败: $($data.message)"
}

# 清理测试数据
Remove-Item -Path $testCategoryPath -Force
Write-Host "测试完成，已清理测试数据"