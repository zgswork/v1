<?php
// 文件数据处理程序 - 专门用于处理AJAX数据请求

// 设置错误报告
error_reporting(E_ALL);
ini_set('display_errors', 0); // 生产环境关闭显示错误

// 强制设置Content-Type为JSON
header('Content-Type: application/json');

// 定义常量，允许访问配置文件
define('IN_ADMIN_PANEL', true);

// 引入数据库配置
require_once __DIR__ . '/db_config.php';

// 初始化响应
$response = [
    'status' => 'error',
    'message' => '未知错误',
    'files' => [],
    'total' => 0,
    'page' => 1,
    'pages' => 0,
    'categories' => []
];

try {
    // 验证必要参数
    if (!isset($_GET['table'])) {
        throw new Exception('缺少必要参数: table');
    }
    
    $table = $_GET['table'];
    // 验证表名，防止SQL注入
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
        throw new Exception('无效的表名');
    }
    
    // 获取分页和搜索参数
    $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $limit = 20; // 每页记录数
    $offset = ($page - 1) * $limit;
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $category = isset($_GET['category']) ? trim($_GET['category']) : '';
    
    // 连接数据库
    $db = DatabaseConfig::getConnection('admin');
    if (!$db) {
        throw new Exception('数据库连接失败');
    }
    
    // 构建WHERE子句
    $where_clause = '';
    $conditions = [];
    
    if (!empty($search)) {
        $conditions[] = "file_name LIKE '%" . $db->escapeString($search) . "%'";
    }
    
    if (!empty($category)) {
        // 匹配两种路径格式: "工具/文件名" 或 "分享文件/工具/文件名"
        $conditions[] = "(file_path LIKE '" . $db->escapeString($category) . "/%' OR file_path LIKE '分享文件/" . $db->escapeString($category) . "/%')";
    }
    
    if (!empty($conditions)) {
        $where_clause = 'WHERE ' . implode(' AND ', $conditions);
    }
    
    // 获取文件列表
    $query = "SELECT file_md5, file_name, file_size, file_path, file_remark, upload_time FROM $table $where_clause ORDER BY upload_time DESC LIMIT $limit OFFSET $offset";
    $result = $db->query($query);
    
    if (!$result) {
        throw new Exception('查询执行失败: ' . $db->lastErrorMsg());
    }
    
    $files = [];
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
                $row['category'] = $path_parts[1];
            } else {
                // 格式为"分类/文件名"，取第一个部分作为分类
                $row['category'] = $path_parts[0];
            }
        } else {
            // 只有一个部分，表示没有分类信息
            $row['category'] = '未分类';
        }
        $files[] = $row;
    }
    
    // 获取总记录数
    $count_query = "SELECT COUNT(*) as total FROM $table $where_clause";
    $count_result = $db->query($count_query);
    
    if (!$count_result) {
        throw new Exception('计数查询失败: ' . $db->lastErrorMsg());
    }
    
    $total_row = $count_result->fetchArray(SQLITE3_ASSOC);
    $total = isset($total_row['total']) ? $total_row['total'] : 0;
    
    // 获取所有分类 - 从分享文件目录获取
    $categories = [];
    $shared_files_dir = __DIR__ . '/../分享文件';
    
    if (is_dir($shared_files_dir)) {
        $dirs = scandir($shared_files_dir);
        foreach ($dirs as $dir) {
            if ($dir !== '.' && $dir !== '..' && is_dir($shared_files_dir . '/' . $dir)) {
                $categories[] = $dir;
            }
        }
    }
    
    // 准备成功响应
    $response = [
        'status' => 'success',
        'message' => '数据加载成功',
        'files' => $files,
        'total' => $total,
        'page' => $page,
        'pages' => ceil($total / $limit),
        'categories' => $categories
    ];
    
} catch (Exception $e) {
    // 记录错误但不泄露技术细节
    error_log('文件数据处理错误: ' . $e->getMessage());
    $response['message'] = $e->getMessage();
}

// 确保只输出JSON，没有其他内容
ob_clean();
echo json_encode($response);
exit;
