<?php
/**
 * 用户管理页面
 * 实现用户的添加、修改、删除和权限管理功能
 */

// 定义常量，允许访问JSON处理文件
define('IN_ADMIN_PANEL', true);

// 引入JSON响应处理文件
require_once __DIR__ . '/json_handler.php';

// 引入皮肤加载器
require_once dirname(__DIR__) . '/skin_loader.php';

// 引入数据库配置文件
require_once __DIR__ . '/db_config.php';

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

// 处理AJAX权限更新请求 - 优先处理以避免不必要的资源加载
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    // 检查是否为AJAX请求
    $is_ajax = isAjaxRequest();
    
    // 处理测试请求
    if ($_POST['action'] === 'test_json') {
        jsonSuccess('用户管理JSON响应测试成功', [
            'module' => 'user_management',
            'timestamp' => date('Y-m-d H:i:s'),
            'json_handler' => 'loaded'
        ]);
        exit;
    }
    
    // 处理权限更新请求
    if ($_POST['action'] === 'update_permissions') {
        // 包含认证文件以验证会话
        require_once 'auth.php';
        
        // 检查是否已登录
        if (!isLoggedIn()) {
            jsonResponse(false, '未登录或会话已过期');
        }

        // 检查是否为管理员
        if (!isAdmin()) {
            jsonResponse(false, '没有权限执行此操作');
        }
        
        // 引入模块化的权限管理
        require_once 'modules/permission_manager.php';
        
        // 处理权限更新
        handleAjaxPermissionUpdate();
    }
    
    // 引入认证文件
    require_once 'auth.php';

    // 保护页面，确保只有登录用户可以访问
    protectPage();
    
    // 处理获取用户列表的AJAX请求
    if ($_POST['action'] === 'list_users') {
        $users = getAllUsers();
        jsonResponse(true, '获取用户列表成功', ['users' => $users]);
    }
    
    // 权限检查：只有管理员可以执行所有操作（添加、修改、删除用户）
    if (!isAdmin()) {
        if ($is_ajax) {
            jsonResponse(false, '没有权限执行此操作');
        }
        $error_message = '没有权限执行此操作';
    } else {
        // 添加用户
        if ($_POST['action'] === 'add_user') {
            $username = trim($_POST['username']);
            $nickname = trim($_POST['nickname']);
            $password = $_POST['password'];
            $role = $_POST['role'];
            
            // 验证输入
            if (empty($username) || empty($nickname) || empty($password)) {
                $error = '用户名、昵称和密码不能为空';
                if ($is_ajax) {
                    jsonResponse(false, $error);
                }
                $error_message = $error;
            } elseif (strlen($password) < 6) {
                $error = '密码长度至少为6位';
                if ($is_ajax) {
                    jsonResponse(false, $error);
                }
                $error_message = $error;
            } else {
                try {
                    $db = DatabaseConfig::getConnection('admin');
                    
                    // 检查用户名是否已存在
                    $stmt = $db->prepare("SELECT COUNT(*) as count FROM administrators WHERE username = :username");
                    $stmt->bindValue(':username', $username, SQLITE3_TEXT);
                    $result = $stmt->execute();
                    $row = $result->fetchArray(SQLITE3_ASSOC);
                    
                    if ($row['count'] > 0) {
                        $error = '用户名已存在';
                        if ($is_ajax) {
                            jsonResponse(false, $error);
                        }
                        $error_message = $error;
                    } else {
                        // 哈希密码
                        $password_hash = password_hash($password, PASSWORD_DEFAULT);
                        
                        // 插入新用户
                        $stmt = $db->prepare("INSERT INTO administrators (username, nickname, password_hash, role, created_at) VALUES (:username, :nickname, :password_hash, :role, :created_at)");
                        $stmt->bindValue(':username', $username, SQLITE3_TEXT);
                        $stmt->bindValue(':nickname', $nickname, SQLITE3_TEXT);
                        $stmt->bindValue(':password_hash', $password_hash, SQLITE3_TEXT);
                        $stmt->bindValue(':role', $role, SQLITE3_TEXT);
                        $stmt->bindValue(':created_at', date('Y-m-d H:i:s'), SQLITE3_TEXT);
                        
                        if ($stmt->execute()) {
                            if ($is_ajax) {
                                jsonResponse(true, '用户添加成功');
                            }
                            $success_message = '用户添加成功';
                        } else {
                            $error = '用户添加失败';
                            if ($is_ajax) {
                                jsonResponse(false, $error);
                            }
                            $error_message = $error;
                        }
                    }
                    
                    $db->close();
                } catch (Exception $e) {
                    $error = '添加用户时发生错误: ' . $e->getMessage();
                    if ($is_ajax) {
                        jsonResponse(false, $error);
                    }
                    $error_message = $error;
                }
            }
        }
        
        // 检查是否为AJAX请求，如果是，则设置一个标记
        $is_ajax = isAjaxRequest();
        
        // 修改用户信息
        if (isset($_POST['action']) && $_POST['action'] === 'update_user') {
            $username = $_POST['username'];
            $nickname = trim($_POST['nickname']);
            $role = $_POST['role'];
            $password = isset($_POST['password']) ? $_POST['password'] : '';
            
            // 基本验证
            if (empty($username) || empty($nickname)) {
                $error = '用户名和昵称不能为空';
                if ($is_ajax) {
                    jsonResponse(false, $error);
                }
                $error_message = $error;
                // 非AJAX情况下继续执行以显示错误消息
            } else {
                try {
                    $db = DatabaseConfig::getConnection('admin');
                    
                    // 检查是否提供了新密码
                    if (!empty($password)) {
                        if (strlen($password) < 6) {
                            $error = '密码长度至少为6位';
                            if ($is_ajax) {
                                jsonResponse(false, $error);
                            }
                            $error_message = $error;
                            // 非AJAX情况下继续执行以显示错误消息
                        } else {
                            // 根据PHP版本选择最安全的哈希算法
                            if (defined('PASSWORD_ARGON2ID') && function_exists('sodium_crypto_pwhash')) {
                                $password_hash = password_hash($password, PASSWORD_ARGON2ID);
                            } else {
                                $password_hash = password_hash($password, PASSWORD_DEFAULT);
                            }
                            
                            // 对于系统管理员(admin)只更新密码，不更新其他信息
                            if ($username === 'admin') {
                                $stmt = $db->prepare("UPDATE administrators SET password_hash = :password_hash WHERE username = :username");
                                $stmt->bindValue(':password_hash', $password_hash, SQLITE3_TEXT);
                                $stmt->bindValue(':username', $username, SQLITE3_TEXT);
                            } else {
                                // 非管理员用户可以更新所有信息
                                $stmt = $db->prepare("UPDATE administrators SET nickname = :nickname, password_hash = :password_hash, role = :role WHERE username = :username");
                                $stmt->bindValue(':nickname', $nickname, SQLITE3_TEXT);
                                $stmt->bindValue(':password_hash', $password_hash, SQLITE3_TEXT);
                                $stmt->bindValue(':role', $role, SQLITE3_TEXT);
                                $stmt->bindValue(':username', $username, SQLITE3_TEXT);
                            }
                        }
                    } else {
                        // 对于管理员(admin)用户，只更新昵称，不更新角色
                        if ($username === 'admin') {
                            $stmt = $db->prepare("UPDATE administrators SET nickname = :nickname WHERE username = :username");
                            $stmt->bindValue(':nickname', $nickname, SQLITE3_TEXT);
                            $stmt->bindValue(':username', $username, SQLITE3_TEXT);
                        } else {
                            // 非管理员用户可以更新所有信息
                            $stmt = $db->prepare("UPDATE administrators SET nickname = :nickname, role = :role WHERE username = :username");
                            $stmt->bindValue(':nickname', $nickname, SQLITE3_TEXT);
                            $stmt->bindValue(':role', $role, SQLITE3_TEXT);
                            $stmt->bindValue(':username', $username, SQLITE3_TEXT);
                        }
                    }
                    
                    // 确保stmt已设置（避免在错误情况下尝试执行未定义的stmt）
                    if (isset($stmt) && !isset($error_message)) {
                        if ($stmt->execute()) {
                            // 区分密码修改和普通信息更新的成功消息
                            $is_current_user = ($username === $_SESSION['admin_username']);
                            
                            if ($change_password) {
                                $message = '密码修改成功';
                                // 如果修改的是当前登录用户的密码，设置密码修改标记
                                if ($is_current_user) {
                                    $_SESSION['password_changed'] = true;
                                }
                                
                                // AJAX响应
                                if ($is_ajax) {
                                    jsonResponse(true, $message, [
                                        'passwordChanged' => true,
                                        'isCurrentUser' => $is_current_user
                                    ]);
                                }
                            } else {
                                $message = '用户信息更新成功';
                                
                                // AJAX响应
                                if ($is_ajax) {
                                    jsonResponse(true, $message);
                                }
                            }
                            
                            $success_message = $message;
                            // 如果修改的是当前登录用户，更新会话中的昵称和角色
                            if ($is_current_user) {
                                $_SESSION['admin_nickname'] = $nickname;
                                if (isset($role)) {
                                    $_SESSION['admin_role'] = $role;
                                }
                            }
                        } else {
                            if ($change_password) {
                                $error = '密码修改失败';
                            } else {
                                $error = '用户信息更新失败';
                            }
                            
                            if ($is_ajax) {
                                jsonResponse(false, $error);
                            }
                            
                            $error_message = $error;
                            // 非AJAX情况下继续执行以显示错误消息
                        }
                    } elseif (!isset($error_message)) {
                        $error = '用户信息更新失败';
                        if ($is_ajax) {
                            jsonResponse(false, $error);
                        }
                        $error_message = $error;
                        // 非AJAX情况下继续执行以显示错误消息
                    }
                    
                    $db->close();
                } catch (Exception $e) {
                    $error = '更新用户信息时发生错误: ' . $e->getMessage();
                    if ($is_ajax) {
                        jsonResponse(false, $error);
                    }
                    $error_message = $error;
                    // 非AJAX情况下继续执行以显示错误消息
                }
            }
        }
        
        // 删除用户
        if (isset($_POST['action']) && $_POST['action'] === 'delete_user') {
            $username = $_POST['username'];
            
            // 不允许删除admin用户
            if ($username === 'admin') {
                if ($is_ajax) {
                    jsonResponse(false, '系统内置管理员账户不可删除');
                }
                $error_message = '系统内置管理员账户不可删除';
            } else {
                try {
                    $db = DatabaseConfig::getConnection('admin');
                    
                    // 开始事务
                    $db->exec('BEGIN TRANSACTION');
                    
                    // 删除用户
                    $stmt = $db->prepare("DELETE FROM administrators WHERE username = :username");
                    $stmt->bindValue(':username', $username, SQLITE3_TEXT);
                    
                    if ($stmt->execute()) {
                        // 提交事务
                        $db->exec('COMMIT');
                        if ($is_ajax) {
                            jsonResponse(true, '用户删除成功');
                        }
                        $success_message = '用户删除成功';
                    } else {
                        // 回滚事务
                        $db->exec('ROLLBACK');
                        if ($is_ajax) {
                            jsonResponse(false, '用户删除失败');
                        }
                        $error_message = '用户删除失败';
                    }
                    
                    $db->close();
                } catch (Exception $e) {
                    if ($is_ajax) {
                        jsonResponse(false, '删除用户时发生错误: ' . $e->getMessage());
                    }
                    $error_message = '删除用户时发生错误: ' . $e->getMessage();
                }
            }
        }
    }
    
    // 如果是AJAX请求，应该已经通过jsonResponse()函数exit了，不应该执行到这里
    // 但为了安全起见，我们再检查一次
    if ($is_ajax) {
        exit();
    }
}

// 常规页面处理 - 只在非AJAX请求时执行

// 引入认证文件
require_once 'auth.php';

// 保护页面，确保只有登录用户可以访问
protectPage();

// 定义操作结果消息
$success_message = '';
$error_message = '';

/**
 * 获取所有用户列表
 * @return array 用户列表
 */
function getAllUsers() {
    $users = [];
    
    try {
        $db = DatabaseConfig::getConnection('admin');
        $result = $db->query("SELECT username, nickname, role, created_at, last_login, login_count FROM administrators ORDER BY role DESC, username");
        
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $users[] = $row;
        }
        
        $db->close();
    } catch (Exception $e) {
        error_log('获取用户列表失败: ' . $e->getMessage());
    }
    
    return $users;
}

/**
 * 获取所有页面权限设置
 * @return array 页面权限设置
 */
function getPagePermissions() {
    $permissions = [];
    
    try {
        $db = DatabaseConfig::getConnection('admin');
        $result = $db->query("SELECT role, page_path, can_access FROM page_permissions ORDER BY role, page_path");
        
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $role = $row['role'];
            $page_path = $row['page_path'];
            if (!isset($permissions[$role])) {
                $permissions[$role] = [];
            }
            $permissions[$role][$page_path] = $row['can_access'];
        }
        
        $db->close();
    } catch (Exception $e) {
        error_log('获取页面权限失败: ' . $e->getMessage());
    }
    
    return $permissions;
}

/**
 * 获取所有可访问的页面列表
 * @return array 页面列表
 */
function getAllPages() {
    $pages = [
        'index.php' => '管理后台首页',
        'system_info.php' => '服务器环境',
        'database_view.php' => '查看数据库',
        'user_management.php' => '用户管理',
        'category_management.php' => '分类管理',
        'file_management.php' => '文件管理',
        'file_upload.php' => '上传文件',
        'skin_management.php' => '皮肤管理',
        'ui_settings.php' => '界面设置'
    ];
    return $pages;
}

/**
 * 初始化默认权限配置
 * @return bool 是否初始化成功
 */
function initializeDefaultPermissions() {
    try {
        $db = DatabaseConfig::getConnection('admin');
        if (!$db) {
            throw new Exception('无法连接到数据库');
        }
        
        // 开启事务
        $db->exec('BEGIN TRANSACTION');
        
        try {
            // 获取所有页面
            $all_pages = getAllPages();
            
            // 管理员默认权限（所有页面都有权限）
            $admin_permissions = [];
            foreach ($all_pages as $page_path => $page_name) {
                $admin_permissions[$page_path] = 1;
            }
            
            // 普通用户默认权限（只能访问部分页面）
            $user_permissions = [
                'index.php' => 1,           // 管理后台首页
                'file_management.php' => 1,  // 文件管理
                'file_upload.php' => 1,     // 上传文件
                'ui_settings.php' => 1      // 界面设置
            ];
            // 其他页面默认无权限
            foreach ($all_pages as $page_path => $page_name) {
                if (!isset($user_permissions[$page_path])) {
                    $user_permissions[$page_path] = 0;
                }
            }
            
            // 删除现有权限配置
            $db->exec("DELETE FROM page_permissions");
            
            // 插入管理员权限
            $insert_stmt = $db->prepare("INSERT INTO page_permissions (role, page_path, can_access) VALUES (:role, :page_path, :can_access)");
            foreach ($admin_permissions as $page_path => $can_access) {
                $insert_stmt->bindValue(':role', 'admin', SQLITE3_TEXT);
                $insert_stmt->bindValue(':page_path', $page_path, SQLITE3_TEXT);
                $insert_stmt->bindValue(':can_access', $can_access, SQLITE3_INTEGER);
                $insert_stmt->execute();
                $insert_stmt->reset();
            }
            
            // 插入普通用户权限
            foreach ($user_permissions as $page_path => $can_access) {
                $insert_stmt->bindValue(':role', 'user', SQLITE3_TEXT);
                $insert_stmt->bindValue(':page_path', $page_path, SQLITE3_TEXT);
                $insert_stmt->bindValue(':can_access', $can_access, SQLITE3_INTEGER);
                $insert_stmt->execute();
                $insert_stmt->reset();
            }
            
            // 提交事务
            $db->exec('COMMIT');
            $db->close();
            
            return true;
            
        } catch (Exception $e) {
            // 回滚事务
            $db->exec('ROLLBACK');
            $db->close();
            throw $e;
        }
        
    } catch (Exception $e) {
        error_log('初始化默认权限失败: ' . $e->getMessage());
        return false;
    }
}

// 获取用户列表和页面权限
$users = getAllUsers();
$page_permissions = getPagePermissions();
$all_pages = getAllPages();

// 检查是否需要初始化权限
$needs_init = false;
if (empty($page_permissions)) {
    $needs_init = true;
}

// 处理初始化权限请求
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'init_permissions') {
    require_once 'auth.php';
    
    if (!isLoggedIn()) {
        $error_message = '未登录或会话已过期';
    } elseif (!isAdmin()) {
        $error_message = '没有权限执行此操作';
    } else {
        if (initializeDefaultPermissions()) {
            $success_message = '默认权限初始化成功';
            // 重新获取权限配置
            $page_permissions = getPagePermissions();
            $needs_init = false;
        } else {
            $error_message = '初始化权限失败';
        }
    }
}

// 页面标题
$page_title = '用户管理';

// HTML头部
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo $page_title; ?></title>
    <?php echo getSkinHTMLHead(); // 加载皮肤CSS和相关资源 ?>
    <style>
        /* 基础样式 - 使用CSS变量支持皮肤系统 */
        /* 移除默认变量定义，确保皮肤系统的变量能够正确覆盖 */
        /* 只保留必要的特定样式，不覆盖皮肤系统的核心变量 */
        
        body {
            font-family: Arial, sans-serif;
            background-color: var(--color-bg-primary);
            margin: 0;
            padding: 0;
            color: var(--color-text-primary);
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        /* 消息样式 */
        .message {
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 4px;
            border: 1px solid var(--color-border);
        }
        
        .message.success {
            background-color: var(--color-bg-secondary);
            color: var(--color-text-primary);
            border-color: var(--color-success);
        }
        
        .message.error {
            background-color: var(--color-bg-secondary);
            color: var(--color-text-primary);
            border-color: var(--color-danger);
        }
        
        /* 按钮样式 */
        .btn {
            padding: 8px 16px;
            border: 1px solid var(--color-border);
            border-radius: 4px;
            background-color: var(--color-bg-secondary);
            color: var(--color-text-primary);
            cursor: pointer;
            transition: all 0.3s;
            display: inline-block;
            min-width: auto;
            max-width: 120px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .btn:hover {
            background-color: var(--color-bg-elevated);
        }
        
        .btn-primary {
            background-color: var(--color-primary);
            color: white;
            border-color: var(--color-primary);
        }
        
        .btn-primary:hover {
            background-color: var(--color-primary-hover);
            border-color: var(--color-primary-hover);
        }
        
        .btn-warning {
            background-color: var(--color-warning);
            color: white;
            border-color: var(--color-warning);
        }
        
        .btn-warning:hover {
            background-color: var(--color-warning-hover);
            border-color: var(--color-warning-hover);
        }
        
        .btn-danger {
            background-color: var(--color-danger);
            color: white;
            border-color: var(--color-danger);
        }
        
        .btn-danger:hover {
            background-color: var(--color-danger-hover);
            border-color: var(--color-danger-hover);
        }
        
        /* 模态框样式 */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: var(--color-modal-overlay);
            z-index: 1000;
            overflow: auto;
        }
        
        .modal-content {
            background-color: var(--color-bg-tertiary);
            margin: 10% auto;
            padding: 20px;
            border: 1px solid var(--color-border);
            border-radius: var(--color-radius-lg);
            width: 90%;
            max-width: 500px;
            box-shadow: 0 4px 8px var(--color-shadow);
        }
        
        /* 表单样式 */
        .form-actions {
            margin-top: var(--color-spacing-lg);
            text-align: right;
        }
        
        .form-group {
            margin-bottom: var(--color-spacing-md);
        }
        
        .form-group label {
            display: block;
            margin-bottom: var(--color-spacing-xs);
            color: var(--color-text-secondary);
        }
        
        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            max-width: 100%;
            padding: 8px;
            border: 1px solid var(--color-border);
            border-radius: var(--color-radius-md);
            background-color: var(--color-bg-tertiary);
            color: var(--color-text-primary);
            transition: border-color var(--color-transition-normal) ease, background-color var(--color-transition-normal) ease;
            box-sizing: border-box;
        }
        
        .form-group input:focus, .form-group select:focus {
            outline: none;
            border-color: var(--color-secondary);
            box-shadow: 0 0 0 2px var(--color-shadow-light);
        }
        
        /* 表格样式 */
        .table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .table th,
        .table td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid var(--color-border);
        }
        
        .table td {
            background-color: var(--color-bg-secondary);
        }
        
        .table tr {
            background-color: var(--color-bg-secondary);
        }
        
        .table th {
            background-color: var(--color-bg-tertiary);
            color: var(--color-text-primary);
            font-weight: bold;
        }
        
        .table tr:hover {
            background-color: var(--color-bg-elevated);
        }
        
        /* 卡片样式 */
        .card {
            background-color: var(--color-bg-secondary);
            border-radius: var(--color-radius-md);
            border: 1px solid var(--color-border);
            box-shadow: 0 2px 4px var(--color-shadow);
            padding: 20px;
            margin-bottom: 20px;
            transition: box-shadow var(--color-transition-normal) ease;
        }
        
        .card:hover {
            box-shadow: 0 4px 8px var(--color-shadow);
        }
        
        .card-header {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
            color: var(--color-text-primary);
        }
        
        /* 权限设置样式 */
        .permission-group {
            margin-bottom: 15px;
        }
        
        .permission-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
            color: var(--color-text-primary);
        }
        
        .permission-group div {
            margin-left: 20px;
            background-color: var(--color-bg-tertiary);
            padding: 10px;
            border-radius: var(--color-radius-md);
            border: 1px solid var(--color-border);
        }
        
        .permission-group input[type="checkbox"] {
            margin-right: 8px;
            vertical-align: middle;
        }
        
        .permission-group input[type="checkbox"] + label {
            display: inline-block;
            margin-bottom: 0;
            font-weight: normal;
            color: var(--color-text-primary);
            vertical-align: middle;
        }
        
        /* 表单字段和表格单元格样式增强 */
        .form-group,
        .permission-group > div > div {
            transition: background-color 0.3s ease, box-shadow 0.3s ease;
        }
        
        /* 表格单元格和行悬停效果增强 */
        .table tr:hover td {
            background-color: var(--color-bg-elevated);
        }
        
        /* 响应式设计 */
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .modal-content {
                width: 95%;
                margin: 15% auto;
            }
            
            .table {
                display: block;
                overflow-x: auto;
            }
        }
    </style>
</head>
<body class="<?php echo getSkinBodyClass($currentSkin); // 应用皮肤对应的body类名 ?>" data-theme="<?php echo $currentSkin; ?>">
    <div class="container">
        <h1><?php echo $page_title; ?></h1>
        
        <!-- 当前登录用户信息 - 用于JavaScript逻辑 -->
        <script>
            // 存储当前登录用户信息，用于权限控制
            window.currentUser = <?php echo json_encode($_SESSION['admin_username'] ?? ''); ?>;
            
            // 检查密码是否被修改，如果是则提示用户并注销登录
            <?php if (isset($_SESSION['password_changed']) && $_SESSION['password_changed'] === true): ?>
                // 密码修改成功，显示提示并清除标记
                alert('密码修改成功，请重新登录以应用新密码。');
                // 清除会话中的密码修改标记
                <?php unset($_SESSION['password_changed']); ?>
                // 重定向到注销页面
                setTimeout(function() {
                    window.location.href = 'logout.php';
                }, 100);
            <?php endif; ?>
        </script>
        
        <!-- 消息显示 -->
        <?php if (!empty($success_message)): ?>
            <div class="message success"><?php echo $success_message; ?></div>
        <?php endif; ?>
        
        <?php if (!empty($error_message)): ?>
            <div class="message error"><?php echo $error_message; ?></div>
        <?php endif; ?>
        
        <!-- 用户列表 -->
        <div class="card">
            <div class="card-header">用户列表</div>
            <?php if (isAdmin()): ?>
                <div style="margin-bottom: 15px;">
                    <button class="btn btn-primary" onclick="showAddUserForm()">添加用户</button>
                    <button id="editUserBtn" class="btn btn-warning" onclick="handleEditUser()" disabled>编辑</button>
                    <button id="deleteUserBtn" class="btn btn-danger" onclick="handleDeleteUser()" disabled>删除</button>
                </div>
            <?php endif; ?>
            
            <table class="table">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="selectAllUsers" onclick="toggleSelectAll()"></th>
                        <th>用户名</th>
                        <th>昵称</th>
                        <th>角色</th>
                        <th>创建时间</th>
                        <th>最后登录</th>
                        <th>登录次数</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($users as $user): ?>
                        <tr>
                            <td>
                                <input type="radio" name="selectedUser" value="<?php echo $user['username']; ?>" 
                                    data-nickname="<?php echo htmlspecialchars($user['nickname']); ?>" 
                                    data-role="<?php echo htmlspecialchars($user['role']); ?>" 
                                    onclick="handleUserSelection(this)" 
                                    <?php echo ''; // 移除管理员账号的选择限制，允许编辑自己的账户 ?>>
                            </td>
                            <td><?php echo htmlspecialchars($user['username']); ?></td>
                            <td><?php echo htmlspecialchars($user['nickname']); ?></td>
                            <td><?php echo htmlspecialchars($user['role']); ?></td>
                            <td><?php echo htmlspecialchars($user['created_at']); ?></td>
                            <td><?php echo htmlspecialchars($user['last_login'] ?? '未登录'); ?></td>
                            <td><?php echo htmlspecialchars($user['login_count']); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        
        <!-- 权限管理部分 -->
        <?php if (isAdmin()): ?>
            <div class="card">
                <div class="card-header">权限管理</div>
                <?php if ($needs_init): ?>
                    <div style="margin-bottom: 15px; padding: 10px; background-color: var(--color-warning-bg); border: 1px solid var(--color-warning); border-radius: 4px;">
                        <p style="margin: 0 0 10px 0; color: var(--color-text-primary);">当前系统尚未初始化权限配置，点击下方按钮初始化默认权限配置。</p>
                        <form method="post" style="display: inline;">
                            <input type="hidden" name="action" value="init_permissions">
                            <button type="submit" class="btn btn-primary">初始化默认权限</button>
                        </form>
                    </div>
                <?php endif; ?>
                <div id="permissions-container">
                    <?php foreach (['admin', 'user'] as $role): ?>
                        <div class="permission-group">
                            <label><?php echo $role === 'admin' ? '管理员' : '普通用户'; ?> 权限</label>
                            <div>
                                <?php foreach ($all_pages as $page_path => $page_name): ?>
                                    <div>
                                        <input type="checkbox" id="perm-<?php echo $role; ?>-<?php echo $page_path; ?>" 
                                            <?php echo isset($page_permissions[$role][$page_path]) && $page_permissions[$role][$page_path] ? 'checked' : ''; ?>>
                                        <label for="perm-<?php echo $role; ?>-<?php echo $page_path; ?>"><?php echo $page_name; ?></label>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                    <div class="form-actions">
                        <button class="btn btn-primary" onclick="updatePermissions()">保存权限设置</button>
                    </div>
                </div>
            </div>
        <?php endif; ?>
    </div>
    
    <!-- 添加用户模态框 -->
    <div id="addUserModal" class="modal">
        <div class="modal-content">
            <h2>添加用户</h2>
            <form id="addUserForm" method="post">
                <input type="hidden" name="action" value="add_user">
                <div class="form-group">
                    <label for="new-username">用户名</label>
                    <input type="text" id="new-username" name="username" required>
                </div>
                <div class="form-group">
                    <label for="new-nickname">昵称</label>
                    <input type="text" id="new-nickname" name="nickname" required>
                </div>
                <div class="form-group">
                    <label for="new-password">密码</label>
                    <input type="password" id="new-password" name="password" required>
                </div>
                <div class="form-group">
                    <label for="new-confirm-password">确认密码</label>
                    <input type="password" id="new-confirm-password" name="confirm_password" required>
                </div>
                <div class="form-group">
                    <label for="new-role">角色</label>
                    <select id="new-role" name="role" required>
                        <option value="user">普通用户</option>
                        <option value="admin">管理员</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn" onclick="closeModal()">取消</button>
                    <button type="button" class="btn btn-primary" onclick="saveAddUser()">添加</button>
                </div>
            </form>
        </div>
    </div>
    
    <!-- 编辑用户模态框 -->
    <div id="editUserModal" class="modal">
        <div class="modal-content">
            <h2>编辑用户</h2>
            <form id="editUserForm" method="post">
                <input type="hidden" name="action" value="update_user">
                <input type="hidden" id="edit-username" name="username">
                <div class="form-group">
                    <label for="edit-nickname">昵称</label>
                    <input type="text" id="edit-nickname" name="nickname" required>
                </div>
                <div class="form-group">
                    <label for="edit-role">角色</label>
                    <select id="edit-role" name="role" required>
                        <option value="user">普通用户</option>
                        <option value="admin">管理员</option>
                    </select>
                </div>
                <div style="margin-bottom: 10px;">
                    <input type="checkbox" id="change-password" style="vertical-align: middle; margin-right: 5px;">
                    <label for="change-password" style="display: inline; font-weight: normal; vertical-align: middle;">修改密码</label>
                </div>
                <div class="form-group" id="password-fields" style="display: none;">
                    <label for="edit-password">新密码</label>
                    <input type="password" id="edit-password" name="password">
                </div>
                <div class="form-group" id="confirm-password-fields" style="display: none;">
                    <label for="edit-confirm-password">确认新密码</label>
                    <input type="password" id="edit-confirm-password" name="confirm_password">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn" onclick="closeModal()">取消</button>
                    <button type="button" class="btn btn-primary" onclick="saveUser()">保存</button>
                    <div id="edit-error-message" style="color: red; margin-top: 10px; display: none;"></div>
                </div>
            </form>
        </div>
    </div>
    
    <!-- 删除用户模态框 -->
    <div id="deleteUserModal" class="modal">
        <div class="modal-content">
            <h2>删除用户</h2>
            <p>确定要删除用户 <span id="delete-username-display"></span> 吗？此操作不可撤销。</p>
            <form id="deleteUserForm" method="post">
                <input type="hidden" name="action" value="delete_user">
                <input type="hidden" id="delete-username" name="username">
                <div class="form-actions">
                    <button type="button" class="btn" onclick="closeModal()">取消</button>
                    <button type="button" class="btn btn-danger" onclick="saveDeleteUser()">删除</button>
                </div>
            </form>
        </div>
    </div>
    
    <script>
        // 显示添加用户表单
        function showAddUserForm() {
            // 先关闭所有模态框
            closeModal();
            // 然后显示添加用户模态框
            document.getElementById('addUserModal').style.display = 'block';
        }
        
        // 保存添加用户的函数 - 使用AJAX提交
        function saveAddUser() {
            // 收集表单数据
            const form = document.getElementById('addUserForm');
            const formData = new FormData(form);
            
            // 验证密码
            const password = formData.get('password');
            const confirmPassword = formData.get('confirm_password');
            
            if (password !== confirmPassword) {
                alert('两次输入的密码不一致');
                return;
            }
            
            if (password.length < 6) {
                alert('密码长度至少为6位');
                return;
            }
            
            // 创建AJAX请求
            const xhr = new XMLHttpRequest();
            xhr.open('POST', window.location.href, true);
            
            // 设置AJAX请求头，确保后端能识别这是一个AJAX请求
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    try {
                        // 打印响应内容到控制台以便调试
                        console.log('服务器响应:', xhr.responseText);
                        
                        // 尝试解析JSON响应
                        const response = JSON.parse(xhr.responseText);
                        
                        if (response.success) {
                            alert(response.message || '用户添加成功');
                            closeModal();
                            // 刷新页面以显示新添加的数据
                            location.reload();
                        } else {
                            // 显示错误信息
                            alert(response.message || '添加失败，请重试');
                        }
                    } catch (e) {
                        // 处理响应格式错误
                        console.error('JSON解析错误:', e, '响应内容:', xhr.responseText);
                        alert('服务器返回格式错误，请重试');
                    }
                }
            };
            
            xhr.send(formData);
        }
        
        // 处理用户选择
        function handleUserSelection(radio) {
            updateButtonStates();
        }
        
        // 全选/取消全选
        function toggleSelectAll() {
            const selectAll = document.getElementById('selectAllUsers');
            const userRadios = document.querySelectorAll('input[name="selectedUser"]:not(:disabled)');
            
            // 如果是单选框组，全选功能改为选择第一个可用的用户
            if (userRadios.length > 0) {
                userRadios[0].checked = true;
                handleUserSelection(userRadios[0]);
            }
            
            // 重置全选框状态（因为我们使用单选模式）
            selectAll.checked = false;
        }
        
        // 更新按钮状态
        function updateButtonStates() {
            const selectedUser = getSelectedUser();
            const editBtn = document.getElementById('editUserBtn');
            const deleteBtn = document.getElementById('deleteUserBtn');
            
            if (selectedUser) {
                editBtn.disabled = false;
                // 管理员账户不可删除
                deleteBtn.disabled = selectedUser === 'admin';
            } else {
                editBtn.disabled = true;
                deleteBtn.disabled = true;
            }
        }
        
        // 页面加载完成后初始化按钮状态
        document.addEventListener('DOMContentLoaded', function() {
            updateButtonStates();
        });
        
        // 获取选中的用户
        function getSelectedUser() {
            const selectedRadio = document.querySelector('input[name="selectedUser"]:checked');
            return selectedRadio ? selectedRadio.value : null;
        }
        
        // 获取选中用户的详细信息
        function getSelectedUserInfo() {
            const selectedRadio = document.querySelector('input[name="selectedUser"]:checked');
            if (selectedRadio) {
                return {
                    username: selectedRadio.value,
                    nickname: selectedRadio.dataset.nickname,
                    role: selectedRadio.dataset.role
                };
            }
            return null;
        }
        
        // 处理编辑用户
        function handleEditUser() {
            const userInfo = getSelectedUserInfo();
            if (userInfo) {
                showEditUserForm(userInfo.username, userInfo.nickname, userInfo.role);
            }
        }
        
        // 处理删除用户
        function handleDeleteUser() {
            const userInfo = getSelectedUserInfo();
            if (userInfo) {
                showDeleteUserForm(userInfo.username);
            }
        }
        
        // 显示编辑用户表单
        function showEditUserForm(username, nickname, role) {
            // 先关闭所有模态框
            closeModal();
            
            document.getElementById('edit-username').value = username;
            document.getElementById('edit-nickname').value = nickname;
            document.getElementById('edit-role').value = role;
            document.getElementById('change-password').checked = false;
            document.getElementById('password-fields').style.display = 'none';
            document.getElementById('confirm-password-fields').style.display = 'none';
            
            // 如果编辑的是当前登录的管理员账户，禁用角色选择
            const editRoleSelect = document.getElementById('edit-role');
            if (username === 'admin' && window.currentUser && window.currentUser === 'admin') {
                editRoleSelect.disabled = true;
                editRoleSelect.title = '管理员账户不可修改自己的角色';
            } else {
                editRoleSelect.disabled = false;
                editRoleSelect.title = '';
            }
            
            document.getElementById('editUserModal').style.display = 'block';
        }
        
        // 显示删除用户表单
        function showDeleteUserForm(username) {
            // 先关闭所有模态框
            closeModal();
            
            document.getElementById('delete-username').value = username;
            document.getElementById('delete-username-display').textContent = username;
            document.getElementById('deleteUserModal').style.display = 'block';
        }
        
        // 保存删除用户的函数 - 使用AJAX提交
        function saveDeleteUser() {
            // 收集表单数据
            const form = document.getElementById('deleteUserForm');
            const formData = new FormData(form);
            
            // 创建AJAX请求
            const xhr = new XMLHttpRequest();
            xhr.open('POST', window.location.href, true);
            
            // 设置AJAX请求头，确保后端能识别这是一个AJAX请求
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    try {
                        // 打印响应内容到控制台以便调试
                        console.log('服务器响应:', xhr.responseText);
                        
                        // 尝试解析JSON响应
                        const response = JSON.parse(xhr.responseText);
                        
                        if (response.success) {
                            alert(response.message || '用户删除成功');
                            closeModal();
                            // 刷新页面以显示更新后的数据
                            location.reload();
                        } else {
                            // 显示错误信息
                            alert(response.message || '删除失败，请重试');
                        }
                    } catch (e) {
                        // 处理响应格式错误
                        console.error('JSON解析错误:', e, '响应内容:', xhr.responseText);
                        alert('服务器返回格式错误，请重试');
                    }
                }
            };
            
            xhr.send(formData);
        }
        
        // 关闭模态框
        function closeModal() {
            document.getElementById('addUserModal').style.display = 'none';
            document.getElementById('editUserModal').style.display = 'none';
            document.getElementById('deleteUserModal').style.display = 'none';
            // 如果存在权限管理模态框，也关闭它
            const permissionModal = document.getElementById('permissionModal');
            if (permissionModal) {
                permissionModal.style.display = 'none';
            }
        }
        
        // 修改密码选项变更处理
        document.getElementById('change-password').addEventListener('change', function() {
            if (this.checked) {
                document.getElementById('password-fields').style.display = 'block';
                document.getElementById('confirm-password-fields').style.display = 'block';
                document.getElementById('edit-password').required = true;
                document.getElementById('edit-confirm-password').required = true;
            } else {
                document.getElementById('password-fields').style.display = 'none';
                document.getElementById('confirm-password-fields').style.display = 'none';
                document.getElementById('edit-password').required = false;
                document.getElementById('edit-confirm-password').required = false;
            }
        });
        
        // 保存用户信息的函数 - 使用AJAX提交
        function saveUser() {
            // 隐藏之前的错误信息
            document.getElementById('edit-error-message').style.display = 'none';
            
            // 收集表单数据
            const form = document.getElementById('editUserForm');
            const formData = new FormData(form);
            
            // 创建AJAX请求
            const xhr = new XMLHttpRequest();
            xhr.open('POST', window.location.href, true);
            
            // 设置AJAX请求头，确保后端能识别这是一个AJAX请求
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    try {
                        // 打印响应内容到控制台以便调试
                        console.log('服务器响应:', xhr.responseText);
                        
                        // 尝试解析JSON响应
                        const response = JSON.parse(xhr.responseText);
                        
                        if (response.success) {
                            // 如果是密码修改成功且是当前用户
                            if (response.passwordChanged && response.isCurrentUser) {
                                alert('密码修改成功，请重新登录以应用新密码。');
                                window.location.href = 'logout.php';
                            } else {
                                // 普通信息更新成功
                                alert(response.message || '用户信息更新成功');
                                closeModal();
                                // 刷新页面以显示更新后的数据
                                location.reload();
                            }
                        } else {
                            // 显示错误信息，但不关闭窗口
                            const errorMessage = document.getElementById('edit-error-message');
                            errorMessage.textContent = response.message || '更新失败，请重试';
                            errorMessage.style.display = 'block';
                        }
                    } catch (e) {
                        // 处理响应格式错误
                        console.error('JSON解析错误:', e, '响应内容:', xhr.responseText);
                        const errorMessage = document.getElementById('edit-error-message');
                        errorMessage.textContent = '服务器返回格式错误，请重试';
                        errorMessage.style.display = 'block';
                    }
                }
            };
            
            xhr.send(formData);
        }
        
        // 更新权限设置
        function updatePermissions() {
            var permissions = {};
            
            // 收集所有权限设置
            ['admin', 'user'].forEach(function(role) {
                permissions[role] = {};
                
                // 收集每个角色对各页面的权限
                var pageCheckboxes = document.querySelectorAll('[id^="perm-' + role + '-"');
                pageCheckboxes.forEach(function(checkbox) {
                    var pagePath = checkbox.id.split('-').slice(2).join('-');
                    permissions[role][pagePath] = checkbox.checked ? 1 : 0;
                });
            });
            
            // 发送AJAX请求更新权限
            var xhr = new XMLHttpRequest();
            xhr.open('POST', window.location.href, true);
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    try {
                        var response = JSON.parse(xhr.responseText);
                        if (response.success) {
                            alert('权限设置更新成功');
                        } else {
                            alert('权限设置更新失败: ' + response.message);
                        }
                    } catch (e) {
                        alert('权限设置更新失败: 服务器返回格式错误');
                    }
                }
            };
            
            var data = 'action=update_permissions&permissions=' + encodeURIComponent(JSON.stringify(permissions));
            xhr.send(data);
        }
        
        // 移除点击模态框外部关闭的功能，确保用户只能通过按钮关闭模态框
        // 这样可以防止用户误触导致编辑内容丢失
        
        // 按下ESC键关闭模态框
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeModal();
            }
        });
        
        // 为编辑用户表单添加提交事件监听，用于调试
        document.getElementById('editUserForm').addEventListener('submit', function(e) {
            console.log('编辑用户表单正在提交...');
            // 不阻止默认提交行为，让表单正常提交
        });
        
        // 为添加用户表单添加提交事件监听，用于调试
        document.getElementById('addUserForm').addEventListener('submit', function(e) {
            console.log('添加用户表单正在提交...');
            // 不阻止默认提交行为，让表单正常提交
        });
        
        // 为删除用户表单添加提交事件监听，用于调试
        document.getElementById('deleteUserForm').addEventListener('submit', function(e) {
            console.log('删除用户表单正在提交...');
            // 不阻止默认提交行为，让表单正常提交
        });
        
        // 初始化时更新按钮状态
        document.addEventListener('DOMContentLoaded', function() {
            updateButtonStates();
        });
    </script>
    <?php echo getSkinSwitchJS(); // 添加皮肤切换的JavaScript代码 ?>
</body>
</html>