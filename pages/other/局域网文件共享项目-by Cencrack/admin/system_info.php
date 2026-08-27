<?php
/**
 * 系统信息页面
 * 显示服务器和PHP环境配置信息
 */

// 引入认证控制
require_once 'auth.php';

// 保护页面，确保只有登录用户才能访问
protectPage();

// 设置页面标题和编码
header('Content-Type: text/html; charset=utf-8');

// 引入统一皮肤加载器
include_once __DIR__ . '/../skin_loader.php';

// 获取所有皮肤信息
$skins = getAllSkins();

// 获取当前选中的皮肤，支持skin和theme参数
$currentSkin = isset($_GET['skin']) ? $_GET['skin'] : (isset($_GET['theme']) ? $_GET['theme'] : getCurrentSkin());

// 验证皮肤有效性
$validSkinFolders = array_column($skins, 'folder');
if (!empty($currentSkin) && !in_array($currentSkin, $validSkinFolders)) {
    $currentSkin = getCurrentSkin() ?: 'warcraft3';
}

// 确保有有效皮肤
if (empty($currentSkin)) {
    $currentSkin = 'warcraft3';
}

// 获取系统信息函数
function getSystemInfo() {
    $info = [];
    
    // 服务器信息
    $info['server'] = [
        '服务器软件' => $_SERVER['SERVER_SOFTWARE'] ?? '未知',
        '服务器IP' => $_SERVER['SERVER_ADDR'] ?? '未知',
        '服务器域名' => $_SERVER['SERVER_NAME'] ?? '未知',
        '服务器端口' => $_SERVER['SERVER_PORT'] ?? '未知',
        '网站根目录' => $_SERVER['DOCUMENT_ROOT'] ?? '未知',
        '服务器操作系统' => PHP_OS,
        '系统负载' => function_exists('sys_getloadavg') ? implode(', ', sys_getloadavg()) : '不支持获取',
    ];
    
    // PHP信息
    $info['php'] = [
        'PHP版本' => PHP_VERSION,
        'Zend版本' => zend_version(),
        'PHP运行模式' => PHP_SAPI,
        'PHP可上传文件大小' => ini_get('upload_max_filesize'),
        'PHP最大POST数据大小' => ini_get('post_max_size'),
        'PHP内存限制' => ini_get('memory_limit'),
        'PHP执行时间限制' => ini_get('max_execution_time') . '秒',
        'file_uploads' => ini_get('file_uploads') ? '开启' : '关闭',
        'allow_url_fopen' => ini_get('allow_url_fopen') ? '开启' : '关闭',
        'expose_php' => ini_get('expose_php') ? '开启' : '关闭',
        'date.timezone' => ini_get('date.timezone') ?: '未设置',
    ];
    
    // 服务器时间信息
    $info['time'] = [
        '服务器当前时间' => date('Y-m-d H:i:s'),
        '时区' => date_default_timezone_get(),
    ];
    
    // 数据库信息
    $info['database'] = [
        'MySQL版本' => (function_exists('mysqli_get_client_info')) ? mysqli_get_client_info() : '无法获取',
        'PDO支持' => extension_loaded('PDO') ? '已安装' : '未安装',
        'MySQLi支持' => extension_loaded('mysqli') ? '已安装' : '未安装',
    ];
    
    // 扩展信息
    $info['extensions'] = get_loaded_extensions();
    
    // 文件系统信息
    $info['filesystem'] = [
        '当前目录' => getcwd(),
        '当前目录权限' => substr(sprintf('%o', fileperms('.')), -4),
        '临时目录' => sys_get_temp_dir(),
        '临时目录权限' => @substr(sprintf('%o', @fileperms(sys_get_temp_dir())), -4) ?: '无法获取',
    ];
    
    // 获取磁盘空间信息
    if (function_exists('disk_free_space') && function_exists('disk_total_space')) {
        $root = '/';
        if (PHP_OS === 'WINNT') {
            $root = 'C:';
        }
        $info['disk'] = [
            '磁盘总空间' => formatBytes(@disk_total_space($root)),
            '磁盘可用空间' => formatBytes(@disk_free_space($root)),
            '磁盘已用空间' => formatBytes(@disk_total_space($root) - @disk_free_space($root)),
        ];
    }
    
    return $info;
}

// 格式化字节数
function formatBytes($bytes, $precision = 2) {
    if ($bytes === 0 || $bytes === false) {
        return '0 B';
    }
    
    $units = array('B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB');
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= (1 << (10 * $pow));
    
    return round($bytes, $precision) . ' ' . $units[$pow];
}

// 获取系统信息
$systemInfo = getSystemInfo();
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>系统信息 - 管理后台</title>
    <link rel="stylesheet" href="../css/font-awesome/font-awesome.min.css">
    <style>
        /* 全局样式 */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: var(--color-text-primary, #333);
            background: var(--color-bg-body);
            min-height: 100vh;
            padding: 20px;
        }
        
        /* 主容器 */
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: var(--color-bg-container, rgba(255, 255, 255, 0.9));
            border-radius: var(--color-radius-lg, 12px);
            box-shadow: var(--color-shadow-container, 0 20px 40px rgba(0, 0, 0, 0.1));
            overflow: hidden;
        }
        
        /* 页头 */
        .header {
            background: var(--color-bg-primary);
            color: var(--color-text-primary, white);
            padding: 30px 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>') repeat;
            opacity: 0.5;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            position: relative;
            z-index: 1;
            font-weight: 600;
        }
        
        .header p {
            font-size: 1.1em;
            opacity: 0.9;
            position: relative;
            z-index: 1;
        }
        
        /* 内容区域 */
        .content {
            padding: 30px;
        }
        
        /* 标签页导航 */
        .tabs {
            display: flex;
            flex-wrap: wrap;
            margin-bottom: 20px;
            border-bottom: 2px solid var(--color-border-divider, #f0f0f0);
        }
        
        .tab-btn {
            padding: 12px 24px;
            background: none;
            border: none;
            font-size: 16px;
            font-weight: 500;
            color: var(--color-text-tab, #666);
            cursor: pointer;
            transition: all var(--color-transition-normal, 0.3s) ease;
            position: relative;
            border-bottom: 3px solid transparent;
        }
        
        .tab-btn:hover {
            color: var(--color-primary, #1890ff);
        }
        
        .tab-btn.active {
            color: var(--color-primary, #1890ff);
            border-bottom-color: var(--color-primary, #1890ff);
        }
        
        /* 标签页内容 */
        .tab-content {
            display: none;
            animation: fadeIn 0.3s ease-in-out;
        }
        
        .tab-content.active {
            display: block;
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        /* 信息卡片 */
        .info-card {
            background: var(--color-bg-card, #fafafa);
            border-radius: var(--color-radius-md, 8px);
            padding: 24px;
            margin-bottom: 20px;
            border: 1px solid var(--color-border-card, #f0f0f0);
            transition: transform var(--color-transition-fast, 0.2s) ease, box-shadow var(--color-transition-fast, 0.2s) ease;
        }
        
        .info-card:hover {
            transform: translateY(-2px);
            box-shadow: var(--color-shadow-card-hover, 0 4px 12px rgba(0, 0, 0, 0.08));
        }
        
        .info-card h2 {
            font-size: 1.4em;
            margin-bottom: 20px;
            color: var(--color-text-heading, #333);
            border-left: 4px solid var(--color-primary, #1890ff);
            padding-left: 15px;
            display: flex;
            align-items: center;
        }
        
        .info-card h2 i {
            margin-right: 10px;
            color: var(--color-primary, #1890ff);
        }
        
        /* 信息表格 */
        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        
        .info-table tr {
            border-bottom: 1px solid var(--color-border-table, #f0f0f0);
        }
        
        .info-table tr:last-child {
            border-bottom: none;
        }
        
        .info-table td {
            padding: 12px 0;
            vertical-align: top;
        }
        
        .info-table td:first-child {
            width: 30%;
            font-weight: 500;
            color: var(--color-text-secondary, #666);
            padding-right: 20px;
        }
        
        .info-table td:last-child {
            width: 70%;
            color: var(--color-text-primary, #333);
        }
        
        /* 状态标签 */
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: var(--color-radius-sm, 4px);
            font-size: 12px;
            font-weight: 500;
        }
        
        .status-badge.success {
            background-color: var(--color-bg-success, #f6ffed);
            color: var(--color-text-success, #52c41a);
            border: 1px solid var(--color-border-success, #b7eb8f);
        }
        
        .status-badge.danger {
            background-color: var(--color-bg-danger, #fff1f0);
            color: var(--color-text-danger, #ff4d4f);
            border: 1px solid var(--color-border-danger, #ffccc7);
        }
        
        /* 扩展列表 */
        .extensions-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
        }
        
        .extension-item {
            background: var(--color-bg-extension, var(--color-bg-card, #f0f0f0));
            color: var(--color-text-primary, #333);
            padding: 8px 16px;
            border-radius: var(--color-radius-sm, 4px);
            font-size: 14px;
            border: 1px solid var(--color-border-extension, var(--color-border-card, #e0e0e0));
            transition: all var(--color-transition-fast, 0.2s) ease;
            cursor: pointer;
            user-select: none;
        }
        
        .extension-item:hover {
            background: var(--color-bg-extension-hover, var(--color-bg-hover, #e6f7ff));
            border-color: var(--color-primary, #91d5ff);
            color: var(--color-primary, #1890ff);
            transform: translateY(-1px);
            box-shadow: var(--color-shadow-card, 0 2px 8px rgba(0, 0, 0, 0.1));
        }
        
        /* 进度条 */
        .progress-bar {
            width: 100%;
            height: 8px;
            background: var(--color-bg-progress, #f0f0f0);
            border-radius: var(--color-radius-sm, 4px);
            overflow: hidden;
            margin-top: 5px;
        }
        
        .progress-fill {
            height: 100%;
            background: var(--color-progress-fill, #1890ff);
            border-radius: var(--color-radius-sm, 4px);
            transition: width var(--color-transition-normal, 0.3s) ease;
        }
        
        /* 上传提示样式 */
        .upload-tips {
            background-color: var(--color-bg-alert-info, #e9ecef);
            border: 1px solid var(--color-border-alert-info, #bee5eb);
            border-radius: var(--color-radius-md, 4px);
            padding: 12px;
            margin-top: 10px;
            font-size: 13px;
            color: var(--color-text-alert-info, #0c5460);
            line-height: 1.5;
        }
        
        .upload-tips i {
            color: var(--color-primary, #1890ff);
            margin-right: 5px;
        }
        
        /* 响应式设计 */
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            
            .container {
                border-radius: 8px;
            }
            
            .header {
                padding: 20px;
            }
            
            .header h1 {
                font-size: 1.8em;
            }
            
            .content {
                padding: 20px;
            }
            
            .tab-btn {
                padding: 10px 15px;
                font-size: 14px;
            }
            
            .info-card {
                padding: 15px;
            }
            
            .info-table td:first-child {
                width: 40%;
                padding-right: 10px;
            }
            
            .info-table td:last-child {
                width: 60%;
            }
        }
        
        /* 动画效果 */
        @keyframes pulse {
            0% {
                transform: scale(1);
            }
            50% {
                transform: scale(1.02);
            }
            100% {
                transform: scale(1);
            }
        }
        
        .highlight {
            animation: pulse 2s infinite;
        }
        
        /* 按钮样式 */
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: var(--color-radius-md, 6px);
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all var(--color-transition-fast, 0.2s) ease;
            text-decoration: none;
            display: inline-block;
            text-align: center;
        }
        
        .btn-primary {
            background: var(--color-bg-btn-primary, #1890ff);
            color: var(--color-text-btn-primary, white);
        }
        
        .btn-primary:hover {
            background: var(--color-bg-btn-primary-hover, #40a9ff);
            transform: translateY(-1px);
            box-shadow: var(--color-shadow-btn, 0 2px 8px rgba(24, 144, 255, 0.3));
        }
        
        .btn-secondary {
            background: var(--color-bg-btn-secondary, #f0f0f0);
            color: var(--color-text-btn-secondary, #333);
            border: 1px solid var(--color-border-btn, #d9d9d9);
        }
        
        .btn-secondary:hover {
            background: var(--color-bg-btn-secondary-hover, #e6f7ff);
            border-color: var(--color-primary, #40a9ff);
            color: var(--color-primary, #1890ff);
        }
    </style>
    <!-- 皮肤CSS变量和样式 -->
    <?php echo getSkinHTMLHead($currentSkin); ?>
    <!-- 皮肤切换JavaScript -->
    <?php echo getSkinSwitchJS(); ?>
</head>
<body class="<?php echo getSkinBodyClass($currentSkin); ?>" data-theme="<?php echo $currentSkin; ?>">
    <div class="container">
        <!-- 页头 -->
        <div class="header">
            <h1><i class="fa fa-server"></i> 系统信息</h1>
            <p>服务器环境与PHP配置详情</p>
        </div>
        
        <!-- 内容区域 -->
        <div class="content">
            <!-- 标签页导航 -->
            <div class="tabs">
                <button class="tab-btn active" data-tab="server"><i class="fa fa-cogs"></i> 服务器信息</button>
                <button class="tab-btn" data-tab="php"><i class="fa fa-code"></i> PHP配置</button>
                <button class="tab-btn" data-tab="database"><i class="fa fa-database"></i> 数据库信息</button>
                <button class="tab-btn" data-tab="extensions"><i class="fa fa-puzzle-piece"></i> PHP扩展</button>
                <button class="tab-btn" data-tab="filesystem"><i class="fa fa-folder-open"></i> 文件系统</button>
            </div>
            
            <!-- 服务器信息标签页 -->
            <div id="server" class="tab-content active">
                <div class="info-card">
                    <h2><i class="fa fa-server"></i> 服务器基本信息</h2>
                    <table class="info-table">
                        <?php foreach ($systemInfo['server'] as $key => $value): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($key); ?></td>
                            <td><?php echo htmlspecialchars($value); ?></td>
                        </tr>
                        <?php endforeach; ?>
                    </table>
                </div>
                
                <div class="info-card">
                    <h2><i class="fa fa-clock-o"></i> 时间信息</h2>
                    <table class="info-table">
                        <?php foreach ($systemInfo['time'] as $key => $value): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($key); ?></td>
                            <td><?php echo htmlspecialchars($value); ?></td>
                        </tr>
                        <?php endforeach; ?>
                    </table>
                </div>
                
                <?php if (isset($systemInfo['disk'])): ?>
                <div class="info-card">
                    <h2><i class="fa fa-hdd-o"></i> 磁盘空间</h2>
                    <table class="info-table">
                        <?php foreach ($systemInfo['disk'] as $key => $value): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($key); ?></td>
                            <td><?php echo htmlspecialchars($value); ?></td>
                        </tr>
                        <?php endforeach; ?>
                    </table>
                    <?php 
                        $root = (PHP_OS === 'WINNT') ? 'C:' : '/';
                        $totalSpace = disk_total_space($root);
                        $freeSpace = disk_free_space($root);
                        $usedSpace = $totalSpace - $freeSpace;
                        $usedPercentage = ($totalSpace > 0) ? ($usedSpace / $totalSpace) * 100 : 0;
                    ?>
                    <div style="margin-top: 15px;">
                        <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px;">
                            <span>磁盘使用率</span>
                            <span><?php echo round($usedPercentage, 2); ?>%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: <?php echo min($usedPercentage, 100); ?>%"></div>
                        </div>
                    </div>
                </div>
                <?php endif; ?>
            </div>
            
            <!-- PHP配置标签页 -->
            <div id="php" class="tab-content">
                <div class="info-card">
                    <h2><i class="fa fa-code"></i> PHP配置信息</h2>
                    <table class="info-table">
                        <?php foreach ($systemInfo['php'] as $key => $value): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($key); ?></td>
                            <td>
                                <?php 
                                    // 特殊处理开关类型的配置项
                                    if ($value === '开启' || $value === '关闭') {
                                        $class = $value === '开启' ? 'success' : 'danger';
                                        echo '<span class="status-badge ' . $class . '">' . $value . '</span>';
                                    } else {
                                        // 特殊处理上传大小和内存限制
                                        if (strpos($key, '大小') !== false || strpos($key, '限制') !== false) {
                                            $value = htmlspecialchars($value);
                                            // 对上传大小和内存限制进行高亮处理
                                            if ((strpos($key, '上传') !== false && $value <= '2M') || 
                                                (strpos($key, '内存') !== false && $value <= '64M')) {
                                                $value = '<span class="highlight">' . $value . '</span>';
                                            }
                                            echo $value;
                                            
                                            // 添加上传文件大小扩展说明
                                            if (strpos($key, '上传') !== false) {
                                                echo '<div class="upload-tips"><i class="fa fa-info-circle"></i> <strong>如何扩展PHP可上传文件大小：</strong><br>
                                                1. 修改php.ini文件中的以下配置：<br>
                                                &nbsp;&nbsp;&nbsp;&nbsp;upload_max_filesize = 100M<br>
                                                &nbsp;&nbsp;&nbsp;&nbsp;post_max_size = 100M<br>
                                                &nbsp;&nbsp;&nbsp;&nbsp;memory_limit = 128M<br>
                                                2. 重启Web服务器使配置生效<br>
                                                3. 如果使用phpstudy，可在面板中直接修改PHP配置</div>';
                                            }
                                        } else {
                                            echo htmlspecialchars($value);
                                        }
                                    }
                                ?>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </table>
                </div>
            </div>
            
            <!-- 数据库信息标签页 -->
            <div id="database" class="tab-content">
                <div class="info-card">
                    <h2><i class="fa fa-database"></i> 数据库支持</h2>
                    <table class="info-table">
                        <?php foreach ($systemInfo['database'] as $key => $value): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($key); ?></td>
                            <td>
                                <?php 
                                    if (strpos($value, '已安装') !== false) {
                                        echo '<span class="status-badge success">' . $value . '</span>';
                                    } else if (strpos($value, '未安装') !== false) {
                                        echo '<span class="status-badge danger">' . $value . '</span>';
                                    } else {
                                        echo htmlspecialchars($value);
                                    }
                                ?>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </table>
                </div>
            </div>
            
            <!-- PHP扩展标签页 -->
            <div id="extensions" class="tab-content">
                <div class="info-card">
                    <h2><i class="fa fa-puzzle-piece"></i> 已加载的PHP扩展</h2>
                    <div class="extensions-list">
                        <?php foreach ($systemInfo['extensions'] as $extension): ?>
                        <span class="extension-item">
                            <i class="fa fa-plug"></i> <?php echo htmlspecialchars($extension); ?>
                        </span>
                        <?php endforeach; ?>
                    </div>
                    <div style="margin-top: 20px; text-align: center; color: #666;">
                        共加载 <strong><?php echo count($systemInfo['extensions']); ?></strong> 个扩展
                    </div>
                </div>
            </div>
            
            <!-- 文件系统标签页 -->
            <div id="filesystem" class="tab-content">
                <div class="info-card">
                    <h2><i class="fa fa-folder-open"></i> 文件系统信息</h2>
                    <table class="info-table">
                        <?php foreach ($systemInfo['filesystem'] as $key => $value): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($key); ?></td>
                            <td><?php echo htmlspecialchars($value); ?></td>
                        </tr>
                        <?php endforeach; ?>
                    </table>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // 标签页切换功能
        document.addEventListener('DOMContentLoaded', function() {
            const tabButtons = document.querySelectorAll('.tab-btn');
            const tabContents = document.querySelectorAll('.tab-content');
            
            tabButtons.forEach(button => {
                button.addEventListener('click', function() {
                    // 移除所有活动状态
                    tabButtons.forEach(btn => btn.classList.remove('active'));
                    tabContents.forEach(content => content.classList.remove('active'));
                    
                    // 添加当前活动状态
                    this.classList.add('active');
                    const targetTab = document.getElementById(this.getAttribute('data-tab'));
                    targetTab.classList.add('active');
                });
            });
            
            // 自动调整进度条动画
              const progressFills = document.querySelectorAll('.progress-fill');
              progressFills.forEach(fill => {
                  const width = fill.style.width;
                  fill.style.width = '0%';
                  setTimeout(() => {
                      fill.style.width = width;
                  }, 300);
              });
        });
    </script>
</body>
</html>