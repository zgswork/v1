<?php
/**
 * 认证检查文件
 * 用于验证用户是否已登录，并提供会话管理和权限控制功能
 */

// 定义常量，允许访问配置文件
define('IN_ADMIN_PANEL', true);

// 引入数据库配置
require_once __DIR__ . '/db_config.php';

// 配置会话安全参数
ini_set('session.cookie_httponly', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_samesite', 'Strict');

// 检查是否使用HTTPS
$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || $_SERVER['SERVER_PORT'] == 443;
if ($secure) {
    ini_set('session.cookie_secure', 1);
}

// 启动会话
session_start();

// 会话启动后立即重新生成ID，防止会话固定攻击
if (!isset($_SESSION['initiated'])) {
    session_regenerate_id(true);
    $_SESSION['initiated'] = true;
}

/**
 * 检查用户是否已登录
 * @return bool 是否已登录
 */
function isLoggedIn() {
    // 检查会话中是否有用户信息
    if (isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true) {
        // 检查会话是否超时
        if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity'] > 1800)) {
            // 会话超时，销毁会话
            logout();
            return false;
        }
        
        // 更新最后活动时间
        $_SESSION['last_activity'] = time();
        
        // 检查Cookie是否存在
        if (!isset($_COOKIE['admin_token'])) {
            logout();
            return false;
        }
        
        // 验证Cookie中的令牌
        if (!validateAdminToken($_COOKIE['admin_token'])) {
            logout();
            return false;
        }
        
        return true;
    }
    return false;
}

/**
 * 验证管理员令牌
 * @param string $token 令牌值
 * @return bool 令牌是否有效
 */
function validateAdminToken($token) {
    if (!isset($_SESSION['admin_token']) || empty($_SESSION['admin_token'])) {
        return false;
    }
    
    // 验证令牌是否匹配
    return hash_equals($_SESSION['admin_token'], $token);
}

/**
 * 登出函数
 */
function logout() {
    // 清除会话变量
    $_SESSION = array();
    
    // 清除Cookie
    if (isset($_COOKIE['admin_token'])) {
        setcookie('admin_token', '', time() - 3600, '/admin/', '', true, true); // Secure, HttpOnly
    }
    if (isset($_COOKIE['PHPSESSID'])) {
        setcookie('PHPSESSID', '', time() - 3600, '/', '', true, true); // Secure, HttpOnly
    }
    
    // 销毁会话
    session_destroy();
}

/**
 * 验证用户并创建会话
 * @param string $username 用户名
 * @param string $password 密码
 * @return array [success, message]
 */
function authenticateUser($username, $password) {
    try {
        // 使用配置文件获取数据库连接
        $db = DatabaseConfig::getConnection('admin');
        if (!$db) {
            return [false, '数据库连接失败'];
        }
        
        // 使用预处理语句防止SQL注入
        $stmt = $db->prepare("SELECT username, nickname, password_hash, role, login_count FROM administrators WHERE username = :username");
        $stmt->bindValue(':username', $username, SQLITE3_TEXT);
        $result = $stmt->execute();
        $user = $result->fetchArray(SQLITE3_ASSOC);
        
        // 关闭数据库连接
        $db->close();
        
        // 检查用户是否存在
        if (!$user) {
            return [false, '用户名或密码错误'];
        }
        
        // 验证密码
        if (!password_verify($password, $user['password_hash'])) {
            return [false, '用户名或密码错误'];
        }
        
        // 生成安全令牌
        $token = bin2hex(random_bytes(32));
        
        // 更新会话信息
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['admin_username'] = $user['username'];
        $_SESSION['admin_nickname'] = $user['nickname'];
        $_SESSION['admin_role'] = isset($user['role']) ? $user['role'] : 'admin'; // 获取用户角色
        $_SESSION['admin_token'] = $token;
        $_SESSION['last_activity'] = time();
        
        // 设置Cookie（30分钟有效期）
        $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || $_SERVER['SERVER_PORT'] == 443;
        $samesite = 'Lax';
        
        // 使用PHP 7.3兼容的方式设置Cookie
        setcookie(
            'admin_token', 
            $token, 
            [
                'expires' => time() + 1800,
                'path' => '/admin/',
                'domain' => '',
                'secure' => $secure,
                'httponly' => true,
                'samesite' => $samesite
            ]
        );
        
        // 更新最后登录时间和登录次数
        updateLoginInfo($user['username'], $user['login_count'] + 1);
        
        // 创建安装锁文件，表示系统已安装完成
        $lockFile = __DIR__ . '/installed.lock';
        if (!file_exists($lockFile)) {
            file_put_contents($lockFile, date('Y-m-d H:i:s'));
        }
        
        return [true, '登录成功'];
        
    } catch (Exception $e) {
        return [false, '登录过程中发生错误: ' . $e->getMessage()];
    }
}

/**
 * 更新登录信息
 * @param string $username 用户名
 * @param int $login_count 登录次数
 */
function updateLoginInfo($username, $login_count) {
    try {
        // 使用配置文件获取数据库连接
        $db = DatabaseConfig::getConnection('admin');
        if (!$db) {
            error_log('更新登录信息失败: 无法连接数据库');
            return;
        }
        
        // 使用预处理语句更新登录信息
        $stmt = $db->prepare("UPDATE administrators SET last_login = :last_login, login_count = :login_count WHERE username = :username");
        $stmt->bindValue(':last_login', date('Y-m-d H:i:s'), SQLITE3_TEXT);
        $stmt->bindValue(':login_count', $login_count, SQLITE3_INTEGER);
        $stmt->bindValue(':username', $username, SQLITE3_TEXT);
        $stmt->execute();
        
        // 关闭数据库连接
        $db->close();
        
    } catch (Exception $e) {
        // 记录错误但不影响登录流程
        error_log('更新登录信息失败: ' . $e->getMessage());
    }
}

/**
 * 更新用户密码
 * @param string $username 用户名
 * @param string $new_password 新密码
 * @return bool 是否更新成功
 */
function updatePassword($username, $new_password) {
    try {
        // 使用配置文件获取数据库连接
        $db = DatabaseConfig::getConnection('admin');
        if (!$db) {
            error_log('更新密码失败: 无法连接数据库');
            return false;
        }
        
        // 生成密码哈希
        $password_hash = password_hash($new_password, PASSWORD_ARGON2ID);
        
        // 使用预处理语句更新密码
        $stmt = $db->prepare("UPDATE administrators SET password_hash = :password_hash WHERE username = :username");
        $stmt->bindValue(':password_hash', $password_hash, SQLITE3_TEXT);
        $stmt->bindValue(':username', $username, SQLITE3_TEXT);
        $result = $stmt->execute();
        
        // 关闭数据库连接
        $db->close();
        
        return $result !== false;
        
    } catch (Exception $e) {
        // 记录错误
        error_log('更新密码失败: ' . $e->getMessage());
        return false;
    }
}

/**
 * 检查用户是否有权限访问指定页面
 * @param string $page_path 页面路径
 * @return bool 是否有权限
 */
function hasPagePermission($page_path) {
    // 如果不是管理员，检查权限
    if (isset($_SESSION['admin_role']) && $_SESSION['admin_role'] !== 'admin') {
        try {
            $db = DatabaseConfig::getConnection('admin');
            if (!$db) {
                return false;
            }
            $stmt = $db->prepare("SELECT can_access FROM page_permissions WHERE role = :role AND page_path = :page_path");
            $stmt->bindValue(':role', $_SESSION['admin_role'], SQLITE3_TEXT);
            $stmt->bindValue(':page_path', $page_path, SQLITE3_TEXT);
            $result = $stmt->execute();
            $row = $result->fetchArray(SQLITE3_ASSOC);
            $db->close();
            
            return $row && $row['can_access'] === 1;
        } catch (Exception $e) {
            return false;
        }
    }
    
    // 管理员角色默认拥有所有权限
    return true;
}

/**
 * 保护页面，如果未登录或没有权限则重定向
 * @param string $redirect_path 重定向路径，默认为login.php
 */
function protectPage($redirect_path = 'login.php') {
    // 首先检查是否已登录
    if (!isLoggedIn()) {
        // 保存当前页面，以便登录后重定向
        $_SESSION['redirect_url'] = $_SERVER['REQUEST_URI'];
        header('Location: ' . $redirect_path);
        exit;
    }
    
    // 然后检查页面权限
    $page_path = basename($_SERVER['PHP_SELF']);
    if (!hasPagePermission($page_path)) {
        // 如果是AJAX请求，返回403错误
        if (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') {
            header('HTTP/1.1 403 Forbidden');
            echo json_encode(['code' => 403, 'message' => '没有权限访问此页面']);
            exit;
        }
        
        // 非AJAX请求重定向到首页
        $_SESSION['error_message'] = '没有权限访问此页面';
        header('Location: index.php');
        exit;
    }
}

/**
 * 获取当前登录用户的角色
 * @return string 用户角色
 */
function getCurrentUserRole() {
    return isset($_SESSION['admin_role']) ? $_SESSION['admin_role'] : 'unknown';
}

/**
 * 获取当前登录用户信息
 * @return array 用户信息
 */
function getCurrentUser() {
    return [
        'username' => isset($_SESSION['admin_username']) ? $_SESSION['admin_username'] : '',
        'nickname' => isset($_SESSION['admin_nickname']) ? $_SESSION['admin_nickname'] : '',
        'role' => isset($_SESSION['admin_role']) ? $_SESSION['admin_role'] : 'unknown',
        'skin' => 'default' // 默认皮肤，可以从数据库或配置中获取
    ];
}

/**
 * 检查当前用户是否是管理员
 * @return bool 是否是管理员
 */
function isAdmin() {
    return getCurrentUserRole() === 'admin';
}
