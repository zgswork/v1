<?php
/**
 * JSON响应处理函数
 * 用于统一处理AJAX请求的JSON响应，避免输出污染
 */

// 确保没有直接访问此文件
if (!defined('IN_ADMIN_PANEL')) {
    exit('Direct access to this file is not allowed.');
}

// 处理测试请求
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    switch ($_POST['action']) {
        case 'test_basic':
            jsonSuccess('基本响应测试成功');
            break;
            
        case 'test_data':
            jsonSuccess('带数据响应测试成功', [
                'user' => 'test_user',
                'timestamp' => date('Y-m-d H:i:s'),
                'random' => rand(1, 100)
            ]);
            break;
            
        case 'test_error':
            jsonError('这是一个测试错误消息');
            break;
    }
}

/**
 * 发送JSON响应并终止脚本
 * @param bool $success 操作是否成功
 * @param string $message 响应消息
 * @param mixed $data 可选的附加数据
 * @param array $debug 可选的调试信息
 */
function jsonResponse($success, $message, $data = null, $debug = []) {
    // 清除所有输出缓冲区
    while (ob_get_level() > 0) {
        $content = ob_get_contents();
        if ($content !== false && strlen($content) > 0) {
            // 记录缓冲区内容到调试日志
            error_log("JSON Response Debug: Cleared buffer content: " . substr($content, 0, 200));
        }
        ob_end_clean();
    }
    
    // 设置响应头
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');
    
    // 构建响应数据
    $response = [
        'success' => $success,
        'message' => $message,
        'timestamp' => time()
    ];
    
    // 添加数据（如果有）
    if ($data !== null) {
        $response['data'] = $data;
    }
    
    // 添加调试信息（如果有且在调试模式下）
    if (!empty($debug) && defined('DEBUG_MODE') && DEBUG_MODE) {
        $response['debug'] = $debug;
    }
    
    // 输出JSON并终止
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * 发送成功响应
 * @param string $message 成功消息
 * @param mixed $data 可选的附加数据
 */
function jsonSuccess($message, $data = null) {
    jsonResponse(true, $message, $data);
}

/**
 * 发送错误响应
 * @param string $message 错误消息
 * @param mixed $data 可选的附加数据
 */
function jsonError($message, $data = null) {
    jsonResponse(false, $message, $data);
}

/**
 * 验证是否为AJAX请求
 * @return bool
 */
function isAjaxRequest() {
    return isset($_SERVER['HTTP_X_REQUESTED_WITH']) && 
           strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';
}

/**
 * 安全地获取POST数据
 * @param string $key 键名
 * @param mixed $default 默认值
 * @param callable $filter 可选的过滤函数
 * @return mixed
 */
function getPostData($key, $default = null, $filter = null) {
    $value = isset($_POST[$key]) ? $_POST[$key] : $default;
    
    if ($filter !== null && is_callable($filter)) {
        return $filter($value);
    }
    
    return $value;
}

/**
 * 验证必填字段
 * @param array $fields 必填字段数组
 * @return array 返回[是否有效, 错误消息]
 */
function validateRequiredFields($fields) {
    foreach ($fields as $field) {
        if (!isset($_POST[$field]) || empty(trim($_POST[$field]))) {
            return [false, "字段 '{$field}' 是必填的"];
        }
    }
    return [true, ''];
}
?>