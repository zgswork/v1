<?php
/**
 * 管理员登出页面
 * 处理用户登出并清除会话信息
 */

// 包含认证函数
require_once 'auth.php';

// 执行登出操作
logout();

// 重定向到登录页面
header('Location: login.php');
exit;
