<?php
/**
 * 皮肤预览页面
 * 功能：展示所有UI组件，并支持实时切换皮肤预览效果
 * 使用统一的skin_loader.php加载皮肤，确保整个系统皮肤加载机制一致
 */

// 包含统一皮肤加载器
require_once __DIR__ . '/../skin_loader.php';

// 处理皮肤保存请求
if (isset($_POST['action']) && $_POST['action'] === 'save_skin' && isset($_POST['skin'])) {
    $saved = saveSelectedSkin($_POST['skin']);
    // 保存成功后可以通过session或其他方式提示用户
    session_start();
    $_SESSION['skin_saved'] = $saved ? 'success' : 'error';
    // 重定向以避免表单重复提交
    header('Location: ' . $_SERVER['PHP_SELF'] . '?theme=' . urlencode($_POST['skin']));
    exit;
}

// 获取所有皮肤信息 (使用skin_loader.php提供的函数)
$skins = getAllSkins();

// 获取当前选中的皮肤，支持skin和theme参数，如果没有则使用配置文件中的皮肤
$currentSkin = isset($_GET['skin']) ? $_GET['skin'] : (isset($_GET['theme']) ? $_GET['theme'] : getCurrentSkin());

// 如果通过URL参数指定了皮肤，但它不是有效的皮肤文件夹，重置为默认皮肤
$validSkinFolders = array_column($skins, 'folder');
if (!empty($currentSkin) && !in_array($currentSkin, $validSkinFolders)) {
    $currentSkin = getCurrentSkin() ?: 'warcraft3';
}

// 如果没有有效的当前皮肤，使用warcraft3作为默认值
if (empty($currentSkin)) {
    $currentSkin = 'warcraft3';
}

// 检查是否有保存成功的提示
$saveMessage = '';
session_start();
if (isset($_SESSION['skin_saved'])) {
    $saveMessage = $_SESSION['skin_saved'] === 'success' ? '皮肤设置已保存' : '皮肤保存失败';
    unset($_SESSION['skin_saved']);
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>皮肤预览 - 组件展示</title>
    <!-- 使用统一皮肤加载器加载当前皮肤的CSS -->
    <?php echo getSkinHTMLHead(); ?>
    <?php echo getSkinSwitchJS(); ?>
    <script>
        // 等待DOM加载完成后再扩展changeSkin函数
        document.addEventListener('DOMContentLoaded', function() {
            // 检查changeSkin函数是否存在
            if (typeof window.changeSkin === 'function') {
                // 扩展皮肤切换函数，增加URL参数更新、皮肤保存功能和预览指示器
                const originalChangeSkin = window.changeSkin;
                window.changeSkin = function(skinName, save = false) {
                    // 调用原始的皮肤切换函数
                    originalChangeSkin(skinName);
                    
                    // 更新URL参数，保持皮肤选择状态
                    const url = new URL(window.location);
                    url.searchParams.set('theme', skinName);
                    history.pushState(null, '', url);
                    
                    // 更新选择框选中状态
                    const selectElement = document.getElementById('skin-select');
                    if (selectElement) {
                        selectElement.value = skinName;
                        
                        // 更新预览指示器颜色
                        const selectedOption = selectElement.options[selectElement.selectedIndex];
                        const previewColor = selectedOption.getAttribute('data-preview-color') || '#007bff';
                        const indicator = document.getElementById('skin-preview-indicator');
                        if (indicator) {
                            indicator.style.setProperty('--preview-color', previewColor);
                        }
                    }
                    
                    // 更新页面元素
                    updatePageElements(skinName);
                    
                    // 如果需要保存，提交表单
                    if (save) {
                        const form = document.createElement('form');
                        form.method = 'POST';
                        form.style.display = 'none';
                        
                        const actionInput = document.createElement('input');
                        actionInput.type = 'hidden';
                        actionInput.name = 'action';
                        actionInput.value = 'save_skin';
                        form.appendChild(actionInput);
                        
                        const skinInput = document.createElement('input');
                        skinInput.type = 'hidden';
                        skinInput.name = 'skin';
                        skinInput.value = skinName;
                        form.appendChild(skinInput);
                        
                        document.body.appendChild(form);
                        form.submit();
                    }
                };
                
                // 更新页面元素的函数
                function updatePageElements(skinName) {
                    // 更新当前皮肤显示
                    const currentSkinElement = document.getElementById('current-skin');
                    if (currentSkinElement) {
                        currentSkinElement.textContent = skinName || '默认';
                    }
                    
                    // 更新皮肤预览卡片的活动状态
                    const skinCards = document.querySelectorAll('.skin-card');
                    skinCards.forEach(card => {
                        const cardSkin = card.getAttribute('data-skin');
                        if (cardSkin === skinName) {
                            card.classList.add('active');
                        } else {
                            card.classList.remove('active');
                        }
                    });
                    
                    // 更新URL参数
                    const url = new URL(window.location);
                    if (skinName) {
                        url.searchParams.set('skin', skinName);
                    } else {
                        url.searchParams.delete('skin');
                    }
                    window.history.replaceState({}, '', url);
                }
                
                // 监听浏览器后退/前进事件，保持皮肤状态一致
                window.addEventListener('popstate', function() {
                    const url = new URL(window.location);
                    const skinFromUrl = url.searchParams.get('skin') || url.searchParams.get('theme');
                    if (skinFromUrl && typeof window.changeSkin === 'function') {
                        window.changeSkin(skinFromUrl);
                    }
                });
            }
            
            // 获取URL参数中的皮肤名
            const url = new URL(window.location);
            const skinFromUrl = url.searchParams.get('skin') || url.searchParams.get('theme');
            
            // 如果URL中指定了皮肤，则应用它
            if (skinFromUrl && typeof window.changeSkin === 'function') {
                // 使用统一的changeSkin函数应用皮肤
                window.changeSkin(skinFromUrl);
            } else {
                // 初始化预览指示器
                const selectElement = document.getElementById('skin-select');
                if (selectElement) {
                    const selectedOption = selectElement.options[selectElement.selectedIndex];
                    const previewColor = selectedOption.getAttribute('data-preview-color') || '#007bff';
                    const indicator = document.getElementById('skin-preview-indicator');
                    if (indicator) {
                        indicator.style.setProperty('--preview-color', previewColor);
                    }
                }
            }
            
            // 显示保存成功消息
            <?php if ($saveMessage): ?>
            const messageEl = document.createElement('div');
            messageEl.className = 'alert alert-success';
            messageEl.textContent = '<?php echo $saveMessage; ?>';
            messageEl.style.position = 'fixed';
            messageEl.style.top = '20px';
            messageEl.style.right = '20px';
            messageEl.style.zIndex = '1000';
            document.body.appendChild(messageEl);
            
            setTimeout(function() {
                messageEl.style.opacity = '0';
                messageEl.style.transition = 'opacity 0.5s ease';
                setTimeout(function() {
                    messageEl.remove();
                }, 500);
            }, 3000);
            <?php endif; ?>
            
            // 标签页切换功能
            const tabButtons = document.querySelectorAll('.tab-btn');
            const tabContents = document.querySelectorAll('.tab-content');
            
            // 确保元素存在后再添加事件监听器
            if (tabButtons.length > 0 && tabContents.length > 0) {
                tabButtons.forEach(button => {
                    if (button) {
                        button.addEventListener('click', function() {
                            // 移除所有活动状态
                            tabButtons.forEach(btn => {
                                if (btn) btn.classList.remove('active');
                            });
                            tabContents.forEach(content => {
                                if (content) content.classList.remove('active');
                            });
                            
                            // 添加当前活动状态
                            this.classList.add('active');
                            const targetTab = document.getElementById(this.getAttribute('data-tab'));
                            if (targetTab) {
                                targetTab.classList.add('active');
                            }
                        });
                    }
                });
            }
            
            // 自动调整进度条动画
            const progressFills = document.querySelectorAll('.progress-fill');
            if (progressFills.length > 0) {
                progressFills.forEach(fill => {
                    if (fill) {
                        const width = fill.style.width;
                        fill.style.width = '0%';
                        setTimeout(() => {
                            fill.style.width = width;
                        }, 300);
                    }
                });
            }
        });
    </script>
    <style>
        /* 基础重置样式 */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--font-family, 'Microsoft YaHei', Arial, sans-serif);
            line-height: 1.6;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            color: var(--color-text-primary, #333);
            background-color: var(--color-bg-primary, #f5f5f5);
        }
        
        /* 顶部导航栏 */
        .top-nav {
            background: var(--color-bg-primary, #333);
            color: var(--color-text-primary, #fff);
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .top-nav h1 {
            font-size: 1.5em;
            font-weight: 600;
        }
        
        .skin-selector {
            position: relative;
        }
        
        .skin-selector {
            display: flex;
            align-items: center;
            gap: 10px;
            position: relative;
        }
        
        .skin-selector select {
            padding: 8px 12px;
            border: none;
            border-radius: var(--color-radius-md, 4px);
            background: var(--color-bg-secondary, #444);
            color: var(--color-text-primary, #fff);
            cursor: pointer;
            font-size: 14px;
            outline: none;
            transition: all var(--color-transition-normal, 0.3s) ease;
        }
        
        .skin-selector select:hover {
            background: var(--color-bg-tertiary, #555);
        }
        
        .skin-preview-indicator {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 8px;
            background: var(--color-bg-preview-indicator, rgba(0, 123, 255, 0.1));
            border: 1px solid var(--color-border-preview-indicator, rgba(0, 123, 255, 0.3));
            border-radius: 12px;
            font-size: 12px;
            color: var(--color-text-preview-indicator, var(--color-primary, #007bff));
            --preview-color: #007bff;
        }
        
        .preview-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--preview-color);
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        /* 主内容区域 */
        .main-container {
            flex: 1;
            display: flex;
            padding: 20px;
            gap: 20px;
        }
        
        .sidebar {
            width: 250px;
            background: var(--color-bg-secondary, #f5f5f5);
            border-radius: var(--color-radius-md, 8px);
            padding: 20px;
            height: fit-content;
            border: 1px solid var(--color-border, #e0e0e0);
        }
        
        .content {
            flex: 1;
            background: var(--color-bg-secondary, #f5f5f5);
            border-radius: var(--color-radius-md, 8px);
            padding: 20px;
            border: 1px solid var(--color-border, #e0e0e0);
        }
        
        /* 组件标题 */
        .component-section {
            margin-bottom: 30px;
        }
        
        .section-title {
            font-size: 1.2em;
            font-weight: 600;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid var(--color-border, #e0e0e0);
            color: var(--color-text-primary, #333);
        }
        
        /* 按钮组件 */
        .buttons-group {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 20px;
        }
        
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: var(--color-radius-md, 4px);
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all var(--color-transition-normal, 0.3s) ease;
            text-decoration: none;
            display: inline-block;
            text-align: center;
        }
        
        .btn-primary {
            background: var(--color-bg-btn-primary, #007bff);
            color: var(--color-text-btn-primary, white);
        }
        
        .btn-secondary {
            background: var(--color-bg-btn-secondary, #6c757d);
            color: var(--color-text-btn-secondary, white);
        }
        
        .btn-success {
            background: var(--color-bg-btn-success, #28a745);
            color: var(--color-text-btn-success, white);
        }
        
        .btn-danger {
            background: var(--color-bg-btn-danger, #dc3545);
            color: var(--color-text-btn-danger, white);
        }
        
        .btn-warning {
            background: var(--color-bg-btn-warning, #ffc107);
            color: var(--color-text-btn-warning, #333);
        }
        
        .btn-info {
            background: var(--color-bg-btn-info, #17a2b8);
            color: var(--color-text-btn-info, white);
        }
        
        .btn-disabled {
            background: var(--color-bg-disabled, #e0e0e0);
            color: var(--color-text-disabled, #999);
            cursor: not-allowed;
        }
        
        /* 表单组件 */
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: var(--color-text-primary, #333);
        }
        
        .form-control {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--color-border-input, #ddd);
            border-radius: var(--color-radius-md, 4px);
            font-size: 14px;
            background: var(--color-bg-input, #fff);
            color: var(--color-text-input, #333);
        }
        
        .form-control:focus {
            outline: none;
            border-color: var(--color-border-input-focus, #007bff);
            box-shadow: 0 0 0 2px var(--color-shadow-input-focus, rgba(0, 123, 255, 0.25));
        }
        
        textarea.form-control {
            min-height: 80px;
            resize: vertical;
        }
        
        /* 表格组件 */
        .file-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background-color: var(--color-bg-table, #fff);
        }
        
        .file-table th,
        .file-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid var(--color-border-table, #e0e0e0);
        }
        
        .file-table th {
            background: var(--color-bg-table-header, #f8f9fa);
            font-weight: 600;
            color: var(--color-text-table-header, #333);
        }
        
        .file-table tbody tr:hover {
            background: var(--color-bg-table-hover, #f8f9fa);
        }
        
        /* 卡片组件 */
        .cards-container {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .card {
            background: var(--color-bg-card, #fff);
            border-radius: var(--color-radius-md, 8px);
            padding: 20px;
            box-shadow: 0 2px 4px var(--color-shadow-card, rgba(0,0,0,0.1));
            border: 1px solid var(--color-border-card, #e0e0e0);
        }
        
        .card-header {
            font-weight: 600;
            margin-bottom: 10px;
            color: var(--color-text-card-header, #333);
        }
        
        .card-body {
            color: var(--color-text-card-body, #666);
            font-size: 14px;
        }
        
        /* 提示框组件 */
        .alerts {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 20px;
        }
        
        .alert {
            padding: 12px 16px;
            border-radius: var(--color-radius-md, 4px);
            font-size: 14px;
            border-left: 4px solid transparent;
        }
        
        .alert-success {
            background: var(--color-bg-alert-success, #d4edda);
            color: var(--color-text-alert-success, #155724);
            border-color: var(--color-success, #28a745);
        }
        
        .alert-danger {
            background: var(--color-bg-alert-danger, #f8d7da);
            color: var(--color-text-alert-danger, #721c24);
            border-color: var(--color-danger, #dc3545);
        }
        
        .alert-warning {
            background: var(--color-bg-alert-warning, #fff3cd);
            color: var(--color-text-alert-warning, #856404);
            border-color: var(--color-warning, #ffc107);
        }
        
        .alert-info {
            background: var(--color-bg-alert-info, #d1ecf1);
            color: var(--color-text-alert-info, #0c5460);
            border-color: var(--color-info, #17a2b8);
        }
        
        /* 导航菜单 */
        .nav-menu {
            list-style: none;
            padding: 0;
        }
        
        .nav-item {
            margin-bottom: 5px;
        }
        
        .nav-link {
            display: block;
            padding: 10px 15px;
            color: var(--color-text-nav-link, #333);
            text-decoration: none;
            border-radius: var(--color-radius-sm, 4px);
            transition: all var(--color-transition-normal, 0.3s) ease;
        }
        
        .nav-link:hover {
            background: var(--color-bg-nav-link-hover, #e9ecef);
            color: var(--color-text-nav-link-hover, #333);
        }
        
        .nav-link.active {
            background: var(--color-bg-nav-link-active, #007bff);
            color: var(--color-text-nav-link-active, #fff);
        }
        
        /* 徽章 */
        .badge {
            display: inline-block;
            padding: 3px 7px;
            border-radius: 10px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .badge-primary {
            background: var(--color-bg-badge-primary, #007bff);
            color: var(--color-text-badge-primary, white);
        }
        
        .badge-success {
            background: var(--color-bg-badge-success, #28a745);
            color: var(--color-text-badge-success, white);
        }
        
        .badge-danger {
            background: var(--color-bg-badge-danger, #dc3545);
            color: var(--color-text-badge-danger, white);
        }
        
        /* 分页组件 */
        .pagination {
            display: flex;
            gap: 5px;
            margin-bottom: 20px;
            list-style: none;
            padding: 0;
        }
        
        .page-item {
            display: inline-block;
        }
        
        .page-link {
            display: inline-block;
            padding: 8px 12px;
            border: 1px solid var(--color-border-page-link, #ddd);
            background: var(--color-bg-page-link, #fff);
            color: var(--color-text-page-link, #007bff);
            text-decoration: none;
            border-radius: var(--color-radius-md, 4px);
            cursor: pointer;
            transition: background-color var(--color-transition-normal, 0.3s);
        }
        
        .page-link:hover {
            background: var(--color-bg-page-link-hover, #e9ecef);
        }
        
        .page-link.active {
            background: var(--color-bg-page-link-active, #007bff);
            color: var(--color-text-page-link-active, white);
            border-color: var(--color-border-page-link-active, #007bff);
        }
        
        /* 工具提示 */
        .tooltip {
            position: relative;
            display: inline-block;
            cursor: help;
        }
        
        .tooltip .tooltiptext {
            visibility: hidden;
            width: 120px;
            background-color: var(--color-bg-tooltip, #333);
            color: var(--color-text-tooltip, #fff);
            text-align: center;
            border-radius: var(--color-radius-sm, 6px);
            padding: 5px;
            position: absolute;
            z-index: 1;
            bottom: 125%;
            left: 50%;
            margin-left: -60px;
            opacity: 0;
            transition: opacity var(--color-transition-normal, 0.3s);
            font-size: 12px;
        }
        
        .tooltip:hover .tooltiptext {
            visibility: visible;
            opacity: 1;
        }
        
        /* 响应式调整 */
        @media (max-width: 768px) {
            .main-container {
                flex-direction: column;
            }
            
            .sidebar {
                width: 100%;
            }
            
            .cards-container {
                grid-template-columns: 1fr;
            }
            
            .skin-selector {
                display: flex;
                flex-direction: column;
                gap: 10px;
                align-items: stretch;
            }
            
            .skin-selector select,
            .skin-selector button {
                width: 100%;
            }
            
            .skin-preview-indicator {
                justify-content: center;
                margin-top: 5px;
            }
        }
    </style>
</head>
<body class="<?php echo getSkinBodyClass(); ?>">
    <!-- 顶部导航栏 -->
    <nav class="top-nav">
        <h1>UI组件皮肤预览</h1>
        <div class="skin-selector">
                <select id="skin-select" onchange="window.changeSkin(this.value)">
                    <?php foreach ($skins as $skin): ?>
                        <option value="<?php echo $skin['folder']; ?>" <?php echo $currentSkin === $skin['folder'] ? 'selected' : ''; ?> data-preview-color="<?php echo isset($skin['previewColor']) ? $skin['previewColor'] : '#007bff'; ?>">
                            <?php echo $skin['name']; ?>
                        </option>
                    <?php endforeach; ?>
                </select>
                <button id="save-skin" class="btn btn-secondary" onclick="window.changeSkin(document.getElementById('skin-select').value, true)">保存</button>
                <div class="skin-preview-indicator" id="skin-preview-indicator">
                    <span class="preview-dot"></span>
                    <span class="preview-text">预览模式</span>
                </div>
            </div>
    </nav>
    
    <!-- 主内容区域 -->
    <div class="main-container">
        <!-- 左侧菜单 -->
        <aside class="sidebar">
            <div class="component-section">
                <h3 class="section-title">导航菜单</h3>
                <ul class="nav-menu">
                    <li class="nav-item">
                        <a href="#" class="nav-link active">仪表盘</a>
                    </li>
                    <li class="nav-item">
                        <a href="#" class="nav-link">文件管理</a>
                    </li>
                    <li class="nav-item">
                        <a href="#" class="nav-link">用户管理</a>
                    </li>
                    <li class="nav-item">
                        <a href="#" class="nav-link">系统设置</a>
                    </li>
                    <li class="nav-item">
                        <a href="#" class="nav-link">帮助文档</a>
                    </li>
                </ul>
            </div>
        </aside>
        
        <!-- 右侧内容区 -->
        <main class="content">
            <!-- 皮肤信息面板 -->
            <div class="skin-info">
                <h4>当前皮肤信息</h4>
                <p><strong>主题名称：</strong><?php echo isset($skins[$currentSkin]) && isset($skins[$currentSkin]['name']) ? $skins[$currentSkin]['name'] : $currentSkin; ?></p>
                <p><strong>主题模式：</strong><?php echo strpos($currentSkin, 'dark') !== false ? '暗色模式' : '亮色模式'; ?></p>
                <p><strong>主题目录：</strong><?php echo $currentSkin; ?></p>
                <p>使用下拉菜单选择主题，点击"应用"按钮即时预览效果，点击"保存"按钮将主题设置保存到系统配置中。</p>
                <p>切换主题时，所有UI组件将平滑过渡到新的样式，保持一致的视觉体验。</p>
            </div>
            
            <!-- 按钮组件 -->
            <div class="component-section">
                <h3 class="section-title">按钮组件</h3>
                <div class="buttons-group">
                    <button class="btn btn-primary">主要按钮</button>
                    <button class="btn btn-secondary">次要按钮</button>
                    <button class="btn btn-success">成功按钮</button>
                    <button class="btn btn-danger">危险按钮</button>
                    <button class="btn btn-warning">警告按钮</button>
                    <button class="btn btn-info">信息按钮</button>
                    <button class="btn btn-disabled">禁用按钮</button>
                </div>
            </div>
            
            <!-- 表单组件 -->
            <div class="component-section">
                <h3 class="section-title">表单组件</h3>
                <div class="form-group">
                    <label for="input-text">文本输入框</label>
                    <input type="text" id="input-text" class="form-control" placeholder="请输入文本...">
                </div>
                <div class="form-group">
                    <label for="input-password">密码输入框</label>
                    <input type="password" id="input-password" class="form-control" placeholder="请输入密码...">
                </div>
                <div class="form-group">
                    <label for="input-textarea">多行文本框</label>
                    <textarea id="input-textarea" class="form-control" placeholder="请输入多行文本..."></textarea>
                </div>
                <div class="form-group">
                    <label for="input-select">下拉选择框</label>
                    <select id="input-select" class="form-control">
                        <option value="1">选项一</option>
                        <option value="2">选项二</option>
                        <option value="3">选项三</option>
                    </select>
                </div>
            </div>
            
            <!-- 表格组件 -->
            <div class="component-section">
                <h3 class="section-title">表格组件</h3>
                <table class="file-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>名称</th>
                            <th>状态</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>1</td>
                            <td>示例文件1.txt</td>
                            <td>正常</td>
                            <td>
                                <button class="btn btn-primary" style="padding: 4px 8px; font-size: 12px;">编辑</button>
                                <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;">删除</button>
                            </td>
                        </tr>
                        <tr>
                            <td>2</td>
                            <td>示例文件2.pdf</td>
                            <td>正常</td>
                            <td>
                                <button class="btn btn-primary" style="padding: 4px 8px; font-size: 12px;">编辑</button>
                                <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;">删除</button>
                            </td>
                        </tr>
                        <tr>
                            <td>3</td>
                            <td>示例文件3.jpg</td>
                            <td>已锁定</td>
                            <td>
                                <button class="btn btn-primary" style="padding: 4px 8px; font-size: 12px;">编辑</button>
                                <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;">删除</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <!-- 卡片组件 -->
            <div class="component-section">
                <h3 class="section-title">卡片组件</h3>
                <div class="cards-container">
                    <div class="card">
                        <div class="card-header">系统信息</div>
                        <div class="card-body">
                            PHP版本: 7.3.4<br>
                            服务器时间: <?php echo date('Y-m-d H:i:s'); ?>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header">文件统计</div>
                        <div class="card-body">
                            总文件数: 1,254<br>
                            今日新增: 23
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header">用户统计</div>
                        <div class="card-body">
                            总用户数: 368<br>
                            在线用户: 12
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 提示框组件 -->
            <div class="component-section">
                <h3 class="section-title">提示框组件</h3>
                <div class="alerts">
                    <div class="alert alert-success">
                        <strong>成功!</strong> 操作已完成
                    </div>
                    <div class="alert alert-danger">
                        <strong>错误!</strong> 操作失败，请重试
                    </div>
                    <div class="alert alert-warning">
                        <strong>警告!</strong> 请注意此操作的风险
                    </div>
                    <div class="alert alert-info">
                        <strong>信息!</strong> 这是一条提示信息
                    </div>
                </div>
            </div>
            
            <!-- 徽章和工具提示 -->
            <div class="component-section">
                <h3 class="section-title">徽章和工具提示</h3>
                <div style="margin-bottom: 20px;">
                    <span class="badge badge-primary">新</span>
                    <span class="badge badge-success">成功</span>
                    <span class="badge badge-danger">紧急</span>
                </div>
                <div>
                    <span class="tooltip">
                        鼠标悬停查看提示
                        <span class="tooltiptext">这是一个工具提示</span>
                    </span>
                </div>
            </div>
            
            <!-- 浏览器组件 -->
            <div class="component-section">
                <h3 class="section-title">浏览器组件</h3>
                <div class="browser-container-preview">
                    <!-- 浏览器控制栏 -->
                    <div class="browser-controls">
                        <div class="tabs">
                            <div class="tab active">
                                服务器环境
                                <span class="tab-close">&times;</span>
                            </div>
                            <div class="tab">
                                文件管理
                                <span class="tab-close">&times;</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- iframe容器 -->
                    <div class="iframe-container-preview">
                        <div class="iframe-placeholder">
                            <div class="preview-text">
                                <i class="fa fa-file-text-o"></i>
                                <p>页面内容预览区域</p>
                                <p class="small-text">这是一个iframe容器的预览效果</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 选择夹组件 -->
            <div class="component-section">
                <h3 class="section-title">选择夹组件</h3>
                <div class="file-stats" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div class="stat-group" style="display: flex; gap: 30px;">
                        <div class="stat-item">
                            总文件数: <span class="stat-number">15</span>
                        </div>
                        <div class="stat-item">
                            总分类数: <span class="stat-number">5</span>
                        </div>
                        <div class="stat-item">
                            当前显示: <span class="stat-number">3</span> 个文件
                        </div>
                    </div>
                    <a href="#" class="btn btn-primary" style="height: 40px; width: 100px; display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <i class="fa fa-sign-in"></i> 登录后台
                    </a>
                </div>
                
                <div class="category-tabs">
                    <a href="#">
                        <button class="category-tab active">工具</button>
                    </a>
                    <a href="#">
                        <button class="category-tab">资料</button>
                    </a>
                    <a href="#">
                        <button class="category-tab">软件</button>
                    </a>
                    <a href="#">
                        <button class="category-tab">文档</button>
                    </a>
                    <a href="#">
                        <button class="category-tab">图片</button>
                    </a>
                </div>
            </div>
            
            <!-- 样式定义 -->
            <style>
                    .browser-container-preview {
                        border: 1px solid var(--border-color, #e0e0e0);
                        border-radius: 6px;
                        overflow: hidden;
                        margin-bottom: 20px;
                    }
                    
                    .iframe-container-preview {
                        height: 300px;
                        background-color: var(--bg-tertiary, #fff);
                        position: relative;
                    }
                    
                    .iframe-placeholder {
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background-color: var(--bg-secondary, #f8f9fa);
                    }
                    
                    .preview-text {
                        text-align: center;
                        color: var(--text-secondary, #6c757d);
                    }
                    
                    .preview-text i {
                        font-size: 48px;
                        margin-bottom: 15px;
                        opacity: 0.5;
                    }
                    
                    .small-text {
                        font-size: 0.9em;
                        margin-top: 5px;
                        opacity: 0.8;
                    }
                </style>
            </div>
            
            <!-- 分页组件 -->
            <div class="component-section">
                <h3 class="section-title">分页组件</h3>
                <nav class="pagination">
                    <span class="page-item"><a href="#" class="page-link">上一页</a></span>
                    <span class="page-item"><a href="#" class="page-link">1</a></span>
                    <span class="page-item"><a href="#" class="page-link active">2</a></span>
                    <span class="page-item"><a href="#" class="page-link">3</a></span>
                    <span class="page-item"><a href="#" class="page-link">...</a></span>
                    <span class="page-item"><a href="#" class="page-link">10</a></span>
                    <span class="page-item"><a href="#" class="page-link">下一页</a></span>
                </nav>
            </div>

            <!-- 标签页组件 -->
            <div class="component-section">
                <h3 class="section-title">标签页组件</h3>
                <div class="tabs-container">
                    <div class="tabs-header">
                        <div class="tab active">标签一</div>
                        <div class="tab">标签二</div>
                        <div class="tab">标签三</div>
                    </div>
                    <div class="tabs-content">
                        <div class="tab-pane active">标签一的内容区域</div>
                    </div>
                </div>
                <style>
                    .tabs-container {
                        border: 1px solid var(--color-border-tab, #ddd);
                        border-radius: 4px;
                        overflow: hidden;
                        margin-bottom: 20px;
                    }
                    .tabs-header {
                        display: flex;
                        background: var(--color-bg-tab, #f8f9fa);
                        border-bottom: 1px solid var(--color-border-tab, #ddd);
                    }
                    .tab {
                        padding: 10px 20px;
                        cursor: pointer;
                        border-right: 1px solid var(--color-border-tab, #ddd);
                        color: var(--color-text-tab, #333);
                        transition: all 0.3s ease;
                    }
                    .tab:last-child {
                        border-right: none;
                    }
                    .tab.active {
                        background: var(--color-bg-tab-active, #fff);
                        color: var(--color-text-tab-active, var(--color-primary, #007bff));
                        border-bottom: 2px solid var(--color-border-tab-active, var(--color-primary, #007bff));
                        margin-bottom: -1px;
                    }
                    .tabs-content {
                        padding: 20px;
                        background: var(--color-bg-tab-active, #fff);
                    }
                    .tab-pane {
                        display: none;
                    }
                    .tab-pane.active {
                        display: block;
                    }
                </style>
            </div>

            <!-- 弹窗/模态框组件 -->
            <div class="component-section">
                <h3 class="section-title">弹窗/模态框组件</h3>
                <button class="btn btn-primary" onclick="document.getElementById('modal-demo').style.display = 'block'">打开弹窗</button>
                
                <div class="modal" id="modal-demo" style="display: none;">
                    <div class="modal-mask"></div>
                    <div class="modal-container">
                        <div class="modal-header">
                            <h4>弹窗标题</h4>
                            <button class="modal-close" onclick="document.getElementById('modal-demo').style.display = 'none'">&times;</button>
                        </div>
                        <div class="modal-body">
                            <p>这是弹窗的内容区域。</p>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" onclick="document.getElementById('modal-demo').style.display = 'none'">取消</button>
                            <button class="btn btn-primary" onclick="document.getElementById('modal-demo').style.display = 'none'">确认</button>
                        </div>
                    </div>
                </div>
                <style>
                    .modal {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        z-index: 1000;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .modal-mask {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: var(--color-bg-modal-mask, rgba(0, 0, 0, 0.7));
                        backdrop-filter: blur(5px);
                    }
                    .modal-container {
                        position: relative;
                        background: var(--color-bg-modal, #fff);
                        border: 2px solid var(--color-border-modal, #333);
                        border-radius: 4px;
                        width: 500px;
                        max-width: 90%;
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                        overflow: hidden;
                    }
                    .modal-container::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 6px;
                        background: var(--color-ink-wash, #333);
                        opacity: 0.8;
                    }
                    .modal-header {
                        padding: 20px;
                        border-bottom: 1px solid var(--color-border-modal, #333);
                        background: var(--color-bg-modal-header, #f9f7f2);
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        position: relative;
                    }
                    .modal-header::after {
                        content: '';
                        position: absolute;
                        bottom: 0;
                        left: 20px;
                        right: 20px;
                        height: 1px;
                        background: linear-gradient(to right, transparent, var(--color-ink-light, #666), transparent);
                    }
                    .modal-header h4 {
                        margin: 0;
                        color: var(--color-text-primary, #333);
                        font-weight: 600;
                        font-family: 'KaiTi', 'STKaiti', serif;
                    }
                    .modal-close {
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: var(--color-text-secondary, #666);
                        width: 32px;
                        height: 32px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 50%;
                        transition: all 0.3s ease;
                    }
                    .modal-close:hover {
                        background: var(--color-bg-hover, rgba(0, 0, 0, 0.1));
                        transform: rotate(90deg);
                    }
                    .modal-body {
                        padding: 25px 20px;
                        background: var(--color-bg-modal, #fff);
                        position: relative;
                    }
                    .modal-body::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 20px;
                        width: 40px;
                        height: 2px;
                        background: var(--color-ink-light, #666);
                        opacity: 0.6;
                    }
                    .modal-footer {
                        padding: 20px;
                        border-top: 1px solid var(--color-border-modal, #333);
                        background: var(--color-bg-modal-footer, #f9f7f2);
                        display: flex;
                        justify-content: flex-end;
                        gap: 15px;
                        position: relative;
                    }
                    .modal-footer::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 20px;
                        right: 20px;
                        height: 1px;
                        background: linear-gradient(to right, transparent, var(--color-ink-light, #666), transparent);
                    }
                </style>
            </div>

            <!-- 进度条/滑块组件 -->
            <div class="component-section">
                <h3 class="section-title">进度条/滑块组件</h3>
                
                <!-- 进度条 -->
                <div class="progress-container">
                    <div class="progress-label">默认进度条</div>
                    <div class="progress">
                        <div class="progress-bar" style="width: 60%;"></div>
                    </div>
                </div>
                
                <div class="progress-container">
                    <div class="progress-label">带百分比的进度条</div>
                    <div class="progress">
                        <div class="progress-bar" style="width: 75%;">75%</div>
                    </div>
                </div>
                
                <!-- 滑块 -->
                <div class="slider-container">
                    <div class="slider-label">滑块示例</div>
                    <input type="range" class="slider" min="0" max="100" value="50">
                </div>
                
                <style>
                    .progress-container {
                        margin-bottom: 20px;
                    }
                    .progress-label {
                        margin-bottom: 8px;
                        color: var(--color-text-primary, #333);
                        font-weight: 500;
                        font-family: 'KaiTi', 'STKaiti', serif;
                    }
                    .progress {
                        height: 24px;
                        background: var(--color-progress-track, #f5f5f0);
                        border-radius: 12px;
                        overflow: hidden;
                        position: relative;
                        border: 1px solid var(--color-border-light, #e0e0e0);
                        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
                    }
                    .progress::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: url("data:image/svg+xml,%3Csvg width='100' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper'%3E%3CfeTurbulence baseFrequency='0.04' numOctaves='5' result='noise' /%3E%3CfeDiffuseLighting in='noise' lighting-color='white' surfaceScale='1'/%3E%3CfeComposite operator='multiply' in2='SourceGraphic'/%3E%3C/filter%3E%3Crect width='100' height='20' filter='url(%23paper)' opacity='0.4'/%3E%3C/svg%3E");
                        opacity: 0.4;
                        pointer-events: none;
                    }
                    .progress-bar {
                        height: 100%;
                        background: linear-gradient(to right, var(--color-ink-wash, #333), var(--color-ink-medium, #555));
                        color: white;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 12px;
                        font-weight: 500;
                        position: relative;
                        overflow: hidden;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                    }
                    .progress-bar::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: -100%;
                        width: 100%;
                        height: 100%;
                        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                        animation: ink-flow 2s infinite;
                    }
                    @keyframes ink-flow {
                        0% { left: -100%; }
                        100% { left: 100%; }
                    }
                    .slider-container {
                        margin-top: 25px;
                    }
                    .slider-label {
                        margin-bottom: 12px;
                        color: var(--color-text-primary, #333);
                        font-weight: 500;
                        font-family: 'KaiTi', 'STKaiti', serif;
                    }
                    .slider {
                        width: 100%;
                        height: 10px;
                        border-radius: 5px;
                        background: var(--color-slider-track, #f5f5f0);
                        outline: none;
                        -webkit-appearance: none;
                        appearance: none;
                        border: 1px solid var(--color-border-light, #e0e0e0);
                        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
                    }
                    .slider::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: url("data:image/svg+xml,%3Csvg width='100' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper'%3E%3CfeTurbulence baseFrequency='0.04' numOctaves='5' result='noise' /%3E%3CfeDiffuseLighting in='noise' lighting-color='white' surfaceScale='1'/%3E%3CfeComposite operator='multiply' in2='SourceGraphic'/%3E%3Cfilter%3E%3Crect width='100' height='20' filter='url(%23paper)' opacity='0.4'/%3E%3C/svg%3E");
                        opacity: 0.4;
                        pointer-events: none;
                    }
                    .slider::-webkit-slider-thumb {
                        -webkit-appearance: none;
                        appearance: none;
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        background: var(--color-ink-wash, #333);
                        cursor: pointer;
                        border: 2px solid #fff;
                        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
                        position: relative;
                        transition: all 0.3s ease;
                    }
                    .slider::-webkit-slider-thumb:hover {
                        transform: scale(1.1);
                        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
                    }
                    .slider::-webkit-slider-thumb::after {
                        content: '';
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background: #fff;
                    }
                    .slider::-moz-range-thumb {
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        background: var(--color-ink-wash, #333);
                        cursor: pointer;
                        border: 2px solid #fff;
                        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
                        position: relative;
                        transition: all 0.3s ease;
                    }
                    .slider::-moz-range-thumb:hover {
                        transform: scale(1.1);
                        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
                    }
                    .slider::-moz-range-thumb::after {
                        content: '';
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background: #fff;
                    }
                </style>
            </div>

            <!-- 下拉菜单组件 -->
            <div class="component-section">
                <h3 class="section-title">下拉菜单组件</h3>
                <div class="dropdown">
                    <button class="btn btn-primary dropdown-toggle">下拉菜单</button>
                    <div class="dropdown-menu">
                        <a href="#" class="dropdown-item">菜单项一</a>
                        <a href="#" class="dropdown-item">菜单项二</a>
                        <a href="#" class="dropdown-item">菜单项三</a>
                        <div class="dropdown-divider"></div>
                        <a href="#" class="dropdown-item">分隔后的菜单项</a>
                    </div>
                </div>
                <style>
                    .dropdown {
                        position: relative;
                        display: inline-block;
                    }
                    .dropdown-toggle {
                        padding-right: 35px;
                        position: relative;
                        font-family: 'KaiTi', 'STKaiti', serif;
                        font-weight: 500;
                        background: linear-gradient(to bottom, var(--color-bg-primary, #f9f7f2), var(--color-bg-secondary, #f5f5f0));
                        border: 1px solid var(--color-border-primary, #333);
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                        position: relative;
                        overflow: hidden;
                    }
                    .dropdown-toggle::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 3px;
                        background: linear-gradient(to right, var(--color-ink-wash, #333), var(--color-ink-medium, #666));
                        opacity: 0.8;
                    }
                    .dropdown-toggle::after {
                        content: '▼';
                        position: absolute;
                        right: 12px;
                        top: 50%;
                        transform: translateY(-50%);
                        font-size: 12px;
                        color: var(--color-ink-medium, #555);
                    }
                    .dropdown-menu {
                        display: none;
                        position: absolute;
                        top: calc(100% + 8px);
                        left: 0;
                        min-width: 180px;
                        background: linear-gradient(to bottom, var(--color-bg-dropdown, #fff), var(--color-bg-secondary, #f9f7f2));
                        border: 1px solid var(--color-border-dropdown, #333);
                        border-radius: 4px;
                        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
                        z-index: 100;
                        overflow: hidden;
                    }
                    .dropdown-menu::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 4px;
                        background: linear-gradient(to right, var(--color-ink-wash, #333), var(--color-ink-medium, #666));
                        opacity: 0.8;
                    }
                    .dropdown-menu::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper-texture'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5' result='noise' /%3E%3CfeDiffuseLighting in='noise' lighting-color='white' surfaceScale='1'/%3E%3CfeComposite operator='multiply' in2='SourceGraphic'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23paper-texture)' opacity='0.15'/%3E%3C/svg%3E");
                        opacity: 0.15;
                        pointer-events: none;
                    }
                    .dropdown:hover .dropdown-menu {
                        display: block;
                        animation: dropdown-fade-in 0.3s ease;
                    }
                    @keyframes dropdown-fade-in {
                        from {
                            opacity: 0;
                            transform: translateY(-10px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    .dropdown-item {
                        display: block;
                        padding: 12px 18px;
                        color: var(--color-text-dropdown, #333);
                        text-decoration: none;
                        border: none;
                        background: none;
                        width: 100%;
                        text-align: left;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        position: relative;
                        font-family: 'KaiTi', 'STKaiti', serif;
                        font-size: 15px;
                    }
                    .dropdown-item::before {
                        content: '';
                        position: absolute;
                        left: 0;
                        top: 0;
                        bottom: 0;
                        width: 0;
                        background: linear-gradient(to bottom, var(--color-ink-wash, #333), var(--color-ink-medium, #666));
                        transition: width 0.2s ease;
                    }
                    .dropdown-item:hover {
                        background: var(--color-bg-dropdown-hover, #f5f5f0);
                        padding-left: 22px;
                    }
                    .dropdown-item:hover::before {
                        width: 4px;
                    }
                    .dropdown-divider {
                        height: 1px;
                        background: linear-gradient(to right, transparent, var(--color-ink-light, #666), transparent);
                        margin: 8px 0;
                        position: relative;
                    }
                    .dropdown-divider::after {
                        content: '·';
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        background: var(--color-bg-dropdown, #fff);
                        padding: 0 8px;
                        color: var(--color-ink-light, #666);
                    }
                </style>
            </div>

            <!-- 骨架屏组件 -->
            <div class="component-section">
                <h3 class="section-title">骨架屏组件</h3>
                <div class="skeleton-card">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-content"></div>
                    <div class="skeleton skeleton-content"></div>
                    <div class="skeleton skeleton-content short"></div>
                </div>
                <style>
                    .skeleton-card {
                        padding: var(--spacing-lg, 20px);
                        border: 1px solid var(--color-border-card, #333);
                        border-radius: 4px;
                        background: linear-gradient(to bottom, var(--color-bg-secondary, #f9f7f2), var(--color-bg-primary, #f5f5f0));
                        position: relative;
                        overflow: hidden;
                    }
                    .skeleton-card::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 3px;
                        background: linear-gradient(to right, var(--color-ink-wash, #333), var(--color-ink-medium, #666));
                        opacity: 0.8;
                    }
                    .skeleton-card::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper-texture'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5' result='noise' /%3E%3CfeDiffuseLighting in='noise' lighting-color='white' surfaceScale='1'/%3E%3CfeComposite operator='multiply' in2='SourceGraphic'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23paper-texture)' opacity='0.15'/%3E%3C/svg%3E");
                        opacity: 0.15;
                        pointer-events: none;
                    }
                    .skeleton {
                        background: linear-gradient(90deg, var(--color-bg-skeleton, #e0e0e0) 25%, var(--color-bg-skeleton-highlight, #f0f0f0) 50%, var(--color-bg-skeleton, #e0e0e0) 75%);
                        background-size: 200% 100%;
                        animation: skeleton-loading 1.5s infinite;
                        border-radius: var(--radius-sm, 4px);
                        margin-bottom: var(--spacing-sm, 10px);
                        position: relative;
                        overflow: hidden;
                    }
                    .skeleton::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.1), transparent);
                        animation: ink-shimmer 2s infinite;
                    }
                    @keyframes ink-shimmer {
                        0% { transform: translateX(-100%); }
                        100% { transform: translateX(100%); }
                    }
                    .skeleton-title {
                        height: 20px;
                        width: 60%;
                    }
                    .skeleton-content {
                        height: 16px;
                        width: 100%;
                    }
                    .skeleton-content.short {
                        width: 70%;
                    }
                    @keyframes skeleton-loading {
                        0% {
                            background-position: 200% 0;
                        }
                        100% {
                            background-position: -200% 0;
                        }
                    }
                </style>
            </div>

            <!-- 加载动画组件 -->
            <div class="component-section">
                <h3 class="section-title">加载动画组件</h3>
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">加载中...</div>
                </div>
                <style>
                    .loading-container {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        padding: var(--spacing-xl, 40px);
                        background: linear-gradient(to bottom, var(--color-bg-secondary, #f9f7f2), var(--color-bg-primary, #f5f5f0));
                        border-radius: var(--radius-sm, 4px);
                        position: relative;
                        overflow: hidden;
                        border: 1px solid var(--color-border-primary, #333);
                    }
                    .loading-container::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 3px;
                        background: linear-gradient(to right, var(--color-ink-wash, #333), var(--color-ink-medium, #666));
                        opacity: 0.8;
                    }
                    .loading-container::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper-texture'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5' result='noise' /%3E%3CfeDiffuseLighting in='noise' lighting-color='white' surfaceScale='1'/%3E%3CfeComposite operator='multiply' in2='SourceGraphic'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23paper-texture)' opacity='0.15'/%3E%3C/svg%3E");
                        opacity: 0.15;
                        pointer-events: none;
                    }
                    .loading-spinner {
                        width: 50px;
                        height: 50px;
                        border: 3px solid transparent;
                        border-top: 3px solid var(--color-ink-wash, #333);
                        border-radius: 50%;
                        animation: spin 1.2s linear infinite;
                        margin-bottom: var(--spacing-md, 15px);
                        position: relative;
                    }
                    .loading-spinner::before, .loading-spinner::after {
                        content: '';
                        position: absolute;
                        border-radius: 50%;
                        border: 2px solid transparent;
                    }
                    .loading-spinner::before {
                        top: -5px;
                        left: -5px;
                        right: -5px;
                        bottom: -5px;
                        border-top-color: var(--color-ink-light, #666);
                        animation: spin 1.5s linear infinite reverse;
                    }
                    .loading-spinner::after {
                        top: -10px;
                        left: -10px;
                        right: -10px;
                        bottom: -10px;
                        border-top-color: var(--color-ink-medium, #999);
                        animation: spin 2s linear infinite;
                    }
                    .loading-text {
                        color: var(--color-text-secondary, #666);
                        font-family: 'KaiTi', 'STKaiti', serif;
                        font-size: 16px;
                        position: relative;
                    }
                    .loading-text::after {
                        content: '';
                        display: inline-block;
                        width: 15px;
                        height: 2px;
                        background: var(--color-ink-wash, #333);
                        margin-left: 5px;
                        vertical-align: middle;
                        animation: loading-dots 1.5s infinite;
                    }
                    @keyframes loading-dots {
                        0%, 20% { width: 0; opacity: 0; }
                        40% { width: 5px; opacity: 1; }
                        60% { width: 10px; opacity: 1; }
                        80%, 100% { width: 15px; opacity: 0; }
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </div>

            <!-- 系统信息标签页组件 -->
            <div class="component-section">
                <h3 class="section-title">系统信息标签页组件</h3>
                <div class="tabs">
                    <button class="tab-btn active" data-tab="tab1">标签页一</button>
                    <button class="tab-btn" data-tab="tab2">标签页二</button>
                    <button class="tab-btn" data-tab="tab3">标签页三</button>
                </div>
                <div id="tab1" class="tab-content active">
                    <div class="info-card">
                        <h2><i class="fa fa-info-circle"></i> 信息卡片示例</h2>
                        <table class="info-table">
                            <tr>
                                <td>项目名称</td>
                                <td>示例项目</td>
                            </tr>
                            <tr>
                                <td>状态</td>
                                <td><span class="status-badge success">已启用</span></td>
                            </tr>
                            <tr>
                                <td>版本</td>
                                <td>1.0.0 <span class="status-badge warning">测试版</span></td>
                            </tr>
                        </table>
                    </div>
                    <div class="info-card">
                        <h2><i class="fa fa-pie-chart"></i> 使用率统计</h2>
                        <table class="info-table">
                            <tr>
                                <td>资源使用率</td>
                                <td>75%</td>
                            </tr>
                        </table>
                        <div style="margin-top: 15px;">
                            <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px;">
                                <span>资源使用进度</span>
                                <span>75%</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: 75%"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="tab2" class="tab-content">
                    <div class="info-card">
                        <h2><i class="fa fa-puzzle-piece"></i> 扩展模块示例</h2>
                        <div class="extensions-list">
                            <span class="extension-item">扩展1</span>
                            <span class="extension-item">扩展2</span>
                            <span class="extension-item">扩展3</span>
                            <span class="extension-item">扩展4</span>
                            <span class="extension-item">扩展5</span>
                        </div>
                    </div>
                </div>
                <div id="tab3" class="tab-content">
                    <div class="info-card">
                        <h2><i class="fa fa-exclamation-triangle"></i> 高亮提示示例</h2>
                        <p>这是一个<span class="highlight">需要注意的高亮内容</span>示例。</p>
                    </div>
                </div>
                <style>
                    /* 标签页导航 */
                    .tabs {
                        display: flex;
                        flex-wrap: wrap;
                        margin-bottom: 20px;
                        border-bottom: 2px solid var(--color-ink-wash, #333);
                        position: relative;
                    }
                    
                    .tabs::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper-texture'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5' result='noise' /%3E%3CfeDiffuseLighting in='noise' lighting-color='white' surfaceScale='1'/%3E%3CfeComposite operator='multiply' in2='SourceGraphic'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23paper-texture)' opacity='0.15'/%3E%3C/svg%3E");
                        opacity: 0.1;
                        pointer-events: none;
                    }
                    
                    .tab-btn {
                        padding: 12px 24px;
                        background: none;
                        border: none;
                        font-size: 16px;
                        font-weight: 500;
                        font-family: 'KaiTi', 'STKaiti', serif;
                        color: var(--color-text-tab, #666);
                        cursor: pointer;
                        transition: all var(--color-transition-normal, 0.3s) ease;
                        position: relative;
                        border-bottom: 3px solid transparent;
                        z-index: 2;
                    }
                    
                    .tab-btn:hover {
                        color: var(--color-ink-wash, #333);
                        background: rgba(0, 0, 0, 0.05);
                    }
                    
                    .tab-btn.active {
                        color: var(--color-ink-wash, #333);
                        border-bottom-color: var(--color-ink-wash, #333);
                        background: rgba(0, 0, 0, 0.08);
                    }
                    
                    .tab-btn.active::after {
                        content: '';
                        position: absolute;
                        bottom: -2px;
                        left: 0;
                        width: 100%;
                        height: 2px;
                        background: var(--color-ink-wash, #333);
                    }
                    
                    /* 标签页内容 */
                    .tab-content {
                        display: none;
                        animation: fadeIn 0.3s ease-in-out;
                        position: relative;
                        z-index: 2;
                    }
                    
                    .tab-content.active {
                        display: block;
                    }
                    
                    @keyframes fadeIn {
                        from {
                            opacity: 0;
                            transform: translateY(10px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    
                    /* 信息卡片 */
                    .info-card {
                        background: var(--color-bg-card, #f9f7f2);
                        border-radius: var(--color-radius-md, 4px);
                        padding: 24px;
                        margin-bottom: 20px;
                        border: 1px solid var(--color-border-card, #333);
                        transition: transform var(--color-transition-fast, 0.2s) ease, box-shadow var(--color-transition-fast, 0.2s) ease;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .info-card::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper-texture'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5' result='noise' /%3E%3CfeDiffuseLighting in='noise' lighting-color='white' surfaceScale='1'/%3E%3CfeComposite operator='multiply' in2='SourceGraphic'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23paper-texture)' opacity='0.15'/%3E%3C/svg%3E");
                        opacity: 0.15;
                        pointer-events: none;
                    }
                    
                    .info-card:hover {
                        transform: translateY(-2px);
                        box-shadow: var(--color-shadow-md, 0 4px 12px rgba(0, 0, 0, 0.15));
                    }
                    
                    .info-card h2 {
                        font-size: 1.4em;
                        margin-bottom: 20px;
                        color: var(--color-text-heading, #333);
                        border-left: 4px solid var(--color-ink-wash, #333);
                        padding-left: 15px;
                        display: flex;
                        align-items: center;
                        font-family: 'KaiTi', 'STKaiti', serif;
                        position: relative;
                        z-index: 2;
                    }
                    
                    .info-card h2 i {
                        margin-right: 10px;
                        color: var(--color-ink-wash, #333);
                    }
                    
                    /* 信息表格 */
                    .info-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 15px;
                        position: relative;
                        z-index: 2;
                    }
                    
                    .info-table tr {
                        border-bottom: 1px solid var(--color-border-table, #ddd);
                    }
                    
                    .info-table tr:last-child {
                        border-bottom: none;
                    }
                    
                    .info-table td {
                        padding: 12px 0;
                        vertical-align: top;
                    }
                    
                    .info-table td:first-child {
                        width: 30%;
                        font-weight: 500;
                        color: var(--color-text-secondary, #666);
                        padding-right: 20px;
                    }
                    
                    .info-table td:last-child {
                        width: 70%;
                        color: var(--color-text-primary, #333);
                    }
                    
                    /* 状态标签 */
                    .status-badge {
                        display: inline-block;
                        padding: 4px 12px;
                        border-radius: var(--color-radius-sm, 4px);
                        font-size: 12px;
                        font-weight: 500;
                        font-family: 'KaiTi', 'STKaiti', serif;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .status-badge::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper-texture'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5' result='noise' /%3E%3CfeDiffuseLighting in='noise' lighting-color='white' surfaceScale='1'/%3E%3CfeComposite operator='multiply' in2='SourceGraphic'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23paper-texture)' opacity='0.15'/%3E%3C/svg%3E");
                        opacity: 0.2;
                        pointer-events: none;
                    }
                    
                    .status-badge.success {
                        background-color: var(--color-bg-success, #f0f9e8);
                        color: var(--color-text-success, #2d5016);
                        border: 1px solid var(--color-border-success, #8fb866);
                    }
                    
                    .status-badge.danger {
                        background-color: var(--color-bg-danger, #f9e8e8);
                        color: var(--color-text-danger, #8b0000);
                        border: 1px solid var(--color-border-danger, #d9a5a5);
                    }
                    
                    .status-badge.warning {
                        background-color: var(--color-bg-warning, #f9f4e8);
                        color: var(--color-text-warning, #8b6914);
                        border: 1px solid var(--color-border-warning, #d9c17a);
                    }
                    
                    /* 扩展列表 */
                    .extensions-list {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 10px;
                        margin-top: 15px;
                    }
                    
                    .extension-item {
                        background: var(--color-bg-extension, #f9f7f2);
                        padding: 8px 16px;
                        border-radius: var(--color-radius-sm, 4px);
                        font-size: 14px;
                        font-family: 'KaiTi', 'STKaiti', serif;
                        border: 1px solid var(--color-border-extension, #ccc);
                        transition: all var(--color-transition-fast, 0.2s) ease;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .extension-item::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper-texture'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5' result='noise' /%3E%3CfeDiffuseLighting in='noise' lighting-color='white' surfaceScale='1'/%3E%3CfeComposite operator='multiply' in2='SourceGraphic'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23paper-texture)' opacity='0.15'/%3E%3C/svg%3E");
                        opacity: 0.15;
                        pointer-events: none;
                    }
                    
                    .extension-item:hover {
                        background: var(--color-bg-extension-hover, #f0e6d2);
                        border-color: var(--color-ink-wash, #333);
                        color: var(--color-ink-wash, #333);
                        transform: translateY(-2px);
                    }
                    
                    /* 进度条 */
                    .progress-bar {
                        width: 100%;
                        height: 8px;
                        background: var(--color-bg-progress-track, #e8e8e8);
                        border-radius: var(--color-radius-sm, 4px);
                        overflow: hidden;
                        margin-top: 5px;
                        position: relative;
                    }
                    
                    .progress-bar::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper-texture'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5' result='noise' /%3E%3CfeDiffuseLighting in='noise' lighting-color='white' surfaceScale='1'/%3E%3CfeComposite operator='multiply' in2='SourceGraphic'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23paper-texture)' opacity='0.15'/%3E%3C/svg%3E");
                        opacity: 0.2;
                        pointer-events: none;
                    }
                    
                    .progress-fill {
                        height: 100%;
                        background: linear-gradient(90deg, var(--color-ink-wash, #333), var(--color-ink-medium, #666));
                        border-radius: var(--color-radius-sm, 4px);
                        transition: width var(--color-transition-normal, 0.3s) ease;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .progress-fill::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                        animation: ink-shimmer 2s infinite;
                    }
                    
                    @keyframes ink-shimmer {
                        0% { transform: translateX(-100%); }
                        100% { transform: translateX(100%); }
                    }
                    
                    /* 高亮效果 */
                    .highlight {
                        animation: pulse 2s infinite;
                        color: var(--color-ink-wash, #333);
                        font-weight: 500;
                        position: relative;
                        display: inline-block;
                    }
                    
                    .highlight::after {
                        content: '';
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        width: 100%;
                        height: 3px;
                        background: var(--color-ink-wash, #333);
                        border-radius: 2px;
                    }
                    
                    @keyframes pulse {
                        0% {
                            transform: scale(1);
                        }
                        50% {
                            transform: scale(1.05);
                        }
                        100% {
                            transform: scale(1);
                        }
                    }
                </style>
            </div>

                <!-- 通知组件 -->
            <div class="component-section">
                <h3 class="section-title">通知组件</h3>
                <button class="btn btn-primary" onclick="showNotification()">显示通知</button>
                <div id="notification-container" style="position: fixed; top: 20px; right: 20px; z-index: 2000;"></div>
                <script>
                    function showNotification() {
                        const container = document.getElementById('notification-container');
                        const notification = document.createElement('div');
                        notification.className = 'notification';
                        notification.innerHTML = `
                            <div class="notification-content">
                                <strong>通知标题</strong>
                                <p>这是一条通知消息</p>
                            </div>
                            <button class="notification-close">&times;</button>
                        `;
                        container.appendChild(notification);
                        
                        // 3秒后自动关闭
                        setTimeout(() => {
                            notification.style.opacity = '0';
                            setTimeout(() => {
                                container.removeChild(notification);
                            }, 300);
                        }, 3000);
                        
                        // 点击关闭按钮
                        notification.querySelector('.notification-close').onclick = () => {
                            notification.style.opacity = '0';
                            setTimeout(() => {
                                container.removeChild(notification);
                            }, 300);
                        };
                    }
                </script>
                <style>
                    .notification {
                        background: var(--color-bg-notification, #fff);
                        background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper-texture'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5' result='noise' /%3E%3CfeDiffuseLighting in='noise' lighting-color='white' surfaceScale='1'/%3E%3CfeComposite operator='multiply' in2='SourceGraphic'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23paper-texture)' opacity='0.15'/%3E%3C/svg%3E");
                        border: 2px solid var(--color-ink-light, #999);
                        border-radius: var(--color-radius-md, 6px);
                        padding: var(--spacing-md, 18px);
                        margin-bottom: var(--spacing-sm, 12px);
                        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        min-width: 320px;
                        transition: opacity var(--color-transition-normal, 0.3s) ease, transform var(--color-transition-normal, 0.3s) ease;
                        position: relative;
                        overflow: hidden;
                        font-family: 'KaiTi', 'STKaiti', serif;
                    }
                    
                    /* 墨水晕染效果 */
                    .notification::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 5px;
                        background: linear-gradient(90deg, var(--color-ink-wash, #333), transparent);
                        opacity: 0.7;
                    }
                    
                    .notification:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
                    }
                    
                    .notification-content {
                        flex: 1;
                        position: relative;
                        z-index: 1;
                    }
                    
                    .notification-content strong {
                        color: var(--color-ink-wash, #333);
                        display: block;
                        margin-bottom: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        position: relative;
                    }
                    
                    .notification-content strong::after {
                        content: '';
                        position: absolute;
                        bottom: -2px;
                        left: 0;
                        width: 60px;
                        height: 2px;
                        background: var(--color-ink-wash, #333);
                        opacity: 0.6;
                    }
                    
                    .notification-content p {
                        margin: 0;
                        color: var(--color-ink-medium, #666);
                        font-size: 14px;
                        line-height: 1.6;
                    }
                    
                    .notification-close {
                        background: none;
                        border: none;
                        font-size: 22px;
                        cursor: pointer;
                        color: var(--color-ink-medium, #666);
                        margin-left: 15px;
                        padding: 0;
                        line-height: 1;
                        width: 24px;
                        height: 24px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 50%;
                        transition: all var(--color-transition-fast, 0.2s) ease;
                    }
                    
                    .notification-close:hover {
                        background-color: rgba(51, 51, 51, 0.1);
                        color: var(--color-ink-wash, #333);
                        transform: rotate(90deg);
                    }
                    
                    /* 不同类型的通知样式 */
                    .notification.success {
                        border-left: 5px solid var(--color-success, #4CAF50);
                    }
                    
                    .notification.warning {
                        border-left: 5px solid var(--color-warning, #FF9800);
                    }
                    
                    .notification.error {
                        border-left: 5px solid var(--color-error, #F44336);
                    }
                    
                    .notification.info {
                        border-left: 5px solid var(--color-info, #2196F3);
                    }
                </style>
            </div>

            <!-- 登录表单组件 -->
            <div class="component-section">
                <h3 class="section-title">登录表单组件</h3>
                <div class="login-container">
                    <div class="login-header">
                        <h2>管理员登录</h2>
                    </div>
                    <form class="login-form">
                        <div class="form-group">
                            <label for="username">用户名</label>
                            <input type="text" id="username" class="form-control" placeholder="请输入用户名">
                        </div>
                        <div class="form-group">
                            <label for="password">密码</label>
                            <input type="password" id="password" class="form-control" placeholder="请输入密码">
                        </div>
                        <div class="form-group">
                            <div class="checkbox-container">
                                <input type="checkbox" id="remember" class="form-check-input">
                                <label for="remember" class="form-check-label">记住我</label>
                            </div>
                        </div>
                        <div class="form-group">
                            <button type="submit" class="btn btn-primary btn-block">登录</button>
                        </div>
                    </form>
                </div>
                <style>
                    .login-container {
                        max-width: 400px;
                        margin: 0 auto;
                        background: var(--color-bg-card, #fff);
                        background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper-texture'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5' result='noise' /%3E%3CfeDiffuseLighting in='noise' lighting-color='white' surfaceScale='1'/%3E%3CfeComposite operator='multiply' in2='SourceGraphic'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23paper-texture)' opacity='0.15'/%3E%3C/svg%3E");
                        border-radius: var(--color-radius-md, 8px);
                        padding: 30px;
                        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
                        border: 2px solid var(--color-ink-light, #999);
                        position: relative;
                        overflow: hidden;
                        font-family: 'KaiTi', 'STKaiti', serif;
                    }
                    
                    /* 墨水晕染效果 */
                    .login-container::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 8px;
                        background: linear-gradient(90deg, var(--color-ink-wash, #333), transparent);
                        opacity: 0.7;
                    }
                    
                    .login-header {
                        text-align: center;
                        margin-bottom: 30px;
                        position: relative;
                    }
                    
                    .login-header h2 {
                        color: var(--color-ink-wash, #333);
                        font-weight: 600;
                        margin: 0;
                        font-size: 24px;
                        position: relative;
                        display: inline-block;
                    }
                    
                    .login-header h2::after {
                        content: '';
                        position: absolute;
                        bottom: -8px;
                        left: 50%;
                        transform: translateX(-50%);
                        width: 80px;
                        height: 2px;
                        background: var(--color-ink-wash, #333);
                        opacity: 0.6;
                    }
                    
                    .login-form .form-group {
                        margin-bottom: 25px;
                    }
                    
                    .login-form label {
                        display: block;
                        margin-bottom: 8px;
                        color: var(--color-ink-medium, #666);
                        font-weight: 500;
                        font-size: 16px;
                    }
                    
                    .login-form .form-control {
                        width: 100%;
                        padding: 14px 18px;
                        border: 2px solid var(--color-ink-light, #999);
                        border-radius: var(--color-radius-md, 6px);
                        font-size: 16px;
                        background: rgba(255, 255, 255, 0.7);
                        color: var(--color-ink-wash, #333);
                        transition: all var(--color-transition-normal, 0.3s) ease;
                        font-family: 'KaiTi', 'STKaiti', serif;
                    }
                    
                    .login-form .form-control:focus {
                        border-color: var(--color-ink-wash, #333);
                        box-shadow: 0 0 0 3px rgba(51, 51, 51, 0.1);
                        outline: none;
                        background: rgba(255, 255, 255, 0.9);
                    }
                    
                    .checkbox-container {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    
                    .form-check-input {
                        margin: 0;
                        width: 18px;
                        height: 18px;
                        cursor: pointer;
                    }
                    
                    .form-check-label {
                        margin: 0;
                        color: var(--color-ink-medium, #666);
                        font-weight: normal;
                        font-size: 15px;
                        cursor: pointer;
                    }
                    
                    .btn-block {
                        display: block;
                        width: 100%;
                        padding: 14px;
                        font-size: 16px;
                        font-weight: 500;
                        margin-top: 10px;
                        border-radius: var(--color-radius-md, 6px);
                        border: 2px solid var(--color-ink-wash, #333);
                        background: var(--color-ink-wash, #333);
                        color: var(--color-paper-white, #fff);
                        cursor: pointer;
                        transition: all var(--color-transition-normal, 0.3s) ease;
                        font-family: 'KaiTi', 'STKaiti', serif;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .btn-block::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: -100%;
                        width: 100%;
                        height: 100%;
                        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                        transition: left 0.5s;
                    }
                    
                    .btn-block:hover {
                        background: var(--color-ink-medium, #666);
                        transform: translateY(-2px);
                        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
                    }
                    
                    .btn-block:hover::before {
                        left: 100%;
                    }
                    
                    .btn-block:active {
                        transform: translateY(0);
                    }
                </style>
            </div>

            <!-- 文件上传组件 -->
            <div class="component-section">
                <h3 class="section-title">文件上传组件</h3>
                <div class="upload-container">
                    <div class="upload-area" id="upload-area">
                        <div class="upload-placeholder">
                            <i class="fa fa-cloud-upload"></i>
                            <p>拖放文件到此处或点击选择文件</p>
                            <p class="upload-hint">支持多文件上传，单个文件最大10MB</p>
                        </div>
                        <input type="file" id="file-input" class="file-input" multiple>
                    </div>
                    <div class="upload-options">
                        <div class="form-group">
                            <label for="upload-category">文件分类</label>
                            <select id="upload-category" class="form-control">
                                <option value="">请选择分类</option>
                                <option value="tools">工具</option>
                                <option value="documents">文档</option>
                                <option value="images">图片</option>
                                <option value="software">软件</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="upload-description">文件描述</label>
                            <textarea id="upload-description" class="form-control" rows="3" placeholder="请输入文件描述..."></textarea>
                        </div>
                    </div>
                    <div class="upload-progress" id="upload-progress" style="display: none;">
                        <div class="progress-label">上传进度</div>
                        <div class="progress">
                            <div class="progress-bar" id="progress-bar" style="width: 0%;">0%</div>
                        </div>
                    </div>
                    <div class="upload-list" id="upload-list">
                        <!-- 已上传文件列表 -->
                    </div>
                </div>
                <style>
                    .upload-container {
                        max-width: 600px;
                        margin: 0 auto;
                        font-family: 'KaiTi', 'STKaiti', serif;
                    }
                    
                    .upload-area {
                        border: 2px dashed var(--color-ink-light, #999);
                        border-radius: var(--color-radius-md, 8px);
                        padding: 40px 20px;
                        text-align: center;
                        cursor: pointer;
                        transition: all var(--color-transition-normal, 0.3s) ease;
                        position: relative;
                        background: var(--color-bg-upload-area, #f9f9f9);
                        background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper-texture'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5' result='noise' /%3E%3CfeDiffuseLighting in='noise' lighting-color='white' surfaceScale='1'/%3E%3CfeComposite operator='multiply' in2='SourceGraphic'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23paper-texture)' opacity='0.15'/%3E%3C/svg%3E");
                        overflow: hidden;
                    }
                    
                    /* 墨水晕染效果 */
                    .upload-area::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 6px;
                        background: linear-gradient(90deg, var(--color-ink-wash, #333), transparent);
                        opacity: 0.7;
                    }
                    
                    .upload-area:hover {
                        border-color: var(--color-ink-medium, #666);
                        background: rgba(255, 255, 255, 0.9);
                        transform: translateY(-2px);
                        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
                    }
                    
                    .upload-placeholder i {
                        font-size: 48px;
                        color: var(--color-ink-medium, #666);
                        margin-bottom: 15px;
                        display: block;
                    }
                    
                    .upload-placeholder p {
                        margin: 10px 0;
                        color: var(--color-ink-wash, #333);
                        font-size: 16px;
                    }
                    
                    .upload-hint {
                        font-size: 14px;
                        color: var(--color-ink-light, #999);
                    }
                    
                    .file-input {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        opacity: 0;
                        cursor: pointer;
                    }
                    
                    .upload-options {
                        margin-top: 25px;
                        background: rgba(255, 255, 255, 0.7);
                        background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper-texture'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5' result='noise' /%3E%3CfeDiffuseLighting in='noise' lighting-color='white' surfaceScale='1'/%3E%3CfeComposite operator='multiply' in2='SourceGraphic'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23paper-texture)' opacity='0.15'/%3E%3C/svg%3E");
                        border: 2px solid var(--color-ink-light, #999);
                        border-radius: var(--color-radius-md, 8px);
                        padding: 20px;
                    }
                    
                    .upload-options .form-group {
                        margin-bottom: 20px;
                    }
                    
                    .upload-options label {
                        display: block;
                        margin-bottom: 8px;
                        color: var(--color-ink-medium, #666);
                        font-weight: 500;
                        font-size: 16px;
                    }
                    
                    .upload-options .form-control {
                        width: 100%;
                        padding: 12px 15px;
                        border: 2px solid var(--color-ink-light, #999);
                        border-radius: var(--color-radius-md, 6px);
                        font-size: 15px;
                        background: rgba(255, 255, 255, 0.7);
                        color: var(--color-ink-wash, #333);
                        transition: all var(--color-transition-normal, 0.3s) ease;
                        font-family: 'KaiTi', 'STKaiti', serif;
                    }
                    
                    .upload-options .form-control:focus {
                        border-color: var(--color-ink-wash, #333);
                        box-shadow: 0 0 0 3px rgba(51, 51, 51, 0.1);
                        outline: none;
                        background: rgba(255, 255, 255, 0.9);
                    }
                    
                    .upload-progress {
                        margin-top: 20px;
                        padding: 15px;
                        background: rgba(255, 255, 255, 0.7);
                        background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper-texture'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5' result='noise' /%3E%3CfeDiffuseLighting in='noise' lighting-color='white' surfaceScale='1'/%3E%3CfeComposite operator='multiply' in2='SourceGraphic'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23paper-texture)' opacity='0.15'/%3E%3C/svg%3E");
                        border: 2px solid var(--color-ink-light, #999);
                        border-radius: var(--color-radius-md, 8px);
                    }
                    
                    .progress-label {
                        margin-bottom: 10px;
                        color: var(--color-ink-medium, #666);
                        font-weight: 500;
                    }
                    
                    .progress {
                        height: 10px;
                        background: var(--color-ink-light, #999);
                        border-radius: var(--color-radius-md, 5px);
                        overflow: hidden;
                        position: relative;
                    }
                    
                    .progress-bar {
                        height: 100%;
                        background: linear-gradient(90deg, var(--color-ink-wash, #333), var(--color-ink-medium, #666));
                        width: 0%;
                        transition: width 0.3s ease;
                        position: relative;
                    }
                    
                    .progress-bar::after {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                        animation: ink-shimmer 2s infinite;
                    }
                    
                    @keyframes ink-shimmer {
                        0% { transform: translateX(-100%); }
                        100% { transform: translateX(100%); }
                    }
                    
                    .upload-list {
                        margin-top: 20px;
                    }
                    
                    .upload-item {
                        display: flex;
                        align-items: center;
                        padding: 12px 15px;
                        background: rgba(255, 255, 255, 0.7);
                        background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper-texture'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5' result='noise' /%3E%3CfeDiffuseLighting in='noise' lighting-color='white' surfaceScale='1'/%3E%3CfeComposite operator='multiply' in2='SourceGraphic'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23paper-texture)' opacity='0.15'/%3E%3C/svg%3E");
                        border: 1px solid var(--color-ink-light, #999);
                        border-radius: var(--color-radius-md, 6px);
                        margin-bottom: 10px;
                        transition: all var(--color-transition-normal, 0.3s) ease;
                    }
                    
                    .upload-item:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
                    }
                    
                    .upload-item-info {
                        flex: 1;
                    }
                    
                    .upload-item-name {
                        color: var(--color-ink-wash, #333);
                        font-weight: 500;
                        margin-bottom: 5px;
                    }
                    
                    .upload-item-size {
                        color: var(--color-ink-light, #999);
                        font-size: 14px;
                    }
                    
                    .upload-item-remove {
                        background: none;
                        border: none;
                        color: var(--color-ink-medium, #666);
                        cursor: pointer;
                        padding: 5px;
                        border-radius: 50%;
                        transition: all var(--color-transition-fast, 0.2s) ease;
                    }
                    
                    .upload-item-remove:hover {
                        background: rgba(51, 51, 51, 0.1);
                        color: var(--color-ink-wash, #333);
                    }
                </style>
                        display: flex;
                        gap: 20px;
                    }
                    .upload-options .form-group {
                        flex: 1;
                    }
                    .upload-progress {
                        margin-top: 20px;
                    }
                    .upload-list {
                        margin-top: 20px;
                    }
                    .upload-item {
                        display: flex;
                        align-items: center;
                        padding: 10px;
                        background: var(--color-bg-secondary, #f5f5f5);
                        border-radius: var(--color-radius-sm, 4px);
                        margin-bottom: 10px;
                    }
                    .upload-item-icon {
                        margin-right: 10px;
                        color: var(--color-text-secondary, #666);
                    }
                    .upload-item-name {
                        flex: 1;
                        color: var(--color-text-primary, #333);
                    }
                    .upload-item-size {
                        color: var(--color-text-secondary, #666);
                        font-size: 14px;
                        margin-right: 10px;
                    }
                    .upload-item-remove {
                        color: var(--color-danger, #dc3545);
                        cursor: pointer;
                    }
                </style>
                <script>
                    // 文件上传功能
                    document.addEventListener('DOMContentLoaded', function() {
                        const uploadArea = document.getElementById('upload-area');
                        const fileInput = document.getElementById('file-input');
                        const uploadList = document.getElementById('upload-list');
                        const uploadProgress = document.getElementById('upload-progress');
                        const progressBar = document.getElementById('progress-bar');
                        
                        // 点击上传区域触发文件选择
                        uploadArea.addEventListener('click', function() {
                            fileInput.click();
                        });
                        
                        // 文件选择后的处理
                        fileInput.addEventListener('change', function() {
                            const files = this.files;
                            if (files.length > 0) {
                                // 显示文件列表
                                for (let i = 0; i < files.length; i++) {
                                    addFileToList(files[i]);
                                }
                                
                                // 模拟上传进度
                                simulateUpload();
                            }
                        });
                        
                        // 添加文件到列表
                        function addFileToList(file) {
                            const fileItem = document.createElement('div');
                            fileItem.className = 'upload-item';
                            
                            const fileSize = (file.size / 1024).toFixed(2) + ' KB';
                            
                            fileItem.innerHTML = `
                                <i class="fa fa-file upload-item-icon"></i>
                                <span class="upload-item-name">${file.name}</span>
                                <span class="upload-item-size">${fileSize}</span>
                                <i class="fa fa-times upload-item-remove"></i>
                            `;
                            
                            uploadList.appendChild(fileItem);
                            
                            // 添加删除功能
                            fileItem.querySelector('.upload-item-remove').addEventListener('click', function() {
                                uploadList.removeChild(fileItem);
                            });
                        }
                        
                        // 模拟上传进度
                        function simulateUpload() {
                            uploadProgress.style.display = 'block';
                            let progress = 0;
                            
                            const interval = setInterval(function() {
                                progress += 5;
                                progressBar.style.width = progress + '%';
                                progressBar.textContent = progress + '%';
                                
                                if (progress >= 100) {
                                    clearInterval(interval);
                                    setTimeout(function() {
                                        uploadProgress.style.display = 'none';
                                        progressBar.style.width = '0%';
                                        progressBar.textContent = '0%';
                                    }, 1000);
                                }
                            }, 200);
                        }
                    });
                </script>
            </div>

            <!-- 权限管理组件 -->
            <div class="component-section">
                <h3 class="section-title">权限管理组件</h3>
                <div class="permission-container">
                    <div class="permission-header">
                        <h4>角色权限设置</h4>
                        <p>为不同角色配置系统访问权限</p>
                    </div>
                    <div class="permission-tabs">
                        <button class="permission-tab active" data-role="admin">管理员</button>
                        <button class="permission-tab" data-role="user">普通用户</button>
                        <button class="permission-tab" data-role="guest">访客</button>
                    </div>
                    <div class="permission-content">
                        <div class="permission-group">
                            <h5>文件管理权限</h5>
                            <div class="permission-list">
                                <div class="permission-item">
                                    <div class="permission-info">
                                        <span class="permission-name">查看文件</span>
                                        <span class="permission-desc">允许查看系统中的所有文件</span>
                                    </div>
                                    <div class="permission-toggle">
                                        <label class="switch">
                                            <input type="checkbox" checked>
                                            <span class="slider"></span>
                                        </label>
                                    </div>
                                </div>
                                <div class="permission-item">
                                    <div class="permission-info">
                                        <span class="permission-name">上传文件</span>
                                        <span class="permission-desc">允许上传新文件到系统</span>
                                    </div>
                                    <div class="permission-toggle">
                                        <label class="switch">
                                            <input type="checkbox" checked>
                                            <span class="slider"></span>
                                        </label>
                                    </div>
                                </div>
                                <div class="permission-item">
                                    <div class="permission-info">
                                        <span class="permission-name">删除文件</span>
                                        <span class="permission-desc">允许删除系统中的文件</span>
                                    </div>
                                    <div class="permission-toggle">
                                        <label class="switch">
                                            <input type="checkbox">
                                            <span class="slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="permission-group">
                            <h5>用户管理权限</h5>
                            <div class="permission-list">
                                <div class="permission-item">
                                    <div class="permission-info">
                                        <span class="permission-name">查看用户</span>
                                        <span class="permission-desc">允许查看系统中的所有用户</span>
                                    </div>
                                    <div class="permission-toggle">
                                        <label class="switch">
                                            <input type="checkbox" checked>
                                            <span class="slider"></span>
                                        </label>
                                    </div>
                                </div>
                                <div class="permission-item">
                                    <div class="permission-info">
                                        <span class="permission-name">添加用户</span>
                                        <span class="permission-desc">允许添加新用户到系统</span>
                                    </div>
                                    <div class="permission-toggle">
                                        <label class="switch">
                                            <input type="checkbox">
                                            <span class="slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="permission-footer">
                        <button class="btn btn-secondary">重置</button>
                        <button class="btn btn-primary">保存权限</button>
                    </div>
                </div>
                <style>
                    .permission-container {
                        max-width: 800px;
                        margin: 0 auto;
                        background: var(--color-bg-card, #fff);
                        background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23f5f5f5' fill-opacity='0.2' fill-rule='evenodd'/%3E%3C/svg%3E");
                        border-radius: var(--color-radius-md, 8px);
                        padding: 20px;
                        box-shadow: var(--color-shadow-card, 0 2px 10px rgba(0,0,0,0.1));
                        border: 1px solid var(--color-ink-wash, #333);
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .permission-container::before {
                        content: "";
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 4px;
                        background: linear-gradient(90deg, var(--color-ink-light, #555) 0%, var(--color-ink-medium, #333) 50%, var(--color-ink-dark, #111) 100%);
                        opacity: 0.7;
                    }
                    
                    .permission-header {
                        margin-bottom: 20px;
                        position: relative;
                    }
                    
                    .permission-header h4 {
                        margin: 0 0 5px 0;
                        color: var(--color-ink-dark, #111);
                        font-family: 'KaiTi', 'STKaiti', serif;
                        font-size: 20px;
                        font-weight: 600;
                    }
                    
                    .permission-header p {
                        margin: 0;
                        color: var(--color-ink-medium, #333);
                        font-size: 14px;
                        font-family: 'KaiTi', 'STKaiti', serif;
                    }
                    
                    .permission-tabs {
                        display: flex;
                        margin-bottom: 20px;
                        border-bottom: 1px solid var(--color-ink-wash, #333);
                        position: relative;
                    }
                    
                    .permission-tab {
                        padding: 10px 20px;
                        background: none;
                        border: none;
                        border-bottom: 2px solid transparent;
                        color: var(--color-ink-medium, #333);
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        font-family: 'KaiTi', 'STKaiti', serif;
                        font-size: 16px;
                        position: relative;
                    }
                    
                    .permission-tab::after {
                        content: "";
                        position: absolute;
                        bottom: -2px;
                        left: 0;
                        width: 0;
                        height: 2px;
                        background: var(--color-ink-medium, #333);
                        transition: width 0.3s ease;
                    }
                    
                    .permission-tab:hover {
                        color: var(--color-ink-dark, #111);
                    }
                    
                    .permission-tab.active {
                        color: var(--color-ink-dark, #111);
                        border-bottom-color: var(--color-ink-dark, #111);
                    }
                    
                    .permission-tab.active::after {
                        width: 100%;
                    }
                    
                    .permission-group {
                        margin-bottom: 25px;
                    }
                    
                    .permission-group h5 {
                        margin: 0 0 15px 0;
                        color: var(--color-ink-dark, #111);
                        font-size: 16px;
                        font-weight: 600;
                        padding-bottom: 8px;
                        border-bottom: 1px solid var(--color-ink-wash, #333);
                        font-family: 'KaiTi', 'STKaiti', serif;
                        position: relative;
                    }
                    
                    .permission-group h5::before {
                        content: "";
                        position: absolute;
                        left: 0;
                        bottom: -1px;
                        width: 60px;
                        height: 1px;
                        background: var(--color-ink-medium, #333);
                    }
                    
                    .permission-list {
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }
                    
                    .permission-item {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 12px 15px;
                        background: var(--color-bg-secondary, #f5f5f5);
                        background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23f5f5f5' fill-opacity='0.1' fill-rule='evenodd'/%3E%3C/svg%3E");
                        border-radius: var(--color-radius-sm, 4px);
                        border: 1px solid var(--color-ink-light, #555);
                        transition: all 0.3s ease;
                    }
                    
                    .permission-item:hover {
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                        transform: translateY(-1px);
                    }
                    
                    .permission-info {
                        flex: 1;
                    }
                    
                    .permission-name {
                        display: block;
                        font-weight: 500;
                        color: var(--color-ink-dark, #111);
                        margin-bottom: 4px;
                        font-family: 'KaiTi', 'STKaiti', serif;
                        font-size: 16px;
                    }
                    
                    .permission-desc {
                        display: block;
                        font-size: 14px;
                        color: var(--color-ink-medium, #333);
                        font-family: 'KaiTi', 'STKaiti', serif;
                    }
                    
                    .permission-toggle {
                        margin-left: 15px;
                    }
                    
                    /* 开关样式 */
                    .switch {
                        position: relative;
                        display: inline-block;
                        width: 50px;
                        height: 24px;
                    }
                    
                    .switch input {
                        opacity: 0;
                        width: 0;
                        height: 0;
                    }
                    
                    .slider {
                        position: absolute;
                        cursor: pointer;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background-color: var(--color-ink-light, #555);
                        transition: .4s;
                        border-radius: 24px;
                        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
                    }
                    
                    .slider:before {
                        position: absolute;
                        content: "";
                        height: 18px;
                        width: 18px;
                        left: 3px;
                        bottom: 3px;
                        background-color: white;
                        transition: .4s;
                        border-radius: 50%;
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
                    }
                    
                    input:checked + .slider {
                        background-color: var(--color-ink-medium, #333);
                        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
                    }
                    
                    input:checked + .slider:before {
                        transform: translateX(26px);
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
                    }
                    
                    .permission-footer {
                        display: flex;
                        justify-content: flex-end;
                        gap: 10px;
                        margin-top: 20px;
                        padding-top: 15px;
                        border-top: 1px solid var(--color-ink-wash, #333);
                        position: relative;
                    }
                    
                    .permission-footer::before {
                        content: "";
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 60px;
                        height: 1px;
                        background: var(--color-ink-medium, #333);
                    }
                </style>
                <script>
                    // 权限标签页切换
                    document.addEventListener('DOMContentLoaded', function() {
                        const permissionTabs = document.querySelectorAll('.permission-tab');
                        
                        permissionTabs.forEach(tab => {
                            tab.addEventListener('click', function() {
                                // 移除所有活动状态
                                permissionTabs.forEach(t => t.classList.remove('active'));
                                
                                // 添加当前活动状态
                                this.classList.add('active');
                            });
                        });
                    });
                </script>
            </div>

            <!-- 分类管理组件 -->
            <div class="component-section">
                <h3 class="section-title">分类管理组件</h3>
                <div class="category-management">
                    <div class="category-header">
                        <h4>文件分类管理</h4>
                        <button class="btn btn-primary" onclick="showAddCategoryModal()">添加分类</button>
                    </div>
                    <div class="category-list" id="category-list">
                        <div class="category-item">
                            <div class="category-info">
                                <i class="fa fa-folder category-icon"></i>
                                <div class="category-details">
                                    <span class="category-name">工具</span>
                                    <span class="category-count">15个文件</span>
                                </div>
                            </div>
                            <div class="category-actions">
                                <button class="btn btn-sm btn-secondary">编辑</button>
                                <button class="btn btn-sm btn-danger">删除</button>
                            </div>
                        </div>
                        <div class="category-item">
                            <div class="category-info">
                                <i class="fa fa-folder category-icon"></i>
                                <div class="category-details">
                                    <span class="category-name">文档</span>
                                    <span class="category-count">23个文件</span>
                                </div>
                            </div>
                            <div class="category-actions">
                                <button class="btn btn-sm btn-secondary">编辑</button>
                                <button class="btn btn-sm btn-danger">删除</button>
                            </div>
                        </div>
                        <div class="category-item">
                            <div class="category-info">
                                <i class="fa fa-folder category-icon"></i>
                                <div class="category-details">
                                    <span class="category-name">图片</span>
                                    <span class="category-count">42个文件</span>
                                </div>
                            </div>
                            <div class="category-actions">
                                <button class="btn btn-sm btn-secondary">编辑</button>
                                <button class="btn btn-sm btn-danger">删除</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 添加分类模态框 -->
                <div class="modal" id="add-category-modal" style="display: none;">
                    <div class="modal-mask"></div>
                    <div class="modal-container">
                        <div class="modal-header">
                            <h4>添加新分类</h4>
                            <button class="modal-close" onclick="hideAddCategoryModal()">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label for="category-name">分类名称</label>
                                <input type="text" id="category-name" class="form-control" placeholder="请输入分类名称">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" onclick="hideAddCategoryModal()">取消</button>
                            <button class="btn btn-primary" onclick="addCategory()">添加</button>
                        </div>
                    </div>
                </div>
                
                <style>
                    .category-management {
                        max-width: 800px;
                        margin: 0 auto;
                        background: var(--color-bg-card, #fff);
                        background-image: 
                            linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.9)),
                            url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23f5f5f5' fill-opacity='0.2' fill-rule='evenodd'/%3E%3C/svg%3E");
                        border-radius: var(--color-radius-md, 8px);
                        padding: 20px;
                        box-shadow: var(--color-shadow-card, 0 2px 10px rgba(0,0,0,0.1));
                        border: 1px solid var(--color-ink-wash, #333);
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .category-management::before {
                        content: "";
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 4px;
                        background: linear-gradient(90deg, var(--color-ink-light, #555) 0%, var(--color-ink-medium, #333) 50%, var(--color-ink-dark, #111) 100%);
                        opacity: 0.7;
                    }
                    
                    .category-management::after {
                        content: "";
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 3px;
                        background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0) 70%);
                        opacity: 0.8;
                    }
                    
                    .category-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                        position: relative;
                        padding-bottom: 10px;
                    }
                    
                    .category-header::after {
                        content: "";
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        width: 60px;
                        height: 2px;
                        background: linear-gradient(90deg, var(--color-ink-medium, #333) 0%, rgba(51, 51, 51, 0) 100%);
                    }
                    
                    .category-header h4 {
                        margin: 0;
                        color: var(--color-ink-dark, #111);
                        font-family: 'KaiTi', 'STKaiti', serif;
                        font-size: 20px;
                        font-weight: 600;
                        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
                    }
                    
                    .category-list {
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                    }
                    
                    .category-item {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 15px;
                        background: var(--color-bg-secondary, #f5f5f5);
                        background-image: 
                            linear-gradient(rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.7)),
                            url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23f5f5f5' fill-opacity='0.1' fill-rule='evenodd'/%3E%3C/svg%3E");
                        border-radius: var(--color-radius-sm, 4px);
                        border: 1px solid var(--color-ink-light, #555);
                        transition: transform 0.2s ease, box-shadow 0.2s ease;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .category-item::before {
                        content: "";
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 3px;
                        height: 100%;
                        background: linear-gradient(to bottom, var(--color-ink-medium, #333), var(--color-ink-light, #555));
                        opacity: 0;
                        transition: opacity 0.2s ease;
                    }
                    
                    .category-item:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                    }
                    
                    .category-item:hover::before {
                        opacity: 1;
                    }
                    
                    .category-info {
                        display: flex;
                        align-items: center;
                        gap: 15px;
                    }
                    
                    .category-icon {
                        font-size: 24px;
                        color: var(--color-ink-medium, #333);
                        filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2));
                    }
                    
                    .category-details {
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .category-name {
                        font-weight: 500;
                        color: var(--color-ink-dark, #111);
                        margin-bottom: 4px;
                        font-family: 'KaiTi', 'STKaiti', serif;
                        font-size: 16px;
                        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
                    }
                    
                    .category-count {
                        font-size: 14px;
                        color: var(--color-ink-medium, #333);
                        font-family: 'KaiTi', 'STKaiti', serif;
                    }
                    
                    .category-actions {
                        display: flex;
                        gap: 8px;
                    }
                    
                    .btn-sm {
                        padding: 5px 10px;
                        font-size: 12px;
                        border-radius: var(--color-radius-sm, 4px);
                        font-family: 'KaiTi', 'STKaiti', serif;
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                        transition: all 0.2s ease;
                    }
                    
                    .btn-sm:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
                    }
                    
                    /* 模态框样式 */
                    .modal {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 1000;
                    }
                    
                    .modal-mask {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background-color: rgba(0, 0, 0, 0.5);
                        backdrop-filter: blur(2px);
                    }
                    
                    .modal-container {
                        position: relative;
                        background: var(--color-bg-card, #fff);
                        background-image: 
                            linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.9)),
                            url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23f5f5f5' fill-opacity='0.2' fill-rule='evenodd'/%3E%3C/svg%3E");
                        border-radius: var(--color-radius-md, 8px);
                        border: 1px solid var(--color-ink-wash, #333);
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                        width: 90%;
                        max-width: 500px;
                        z-index: 1001;
                        overflow: hidden;
                    }
                    
                    .modal-container::before {
                        content: "";
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 4px;
                        background: linear-gradient(90deg, var(--color-ink-light, #555) 0%, var(--color-ink-medium, #333) 50%, var(--color-ink-dark, #111) 100%);
                        opacity: 0.7;
                    }
                    
                    .modal-container::after {
                        content: "";
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 3px;
                        background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0) 70%);
                        opacity: 0.8;
                    }
                    
                    .modal-header {
                        padding: 20px 20px 10px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1px solid var(--color-ink-wash, #333);
                        position: relative;
                    }
                    
                    .modal-header h4 {
                        margin: 0;
                        color: var(--color-ink-dark, #111);
                        font-family: 'KaiTi', 'STKaiti', serif;
                        font-size: 18px;
                        font-weight: 600;
                    }
                    
                    .modal-close {
                        background: none;
                        border: none;
                        font-size: 24px;
                        color: var(--color-ink-medium, #333);
                        cursor: pointer;
                        font-family: 'KaiTi', 'STKaiti', serif;
                        transition: color 0.2s ease;
                    }
                    
                    .modal-close:hover {
                        color: var(--color-ink-dark, #111);
                    }
                    
                    .modal-body {
                        padding: 20px;
                    }
                    
                    .modal-footer {
                        padding: 10px 20px 20px;
                        display: flex;
                        justify-content: flex-end;
                        gap: 10px;
                    }
                    
                    .form-group {
                        margin-bottom: 15px;
                    }
                    
                    .form-group label {
                        display: block;
                        margin-bottom: 5px;
                        color: var(--color-ink-dark, #111);
                        font-family: 'KaiTi', 'STKaiti', serif;
                        font-weight: 500;
                    }
                    
                    .form-control {
                        width: 100%;
                        padding: 8px 12px;
                        border: 1px solid var(--color-ink-wash, #333);
                        border-radius: var(--color-radius-sm, 4px);
                        background-color: var(--color-bg-input, #fff);
                        font-family: 'KaiTi', 'STKaiti', serif;
                        font-size: 14px;
                        transition: border-color 0.2s ease, box-shadow 0.2s ease;
                    }
                    
                    .form-control:focus {
                        outline: none;
                        border-color: var(--color-ink-medium, #333);
                        box-shadow: 0 0 0 2px rgba(51, 51, 51, 0.2);
                    }
                </style>
                <script>
                    document.addEventListener('DOMContentLoaded', function() {
                        // 添加墨水晕染效果
                        function addInkEffect(element) {
                            element.style.position = 'relative';
                            element.style.overflow = 'hidden';
                            
                            element.addEventListener('click', function(e) {
                                const ripple = document.createElement('span');
                                const rect = this.getBoundingClientRect();
                                const size = Math.max(rect.width, rect.height);
                                const x = e.clientX - rect.left - size / 2;
                                const y = e.clientY - rect.top - size / 2;
                                
                                ripple.style.width = ripple.style.height = size + 'px';
                                ripple.style.left = x + 'px';
                                ripple.style.top = y + 'px';
                                ripple.classList.add('ink-ripple');
                                
                                this.appendChild(ripple);
                                
                                setTimeout(() => {
                                    ripple.remove();
                                }, 600);
                            });
                        }
                        
                        // 添加墨水晕染动画样式
                        const style = document.createElement('style');
                        style.textContent = `
                            .ink-ripple {
                                position: absolute;
                                border-radius: 50%;
                                background-color: rgba(51, 51, 51, 0.3);
                                transform: scale(0);
                                animation: ripple-animation 0.6s ease-out;
                                pointer-events: none;
                            }
                            
                            @keyframes ripple-animation {
                                to {
                                    transform: scale(4);
                                    opacity: 0;
                                }
                            }
                            
                            .modal {
                                transition: opacity 0.3s ease;
                            }
                            
                            .modal.show {
                                opacity: 1;
                            }
                            
                            .modal.show .modal-container {
                                transform: scale(1);
                            }
                            
                            .modal-container {
                                transform: scale(0.9);
                                transition: transform 0.3s ease;
                            }
                            
                            /* 通知消息的中国风样式 */
                            .notification {
                                position: fixed;
                                top: 20px;
                                right: 20px;
                                padding: 15px 20px;
                                border-radius: 4px;
                                font-family: 'KaiTi', 'STKaiti', serif;
                                font-size: 16px;
                                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                                z-index: 1000;
                                min-width: 250px;
                                border-left: 5px solid;
                                background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,0 L100,0 L100,100 L0,100 Z' fill='%23f9f6f0' fill-opacity='0.8'/%3E%3Cpath d='M0,0 C30,20 70,20 100,0 L100,100 C70,80 30,80 0,100 Z' fill='%23f0ebe0' fill-opacity='0.5'/%3E%3C/svg%3E");
                                background-color: rgba(249, 246, 240, 0.95);
                                color: #333;
                            }
                            
                            .notification-success {
                                border-left-color: #4CAF50;
                                background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,0 L100,0 L100,100 L0,100 Z' fill='%23f1f8e9' fill-opacity='0.8'/%3E%3Cpath d='M0,0 C30,20 70,20 100,0 L100,100 C70,80 30,80 0,100 Z' fill='%23e8f5e9' fill-opacity='0.5'/%3E%3C/svg%3E");
                                background-color: rgba(241, 248, 233, 0.95);
                            }
                            
                            .notification-warning {
                                border-left-color: #FF9800;
                                background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,0 L100,0 L100,100 L0,100 Z' fill='%23fff8e1' fill-opacity='0.8'/%3E%3Cpath d='M0,0 C30,20 70,20 100,0 L100,100 C70,80 30,80 0,100 Z' fill='%23fff3e0' fill-opacity='0.5'/%3E%3C/svg%3E");
                                background-color: rgba(255, 248, 225, 0.95);
                            }
                            
                            .notification-error {
                                border-left-color: #F44336;
                                background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,0 L100,0 L100,100 L0,100 Z' fill='%23ffebee' fill-opacity='0.8'/%3E%3Cpath d='M0,0 C30,20 70,20 100,0 L100,100 C70,80 30,80 0,100 Z' fill='%23ffebee' fill-opacity='0.5'/%3E%3C/svg%3E");
                                background-color: rgba(255, 235, 238, 0.95);
                            }
                            
                            .notification::before {
                                content: '';
                                position: absolute;
                                top: 0;
                                left: 0;
                                right: 0;
                                height: 4px;
                                background: linear-gradient(90deg, rgba(0,0,0,0.7), rgba(0,0,0,0.3), rgba(0,0,0,0.7));
                                opacity: 0.8;
                            }
                            
                            .notification-success::before {
                                background: linear-gradient(90deg, rgba(76,175,80,0.7), rgba(76,175,80,0.3), rgba(76,175,80,0.7));
                            }
                            
                            .notification-warning::before {
                                background: linear-gradient(90deg, rgba(255,152,0,0.7), rgba(255,152,0,0.3), rgba(255,152,0,0.7));
                            }
                            
                            .notification-error::before {
                                background: linear-gradient(90deg, rgba(244,67,54,0.7), rgba(244,67,54,0.3), rgba(244,67,54,0.7));
                            }
                        `;
                        document.head.appendChild(style);
                        
                        // 为按钮添加墨水效果
                        document.querySelectorAll('.btn').forEach(addInkEffect);
                        
                        // 显示添加分类模态框
                        window.showAddCategoryModal = function() {
                            const modal = document.getElementById('add-category-modal');
                            modal.style.display = 'flex';
                            setTimeout(() => {
                                modal.classList.add('show');
                            }, 10);
                        }
                        
                        // 隐藏添加分类模态框
                        window.hideAddCategoryModal = function() {
                            const modal = document.getElementById('add-category-modal');
                            modal.classList.remove('show');
                            setTimeout(() => {
                                modal.style.display = 'none';
                            }, 300);
                        }
                        
                        // 添加分类
                        window.addCategory = function() {
                            const categoryName = document.getElementById('category-name').value.trim();
                            
                            if (!categoryName) {
                                showMessage('请输入分类名称', 'warning');
                                return;
                            }
                            
                            // 创建新的分类项
                            const categoryList = document.getElementById('category-list');
                            const newCategory = document.createElement('div');
                            newCategory.className = 'category-item';
                            
                            newCategory.innerHTML = `
                                <div class="category-info">
                                    <i class="fa fa-folder category-icon"></i>
                                    <div class="category-details">
                                        <span class="category-name">${categoryName}</span>
                                        <span class="category-count">0个文件</span>
                                    </div>
                                </div>
                                <div class="category-actions">
                                    <button class="btn btn-sm btn-secondary">编辑</button>
                                    <button class="btn btn-sm btn-danger">删除</button>
                                </div>
                            `;
                            
                            // 为新添加的按钮添加墨水效果
                            newCategory.querySelectorAll('.btn').forEach(addInkEffect);
                            
                            // 添加删除功能
                            const deleteBtn = newCategory.querySelector('.btn-danger');
                            deleteBtn.addEventListener('click', function() {
                                if (confirm(`确定要删除分类"${categoryName}"吗？`)) {
                                    newCategory.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                                    newCategory.style.opacity = '0';
                                    newCategory.style.transform = 'translateX(20px)';
                                    setTimeout(() => {
                                        newCategory.remove();
                                        showMessage('分类删除成功', 'success');
                                    }, 300);
                                }
                            });
                            
                            // 添加淡入动画
                            newCategory.style.opacity = '0';
                            newCategory.style.transform = 'translateY(-10px)';
                            categoryList.appendChild(newCategory);
                            setTimeout(() => {
                                newCategory.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                                newCategory.style.opacity = '1';
                                newCategory.style.transform = 'translateY(0)';
                            }, 10);
                            
                            // 清空输入框并关闭模态框
                            document.getElementById('category-name').value = '';
                            hideAddCategoryModal();
                            
                            showMessage('分类添加成功', 'success');
                        }
                        
                        // 显示消息提示
                        function showMessage(message, type) {
                            const notification = document.createElement('div');
                            notification.className = `notification notification-${type}`;
                            notification.textContent = message;
                            
                            document.body.appendChild(notification);
                            
                            // 添加显示动画
                            notification.style.transform = 'translateY(-20px)';
                            notification.style.opacity = '0';
                            setTimeout(() => {
                                notification.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
                                notification.style.transform = 'translateY(0)';
                                notification.style.opacity = '1';
                            }, 10);
                            
                            // 自动隐藏
                            setTimeout(() => {
                                notification.style.transform = 'translateY(-20px)';
                                notification.style.opacity = '0';
                                setTimeout(() => {
                                    notification.remove();
                                }, 300);
                            }, 3000);
                        }
                        
                        // 点击模态框外部关闭
                        const modal = document.getElementById('add-category-modal');
                        if (modal) {
                            modal.addEventListener('click', function(e) {
                                if (e.target === modal) {
                                    hideAddCategoryModal();
                                }
                            });
                        }
                    });
                </script>
            </div>

            <!-- 文件上传组件 -->
            <div class="component-section">
                <h3 class="section-title">文件上传组件</h3>
                
                <div class="upload-container">
                    <div class="upload-area" id="upload-area">
                        <div class="upload-icon">
                            <i class="fa fa-cloud-upload"></i>
                        </div>
                        <div class="upload-text">
                            <p>拖拽文件到此处或点击选择文件</p>
                            <p class="upload-hint">支持批量上传，单个文件最大10MB</p>
                        </div>
                        <input type="file" id="file-input" multiple class="file-input">
                        <button class="btn btn-primary upload-btn">选择文件</button>
                    </div>
                    
                    <div class="upload-progress" id="upload-progress" style="display: none;">
                <div class="progress">
                    <div class="progress-bar" id="progress-bar" style="width: 0%;">0%</div>
                </div>
                <div class="upload-status" id="upload-status">正在上传...</div>
            </div>
                    
                    <div class="upload-list" id="upload-list">
                        <!-- 上传的文件列表将在这里显示 -->
                    </div>
                </div>
                
                <style>
                    .upload-container {
                        border: 2px dashed var(--color-border, #ddd);
                        border-radius: 8px;
                        padding: 30px;
                        text-align: center;
                        background-color: var(--color-bg-secondary, #f9f9f9);
                        transition: all 0.3s ease;
                    }
                    
                    .upload-container:hover {
                        border-color: var(--color-primary, #007bff);
                        background-color: var(--color-bg-hover, #f0f8ff);
                    }
                    
                    .upload-area {
                        position: relative;
                    }
                    
                    .upload-icon {
                        font-size: 48px;
                        color: var(--color-primary, #007bff);
                        margin-bottom: 20px;
                    }
                    
                    .upload-text p {
                        margin: 5px 0;
                        color: var(--color-text-primary, #333);
                    }
                    
                    .upload-hint {
                        font-size: 14px;
                        color: var(--color-text-secondary, #666);
                    }
                    
                    .file-input {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        opacity: 0;
                        cursor: pointer;
                    }
                    
                    .upload-btn {
                        margin-top: 20px;
                    }
                    
                    .upload-progress {
                        margin-top: 20px;
                    }
                    
                    .upload-status {
                        margin-top: 10px;
                        font-size: 14px;
                        color: var(--color-text-secondary, #666);
                    }
                    
                    .upload-list {
                        margin-top: 20px;
                        text-align: left;
                    }
                    
                    .upload-item {
                        display: flex;
                        align-items: center;
                        padding: 10px;
                        border-bottom: 1px solid var(--color-border-light, #eee);
                    }
                    
                    .upload-item:last-child {
                        border-bottom: none;
                    }
                    
                    .upload-item-icon {
                        margin-right: 10px;
                        color: var(--color-text-secondary, #666);
                    }
                    
                    .upload-item-info {
                        flex: 1;
                    }
                    
                    .upload-item-name {
                        font-weight: 500;
                        color: var(--color-text-primary, #333);
                    }
                    
                    .upload-item-size {
                        font-size: 12px;
                        color: var(--color-text-secondary, #666);
                    }
                    
                    .upload-item-status {
                        margin-left: 10px;
                        font-size: 14px;
                    }
                    
                    .upload-item-status.success {
                        color: var(--color-success, #28a745);
                    }
                    
                    .upload-item-status.error {
                        color: var(--color-danger, #dc3545);
                    }
                </style>
                
                <script>
                    document.addEventListener('DOMContentLoaded', function() {
                        const uploadArea = document.getElementById('upload-area');
                        const fileInput = document.getElementById('file-input');
                        const uploadBtn = uploadArea ? uploadArea.querySelector('.upload-btn') : null;
                        const uploadProgress = document.getElementById('upload-progress');
                        const progressBar = document.getElementById('progress-bar');
                        const uploadStatus = document.getElementById('upload-status');
                        const uploadList = document.getElementById('upload-list');
                        
                        // 点击按钮触发文件选择
                        if (uploadBtn) {
                            uploadBtn.addEventListener('click', function(e) {
                                e.preventDefault();
                                fileInput.click();
                            });
                        }
                        
                        // 文件选择后的处理
                        if (fileInput) {
                            fileInput.addEventListener('change', function() {
                                handleFiles(this.files);
                            });
                        }
                        
                        // 拖拽处理
                        if (uploadArea) {
                            uploadArea.addEventListener('dragover', function(e) {
                                e.preventDefault();
                                this.style.borderColor = 'var(--color-primary, #007bff)';
                                this.style.backgroundColor = 'var(--color-bg-hover, #f0f8ff)';
                            });
                            
                            uploadArea.addEventListener('dragleave', function(e) {
                                e.preventDefault();
                                this.style.borderColor = 'var(--color-border, #ddd)';
                                this.style.backgroundColor = 'var(--color-bg-secondary, #f9f9f9)';
                            });
                            
                            uploadArea.addEventListener('drop', function(e) {
                                e.preventDefault();
                                this.style.borderColor = 'var(--color-border, #ddd)';
                                this.style.backgroundColor = 'var(--color-bg-secondary, #f9f9f9)';
                                
                                const files = e.dataTransfer.files;
                                handleFiles(files);
                            });
                        }
                        
                        // 处理文件
                        function handleFiles(files) {
                            if (!files || files.length === 0) return;
                            
                            // 显示上传进度
                            if (uploadProgress) {
                                uploadProgress.style.display = 'block';
                            }
                            
                            // 模拟上传进度
                            let progress = 0;
                            const interval = setInterval(function() {
                                progress += Math.random() * 15;
                                if (progress > 100) progress = 100;
                                
                                if (progressBar) {
                                    progressBar.style.width = progress + '%';
                                    progressBar.textContent = Math.round(progress) + '%';
                                }
                                
                                if (progress >= 100) {
                                    clearInterval(interval);
                                    if (uploadStatus) {
                                        uploadStatus.textContent = '上传完成';
                                    }
                                    
                                    // 添加文件到列表
                                    for (let i = 0; i < files.length; i++) {
                                        addFileToList(files[i]);
                                    }
                                    
                                    // 3秒后隐藏进度条
                                    setTimeout(function() {
                                        if (uploadProgress) {
                                            uploadProgress.style.display = 'none';
                                        }
                                        if (progressBar) {
                                            progressBar.style.width = '0%';
                                            progressBar.textContent = '0%';
                                        }
                                        if (uploadStatus) {
                                            uploadStatus.textContent = '正在上传...';
                                        }
                                    }, 3000);
                                }
                            }, 200);
                        }
                        
                        // 添加文件到列表
                        function addFileToList(file) {
                            if (!uploadList) return;
                            
                            const fileSize = formatFileSize(file.size);
                            const fileId = 'file-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                            
                            const fileItem = document.createElement('div');
                            fileItem.className = 'upload-item';
                            fileItem.id = fileId;
                            
                            // 根据文件类型选择图标
                            let fileIcon = 'fa-file';
                            if (file.type.startsWith('image/')) {
                                fileIcon = 'fa-file-image-o';
                            } else if (file.type.startsWith('video/')) {
                                fileIcon = 'fa-file-video-o';
                            } else if (file.type.startsWith('audio/')) {
                                fileIcon = 'fa-file-audio-o';
                            } else if (file.type.includes('pdf')) {
                                fileIcon = 'fa-file-pdf-o';
                            } else if (file.type.includes('zip') || file.type.includes('rar')) {
                                fileIcon = 'fa-file-archive-o';
                            } else if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
                                fileIcon = 'fa-file-word-o';
                            } else if (file.type.includes('excel') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
                                fileIcon = 'fa-file-excel-o';
                            }
                            
                            fileItem.innerHTML = `
                                <div class="upload-item-icon">
                                    <i class="fa ${fileIcon}"></i>
                                </div>
                                <div class="upload-item-info">
                                    <div class="upload-item-name">${file.name}</div>
                                    <div class="upload-item-size">${fileSize}</div>
                                </div>
                                <div class="upload-item-status success">
                                    <i class="fa fa-check-circle"></i> 已上传
                                </div>
                            `;
                            
                            uploadList.appendChild(fileItem);
                        }
                        
                        // 格式化文件大小
                        function formatFileSize(bytes) {
                            if (bytes === 0) return '0 Bytes';
                            const k = 1024;
                            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                            const i = Math.floor(Math.log(bytes) / Math.log(k));
                            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                        }
                    });
                </script>
            </div>

            <!-- 加载状态组件 -->
            <div class="component-section">
                <h3 class="section-title">加载状态组件</h3>
                
                <div class="loading-examples">
                    <!-- 基础加载动画 -->
                    <div class="loading-container">
                        <div class="loading-spinner"></div>
                        <p>加载中...</p>
                    </div>
                    
                    <!-- 进度条加载 -->
                    <div class="loading-container">
                        <div class="progress">
                            <div class="progress-bar progress-bar-striped active" style="width: 60%;"></div>
                        </div>
                        <p>正在处理数据 (60%)</p>
                    </div>
                    
                    <!-- 骨架屏加载 -->
                    <div class="skeleton-container">
                        <div class="skeleton-header"></div>
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line short"></div>
                        <div class="skeleton-line"></div>
                    </div>
                </div>
                
                <style>
                    .loading-examples {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 30px;
                    }
                    
                    .loading-container {
                        flex: 1;
                        min-width: 200px;
                        text-align: center;
                    }
                    
                    .loading-spinner {
                        width: 40px;
                        height: 40px;
                        margin: 0 auto 15px;
                        border: 4px solid var(--color-bg-secondary, #f3f3f3);
                        border-top: 4px solid var(--color-primary, #007bff);
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                    
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    
                    .progress-bar-striped {
                        background-image: linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent);
                        background-size: 40px 40px;
                    }
                    
                    .progress-bar.active {
                        animation: progress-bar-stripes 1s linear infinite;
                    }
                    
                    @keyframes progress-bar-stripes {
                        0% { background-position: 40px 0; }
                        100% { background-position: 0 0; }
                    }
                    
                    .skeleton-container {
                        flex: 1;
                        min-width: 200px;
                        padding: 15px;
                        border: 1px solid var(--color-border-light, #eee);
                        border-radius: 4px;
                    }
                    
                    .skeleton-header {
                        height: 20px;
                        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                        background-size: 200% 100%;
                        animation: loading 1.5s infinite;
                        border-radius: 4px;
                        margin-bottom: 15px;
                    }
                    
                    .skeleton-line {
                        height: 12px;
                        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                        background-size: 200% 100%;
                        animation: loading 1.5s infinite;
                        border-radius: 4px;
                        margin-bottom: 10px;
                    }
                    
                    .skeleton-line.short {
                        width: 60%;
                    }
                    
                    @keyframes loading {
                        0% { background-position: 200% 0; }
                        100% { background-position: -200% 0; }
                    }
                </style>
            </div>
        </main>
    </div>
    

</body>
</html>