<?php
/**
 * 文件访问控制脚本
 * 用于保护敏感文件不被直接访问
 */

// 设置响应头
header('Content-Type: application/json; charset=utf-8');

// 获取请求的文件路径
$requestUri = $_SERVER['REQUEST_URI'];
$parsedUrl = parse_url($requestUri);
$path = $parsedUrl['path'];

// 提取文件名
$fileName = basename($path);

// 定义禁止直接访问的文件模式
$forbiddenPatterns = [
    '/\.db$/i',           // 数据库文件
    '/\.ini$/i',          // 配置文件
    '/\.config$/i',       // 配置文件
    '/\.log$/i',          // 日志文件
    '/\.bak$/i',          // 备份文件
    '/\.backup$/i',       // 备份文件
    '/\.old$/i',          // 旧文件
    '/\.tmp$/i',          // 临时文件
    '/^db_config\.php$/i', // 数据库配置文件
    '/^security_utils\.php$/i', // 安全工具文件
    '/^file_security_checker\.php$/i', // 文件安全检查器
    '/^file_whitelist\.php$/i', // 文件白名单
    '/^check_server_env\.php$/i', // 服务器环境检查脚本
];

// 检查是否匹配禁止模式
$isForbidden = false;
foreach ($forbiddenPatterns as $pattern) {
    if (preg_match($pattern, $fileName)) {
        $isForbidden = true;
        break;
    }
}

// 如果是禁止访问的文件，返回403错误
if ($isForbidden) {
    http_response_code(403);
    echo json_encode([
        'error' => 'Access Denied',
        'message' => '您没有权限访问此文件',
        'file' => $fileName,
        'status' => 'forbidden'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 如果不是禁止访问的文件，返回404错误（假装文件不存在）
http_response_code(404);
echo json_encode([
    'error' => 'File Not Found',
    'message' => '请求的文件不存在',
    'file' => $fileName,
    'status' => 'not_found'
], JSON_UNESCAPED_UNICODE);
?>