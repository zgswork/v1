<?php
// 错误报告设置
error_reporting(E_ALL);
ini_set('display_errors', 0); // 不显示错误，避免JSON格式错误

// 设置错误日志
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/logs/php_errors.log');

// 设置响应头为JSON
header('Content-Type: application/json');

// 检查是否是AJAX请求
function isAjaxRequest() {
    return isset($_SERVER['HTTP_X_REQUESTED_WITH']) && 
           strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';
}

// 检查是否是有效的内部调用
function isValidInternalCall() {
    // 检查HTTP_REFERER
    if (isset($_SERVER['HTTP_REFERER'])) {
        $referer = parse_url($_SERVER['HTTP_REFERER']);
        $host = $_SERVER['HTTP_HOST'];
        
        // 如果来源是同一域名，允许访问
        if (isset($referer['host']) && $referer['host'] === $host) {
            return true;
        }
    }
    
    // 检查是否是AJAX请求
    if (isAjaxRequest()) {
        return true;
    }
    
    return false;
}

// 执行访问控制检查
if (!isValidInternalCall()) {
    // 设置响应头
    header('HTTP/1.0 403 Forbidden');
    
    // 返回错误信息
    echo json_encode([
        'error' => 'Access Denied',
        'message' => '您没有权限直接访问此文件',
        'status' => 'forbidden'
    ], JSON_UNESCAPED_UNICODE);
    
    // 终止脚本执行
    exit;
}

try {
    // 引入必要的文件
    require_once __DIR__ . '/error_log_config.php';
    require_once __DIR__ . '/db_config.php';
    
    // 初始化数据库连接
    $db = DatabaseConfig::getConnection('admin');
    if (!$db) {
        throw new Exception('无法连接到数据库');
    }
    
    // 启用异常处理
    $db->enableExceptions(true);
    
    // 确保表存在
    $db->exec("CREATE TABLE IF NOT EXISTS file_extension_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        extension_name TEXT NOT NULL UNIQUE,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
    
    // 获取禁止上传的文件扩展名
    $query = "SELECT extension_name FROM file_extension_settings WHERE is_active = 1 ORDER BY extension_name";
    $result = $db->query($query);
    
    $forbiddenExtensions = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $forbiddenExtensions[] = $row['extension_name'];
    }
    
    // 返回JSON格式的禁止扩展名列表
    echo json_encode($forbiddenExtensions);
    
} catch (Exception $e) {
    // 记录错误到日志
    error_log("获取禁止扩展名失败: " . $e->getMessage());
    
    // 返回错误信息
    echo json_encode(['error' => $e->getMessage()]);
}
?>