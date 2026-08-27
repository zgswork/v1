<?php
/**
 * 访问控制检查
 * 用于保护敏感文件不被直接访问
 */

// 检查是否是直接访问
function isDirectAccess() {
    // 获取调用栈
    $backtrace = debug_backtrace();
    
    // 如果调用栈只有一个元素，说明是直接访问
    if (count($backtrace) <= 1) {
        return true;
    }
    
    // 检查调用者
    $caller = $backtrace[1];
    
    // 如果调用者文件名与当前文件名相同，说明是直接访问
    if (isset($caller['file']) && basename($caller['file']) === basename(__FILE__)) {
        return true;
    }
    
    return false;
}

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
    
    // 检查特定的POST参数
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['internal_call'])) {
        return true;
    }
    
    return false;
}

// 执行访问控制检查
function performAccessCheck() {
    // 如果是直接访问且不是有效的内部调用，拒绝访问
    if (isDirectAccess() && !isValidInternalCall()) {
        // 设置响应头
        header('HTTP/1.0 403 Forbidden');
        header('Content-Type: application/json; charset=utf-8');
        
        // 返回错误信息
        echo json_encode([
            'error' => 'Access Denied',
            'message' => '您没有权限直接访问此文件',
            'file' => basename(__FILE__),
            'status' => 'forbidden'
        ], JSON_UNESCAPED_UNICODE);
        
        // 终止脚本执行
        exit;
    }
}

// 自动执行访问控制检查
performAccessCheck();
?>