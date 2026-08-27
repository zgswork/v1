<?php
/**
 * 界面设置管理
 * 功能：管理index.php页面的页眉和页脚自定义内容
 */

// 引入认证控制
require_once 'auth.php';

// 引入皮肤加载器
require_once '../skin_loader.php';

// 保护页面，确保只有登录用户才能访问
protectPage();

// 设置页面标题
$page_title = "界面设置管理";

// 配置文件路径
$config_file = __DIR__ . '/../ui_config.json';

// 默认配置
$default_config = [
    'header_title' => 'Cencrack文件分享中心',
    'header_description' => '<p align="left">提供各类软件、工具和资料的下载服务</p>',
    'footer_content' => ''
];

// 加载现有配置
function loadConfig($config_file, $default_config) {
    if (file_exists($config_file)) {
        $json_content = file_get_contents($config_file);
        $config = json_decode($json_content, true);
        if ($config !== null) {
            // 合并配置，确保所有必需字段都存在
            return array_merge($default_config, $config);
        }
    }
    return $default_config;
}

// 生成完整的页眉HTML
function generateHeaderHTML($config) {
    return '<div style="display: flex; justify-content: space-between; align-items: center;">
        <h1>' . $config['header_title'] . '</h1>
        <a href="skin_viewer.php" class="btn btn-primary" style="text-decoration: none;">
            <i class="fa fa-paint-brush"></i> 更换皮肤
        </a>
    </div>
    <p>' . $config['header_description'] . '</p>';
}

// 保存配置
function saveConfig($config_file, $config) {
    $json_content = json_encode($config, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    return file_put_contents($config_file, $json_content) !== false;
}

// 加载配置
$config = loadConfig($config_file, $default_config);

// 处理表单提交
    $message = '';
    $message_type = '';

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // 获取表单输入
        $header_title = isset($_POST['header_title']) ? trim($_POST['header_title']) : $default_config['header_title'];
        $header_description = isset($_POST['header_description']) ? trim($_POST['header_description']) : $default_config['header_description'];
        $footer_content = isset($_POST['footer_content']) ? $_POST['footer_content'] : $default_config['footer_content'];
        
        // 基本安全过滤 - 移除所有script标签
        $header_title = preg_replace('#<script[^>]*>(.*?)</script>#is', '', $header_title);
        $header_description = preg_replace('#<script[^>]*>(.*?)</script>#is', '', $header_description);
        $footer_content = preg_replace('#<script[^>]*>(.*?)</script>#is', '', $footer_content);
    
    // 更新配置
    $new_config = [
        'header_title' => $header_title,
        'header_description' => $header_description,
        'footer_content' => $footer_content
    ];
    
    // 保存配置
    if (saveConfig($config_file, $new_config)) {
        $message = '配置保存成功！';
        $message_type = 'success';
        $config = $new_config;
    } else {
        $message = '配置保存失败，请检查文件权限！';
        $message_type = 'error';
    }
}

// 重置配置
if (isset($_POST['reset'])) {
    if (saveConfig($config_file, $default_config)) {
        $message = '配置已重置为默认值！';
        $message_type = 'success';
        $config = $default_config;
    } else {
        $message = '重置配置失败，请检查文件权限！';
        $message_type = 'error';
    }
}

// 向后兼容：如果是旧版配置格式，转换为新版
if (isset($config['header_content']) && !isset($config['header_title'])) {
    // 尝试从旧版内容中提取标题和描述
    $header_content = $config['header_content'];
    
    // 提取标题
    if (preg_match('/<h1>(.*?)<\/h1>/s', $header_content, $title_matches)) {
        $config['header_title'] = strip_tags($title_matches[1]);
    } else {
        $config['header_title'] = $default_config['header_title'];
    }
    
    // 提取描述
    if (preg_match('/<p>(.*?)<\/p>/s', $header_content, $desc_matches)) {
        $config['header_description'] = strip_tags($desc_matches[1]);
    } else {
        $config['header_description'] = $default_config['header_description'];
    }
    
    // 移除旧配置项
    unset($config['header_content']);
    
    // 保存转换后的配置
    saveConfig($config_file, $config);
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo $page_title; ?></title>
    <link rel="stylesheet" href="../css/font-awesome/font-awesome.min.css">
    <?php echo getSkinHTMLHead(); ?>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            background-color: var(--color-bg-primary, #f4f4f4);
            color: var(--color-text-primary, #333);
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: var(--color-spacing-lg, 20px);
        }
        
        .header {
            background-color: var(--color-bg-header, var(--color-header-bg, #35495e));
            color: var(--color-text-header, var(--color-header-text, white));
            padding: var(--color-spacing-lg, 20px);
            border-radius: var(--color-radius-md, 5px);
            margin-bottom: var(--color-spacing-lg, 20px);
            box-shadow: 0 2px 4px var(--color-shadow, rgba(0,0,0,0.1));
        }
        
        h1 {
            margin: 0;
        }
        
        .form-container {
            background-color: var(--color-bg-card, var(--color-bg-secondary, white));
            padding: 20px;
            border-radius: var(--color-radius-md, 5px);
            box-shadow: 0 2px 4px var(--color-shadow, rgba(0,0,0,0.1));
            margin-bottom: 20px;
        }
        
        .form-group {
            margin-bottom: var(--color-spacing-lg, 20px);
        }
        
        label {
            display: block;
            font-weight: bold;
            margin-bottom: var(--color-spacing-sm, 8px);
            color: var(--color-text-label, var(--color-text-primary, #333));
        }
        
        textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid var(--color-border-input, var(--color-border, #ddd));
            border-radius: var(--color-radius-md, 4px);
            font-family: monospace;
            min-height: 200px;
            resize: vertical;
            background-color: var(--color-bg-input, var(--color-input-bg, white));
            color: var(--color-text-input, var(--color-input-text, #333));
        }
        
        .buttons {
            display: flex;
            gap: var(--color-spacing-md, 10px);
            margin-top: var(--color-spacing-lg, 20px);
        }
        
        button {
            padding: 10px 20px;
            border: none;
            border-radius: var(--color-radius-md, 4px);
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s ease;
        }
        
        .btn-save {
            background-color: var(--color-bg-btn-primary, var(--color-primary, #3498db));
            color: var(--color-text-btn-primary, var(--color-text-btn-text, white));
        }
        
        .btn-save:hover {
            background-color: var(--color-bg-btn-primary-hover, var(--color-primary, #2980b9));
        }
        
        .btn-reset {
            background-color: var(--color-bg-btn-danger, var(--color-danger, #e74c3c));
            color: var(--color-text-btn-danger, var(--color-text-btn-text, white));
        }
        
        .btn-reset:hover {
            background-color: var(--color-bg-btn-danger-hover, var(--color-danger, #c0392b));
        }
        
        .btn-back {
            background-color: var(--color-bg-btn-secondary, var(--color-secondary, #95a5a6));
            color: var(--color-text-btn-secondary, var(--color-text-btn-text, white));
            text-decoration: none;
            display: inline-block;
            padding: 10px 20px;
            border-radius: var(--color-radius-md, 4px);
        }
        
        .btn-back:hover {
            background-color: var(--color-bg-btn-secondary-hover, var(--color-secondary, #7f8c8d));
        }
        
        .message {
            padding: var(--color-spacing-md, 15px);
            border-radius: var(--color-radius-md, 4px);
            margin-bottom: var(--color-spacing-lg, 20px);
        }
        
        .message.success {
            background-color: var(--color-bg-alert-success, var(--color-success-bg, #d4edda));
            color: var(--color-text-alert-success, var(--color-success-text, #155724));
            border: 1px solid var(--color-border-alert-success, var(--color-success-border, #c3e6cb));
        }
        
        .message.error {
            background-color: var(--color-bg-alert-danger, var(--color-error-bg, #f8d7da));
            color: var(--color-text-alert-danger, var(--color-error-text, #721c24));
            border: 1px solid var(--color-border-alert-danger, var(--color-error-border, #f5c6cb));
        }
        
        .instructions {
            background-color: var(--color-bg-alert-info, rgba(58, 134, 255, 0.1));
            border: 1px solid var(--color-border-alert-info, rgba(58, 134, 255, 0.3));
            padding: var(--color-spacing-md, 15px);
            border-radius: var(--color-radius-md, 4px);
            margin-bottom: var(--color-spacing-md, 15px);
            position: relative;
        }
        
        .instructions::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 3px;
            background: var(--color-primary, #3a86ff);
        }
        
        .instructions h4 {
            margin-top: 0;
            color: var(--color-text-alert-info, #3a86ff);
            font-weight: bold;
        }
        
        .instructions ul {
            margin: 0;
            padding-left: 20px;
            color: var(--color-text-secondary, #666);
        }
        
        .instructions li {
            margin-bottom: var(--color-spacing-xs, 5px);
            line-height: 1.5;
        }
        
        .instructions li:last-child {
            margin-bottom: 0;
        }
        
        /* 响应式设计 */
        @media (max-width: 768px) {
            .container {
                padding: var(--color-spacing-sm, 10px);
            }
            
            .buttons {
                flex-direction: column;
                gap: var(--color-spacing-sm, 10px);
            }
        }
    </style>
</head>
<body class="<?php echo getSkinBodyClass(); ?>">
    <div class="container">
        <div class="header">
            <h1><?php echo $page_title; ?></h1>
        </div>
        
        <!-- 消息提示 -->
        <?php if (!empty($message)): ?>
            <div class="message <?php echo $message_type; ?>">
                <?php echo $message; ?>
            </div>
        <?php endif; ?>
        
        <div class="form-container">
            <form method="post" action="">
                <div class="buttons" style="margin-bottom: 20px;">
                    <button type="submit" class="btn-save"><i class="fa fa-save"></i> 保存配置</button>
                    <button type="submit" name="reset" class="btn-reset" onclick="return confirm('确定要重置为默认配置吗？')"><i class="fa fa-refresh"></i> 重置为默认</button>
                    <a href="../index.php" class="btn-back" target="_blank"><i class="fa fa-home"></i> 返回前台</a>
                </div>
                <!-- 页眉设置 -->
                <div class="form-group">
                    <div class="instructions">
                        <h4>页眉设置说明</h4>
                        <ul>
                            <li>支持自定义HTML标签，可以设置不同样式</li>
                            <li>标题将显示为页面主标题</li>
                            <li>描述文本将显示在标题下方</li>
                            <li>建议使用安全的HTML标签，避免使用script标签</li>
                        </ul>
                    </div>
                    <label for="header_title">页眉标题</label>
                    <textarea id="header_title" name="header_title" placeholder="在此输入页眉标题HTML内容..." style="width: 100%; padding: 12px; border: 1px solid var(--color-border-input, var(--color-border, #ddd)); border-radius: var(--color-radius-md, 4px); font-family: monospace; min-height: 200px; resize: vertical; margin-bottom: 15px; background-color: var(--color-bg-input, var(--color-input-bg, white)); color: var(--color-text-input, var(--color-input-text, #333));"><?php echo $config['header_title']; ?></textarea>
                    
                    <label for="header_description">页眉描述</label>
                    <textarea id="header_description" name="header_description" placeholder="在此输入页眉描述HTML内容..." style="width: 100%; padding: 12px; border: 1px solid var(--color-border-input, var(--color-border, #ddd)); border-radius: var(--color-radius-md, 4px); font-family: monospace; min-height: 200px; resize: vertical; margin-bottom: 15px; background-color: var(--color-bg-input, var(--color-input-bg, white)); color: var(--color-text-input, var(--color-input-text, #333));"><?php echo $config['header_description']; ?></textarea>
                </div>
                
                <!-- 页脚设置 -->
                <div class="form-group">
                    <div class="instructions">
                        <h4>页脚设置说明</h4>
                        <ul>
                            <li>支持HTML标签，可以设置版权信息、联系方式等</li>
                            <li>建议使用内联样式进行布局和美化</li>
                            <li>页脚会自动固定在页面底部</li>
                        </ul>
                    </div>
                    <label for="footer_content">页脚内容 (HTML)</label>
                    <textarea id="footer_content" name="footer_content" placeholder="在此输入页脚HTML内容..." style="width: 100%; padding: 12px; border: 1px solid var(--color-border-input, var(--color-border, #ddd)); border-radius: var(--color-radius-md, 4px); font-family: monospace; min-height: 200px; resize: vertical; background-color: var(--color-bg-input, var(--color-input-bg, white)); color: var(--color-text-input, var(--color-input-text, #333));"><?php echo $config['footer_content']; ?></textarea>
                </div>
                
                <div class="buttons">
                    <button type="submit" class="btn-save"><i class="fa fa-save"></i> 保存配置</button>
                    <button type="submit" name="reset" class="btn-reset" onclick="return confirm('确定要重置为默认配置吗？')"><i class="fa fa-refresh"></i> 重置为默认</button>
                    <a href="../index.php" class="btn-back" target="_blank"><i class="fa fa-home"></i> 返回前台</a>
                </div>
            </form>
        </div>
    </div>
</body>
</html>