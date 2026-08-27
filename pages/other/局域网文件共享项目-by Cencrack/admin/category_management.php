<?php
/**
 * 分类管理页面
 * 功能：管理文件分类，支持分类的增删改查和排序
 */

// 引入统一皮肤加载器
include_once __DIR__ . '/../skin_loader.php';
// 引入UI配置加载器
include_once __DIR__ . '/../ui_config_loader.php';

// 引入认证控制
require_once 'auth.php';

// 保护页面，确保只有登录用户才能访问
protectPage();

// 引入数据库配置
require_once __DIR__ . '/db_config.php';

// 获取皮肤数据
$skinData = loadSelectedSkin();

// 获取当前页面路径，用于菜单高亮
$current_page = basename($_SERVER['PHP_SELF']);

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

// 定义分享文件目录路径
$shareFolderPath = __DIR__ . '/../分享文件';

// 处理AJAX请求
if (isset($_GET['action'])) {
    $action = $_GET['action'];
    
    // 设置响应头为JSON
    header('Content-Type: application/json');
    
    try {
        // 获取数据库连接
        $db = DatabaseConfig::getConnection('admin');
        if (!$db) {
            throw new Exception('数据库连接失败');
        }
        
        switch ($action) {
            case 'getCategories':
                // 获取所有分类
                $categories = [];
                $folders = scandir($shareFolderPath);
                
                foreach ($folders as $folder) {
                    if ($folder === '.' || $folder === '..') {
                        continue;
                    }
                    
                    $folderPath = $shareFolderPath . '/' . $folder;
                    if (is_dir($folderPath)) {
                        // 统计文件夹中的文件数量
                        $fileCount = 0;
                        $files = scandir($folderPath);
                        foreach ($files as $file) {
                            if ($file === '.' || $file === '..') {
                                continue;
                            }
                            if (is_file($folderPath . '/' . $file)) {
                                $fileCount++;
                            }
                        }
                        
                        $categories[] = [
                            'name' => $folder,
                            'fileCount' => $fileCount,
                            'path' => $folderPath
                        ];
                    }
                }
                
                // 获取分类排序信息
                $sortOrder = [];
                try {
                    $result = $db->query("SELECT category_name, sort_order FROM category_sort ORDER BY sort_order");
                    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                        $sortOrder[$row['category_name']] = $row['sort_order'];
                    }
                } catch (Exception $e) {
                    // 表可能不存在，创建表
                    $db->exec("CREATE TABLE IF NOT EXISTS category_sort (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        category_name TEXT NOT NULL UNIQUE,
                        sort_order INTEGER NOT NULL DEFAULT 0
                    )");
                }
                
                // 自动添加新分类到category_sort表
                $newCategories = [];
                foreach ($categories as $category) {
                    if (!isset($sortOrder[$category['name']])) {
                        $newCategories[] = $category['name'];
                    }
                }
                
                // 如果有新分类，添加到数据库
                if (!empty($newCategories)) {
                    // 获取当前最大排序值
                    $maxSortOrder = 0;
                    $result = $db->query("SELECT MAX(sort_order) as max_order FROM category_sort");
                    if ($result) {
                        $row = $result->fetchArray(SQLITE3_ASSOC);
                        $maxSortOrder = $row['max_order'] ?? 0;
                    }
                    
                    // 添加新分类到排序表
                    $stmt = $db->prepare("INSERT INTO category_sort (category_name, sort_order) VALUES (:name, :order)");
                    foreach ($newCategories as $index => $categoryName) {
                        $stmt->bindValue(':name', $categoryName, SQLITE3_TEXT);
                        $stmt->bindValue(':order', $maxSortOrder + $index + 1, SQLITE3_INTEGER);
                        $stmt->execute();
                        
                        // 更新排序数组
                        $sortOrder[$categoryName] = $maxSortOrder + $index + 1;
                    }
                }
                
                // 应用排序
                usort($categories, function($a, $b) use ($sortOrder) {
                    $orderA = isset($sortOrder[$a['name']]) ? $sortOrder[$a['name']] : 999;
                    $orderB = isset($sortOrder[$b['name']]) ? $sortOrder[$b['name']] : 999;
                    return $orderA - $orderB;
                });
                
                echo json_encode([
                    'code' => 200,
                    'data' => $categories
                ]);
                break;
                
            case 'renameCategory':
                // 重命名分类
                $oldName = $_POST['oldName'] ?? '';
                $newName = $_POST['newName'] ?? '';
                
                if (empty($oldName) || empty($newName)) {
                    throw new Exception('分类名称不能为空');
                }
                
                // 检查新名称是否已存在
                $newPath = $shareFolderPath . '/' . $newName;
                if (is_dir($newPath)) {
                    throw new Exception('分类名称已存在');
                }
                
                // 重命名文件夹
                $oldPath = $shareFolderPath . '/' . $oldName;
                if (!rename($oldPath, $newPath)) {
                    throw new Exception('重命名文件夹失败');
                }
                
                // 更新数据库中的分类排序信息
                $stmt = $db->prepare("UPDATE category_sort SET category_name = :newName WHERE category_name = :oldName");
                $stmt->bindValue(':newName', $newName, SQLITE3_TEXT);
                $stmt->bindValue(':oldName', $oldName, SQLITE3_TEXT);
                $stmt->execute();
                
                // 更新数据库中文件的分类信息
                $stmt = $db->prepare("UPDATE shared_files SET file_path = REPLACE(file_path, :oldPath, :newPath) WHERE file_path LIKE :oldPattern");
                $oldPathPattern = '%/' . $oldName . '/%';
                $newPathPattern = '%/' . $newName . '/%';
                $stmt->bindValue(':oldPath', $oldPath, SQLITE3_TEXT);
                $stmt->bindValue(':newPath', $newPath, SQLITE3_TEXT);
                $stmt->bindValue(':oldPattern', $oldPathPattern, SQLITE3_TEXT);
                $stmt->execute();
                
                echo json_encode([
                    'code' => 200,
                    'message' => '分类重命名成功'
                ]);
                break;
                
            case 'deleteCategory':
                // 删除分类
                $categoryName = $_POST['categoryName'] ?? '';
                
                if (empty($categoryName)) {
                    throw new Exception('分类名称不能为空');
                }
                
                // 检查文件夹中是否还有文件
                $categoryPath = $shareFolderPath . '/' . $categoryName;
                if (is_dir($categoryPath)) {
                    $files = scandir($categoryPath);
                    $fileCount = 0;
                    foreach ($files as $file) {
                        if ($file === '.' || $file === '..') {
                            continue;
                        }
                        if (is_file($categoryPath . '/' . $file)) {
                            $fileCount++;
                        }
                    }
                    
                    if ($fileCount > 0) {
                        echo json_encode([
                            'code' => 400,
                            'message' => '请清理所有文件才能删除'
                        ]);
                        break;
                    }
                    
                    // 删除空文件夹
                    if (!rmdir($categoryPath)) {
                        throw new Exception('删除文件夹失败');
                    }
                }
                
                // 从数据库中删除分类排序信息
                $stmt = $db->prepare("DELETE FROM category_sort WHERE category_name = :categoryName");
                $stmt->bindValue(':categoryName', $categoryName, SQLITE3_TEXT);
                $stmt->execute();
                
                echo json_encode([
                    'code' => 200,
                    'message' => '分类删除成功'
                ]);
                break;
                
            case 'updateSortOrder':
                // 更新分类排序
                $categories = $_POST['categories'] ?? [];
                
                if (empty($categories)) {
                    throw new Exception('排序数据不能为空');
                }
                
                // 开始事务
                $db->exec('BEGIN TRANSACTION');
                
                try {
                    // 清除现有排序
                    $db->exec("DELETE FROM category_sort");
                    
                    // 插入新的排序
                    $stmt = $db->prepare("INSERT INTO category_sort (category_name, sort_order) VALUES (:name, :order)");
                    foreach ($categories as $index => $category) {
                        $stmt->bindValue(':name', $category, SQLITE3_TEXT);
                        $stmt->bindValue(':order', $index + 1, SQLITE3_INTEGER);
                        $stmt->execute();
                    }
                    
                    // 提交事务
                    $db->exec('COMMIT');
                    
                    echo json_encode([
                        'code' => 200,
                        'message' => '排序更新成功'
                    ]);
                } catch (Exception $e) {
                    // 回滚事务
                    $db->exec('ROLLBACK');
                    throw $e;
                }
                break;
                
            case 'addCategory':
                // 添加新分类
                $categoryName = $_POST['categoryName'] ?? '';
                
                if (empty($categoryName)) {
                    throw new Exception('分类名称不能为空');
                }
                
                // 检查分类名称是否已存在
                $newPath = $shareFolderPath . '/' . $categoryName;
                if (is_dir($newPath)) {
                    throw new Exception('分类名称已存在');
                }
                
                // 创建新分类文件夹
                if (!mkdir($newPath, 0755, true)) {
                    throw new Exception('创建分类文件夹失败');
                }
                
                // 获取当前最大排序值
                $maxSortOrder = 0;
                $result = $db->query("SELECT MAX(sort_order) as max_order FROM category_sort");
                if ($result) {
                    $row = $result->fetchArray(SQLITE3_ASSOC);
                    $maxSortOrder = $row['max_order'] ?? 0;
                }
                
                // 添加到分类排序表
                $stmt = $db->prepare("INSERT INTO category_sort (category_name, sort_order) VALUES (:name, :order)");
                $stmt->bindValue(':name', $categoryName, SQLITE3_TEXT);
                $stmt->bindValue(':order', $maxSortOrder + 1, SQLITE3_INTEGER);
                $stmt->execute();
                
                echo json_encode([
                    'code' => 200,
                    'message' => '分类添加成功'
                ]);
                break;
                
            default:
                throw new Exception('未知操作');
        }
    } catch (Exception $e) {
        echo json_encode([
            'code' => 500,
            'message' => $e->getMessage()
        ]);
    }
    exit;
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>分类管理 - 文件分享系统</title>
    
    <!-- 加载皮肤CSS -->
    <?php echo getSkinHTMLHead($currentSkin); ?>
    
    <!-- Font Awesome图标库 -->
    <link rel="stylesheet" href="../css/font-awesome/font-awesome.min.css">
    
    <!-- jQuery UI CSS -->
    <link rel="stylesheet" href="https://code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css">
    
    <style>
        /* 全局样式重置和优化 */
        body {
            margin: 0;
            padding: 0;
            font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
            background: var(--color-bg-primary, #f5f7fa);
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 15px;
        }
        
        /* 分类容器优化 - 更紧凑的设计 */
        .category-container {
            background: var(--color-bg-card, var(--color-bg-secondary, #fff));
            border-radius: var(--color-radius-lg, 12px);
            box-shadow: var(--color-shadow, 0 2px 8px rgba(0,0,0,0.08));
            overflow: hidden;
        }
        
        .category-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            background: var(--color-bg-tertiary, #f8f9fa);
            border-bottom: 1px solid var(--color-border, #eee);
        }
        
        .category-header h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 600;
            color: var(--color-text-primary, #333);
            display: flex;
            align-items: center;
        }
        
        .category-header h1 i {
            margin-right: 8px;
            color: var(--color-primary, #4a6cf7);
        }
        
        /* 分类列表优化 - 卡片式网格布局 */
        .category-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 15px;
            padding: 20px;
            list-style: none;
            margin: 0;
        }
        
        .category-item {
            display: flex;
            flex-direction: column;
            padding: 15px;
            background: var(--color-bg-card, var(--color-bg-secondary, #fff));
            border-radius: var(--color-radius-md, 8px);
            border: 1px solid var(--color-border, #eee);
            cursor: move;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
        }
        
        .category-item::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: var(--color-primary, #4a6cf7);
            transform: scaleY(0);
            transition: transform 0.2s ease;
        }
        
        .category-item:hover {
            box-shadow: var(--color-shadow, 0 4px 12px rgba(0,0,0,0.1));
            transform: translateY(-2px);
            border-color: var(--color-primary, #4a6cf7);
        }
        
        .category-item:hover::before {
            transform: scaleY(1);
        }
        
        .category-item.ui-sortable-helper {
            opacity: 0.8;
            transform: scale(1.02) rotate(2deg);
            box-shadow: var(--color-shadow, 0 8px 16px rgba(0,0,0,0.15));
        }
        
        .ui-sortable-placeholder {
            background: var(--color-bg-tertiary, #f8f9fa);
            border: 2px dashed var(--color-border, #ddd);
            border-radius: var(--color-radius-md, 8px);
            margin: 15px;
        }
        
        /* 分类信息布局优化 */
        .category-top {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .category-icon {
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--color-bg-tertiary, rgba(74, 108, 247, 0.1));
            border-radius: var(--color-radius-md, 8px);
            margin-right: 12px;
        }
        
        .category-icon i {
            font-size: 18px;
            color: var(--color-primary, #4a6cf7);
        }
        
        .category-info {
            flex-grow: 1;
        }
        
        .category-name {
            font-weight: 600;
            font-size: 16px;
            margin: 0 0 2px 0;
            color: var(--color-text-primary, #333);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .category-stats {
            color: var(--color-text-secondary, #666);
            font-size: 13px;
            display: flex;
            align-items: center;
        }
        
        .category-stats i {
            margin-right: 5px;
            font-size: 12px;
        }
        
        /* 操作按钮优化 */
        .category-actions {
            display: flex;
            gap: 8px;
            opacity: 0.7;
            transition: opacity 0.2s ease;
            margin-top: 10px;
        }
        
        .category-item:hover .category-actions {
            opacity: 1;
        }
        
        .btn {
            padding: 6px 12px;
            border: none;
            border-radius: var(--color-radius-sm, 4px);
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: var(--color-bg-tertiary, #f8f9fa);
            color: var(--color-text-primary, #333);
        }
        
        .btn i {
            margin-right: 5px;
            font-size: 12px;
        }
        
        .btn-primary {
            background: var(--color-bg-btn-primary, var(--color-primary, #4a6cf7));
            color: var(--color-text-btn-primary, white);
        }
        
        .btn-danger {
            background: var(--color-bg-btn-danger, var(--color-danger, #f56565));
            color: var(--color-text-btn-danger, white);
        }
        
        .btn-danger:hover {
            background-color: var(--color-bg-btn-danger-hover, #e53e3e);
        }
        
        .btn:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }
        
        /* 模态框优化 */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: var(--color-shadow-dark, rgba(0,0,0,0.5));
            z-index: 1000;
            animation: fadeIn 0.2s ease;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .modal-content {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--color-bg-card, var(--color-bg-secondary, #fff));
            border-radius: var(--color-radius-lg, 12px);
            padding: 0;
            width: 450px;
            max-width: 95%;
            box-shadow: var(--color-shadow, 0 10px 25px rgba(0,0,0,0.15));
            overflow: hidden;
            animation: slideUp 0.3s ease;
        }
        
        @keyframes slideUp {
            from { 
                opacity: 0;
                transform: translate(-50%, -40%);
            }
            to { 
                opacity: 1;
                transform: translate(-50%, -50%);
            }
        }
        
        .modal-header {
            padding: 15px 20px;
            background: var(--color-bg-tertiary, #f8f9fa);
            border-bottom: 1px solid var(--color-border, #eee);
        }
        
        .modal-header h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: var(--color-text-primary, #333);
        }
        
        .modal-body {
            padding: 20px;
            overflow: hidden;
            background: var(--color-bg-card, var(--color-bg-secondary, #fff));
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        .form-label {
            display: block;
            margin-bottom: 6px;
            font-weight: 500;
            font-size: 14px;
            color: var(--color-text-primary, #333);
        }
        
        .form-control {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--color-border-input, var(--color-border, #ddd));
            border-radius: var(--color-radius-md, 6px);
            font-size: 14px;
            transition: border-color 0.2s ease;
            box-sizing: border-box;
            background: var(--color-bg-input, var(--color-bg-tertiary, #fff));
            color: var(--color-text-input, var(--color-text-primary, #333));
        }
        
        .form-control::placeholder {
            color: var(--text-muted, #999);
        }
        
        .form-control:focus {
            outline: none;
            border-color: var(--color-border-input-focus, var(--color-secondary, #4a6cf7));
            box-shadow: 0 0 0 2px var(--color-shadow-input-focus, rgba(74, 108, 247, 0.2));
        }
        
        .modal-footer {
            padding: 15px 20px;
            background: var(--color-bg-tertiary, #f8f9fa);
            border-top: 1px solid var(--color-border, #eee);
            text-align: right;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        
        /* 加载状态优化 */
        .loading {
            text-align: center;
            padding: 40px 20px;
            color: var(--color-text-muted, #666);
            background: var(--color-bg-card, var(--color-bg-secondary, #fff));
        }
        
        .loading i {
            font-size: 24px;
            margin-bottom: 10px;
            display: block;
            color: var(--color-primary, #4a6cf7);
        }
        
        /* 通知提示优化 */
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: var(--border-radius, 8px);
            color: white;
            font-weight: 500;
            z-index: 2000;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s ease;
            box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.15));
            display: flex;
            align-items: center;
        }
        
        .notification.show {
            opacity: 1;
            transform: translateY(0);
        }
        
        .notification.success {
            background: var(--color-bg-alert-success, var(--color-success, #48bb78));
        }
        
        .notification.error {
            background: var(--color-bg-alert-danger, var(--color-danger, #f56565));
        }
        
        /* 空状态优化 */
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: var(--color-text-muted, #666);
            background: var(--color-bg-card, var(--color-bg-secondary, #fff));
        }
        
        .empty-state i {
            font-size: 48px;
            margin-bottom: 15px;
            color: var(--color-text-muted, #ccc);
        }
        
        .empty-state p {
            margin: 0;
            font-size: 16px;
        }
        
        /* 响应式优化 */
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .category-list {
                grid-template-columns: 1fr;
                padding: 15px;
            }
            
            .category-header {
                padding: 12px 15px;
                flex-direction: column;
                align-items: flex-start;
            }
            
            .category-header h1 {
                font-size: 18px;
                margin-bottom: 10px;
            }
            
            .modal-content {
                width: 95%;
                max-width: 95%;
            }
            
            .modal-body {
                padding: 15px;
            }
        }
    </style>
    <!-- 皮肤切换JavaScript -->
    <?php echo getSkinSwitchJS(); ?>
</head>
<body <?php echo getSkinBodyClass($currentSkin); ?> data-theme="<?php echo $currentSkin; ?>">
    <div class="container">
        <div class="category-container">
            <div class="category-header">
                <h1><i class="fa fa-folder"></i> 分类管理</h1>
                <div>
                    <button id="addCategoryBtn" class="btn btn-primary">
                        <i class="fa fa-plus"></i> 添加分类
                    </button>
                    <button id="refreshBtn" class="btn btn-primary">
                        <i class="fa fa-refresh"></i> 刷新
                    </button>
                </div>
            </div>
            
            <div id="categoryContent">
                <div class="loading">
                    <i class="fa fa-spinner fa-spin"></i> 正在加载分类...
                </div>
            </div>
        </div>
    </div>
    
    <!-- 添加分类模态框 -->
    <div id="addCategoryModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>添加新分类</h3>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">分类名称</label>
                    <input type="text" id="newCategoryNameInput" class="form-control" placeholder="请输入分类名称">
                </div>
            </div>
            <div class="modal-footer">
                <button id="cancelAddCategory" class="btn">取消</button>
                <button id="confirmAddCategory" class="btn btn-primary">添加</button>
            </div>
        </div>
    </div>
    
    <!-- 重命名分类模态框 -->
    <div id="renameModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>重命名分类</h3>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">新名称</label>
                    <input type="text" id="newCategoryName" class="form-control" placeholder="请输入新的分类名称">
                </div>
            </div>
            <div class="modal-footer">
                <button id="cancelRename" class="btn">取消</button>
                <button id="confirmRename" class="btn btn-primary">确定</button>
            </div>
        </div>
    </div>
    
    <!-- 删除确认模态框 -->
    <div id="deleteModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>删除确认</h3>
            </div>
            <div class="modal-body">
                <p>确定要删除分类 "<span id="deleteCategoryName"></span>" 吗？</p>
                <p id="deleteWarning" style="color: var(--danger-color, #dc3545); display: none;">
                    <i class="fa fa-exclamation-triangle"></i> 请清理所有文件才能删除
                </p>
            </div>
            <div class="modal-footer">
                <button id="cancelDelete" class="btn">取消</button>
                <button id="confirmDelete" class="btn btn-danger">删除</button>
            </div>
        </div>
    </div>
    
    <!-- 通知提示 -->
    <div id="notification" class="notification"></div>
    
    <!-- jQuery -->
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <!-- jQuery UI -->
    <script src="https://code.jquery.com/ui/1.12.1/jquery-ui.min.js"></script>
    
    <script>
        $(document).ready(function() {
            // 当前操作的分类名称
            let currentCategoryName = '';
            
            // 显示通知
            function showNotification(message, type) {
                const notification = $('#notification');
                notification.text(message);
                notification.removeClass('success error').addClass(type);
                notification.addClass('show');
                
                setTimeout(function() {
                    notification.removeClass('show');
                }, 3000);
            }
            
            // 加载分类列表
            function loadCategories() {
                $('#categoryContent').html('<div class="loading"><i class="fa fa-spinner fa-spin"></i> 正在加载分类...</div>');
                
                $.ajax({
                    url: '?action=getCategories',
                    method: 'GET',
                    dataType: 'json',
                    success: function(response) {
                        if (response.code === 200) {
                            renderCategories(response.data);
                        } else {
                            $('#categoryContent').html('<div class="empty-state"><i class="fa fa-exclamation-triangle"></i><p>加载分类失败: ' + response.message + '</p></div>');
                        }
                    },
                    error: function() {
                        $('#categoryContent').html('<div class="empty-state"><i class="fa fa-exclamation-triangle"></i><p>加载分类失败，请检查网络连接</p></div>');
                    }
                });
            }
            
            // 渲染分类列表
            function renderCategories(categories) {
                if (categories.length === 0) {
                    $('#categoryContent').html('<div class="empty-state"><i class="fa fa-folder-open"></i><p>暂无分类</p></div>');
                    return;
                }
                
                let html = '<ul class="category-list" id="sortableCategories">';
                
                categories.forEach(function(category) {
                    const icon = getCategoryIcon(category.name);
                    html += `
                        <li class="category-item" data-name="${category.name}">
                            <div class="category-top">
                                <div class="category-icon">
                                    <i class="fa ${icon}"></i>
                                </div>
                                <div class="category-info">
                                    <div class="category-name">${category.name}</div>
                                    <div class="category-stats">
                                        <i class="fa fa-file"></i> ${category.fileCount} 个文件
                                    </div>
                                </div>
                            </div>
                            <div class="category-actions">
                                <button class="btn btn-primary rename-btn" data-name="${category.name}">
                                    <i class="fa fa-edit"></i> 重命名
                                </button>
                                <button class="btn btn-danger delete-btn" data-name="${category.name}" data-count="${category.fileCount}">
                                    <i class="fa fa-trash"></i> 删除
                                </button>
                            </div>
                        </li>
                    `;
                });
                
                html += '</ul>';
                $('#categoryContent').html(html);
                
                // 初始化拖拽排序
                $('#sortableCategories').sortable({
                    placeholder: 'ui-sortable-placeholder',
                    helper: 'clone',
                    update: function(event, ui) {
                        const categories = [];
                        $('#sortableCategories .category-item').each(function() {
                            categories.push($(this).data('name'));
                        });
                        
                        $.ajax({
                            url: '?action=updateSortOrder',
                            method: 'POST',
                            data: { categories: categories },
                            dataType: 'json',
                            success: function(response) {
                                if (response.code === 200) {
                                    showNotification('分类排序已更新', 'success');
                                } else {
                                    showNotification('排序更新失败: ' + response.message, 'error');
                                    // 重新加载以恢复原始顺序
                                    loadCategories();
                                }
                            },
                            error: function() {
                                showNotification('排序更新失败，请检查网络连接', 'error');
                                // 重新加载以恢复原始顺序
                                loadCategories();
                            }
                        });
                    }
                });
                
                // 绑定重命名按钮事件
                $('.rename-btn').click(function() {
                    currentCategoryName = $(this).data('name');
                    $('#newCategoryName').val(currentCategoryName);
                    $('#renameModal').show();
                });
                
                // 绑定删除按钮事件
                $('.delete-btn').click(function() {
                    currentCategoryName = $(this).data('name');
                    const fileCount = $(this).data('count');
                    
                    $('#deleteCategoryName').text(currentCategoryName);
                    
                    if (fileCount > 0) {
                        $('#deleteWarning').show();
                        $('#confirmDelete').prop('disabled', true);
                    } else {
                        $('#deleteWarning').hide();
                        $('#confirmDelete').prop('disabled', false);
                    }
                    
                    $('#deleteModal').show();
                });
            }
            
            // 获取分类图标
            function getCategoryIcon(categoryName) {
                const categoryIcons = {
                    '工具': 'fa-wrench',
                    '资料': 'fa-book',
                    '软件': 'fa-desktop',
                    '默认分类': 'fa-folder-o',
                    '文档': 'fa-file-text-o',
                    '图片': 'fa-image',
                    '视频': 'fa-video-camera',
                    '音频': 'fa-headphones',
                    '游戏': 'fa-gamepad',
                    '其他': 'fa-ellipsis-h'
                };
                
                // 先尝试精确匹配
                if (categoryIcons[categoryName]) {
                    return categoryIcons[categoryName];
                }
                
                // 如果没有精确匹配，尝试模糊匹配
                for (const key in categoryIcons) {
                    if (categoryName.indexOf(key) !== -1) {
                        return categoryIcons[key];
                    }
                }
                
                // 默认返回文件夹图标
                return 'fa-folder-o';
            }
            
            // 重命名分类
            $('#confirmRename').click(function() {
                const newName = $('#newCategoryName').val().trim();
                
                if (!newName) {
                    showNotification('分类名称不能为空', 'error');
                    return;
                }
                
                if (newName === currentCategoryName) {
                    $('#renameModal').hide();
                    return;
                }
                
                // 获取新名称对应的图标
                const newIcon = getCategoryIcon(newName);
                
                $.ajax({
                    url: '?action=renameCategory',
                    method: 'POST',
                    data: {
                        oldName: currentCategoryName,
                        newName: newName
                    },
                    dataType: 'json',
                    success: function(response) {
                        $('#renameModal').hide();
                        if (response.code === 200) {
                            showNotification(`分类重命名成功，已自动匹配图标: ${newIcon}`, 'success');
                            loadCategories();
                        } else {
                            showNotification('重命名失败: ' + response.message, 'error');
                        }
                    },
                    error: function() {
                        $('#renameModal').hide();
                        showNotification('重命名失败，请检查网络连接', 'error');
                    }
                });
            });
            
            // 删除分类
            $('#confirmDelete').click(function() {
                $.ajax({
                    url: '?action=deleteCategory',
                    method: 'POST',
                    data: {
                        categoryName: currentCategoryName
                    },
                    dataType: 'json',
                    success: function(response) {
                        $('#deleteModal').hide();
                        if (response.code === 200) {
                            showNotification('分类删除成功', 'success');
                            loadCategories();
                        } else {
                            showNotification('删除失败: ' + response.message, 'error');
                        }
                    },
                    error: function() {
                        $('#deleteModal').hide();
                        showNotification('删除失败，请检查网络连接', 'error');
                    }
                });
            });
            
            // 关闭模态框
            $('#cancelRename').click(function() {
                $('#renameModal').hide();
            });
            
            $('#cancelDelete').click(function() {
                $('#deleteModal').hide();
            });
            
            // 点击模态框外部关闭
            $('.modal').click(function(e) {
                if (e.target === this) {
                    $(this).hide();
                }
            });
            
            // 刷新按钮
            $('#refreshBtn').click(function() {
                loadCategories();
            });
            
            // 添加分类按钮
            $('#addCategoryBtn').click(function() {
                $('#newCategoryNameInput').val('');
                $('#addCategoryModal').show();
            });
            
            // 确认添加分类
            $('#confirmAddCategory').click(function() {
                const categoryName = $('#newCategoryNameInput').val().trim();
                
                if (!categoryName) {
                    showNotification('分类名称不能为空', 'error');
                    return;
                }
                
                $.ajax({
                    url: '?action=addCategory',
                    method: 'POST',
                    data: {
                        categoryName: categoryName
                    },
                    dataType: 'json',
                    success: function(response) {
                        $('#addCategoryModal').hide();
                        if (response.code === 200) {
                            showNotification('分类添加成功', 'success');
                            loadCategories();
                        } else {
                            showNotification('添加失败: ' + response.message, 'error');
                        }
                    },
                    error: function() {
                        $('#addCategoryModal').hide();
                        showNotification('添加失败，请检查网络连接', 'error');
                    }
                });
            });
            
            // 取消添加分类
            $('#cancelAddCategory').click(function() {
                $('#addCategoryModal').hide();
            });
            
            // 初始加载分类
            loadCategories();
        });
    </script>
</body>
</html>