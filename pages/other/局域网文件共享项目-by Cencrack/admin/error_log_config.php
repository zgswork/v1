<?php
/**
 * PHP错误日志配置文件
 * 用于设置自定义错误日志路径
 */

// 设置错误日志路径
$error_log_path = __DIR__ . '/logs/php_errors.log';

// 确保日志目录存在
$log_dir = dirname($error_log_path);
if (!is_dir($log_dir)) {
    mkdir($log_dir, 0777, true);
}

// 设置PHP错误日志配置
ini_set('log_errors', 1);
ini_set('error_log', $error_log_path);

// 设置错误报告级别
error_reporting(E_ALL);
ini_set('display_errors', 0); // 生产环境中不显示错误，只记录到日志

// 记录一条测试日志
error_log('错误日志系统初始化: ' . date('Y-m-d H:i:s'));
?>