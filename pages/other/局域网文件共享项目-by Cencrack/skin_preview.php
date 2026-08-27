<?php
/**
 * 皮肤预览页面
 * 功能：在iframe中显示皮肤效果的预览
 */

$skinFolder = isset($_GET['skin']) ? $_GET['skin'] : '';
$skinsDir = __DIR__ . '/skins';
$skinPath = $skinsDir . '/' . $skinFolder;

// 检查皮肤是否存在
if (!is_dir($skinPath) || !file_exists($skinPath . '/style.css')) {
    die('皮肤不存在或缺少必要的CSS文件');
}

// 加载皮肤配置
$configFile = $skinPath . '/skin.json';
$skinName = $skinFolder;
if (file_exists($configFile)) {
    $config = json_decode(file_get_contents($configFile), true);
    if ($config && isset($config['name'])) {
        $skinName = $config['name'];
    }
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo $skinName; ?> 预览</title>
    <!-- 使用相对于根目录的路径，确保从任何位置访问都能正确加载皮肤CSS -->
    <link rel="stylesheet" href="/skins/<?php echo $skinFolder; ?>/style.css">
    <style>
        /* 确保预览内容在iframe中正确显示 */
        body {
            margin: 0;
            padding: 0;
        }
        
        .container {
            max-width: 100%;
            padding: 10px;
        }
    </style>
</head>
<body class="theme-<?php echo $skinFolder; ?>">
    <div class="container">
        <header>
            <h1>文件分享中心</h1>
            <p>提供各类软件、工具和资料的下载服务</p>
        </header>
        
        <div class="file-stats">
            <div class="stat-item">
                总文件数: <span class="stat-number">28</span>
            </div>
            <div class="stat-item">
                总分类数: <span class="stat-number">8</span>
            </div>
            <div class="stat-item">
                当前显示: <span class="stat-number">28</span> 个文件
            </div>
        </div>
        
        <div class="category-tabs">
            <a href="#" onclick="return false;">
                <button class="category-tab active">
                    全部文件
                </button>
            </a>
            <a href="#" onclick="return false;">
                <button class="category-tab">
                    工具
                </button>
            </a>
            <a href="#" onclick="return false;">
                <button class="category-tab">
                    软件
                </button>
            </a>
            <a href="#" onclick="return false;">
                <button class="category-tab">
                    资料
                </button>
            </a>
        </div>
        
        <table class="file-table">
            <thead>
                <tr>
                    <th>文件名</th>
                    <th>分类</th>
                    <th>大小</th>
                    <th>修改日期</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>
                        <a href="#" class="file-name" onclick="return false;">
                            <span class="file-icon">⚙️</span>
                            系统工具.exe
                        </a>
                    </td>
                    <td>工具</td>
                    <td>5.2 MB</td>
                    <td>2023-10-20 14:30:00</td>
                    <td>
                        <a href="#" class="file-name" onclick="return false;">
                            下载
                        </a>
                    </td>
                </tr>
                <tr>
                    <td>
                        <a href="#" class="file-name" onclick="return false;">
                            <span class="file-icon">📄</span>
                            使用手册.pdf
                        </a>
                    </td>
                    <td>资料</td>
                    <td>2.8 MB</td>
                    <td>2023-10-19 09:15:00</td>
                    <td>
                        <a href="#" class="file-name" onclick="return false;">
                            下载
                        </a>
                    </td>
                </tr>
                <tr>
                    <td>
                        <a href="#" class="file-name" onclick="return false;">
                            <span class="file-icon">🖼️</span>
                            壁纸.jpg
                        </a>
                    </td>
                    <td>软件</td>
                    <td>1.5 MB</td>
                    <td>2023-10-18 16:45:00</td>
                    <td>
                        <a href="#" class="file-name" onclick="return false;">
                            下载
                        </a>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</body>
</html>