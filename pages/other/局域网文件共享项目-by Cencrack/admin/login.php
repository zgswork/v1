<?php
/**
 * 管理员登录页面
 * 提供管理员登录表单和登录验证功能
 */

// 包含认证函数
require_once 'auth.php';

// 包含皮肤加载器
require_once dirname(__DIR__) . '/skin_loader.php';

// 检查是否已登录，如果已登录则重定向到首页
if (isLoggedIn()) {
    header('Location: index.php');
    exit;
}

$error_message = '';

// 处理登录请求
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 验证CSRF令牌
    if (!isset($_POST['csrf_token']) || $_POST['csrf_token'] !== $_SESSION['csrf_token']) {
        $error_message = '安全验证失败，请重试';
    } else {
        // 获取并清理用户输入
        $username = trim($_POST['username'] ?? '');
        $password = trim($_POST['password'] ?? '');
        
        // 基本输入验证
        if (empty($username) || empty($password)) {
            $error_message = '请输入用户名和密码';
        } else {
            // 验证用户
            list($success, $message) = authenticateUser($username, $password);
            
            if ($success) {
                // 获取之前保存的重定向URL
                $redirect_url = $_SESSION['redirect_url'] ?? 'index.php';
                unset($_SESSION['redirect_url']); // 清除重定向URL
                
                // 重定向到目标页面
                header('Location: ' . $redirect_url);
                exit;
            } else {
                $error_message = $message;
            }
        }
    }
}

// 生成CSRF令牌
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// 生成唯一的nonce用于CSP
$nonce = bin2hex(random_bytes(16));

// 设置CSP头部以防止XSS攻击
header("Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'nonce-$nonce'; img-src 'self' data:;");
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>管理员登录 - 后台管理系统</title>
    <?php echo getSkinHTMLHead(); ?>
    <style>
        /* 登录页面样式 - 使用皮肤变量 */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: var(--color-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif);
            background: var(--color-bg-primary, linear-gradient(135deg, #667eea 0%, #764ba2 100%));
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .login-container {
            background: var(--color-bg-secondary, white);
            border: 1px solid var(--color-border, #e1e1e1);
            border-radius: var(--color-radius-lg, 10px);
            box-shadow: var(--color-shadow, 0 10px 30px rgba(0, 0, 0, 0.3));
            padding: 40px;
            width: 100%;
            max-width: 400px;
            transition: transform var(--color-transition-normal, 0.3s ease);
        }
        
        .login-container:hover {
            transform: translateY(-5px);
        }
        
        .login-header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .login-title {
            color: var(--color-text-heading, #333);
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 10px;
        }
        
        .login-subtitle {
            color: var(--color-text-secondary, #666);
            font-size: 14px;
        }
        
        .login-form {
            display: flex;
            flex-direction: column;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-label {
            display: block;
            margin-bottom: 8px;
            color: var(--color-text-primary, #555);
            font-weight: 500;
        }
        
        .form-input {
            width: 100%;
            padding: 12px 15px;
            border: 1px solid var(--color-border-input, #e1e1e1);
            border-radius: var(--color-radius-md, 6px);
            font-size: 16px;
            background-color: var(--color-bg-input, white);
            color: var(--color-text-input, #333);
            transition: border-color var(--color-transition-normal, 0.3s ease);
        }
        
        .form-input:focus {
            outline: none;
            border-color: var(--color-border-input-focus, #667eea);
            box-shadow: var(--color-shadow-input-focus, 0 0 0 3px rgba(102, 126, 234, 0.1));
        }
        
        .form-button {
            background: var(--color-bg-btn-primary, linear-gradient(135deg, #667eea 0%, #764ba2 100%));
            color: var(--color-text-btn-primary, white);
            border: 1px solid var(--color-border, transparent);
            border-radius: var(--color-radius-md, 6px);
            padding: 14px 20px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all var(--color-transition-normal, 0.3s ease);
            margin-top: 10px;
        }
        
        .form-button:hover {
            opacity: 0.9;
            transform: translateY(-2px);
            background: var(--color-bg-btn-primary-hover, #5a67d8);
        }
        
        .form-button:active {
            transform: translateY(0);
        }
        
        .error-message {
            background-color: var(--color-bg-alert-danger, #f8d7da);
            color: var(--color-text-alert-danger, #721c24);
            padding: 12px;
            border-radius: var(--color-radius-md, 6px);
            margin-bottom: 20px;
            border: 1px solid var(--color-border-alert-danger, #f5c6cb);
            text-align: center;
        }
        
        .success-message {
            background-color: var(--color-bg-alert-success, #d4edda);
            color: var(--color-text-alert-success, #155724);
            padding: 12px;
            border-radius: var(--color-radius-md, 6px);
            margin-bottom: 20px;
            border: 1px solid var(--color-border-alert-success, #c3e6cb);
            text-align: center;
        }
        
        .login-footer {
            text-align: center;
            margin-top: 20px;
            font-size: 14px;
            color: var(--color-text-muted, #666);
        }
        
        @media (max-width: 480px) {
            .login-container {
                padding: 30px 20px;
            }
            
            .login-title {
                font-size: 24px;
            }
        }
    </style>
</head>
<body class="<?php echo getSkinBodyClass(); ?>">
    <div class="login-container">
        <div class="login-header">
            <h1 class="login-title">管理员登录</h1>
            <p class="login-subtitle">请输入您的管理员账户信息</p>
        </div>
        
        <?php if (!empty($error_message)): ?>
            <div class="error-message">
                <?php echo htmlspecialchars($error_message, ENT_QUOTES, 'UTF-8'); ?>
            </div>
        <?php endif; ?>
        
        <form class="login-form" method="POST" action="login.php">
            <!-- CSRF令牌 -->
            <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8'); ?>">
            
            <div class="form-group">
                <label class="form-label" for="username">用户名</label>
                <input 
                    type="text" 
                    id="username" 
                    name="username" 
                    class="form-input" 
                    placeholder="请输入用户名" 
                    required 
                    autocomplete="username"
                >
            </div>
            
            <div class="form-group">
                <label class="form-label" for="password">密码</label>
                <input 
                    type="password" 
                    id="password" 
                    name="password" 
                    class="form-input" 
                    placeholder="请输入密码" 
                    required 
                    autocomplete="current-password"
                >
            </div>
            
            <button type="submit" class="form-button">登录</button>
        </form>
        
        <div class="login-footer">
            <?php
            // 检查是否为首次安装（通过检查是否存在安装锁文件）
            $firstInstall = !file_exists(__DIR__ . '/installed.lock');
            if ($firstInstall): ?>
                <p>默认管理员账号: admin / admin123</p>
                <p>请务必在首次登录后修改默认密码</p>
            <?php else: ?>
                <p>请输入您的管理员账户信息</p>
            <?php endif; ?>
        </div>
    </div>
    
    <script nonce="<?php echo $nonce; ?>">
        // 添加一些基本的前端验证
        document.querySelector('.login-form').addEventListener('submit', function(e) {
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            
            if (!username || !password) {
                alert('请输入用户名和密码');
                e.preventDefault();
                return false;
            }
            
            // 防止表单重复提交
            const submitButton = this.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = '登录中...';
        });
    </script>
    
    <?php echo getSkinSwitchJS(); ?>
</body>
</html>
