<?php
/**
 * 管理员密码重置页面
 * 提供管理员密码重置功能
 */

// 包含认证函数
require_once 'auth.php';

// 包含皮肤加载器
require_once dirname(__DIR__) . '/skin_loader.php';

// 检查是否已登录，如果未登录则重定向到登录页
if (!isLoggedIn()) {
    header('Location: login.php');
    exit;
}

$error_message = '';
$success_message = '';

// 处理密码重置请求
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 验证CSRF令牌
    if (!isset($_POST['csrf_token']) || $_POST['csrf_token'] !== $_SESSION['csrf_token']) {
        $error_message = '安全验证失败，请重试';
    } else {
        // 获取并清理用户输入
        $current_password = trim($_POST['current_password'] ?? '');
        $new_password = trim($_POST['new_password'] ?? '');
        $confirm_password = trim($_POST['confirm_password'] ?? '');
        
        // 基本输入验证
        if (empty($current_password) || empty($new_password) || empty($confirm_password)) {
            $error_message = '请填写所有密码字段';
        } elseif ($new_password !== $confirm_password) {
            $error_message = '新密码与确认密码不匹配';
        } elseif (strlen($new_password) < 6) {
            $error_message = '新密码长度至少为6个字符';
        } else {
            // 验证当前密码
            $username = $_SESSION['admin_username'];
            list($success, $message) = authenticateUser($username, $current_password);
            
            if (!$success) {
                $error_message = '当前密码不正确';
            } else {
                // 更新密码
                $result = updatePassword($username, $new_password);
                if ($result) {
                    $success_message = '密码重置成功，请使用新密码重新登录';
                    // 强制用户重新登录
                    logout();
                    // 3秒后重定向到登录页
                    header('refresh:3;url=login.php');
                } else {
                    $error_message = '密码重置失败，请重试';
                }
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
    <title>密码重置 - 后台管理系统</title>
    <?php echo getSkinHTMLHead(); ?>
    <style>
        /* 密码重置页面样式 - 使用皮肤变量 */
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
        
        .reset-container {
            background: var(--color-bg-secondary, white);
            border: 1px solid var(--color-border, #e1e1e1);
            border-radius: var(--color-radius-lg, 10px);
            box-shadow: var(--color-shadow, 0 10px 30px rgba(0, 0, 0, 0.3));
            padding: 40px;
            width: 100%;
            max-width: 450px;
            transition: transform var(--color-transition-normal, 0.3s ease);
        }
        
        .reset-container:hover {
            transform: translateY(-5px);
        }
        
        .reset-header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .reset-title {
            color: var(--color-text-heading, #333);
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 10px;
        }
        
        .reset-subtitle {
            color: var(--color-text-secondary, #666);
            font-size: 14px;
        }
        
        .reset-form {
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
        
        .password-requirements {
            margin-top: 5px;
            font-size: 12px;
            color: var(--color-text-muted, #666);
        }
        
        .reset-footer {
            text-align: center;
            margin-top: 20px;
            font-size: 14px;
            color: var(--color-text-muted, #666);
        }
        
        .back-link {
            color: var(--color-link, #667eea);
            text-decoration: none;
            transition: color var(--color-transition-normal, 0.3s ease);
        }
        
        .back-link:hover {
            color: var(--color-link-hover, #5a67d8);
            text-decoration: underline;
        }
        
        @media (max-width: 480px) {
            .reset-container {
                padding: 30px 20px;
            }
            
            .reset-title {
                font-size: 24px;
            }
        }
    </style>
</head>
<body class="<?php echo getSkinBodyClass(); ?>">
    <div class="reset-container">
        <div class="reset-header">
            <h1 class="reset-title">密码重置</h1>
            <p class="reset-subtitle">请重置您的管理员密码</p>
        </div>
        
        <?php if (!empty($error_message)): ?>
            <div class="error-message">
                <?php echo htmlspecialchars($error_message, ENT_QUOTES, 'UTF-8'); ?>
            </div>
        <?php endif; ?>
        
        <?php if (!empty($success_message)): ?>
            <div class="success-message">
                <?php echo htmlspecialchars($success_message, ENT_QUOTES, 'UTF-8'); ?>
            </div>
        <?php endif; ?>
        
        <form class="reset-form" method="POST" action="reset_password.php">
            <!-- CSRF令牌 -->
            <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8'); ?>">
            
            <div class="form-group">
                <label class="form-label" for="current_password">当前密码</label>
                <input 
                    type="password" 
                    id="current_password" 
                    name="current_password" 
                    class="form-input" 
                    placeholder="请输入当前密码" 
                    required 
                    autocomplete="current-password"
                >
            </div>
            
            <div class="form-group">
                <label class="form-label" for="new_password">新密码</label>
                <input 
                    type="password" 
                    id="new_password" 
                    name="new_password" 
                    class="form-input" 
                    placeholder="请输入新密码" 
                    required 
                    autocomplete="new-password"
                >
                <div class="password-requirements">
                    密码要求：至少6个字符
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="confirm_password">确认新密码</label>
                <input 
                    type="password" 
                    id="confirm_password" 
                    name="confirm_password" 
                    class="form-input" 
                    placeholder="请再次输入新密码" 
                    required 
                    autocomplete="new-password"
                >
            </div>
            
            <button type="submit" class="form-button">重置密码</button>
        </form>
        
        <div class="reset-footer">
            <p><a href="index.php" class="back-link">返回管理面板</a></p>
        </div>
    </div>
    
    <script nonce="<?php echo $nonce; ?>">
        // 添加一些基本的前端验证
        document.querySelector('.reset-form').addEventListener('submit', function(e) {
            const currentPassword = document.getElementById('current_password').value.trim();
            const newPassword = document.getElementById('new_password').value.trim();
            const confirmPassword = document.getElementById('confirm_password').value.trim();
            
            if (!currentPassword || !newPassword || !confirmPassword) {
                alert('请填写所有密码字段');
                e.preventDefault();
                return false;
            }
            
            if (newPassword !== confirmPassword) {
                alert('新密码与确认密码不匹配');
                e.preventDefault();
                return false;
            }
            
            if (newPassword.length < 6) {
                alert('新密码长度至少为6个字符');
                e.preventDefault();
                return false;
            }
            
            // 防止表单重复提交
            const submitButton = this.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = '处理中...';
        });
    </script>
    
    <?php echo getSkinSwitchJS(); ?>
</body>
</html>