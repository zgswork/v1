<?php
/**
 * 文件分享前台页面
 * 功能：扫描分享文件文件夹中的所有文件并展示，支持数据库交互和下载计数
 */

// 引入统一皮肤加载器
include_once __DIR__ . '/skin_loader.php';
// 引入UI配置加载器
include_once __DIR__ . '/ui_config_loader.php';

// 定义常量，允许访问配置文件
define('IN_ADMIN_PANEL', true);
define('IN_FILE_DOWNLOAD', true);

// 引入数据库配置
require_once __DIR__ . '/admin/db_config.php';

// 引入安全下载处理程序
require_once __DIR__ . '/admin/secure_download.php';

// 初始化数据库连接函数
function getDbConnection() {
    // 使用配置文件获取数据库连接
    $db = DatabaseConfig::getConnection('admin');
    if (!$db) {
        throw new Exception('数据库连接失败');
    }
    return $db;
}

// 尝试连接数据库
$db = null;
try {
    $db = DatabaseConfig::getConnection();
} catch (Exception $e) {
    error_log('数据库连接错误: ' . $e->getMessage());
    // 连接失败时继续执行，但数据库功能将不可用
}

$skinData = loadSelectedSkin();

// 定义分享文件目录路径
$shareFolderPath = __DIR__ . '/分享文件';

// 获取所有文件信息的函数 - 从数据库获取
function getAllFiles($shareFolderPath, $db = null) {
    $allFiles = [];
    
    // 如果数据库连接失败，返回空数组
    if ($db === null) {
        error_log('数据库连接失败，无法获取文件信息');
        return $allFiles;
    }
    
    try {
        // 从数据库获取所有文件信息
        $result = $db->query("SELECT file_md5, file_name, file_size, file_path, file_remark, upload_time, download_count FROM shared_files ORDER BY upload_time DESC");
        
        if (!$result) {
            error_log('查询文件信息失败: ' . $db->lastErrorMsg());
            return $allFiles;
        }
        
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            // 提取分类信息 - 改进的路径解析逻辑
            $path_parts = explode('/', trim($row['file_path'], '/'));
            
            // 处理可能的路径格式:
            // 1. "分享文件/分类/文件名"
            // 2. "分类/文件名"
            // 3. "文件名" (无分类)
            
            if (count($path_parts) >= 2) {
                // 检查第一个部分是否是"分享文件"
                if ($path_parts[0] === '分享文件') {
                    // 格式为"分享文件/分类/文件名"，取第二个部分作为分类
                    $category = $path_parts[1];
                } else {
                    // 格式为"分类/文件名"，取第一个部分作为分类
                    $category = $path_parts[0];
                }
            } else {
                // 只有一个部分，表示没有分类信息
                $category = '未分类';
            }
            
            // 获取文件修改时间，优先使用数据库中的上传时间，如果为空则使用当前时间
            $fileTime = !empty($row['upload_time']) ? strtotime($row['upload_time']) : time();
            
            $fileInfo = [
                'name' => $row['file_name'],
                'path' => $row['file_path'],
                'folder' => $category,
                'size' => $row['file_size'],
                'date' => $fileTime,
                'md5' => $row['file_md5'],
                'download_count' => $row['download_count'] ?? 0,
                'remark' => $row['file_remark'] ?? ''
            ];
            $allFiles[] = $fileInfo;
        }
    } catch (Exception $e) {
        error_log('获取文件信息异常: ' . $e->getMessage());
    }
    
    return $allFiles;
}

// 格式化文件大小
function formatFileSize($bytes) {
    if ($bytes >= 1073741824) {
        return number_format($bytes / 1073741824, 2) . ' GB';
    } elseif ($bytes >= 1048576) {
        return number_format($bytes / 1048576, 2) . ' MB';
    } elseif ($bytes >= 1024) {
        return number_format($bytes / 1024, 2) . ' KB';
    } else {
        return $bytes . ' B';
    }
}

// 格式化日期
function formatDate($timestamp) {
    // 检查时间戳是否有效
    if (!$timestamp || !is_numeric($timestamp) || $timestamp <= 0) {
        return '-';
    }
    return date('Y-m-d H:i:s', $timestamp);
}

// 获取文件图标
function getFileIcon($fileName) {
    $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
    $icons = [
        'txt' => 'fa-file-text-o',
        'doc' => 'fa-file-word-o',
        'docx' => 'fa-file-word-o',
        'pdf' => 'fa-file-pdf-o',
        'zip' => 'fa-file-archive-o',
        'rar' => 'fa-file-archive-o',
        '7z' => 'fa-file-archive-o',
        'jpg' => 'fa-file-image-o',
        'jpeg' => 'fa-file-image-o',
        'png' => 'fa-file-image-o',
        'gif' => 'fa-file-image-o',
        'exe' => 'fa-cogs',
        'mp3' => 'fa-music',
        'mp4' => 'fa-film',
        'avi' => 'fa-film',
        'xls' => 'fa-file-excel-o',
        'xlsx' => 'fa-file-excel-o',
        'ppt' => 'fa-file-powerpoint-o',
        'pptx' => 'fa-file-powerpoint-o'
    ];
    return isset($icons[$extension]) ? $icons[$extension] : 'fa-file-o';
}

// 获取分类图标
function getCategoryIcon($categoryName) {
    // 根据分类名称返回相应的图标
    $categoryIcons = [
        '工具' => 'fa-wrench',
        '资料' => 'fa-book',
        '软件' => 'fa-desktop',
        '默认分类' => 'fa-folder-o',
        '文档' => 'fa-file-text-o',
        '图片' => 'fa-image',
        '视频' => 'fa-video-camera',
        '音频' => 'fa-headphones',
        '游戏' => 'fa-gamepad',
        '其他' => 'fa-ellipsis-h'
    ];
    
    // 先尝试精确匹配
    if (isset($categoryIcons[$categoryName])) {
        return $categoryIcons[$categoryName];
    }
    
    // 如果没有精确匹配，尝试模糊匹配
    foreach ($categoryIcons as $key => $icon) {
        if (strpos($categoryName, $key) !== false) {
            return $icon;
        }
    }
    
    // 默认返回文件夹图标
    return 'fa-folder-o';
}

// 获取所有文件（带数据库连接）
$files = getAllFiles($shareFolderPath, $db);

// 如果没有文件，创建一个默认的示例文件信息
if (empty($files)) {
    $files[] = [
        'name' => '示例文件.txt',
        'path' => '',
        'folder' => '默认分类',
        'size' => 1024,
        'date' => time(),
        'md5' => '',
        'download_count' => 0,
        'remark' => '这是一个示例文件'
    ];
}

// 获取所有分类 - 从数据库获取
function getAllCategories($db = null) {
    $categories = [];
    
    // 如果数据库连接失败，返回空数组
    if ($db === null) {
        error_log('数据库连接失败，无法获取分类信息');
        return $categories;
    }
    
    try {
        // 从数据库获取所有分类
        $result = $db->query("SELECT DISTINCT category_name FROM category_sort ORDER BY sort_order");
        
        if (!$result) {
            error_log('查询分类信息失败: ' . $db->lastErrorMsg());
            return $categories;
        }
        
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $categories[] = $row['category_name'];
        }
    } catch (Exception $e) {
        error_log('获取分类信息异常: ' . $e->getMessage());
    }
    
    return $categories;
}

// 获取排序后的分类 - 从数据库获取
function getSortedCategories($db) {
    // 如果数据库连接失败，返回空数组
    if ($db === null) {
        error_log('数据库连接失败，无法获取分类排序');
        return [];
    }
    
    try {
        // 获取分类排序信息
        $categories = [];
        $result = $db->query("SELECT category_name FROM category_sort ORDER BY sort_order");
        
        if (!$result) {
            error_log('查询分类排序失败: ' . $db->lastErrorMsg());
            return $categories;
        }
        
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $categories[] = $row['category_name'];
        }
        
        return $categories;
    } catch (Exception $e) {
        error_log('获取分类排序失败: ' . $e->getMessage());
        return [];
    }
}

// 获取排序后的分类
$categories = getSortedCategories($db);

// 如果没有分类，添加默认分类
if (empty($categories)) {
    $categories = ['默认分类'];
}

// 当前选中的分类 - 默认选择第一个分类
$selectedCategory = isset($_GET['category']) ? $_GET['category'] : (empty($categories) ? '' : reset($categories));

// 根据选中的分类过滤文件
$filteredFiles = empty($selectedCategory) ? $files : array_filter($files, function($file) use ($selectedCategory) {
    return $file['folder'] === $selectedCategory;
});

// 文件搜索功能
$searchKeyword = isset($_GET['search']) ? trim($_GET['search']) : '';
$searchResults = [];

// 如果有搜索请求，执行搜索
if (!empty($searchKeyword)) {
    $searchResults = array_filter($files, function($file) use ($searchKeyword) {
        // 只搜索文件名
        return stripos($file['name'], $searchKeyword) !== false;
    });
    
    // 使用搜索结果替代过滤后的文件
    $filteredFiles = $searchResults;
}

// 检查是否有下载请求
if (isset($_GET['download']) && isset($_GET['md5']) && $db !== null) {
    // 验证文件是否在数据库中存在
    $fileMd5 = $_GET['md5'];
    if (!isFileInDatabase($fileMd5, $db)) {
        error_log('下载请求: 文件MD5不存在于数据库中: ' . $fileMd5);
        header('HTTP/1.0 404 Not Found');
        exit('文件不存在');
    }
    
    // 更新下载计数
    updateDownloadCount($fileMd5, $db);
    
    // 使用传入的file_path进行安全下载
    if (isset($_GET['file_path'])) {
        $file_path = urldecode($_GET['file_path']);
        // 使用安全下载函数
        if (secureFileDownload($file_path, $shareFolderPath)) {
            exit; // 下载成功，退出脚本
        } else {
            error_log('安全下载失败: ' . $file_path);
            header('HTTP/1.0 403 Forbidden');
            exit('文件下载失败');
        }
    }
    
    // 如果直接下载失败，尝试从数据库获取文件路径
    try {
        $stmt = $db->prepare("SELECT file_name FROM shared_files WHERE file_md5 = :md5");
        $stmt->bindValue(':md5', $fileMd5, SQLITE3_TEXT);
        $result = $stmt->execute();
        $row = $result->fetchArray(SQLITE3_ASSOC);
        
        if ($row && !empty($row['file_name'])) {
            // 从文件列表中查找文件路径
            $targetFile = array_filter($files, function($file) use ($fileMd5) {
                return $file['md5'] === $fileMd5;
            });
            
            if (!empty($targetFile)) {
                $file = reset($targetFile);
                $relativePath = str_replace('\\', '/', substr($file['path'], strlen('/分享文件/')));
                
                // 使用安全下载函数
                if (secureFileDownload($relativePath, $shareFolderPath)) {
                    exit; // 下载成功，退出脚本
                }
            }
        }
    } catch (Exception $e) {
        error_log('查询文件路径失败: ' . $e->getMessage());
    }
    
    // 所有下载尝试均失败
    header('HTTP/1.0 404 Not Found');
    exit('文件不存在或无法访问');
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>文件分享中心</title>
    <!-- 引入本地Font Awesome CSS -->
    <link rel="stylesheet" href="css/font-awesome/font-awesome.min.css">
    <style>
        /* 强制表格行高为最小值 - 最高优先级 */
        table.file-table tr, table.file-table td {
            min-height: 35px !important;
            height: auto !important;
            line-height: 1.4 !important;
            padding-top: 8px !important;
            padding-bottom: 8px !important;
            box-sizing: border-box !important;
        }
    </style>
    <!-- 加载皮肤CSS -->
    <?php echo getSkinHTMLHead(); ?>
    
    <!-- 基础重置样式，确保布局不受皮肤影响 -->
    <style>
        /* 基础布局重置 */
        * {
            box-sizing: border-box;
        }
        
        body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }
        
        .container {
            width: calc(100% - 80px);
            margin: 0 auto;
            padding: 20px;
            flex: 1;
        }
        
        /* 确保表格布局不受皮肤影响 */
        table {
            width: 100%;
            border-collapse: collapse;
            overflow: hidden;
        }
        
        /* 表格列宽设置 - 最高优先级 */
        table.file-table,
        body table.file-table,
        div.file-list-container table.file-table {
            table-layout: fixed !important;
            width: 100% !important;
        }
        
        /* 操作列 - 固定宽度 */
        table.file-table th:nth-child(1),
        body table.file-table th:nth-child(1),
        div.file-list-container table.file-table th:nth-child(1),
        table.file-table td:nth-child(1),
        body table.file-table td:nth-child(1),
        div.file-list-container table.file-table td:nth-child(1) {
            width: 100px !important;
            min-width: 100px !important;
            max-width: 100px !important;
        }
        
        /* 文件名列 - 自适应宽度 */
        table.file-table th:nth-child(2),
        body table.file-table th:nth-child(2),
        div.file-list-container table.file-table th:nth-child(2),
        table.file-table td:nth-child(2),
        body table.file-table td:nth-child(2),
        div.file-list-container table.file-table td:nth-child(2) {
            width: auto !important;
            min-width: 200px !important;
        }
        
        /* 下载次数列 - 固定宽度 */
        table.file-table th:nth-child(3),
        body table.file-table th:nth-child(3),
        div.file-list-container table.file-table th:nth-child(3),
        table.file-table td:nth-child(3),
        body table.file-table td:nth-child(3),
        div.file-list-container table.file-table td:nth-child(3) {
            width: 130px !important;
            min-width: 130px !important;
            max-width: 130px !important;
            text-align: center !important;
        }
        
        /* 大小列 - 固定宽度 */
        table.file-table th:nth-child(4),
        body table.file-table th:nth-child(4),
        div.file-list-container table.file-table th:nth-child(4),
        table.file-table td:nth-child(4),
        body table.file-table td:nth-child(4),
        div.file-list-container table.file-table td:nth-child(4) {
            width: 140px !important;
            min-width: 140px !important;
            max-width: 140px !important;
            text-align: center !important;
        }
        
        /* 修改日期列 - 固定宽度 */
        table.file-table th:nth-child(5),
        body table.file-table th:nth-child(5),
        div.file-list-container table.file-table th:nth-child(5),
        table.file-table td:nth-child(5),
        body table.file-table td:nth-child(5),
        div.file-list-container table.file-table td:nth-child(5) {
            width: 260px !important;
            min-width: 260px !important;
            max-width: 260px !important;
            text-align: center !important;
        }
        
        /* 备注列 - 获取剩余空间 */
        table.file-table th:nth-child(6),
        body table.file-table th:nth-child(6),
        div.file-list-container table.file-table th:nth-child(6),
        table.file-table td:nth-child(6),
        body table.file-table td:nth-child(6),
        div.file-list-container table.file-table td:nth-child(6) {
            width: auto !important;
            min-width: 150px !important;
        }
        
        .file-actions {
            text-align: center !important;
            width: 100px !important;
            min-width: 100px !important;
            max-width: 100px !important;
        }
        
        /* 表格行高设置 - 最小值优先级 */
table.file-table tbody tr,
body table.file-table tbody tr,
div.file-list-container table.file-table tbody tr,
.skin-warcraft3 table.file-table tbody tr,
[class*="skin-"] table.file-table tbody tr,
html body table.file-table tbody tr {
    min-height: 35px !important;
    height: auto !important;
    line-height: 1.4 !important;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
    box-sizing: border-box !important;
}

table.file-table tbody td,
body table.file-table tbody td,
div.file-list-container table.file-table tbody td,
.skin-warcraft3 table.file-table tbody td,
[class*="skin-"] table.file-table tbody td,
html body table.file-table tbody td {
    min-height: 35px !important;
    height: auto !important;
    line-height: 1.4 !important;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
    box-sizing: border-box !important;
}
        
        /* 分类标签样式 */
        .category-tabs {
            text-align: center;
            margin: 20px 0;
        }
        
        .category-tab i {
            margin-right: 5px;
        }
        
        th, td {
            padding: 12px;
            text-align: left;
            vertical-align: top;
            word-break: break-word;
        }
        
        th {
            white-space: nowrap;
        }
        
        th i {
            margin-right: 5px;
        }
        
        /* 页脚基础布局 - 不设置具体样式，让皮肤控制 */
        footer {
            width: 100%;
            padding: 20px;
            margin-top: auto;
            text-align: center;
        }
        
        /* 登录后台按钮样式 - 防止文字换行 */
        .btn-primary {
            white-space: nowrap !important;
            min-width: 100px;
        }
        
        /* 管理员搜索容器样式 */
        .admin-search-container {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .admin-search-form {
            margin: 0;
        }
        
        .admin-search-input-group {
            display: flex;
            align-items: center;
        }
        
        .admin-search-input {
            padding: 8px 12px;
            border: 1px solid var(--color-border, #ccc);
            border-radius: 4px 0 0 4px;
            font-size: 14px;
            width: 200px;
            height: 40px;
            box-sizing: border-box;
        }
        
        .admin-search-button {
            padding: 8px 12px;
            background: var(--color-primary, #007bff);
            color: white;
            border: none;
            border-radius: 0 4px 4px 0;
            cursor: pointer;
            font-size: 14px;
            height: 40px;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .admin-search-button:hover {
            background: var(--color-primary-hover, #0056b3);
        }
        
        .search-highlight {
            background-color: var(--color-highlight, #ffeb3b);
            padding: 0 2px;
        }
        
        .search-error {
            color: var(--color-danger, #dc3545);
            background-color: var(--color-danger-bg, #f8d7da);
            border: 1px solid var(--color-danger-border, #f5c6cb);
            border-radius: 4px;
            padding: 10px;
            margin-top: 10px;
            display: flex;
            align-items: center;
        }
        
        .search-error i {
            margin-right: 8px;
        }
        
        .search-info {
            color: var(--color-info, #0c5460);
            background-color: var(--color-info-bg, #d1ecf1);
            border: 1px solid var(--color-info-border, #bee5eb);
            border-radius: 4px;
            padding: 10px;
            margin-top: 10px;
            display: flex;
            align-items: center;
        }
        
        .search-info i {
            margin-right: 8px;
        }
        
        /* 响应式设计基础样式 */
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            footer {
                padding: 15px 10px;
            }
        }
    </style>
    
    <!-- 皮肤切换JavaScript -->
    <?php echo getSkinSwitchJS(); ?>
    
    <!-- 文件搜索JavaScript -->
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const searchInput = document.querySelector('.admin-search-input');
            const searchForm = document.querySelector('.admin-search-form');
            const searchButton = document.querySelector('.admin-search-button');
            
            // 实时搜索功能 - 防抖处理
            let searchTimeout;
            searchInput.addEventListener('input', function() {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(function() {
                    // 如果输入为空，自动提交表单以清除搜索
                    if (searchInput.value.trim() === '') {
                        // 构建URL，保留其他参数但移除搜索参数
                        const urlParams = new URLSearchParams(window.location.search);
                        urlParams.delete('search');
                        window.location.href = '?' + urlParams.toString();
                    }
                }, 500);
            });
            
            // 表单提交前的验证
            searchForm.addEventListener('submit', function(e) {
                const searchTerm = searchInput.value.trim();
                
                // 如果搜索词为空，阻止提交
                if (!searchTerm) {
                    e.preventDefault();
                    showNotification('请输入搜索关键词', 'warning');
                    return false;
                }
                
                // 搜索词长度验证
                if (searchTerm.length < 2) {
                    e.preventDefault();
                    showNotification('搜索关键词至少需要2个字符', 'warning');
                    return false;
                }
                
                // 显示加载状态
                searchButton.disabled = true;
                searchButton.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
            });
            
            // 高亮搜索关键词
            function highlightSearchTerm() {
                const searchTerm = '<?php echo addslashes($searchKeyword); ?>';
                if (!searchTerm) return;
                
                const fileNames = document.querySelectorAll('.file-table td:nth-child(2)');
                fileNames.forEach(function(element) {
                    const text = element.textContent;
                    const regex = new RegExp(`(${searchTerm})`, 'gi');
                    if (text.match(regex)) {
                        element.innerHTML = element.innerHTML.replace(regex, '<span class="search-highlight">$1</span>');
                    }
                });
            }
            
            // 通知函数
            function showNotification(message, type = 'info') {
                // 创建通知元素
                const notification = document.createElement('div');
                notification.className = `search-notification search-${type}`;
                notification.style.position = 'fixed';
                notification.style.top = '20px';
                notification.style.right = '20px';
                notification.style.zIndex = '9999';
                notification.style.maxWidth = '300px';
                notification.style.padding = '15px';
                notification.style.borderRadius = '4px';
                notification.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                
                // 根据类型设置颜色
                if (type === 'warning') {
                    notification.style.backgroundColor = 'var(--color-warning-bg, #fff3cd)';
                    notification.style.color = 'var(--color-warning, #856404)';
                    notification.style.border = '1px solid var(--color-warning-border, #ffeaa7)';
                } else if (type === 'error') {
                    notification.style.backgroundColor = 'var(--color-danger-bg, #f8d7da)';
                    notification.style.color = 'var(--color-danger, #721c24)';
                    notification.style.border = '1px solid var(--color-danger-border, #f5c6cb)';
                } else {
                    notification.style.backgroundColor = 'var(--color-info-bg, #d1ecf1)';
                    notification.style.color = 'var(--color-info, #0c5460)';
                    notification.style.border = '1px solid var(--color-info-border, #bee5eb)';
                }
                
                // 添加图标和内容
                let icon = 'fa-info-circle';
                if (type === 'warning') icon = 'fa-exclamation-triangle';
                if (type === 'error') icon = 'fa-times-circle';
                
                notification.innerHTML = `
                    <div style="display: flex; align-items: center;">
                        <i class="fa ${icon}" style="margin-right: 10px;"></i>
                        <span>${message}</span>
                    </div>
                `;
                
                // 添加到页面
                document.body.appendChild(notification);
                
                // 自动移除
                setTimeout(function() {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 3000);
            }
            
            // 如果有搜索结果，执行高亮
            if ('<?php echo !empty($searchKeyword); ?>' === '1') {
                highlightSearchTerm();
            }
        });
    </script>
    
    <!-- 下载计数功能已整合到PHP处理 -->
</head>
<body class="<?php echo getSkinBodyClass(); ?>">
    <div class="cyberpunk-noise"></div>
    <div class="container">
        <header>
            <?php echo getCustomHeader(); ?>
        </header>
        
        <div class="file-stats" style="display: flex; justify-content: space-between; align-items: center;">
            <div class="stat-group" style="display: flex; gap: 30px;">
                <div class="stat-item">
                    总文件数: <span class="stat-number"><?php echo count($files); ?></span>
                </div>
                <div class="stat-item">
                    总分类数: <span class="stat-number"><?php echo count($categories); ?></span>
                </div>
                <div class="stat-item">
                    当前显示: <span class="stat-number"><?php echo count($filteredFiles); ?></span> 个文件
                </div>
            </div>
            <div class="admin-search-container">
                <form class="admin-search-form" method="get" action="">
                    <div class="admin-search-input-group">
                        <input type="text" name="search" class="admin-search-input" placeholder="搜索文件名..." value="<?php echo htmlspecialchars($searchKeyword); ?>">
                        <button type="submit" class="admin-search-button">
                            <i class="fa fa-search"></i>
                        </button>
                    </div>
                    <!-- 保留当前分类参数 -->
                    <?php if (!empty($selectedCategory)): ?>
                        <input type="hidden" name="category" value="<?php echo htmlspecialchars($selectedCategory); ?>">
                    <?php endif; ?>
                </form>
                <a href="admin/index.php" class="btn btn-primary" style="height: 40px; width: 100px; display: flex; align-items: center; justify-content: center; gap: 5px; margin-left: 10px;">
                    <i class="fa fa-sign-in"></i> 登录后台
                </a>
            </div>
        </div>
        
        <?php if (!empty($searchKeyword)): ?>
            <div class="search-results-info" style="margin-top: 10px; margin-bottom: 10px; font-size: 14px; color: var(--color-text-secondary, #666);">
                找到 <strong><?php echo count($searchResults); ?></strong> 个匹配 "<strong><?php echo htmlspecialchars($searchKeyword); ?></strong>" 的文件
                <a href="?" style="margin-left: 10px; color: var(--color-primary, #007bff); text-decoration: none;">
                    <i class="fa fa-times"></i> 清除搜索
                </a>
                
                <?php if (empty($searchResults)): ?>
                    <div class="search-error" style="margin-top: 5px;">
                        <i class="fa fa-exclamation-triangle"></i>
                        未找到匹配的文件。请尝试使用不同的关键词。
                    </div>
                <?php endif; ?>
            </div>
        <?php endif; ?>
        
        <div class="category-tabs">
            <?php foreach ($categories as $category): ?>
                <a href="?category=<?php echo urlencode($category); ?>">
                    <button class="category-tab <?php echo $selectedCategory === $category ? 'active' : ''; ?>">
                        <i class="fa <?php echo getCategoryIcon($category); ?>"></i>
                        <?php echo $category; ?>
                    </button>
                </a>
            <?php endforeach; ?>
        </div>
        
        <table class="file-table">
            <thead>
                <tr>
                    <th><i class="fa fa-cogs"></i> 操作</th>
                    <th><i class="fa fa-file"></i> 文件名</th>
                    <th><i class="fa fa-download"></i> 下载次数</th>
                    <th><i class="fa fa-hdd-o"></i> 大小</th>
                    <th><i class="fa fa-calendar"></i> 上传时间</th>
                    <th><i class="fa fa-comment-o"></i> 备注</th>
                </tr>
            </thead>
            <tbody>
                <?php if (!empty($filteredFiles)): ?>
                    <?php foreach ($filteredFiles as $file): ?>
                        <tr>
                            <td>
                                <?php if (!empty($file['md5'])): ?>
                                    <a href="?download=1&md5=<?php echo urlencode($file['md5']); ?>&file_path=<?php echo urlencode($file['path']); ?>" class="btn btn-primary" download style="display: inline-flex; align-items: center; justify-content: center; gap: 3px; height: 25px; width: 60px; min-width: 60px; max-width: 60px; padding: 0 5px; font-size: 14px; overflow: hidden; white-space: nowrap;">
                                        <i class="fa fa-download" style="font-size: 12px;"></i> 下载
                                    </a>
                                <?php else: ?>
                                    <a href="<?php echo $file['path']; ?>" class="btn btn-primary" download style="display: inline-flex; align-items: center; justify-content: center; gap: 3px; height: 25px; width: 60px; min-width: 60px; max-width: 60px; padding: 0 5px; font-size: 14px; overflow: hidden; white-space: nowrap;">
                                        <i class="fa fa-download" style="font-size: 12px;"></i> 下载
                                    </a>
                                <?php endif; ?>
                            </td>
                            <td>
                                <i class="fa <?php echo getFileIcon($file['name']); ?> file-icon"></i>
                                <?php echo $file['name']; ?>
                            </td>
                            <td><?php echo $file['download_count']; ?></td>
                            <td><?php echo formatFileSize($file['size']); ?></td>
                            <td><?php echo formatDate($file['date']); ?></td>
                            <td><?php echo htmlspecialchars($file['remark']); ?></td>
                        </tr>
                    <?php endforeach; ?>
                <?php else: ?>
                    <tr>
                        <td colspan="6" class="empty-message">
                            该分类下暂无文件
                        </td>
                    </tr>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
    <footer>
        <?php
        // 输出自定义页脚
        echo getCustomFooter();
        
        // 关闭数据库连接
        if ($db !== null) {
            $db->close();
        }
        ?>
    </footer>
</body>
</html>