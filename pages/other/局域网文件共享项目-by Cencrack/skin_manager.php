<?php
require_once 'skin_loader.php';

// 获取所有可用皮肤
$allSkins = getAllSkins();
$currentSkin = getCurrentSkin();

// 处理皮肤切换请求
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['save_skin'])) {
    $newSkin = $_POST['save_skin'];
    if (saveSelectedSkin($newSkin)) {
        // 保存成功，重定向到当前页面以应用新皮肤
        header('Location: ' . $_SERVER['PHP_SELF'] . '?skin=' . $newSkin);
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>皮肤管理中心</title>
    <?php echo getSkinHTMLHead(); ?>
    <style>
        .skin-manager {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .skin-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .skin-card {
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            border: 1px solid var(--border-color);
            background: var(--card-bg);
        }
        
        .skin-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
        }
        
        .skin-preview {
            height: 150px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: bold;
            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
            position: relative;
            overflow: hidden;
        }
        
        .skin-preview::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%, rgba(255,255,255,0.1)),
                        linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%, rgba(255,255,255,0.1));
            background-size: 20px 20px;
            background-position: 0 0, 10px 10px;
            opacity: 0.3;
        }
        
        .skin-info {
            padding: 15px;
        }
        
        .skin-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
            color: var(--text-color);
        }
        
        .skin-description {
            font-size: 14px;
            color: var(--text-secondary);
            margin-bottom: 15px;
        }
        
        .skin-meta {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: var(--text-secondary);
            margin-bottom: 15px;
        }
        
        .skin-actions {
            display: flex;
            gap: 10px;
        }
        
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
            flex: 1;
            text-align: center;
            text-decoration: none;
            display: inline-block;
        }
        
        .btn-preview {
            background-color: var(--secondary-color);
            color: white;
        }
        
        .btn-preview:hover {
            background-color: var(--secondary-hover);
        }
        
        .btn-apply {
            background-color: var(--primary-color);
            color: white;
        }
        
        .btn-apply:hover {
            background-color: var(--primary-hover);
        }
        
        .btn.active {
            background-color: var(--success-color);
        }
        
        .current-skin-indicator {
            background-color: var(--success-color);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }
        
        .demo-section {
            margin-top: 40px;
            padding: 20px;
            border-radius: 8px;
            background: var(--card-bg);
            border: 1px solid var(--border-color);
        }
        
        .demo-title {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 20px;
            color: var(--text-color);
        }
        
        .demo-components {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 20px;
        }
        
        .demo-component {
            padding: 15px;
            border-radius: 6px;
            background: var(--bg-color);
            border: 1px solid var(--border-color);
        }
        
        .demo-component h4 {
            margin-top: 0;
            margin-bottom: 10px;
            color: var(--text-color);
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: var(--text-color);
        }
        
        .form-control {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            background: var(--input-bg);
            color: var(--text-color);
        }
        
        .demo-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        
        .demo-table th, .demo-table td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }
        
        .demo-table th {
            background-color: var(--header-bg);
            font-weight: bold;
        }
        
        .alert {
            padding: 10px 15px;
            border-radius: 4px;
            margin-bottom: 15px;
        }
        
        .alert-info {
            background-color: var(--info-bg);
            border: 1px solid var(--info-border);
            color: var(--info-text);
        }
        
        .alert-success {
            background-color: var(--success-bg);
            border: 1px solid var(--success-border);
            color: var(--success-text);
        }
        
        .alert-warning {
            background-color: var(--warning-bg);
            border: 1px solid var(--warning-border);
            color: var(--warning-text);
        }
        
        .alert-danger {
            background-color: var(--danger-bg);
            border: 1px solid var(--danger-border);
            color: var(--danger-text);
        }
    </style>
</head>
<body class="<?php echo getSkinBodyClass(); ?>">
    <div class="skin-manager">
        <div class="header">
            <h1>皮肤管理中心</h1>
            <p>选择并预览不同的界面主题</p>
        </div>
        
        <?php if (isset($_GET['skin']) && $_GET['skin'] === $currentSkin): ?>
            <div class="alert alert-success">
                皮肤已成功切换为: <strong><?php echo $currentSkin; ?></strong>
            </div>
        <?php endif; ?>
        
        <div class="skin-grid">
            <?php foreach ($allSkins as $skin): ?>
                <div class="skin-card">
                    <div class="skin-preview" style="background-color: <?php echo $skin['previewColor']; ?>">
                        <?php echo $skin['name']; ?>
                    </div>
                    <div class="skin-info">
                        <div class="skin-name">
                            <?php echo $skin['name']; ?>
                            <?php if ($skin['folder'] === $currentSkin): ?>
                                <span class="current-skin-indicator">当前</span>
                            <?php endif; ?>
                        </div>
                        <div class="skin-description"><?php echo $skin['description']; ?></div>
                        <div class="skin-meta">
                            <span>作者: <?php echo $skin['author']; ?></span>
                            <span>版本: <?php echo $skin['version']; ?></span>
                        </div>
                        <div class="skin-actions">
                            <a href="/skins/<?php echo $skin['folder']; ?>/preview.html" class="btn btn-preview" target="_blank">预览</a>
                            <?php if ($skin['folder'] === $currentSkin): ?>
                                <button class="btn active" disabled>已应用</button>
                            <?php else: ?>
                                <form method="post" style="margin: 0;">
                                    <input type="hidden" name="save_skin" value="<?php echo $skin['folder']; ?>">
                                    <button type="submit" class="btn btn-apply">应用</button>
                                </form>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
        
        <div class="demo-section">
            <div class="demo-title">当前皮肤效果预览</div>
            <div class="demo-components">
                <div class="demo-component">
                    <h4>按钮样式</h4>
                    <button class="btn btn-apply">主要按钮</button>
                    <button class="btn btn-preview">次要按钮</button>
                </div>
                
                <div class="demo-component">
                    <h4>表单控件</h4>
                    <div class="form-group">
                        <label for="demo-input">文本输入</label>
                        <input type="text" id="demo-input" class="form-control" placeholder="请输入内容">
                    </div>
                    <div class="form-group">
                        <label for="demo-select">下拉选择</label>
                        <select id="demo-select" class="form-control">
                            <option>选项 1</option>
                            <option>选项 2</option>
                            <option>选项 3</option>
                        </select>
                    </div>
                </div>
                
                <div class="demo-component">
                    <h4>表格样式</h4>
                    <table class="demo-table">
                        <thead>
                            <tr>
                                <th>姓名</th>
                                <th>年龄</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>张三</td>
                                <td>25</td>
                            </tr>
                            <tr>
                                <td>李四</td>
                                <td>30</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <div class="demo-component">
                    <h4>提示框样式</h4>
                    <div class="alert alert-info">信息提示</div>
                    <div class="alert alert-success">成功提示</div>
                    <div class="alert alert-warning">警告提示</div>
                    <div class="alert alert-danger">错误提示</div>
                </div>
            </div>
        </div>
    </div>
    
    <?php echo getSkinSwitchJS(); ?>
</body>
</html>