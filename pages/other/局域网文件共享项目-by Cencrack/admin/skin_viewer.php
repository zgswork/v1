<?php
/**
 * 皮肤预览和切换页面
 * 功能：展示所有可用的皮肤，并允许用户启用不同的皮肤
 */

// 引入认证控制
require_once 'auth.php';

// 保护页面，确保只有登录用户才能访问
protectPage();

// 引入统一皮肤加载器
include_once __DIR__ . '/../skin_loader.php';

// 获取当前页面路径，用于菜单高亮
$current_page = basename($_SERVER['PHP_SELF']);

// 获取所有皮肤信息
$skins = getAllSkins();

// 获取皮肤排序配置
$configFile = __DIR__ . '/../skin_config.json';
$skinOrder = [];
if (file_exists($configFile)) {
    $config = json_decode(file_get_contents($configFile), true);
    if (isset($config['skinOrder']) && is_array($config['skinOrder'])) {
        $skinOrder = $config['skinOrder'];
    }
}

// 如果有排序配置，按照排序重新排列皮肤
if (!empty($skinOrder)) {
    $orderedSkins = [];
    
    // 首先添加排序中的皮肤
    foreach ($skinOrder as $skinFolder) {
        foreach ($skins as $index => $skin) {
            if ($skin['folder'] === $skinFolder) {
                $orderedSkins[] = $skin;
                unset($skins[$index]);
                break;
            }
        }
    }
    
    // 然后添加不在排序中的皮肤
    foreach ($skins as $skin) {
        $orderedSkins[] = $skin;
    }
    
    $skins = $orderedSkins;
}

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

// 处理启用皮肤的请求
if (isset($_POST['enableSkin'])) {
    $selectedSkin = $_POST['skinFolder'];
    saveSelectedSkin($selectedSkin);
    $successMessage = "皮肤 '$selectedSkin' 已成功启用！";
}

// 处理保存皮肤排序的请求
if (isset($_POST['action']) && $_POST['action'] === 'save_skin_order') {
    $skinOrder = json_decode($_POST['skin_order'], true);
    
    if ($skinOrder && is_array($skinOrder)) {
        // 读取现有配置
        $configFile = __DIR__ . '/../skin_config.json';
        $config = [];
        
        if (file_exists($configFile)) {
            $config = json_decode(file_get_contents($configFile), true) ?: [];
        }
        
        // 更新排序
        $config['skinOrder'] = $skinOrder;
        
        // 保存配置
        $result = file_put_contents($configFile, json_encode($config, JSON_PRETTY_PRINT));
        
        if ($result !== false) {
            header('Content-Type: application/json');
            echo json_encode(['success' => true]);
            exit;
        } else {
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'message' => '无法保存配置文件']);
            exit;
        }
    } else {
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => '无效的排序数据']);
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
    <!-- 加载皮肤CSS -->
    <?php echo getSkinHTMLHead($currentSkin); ?>
    <style>
        /* 基础重置 */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
            line-height: 1.6;
            color: var(--color-text-primary, #333);
            background-color: var(--color-bg-primary, #f5f7fa);
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        header {
            text-align: center;
            margin-bottom: 40px;
            padding: 30px;
            background: var(--color-bg-secondary, linear-gradient(135deg, #667eea 0%, #764ba2 100%));
            color: var(--color-text-primary, white);
            border-radius: 10px;
            box-shadow: var(--color-shadow, 0 4px 20px rgba(0,0,0,0.1));
        }
        
        h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: var(--color-shadow, 2px 2px 4px rgba(0,0,0,0.3));
        }
        
        .skins-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            margin-bottom: 40px;
        }
        
        /* 拖动排序相关样式 */
        .sortable-container {
            position: relative;
        }
        
        .sortable-ghost {
            opacity: 0.4;
            background: var(--color-bg-ghost, #f0f0f0);
        }
        
        .sortable-drag {
            opacity: 0.9;
            transform: rotate(5deg);
            cursor: grabbing !important;
        }
        
        .drag-handle {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 24px;
            height: 24px;
            background: var(--color-bg-drag-handle, rgba(0,0,0,0.1));
            border-radius: 50%;
            cursor: grab;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10;
            transition: all 0.2s ease;
        }
        
        .drag-handle:hover {
            background: var(--color-bg-drag-handle-hover, rgba(0,0,0,0.2));
            transform: scale(1.1);
        }
        
        .drag-handle:active {
            cursor: grabbing;
        }
        
        .drag-handle::before {
            content: "⋮⋮";
            color: var(--color-text-drag-handle, #666);
            font-size: 12px;
            line-height: 1;
        }
        
        .skin-card {
            background: var(--color-bg-card, white);
            border-radius: 10px;
            overflow: hidden;
            box-shadow: var(--color-shadow-card, 0 4px 15px rgba(0,0,0,0.1));
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            position: relative;
            cursor: grab;
        }
        
        .skin-card.dragging {
            cursor: grabbing;
            z-index: 1000;
        }
        
        .skin-card:hover {
            transform: translateY(-10px);
            box-shadow: var(--color-shadow-light, 0 8px 30px rgba(0,0,0,0.2));
        }
        
        .skin-preview {
            height: 200px;
            background: var(--color-bg-tertiary, #f0f0f0);
            position: relative;
            overflow: hidden;
            border-bottom: 3px solid var(--color-border-accent, #e0e0e0);
        }
        
        .preview-content {
            height: 100%;
            width: 100%;
            padding: 20px;
            overflow-y: auto;
            background: var(--color-bg-tertiary, white);
        }
        
        .preview-container {
            font-size: 12px;
            min-height: 100%;
            display: flex;
            flex-direction: column;
        }
        
        .preview-header {
            text-align: center;
            margin-bottom: 10px;
            padding: 10px;
            background: var(--color-bg-elevated, #f0f0f0);
            border-radius: 5px;
        }
        
        .preview-header h3 {
            margin: 0;
            font-size: 14px;
            color: var(--color-text-card-header, #333);
        }
        
        .preview-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
        }
        
        .preview-table th,
        .preview-table td {
            padding: 4px;
            text-align: left;
            border-bottom: 1px solid var(--color-border-table, #e0e0e0);
            font-size: 10px;
            color: var(--color-text-secondary, #666);
        }
        
        .skin-info {
            padding: 20px;
        }
        
        .skin-info h3 {
            margin-bottom: 10px;
            font-size: 1.5em;
            color: var(--color-text-card-header, #2c3e50);
        }
        
        .skin-description {
            margin-bottom: 15px;
            color: var(--color-text-card-body, #7f8c8d);
            font-size: 14px;
        }
        
        .skin-meta {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
            font-size: 12px;
            color: var(--color-text-muted, #95a5a6);
        }
        
        .action-buttons {
            display: flex;
            gap: 10px;
        }
        
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
            text-align: center;
        }
        
        .btn-primary {
            background: var(--color-bg-btn-primary, linear-gradient(135deg, #3498db 0%, #2980b9 100%));
            color: var(--color-text-btn-primary, white);
        }
        
        .btn-primary:hover {
            background: var(--color-bg-btn-primary-hover, linear-gradient(135deg, #2980b9 0%, #1f6dad 100%));
            transform: translateY(-2px);
            box-shadow: var(--color-shadow-light, 0 4px 10px rgba(52, 152, 219, 0.3));
        }
        
        .btn-success {
            background: var(--color-bg-btn-success, linear-gradient(135deg, #2ecc71 0%, #27ae60 100%));
            color: var(--color-text-btn-success, white);
        }
        
        .btn-success:hover {
            background: var(--color-bg-btn-success-hover, linear-gradient(135deg, #27ae60 0%, #219653 100%));
        }
        
        .btn-disabled {
            background: var(--color-bg-btn-disabled, #bdc3c7);
            color: var(--color-text-btn-disabled, #7f8c8d);
            cursor: not-allowed;
        }
        
        .btn-disabled:hover {
            transform: none;
            box-shadow: none;
        }
        
        .btn-top {
            background: var(--color-bg-btn-top, linear-gradient(135deg, #f39c12 0%, #e67e22 100%));
            color: var(--color-text-btn-top, white);
            font-size: 12px;
            padding: 8px 15px;
        }
        
        .btn-top:hover {
            background: var(--color-bg-btn-top-hover, linear-gradient(135deg, #e67e22 0%, #d35400 100%));
            transform: translateY(-2px);
            box-shadow: var(--color-shadow-light, 0 4px 10px rgba(243, 156, 18, 0.3));
        }
        
        .success-message {
            background: var(--color-bg-alert-success, #2ecc71);
            color: var(--color-text-alert-success, white);
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 30px;
            text-align: center;
            animation: fadeIn 0.5s ease;
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .back-link {
            text-align: center;
            margin-top: 40px;
        }
        
        .back-link a {
            color: var(--color-text-nav-link-hover, #3498db);
            text-decoration: none;
            font-weight: 500;
            transition: color 0.3s ease;
        }
        
        .back-link a:hover {
            color: var(--color-secondary, #2980b9);
            text-decoration: underline;
        }
        
        @media (max-width: 768px) {
            .skins-grid {
                grid-template-columns: 1fr;
            }
            
            h1 {
                font-size: 2em;
            }
        }
    </style>
    <!-- 皮肤切换JavaScript -->
    <?php echo getSkinSwitchJS(); ?>
    
    <!-- 拖动排序JavaScript -->
    <script>
        // 全局变量
        let draggedElement = null;
        
        document.addEventListener('DOMContentLoaded', function() {
            const skinCards = document.querySelectorAll('.skin-card');
            
            // 为每个皮肤卡片添加拖动手柄
            skinCards.forEach(card => {
                const dragHandle = document.createElement('div');
                dragHandle.className = 'drag-handle';
                dragHandle.title = '拖动排序';
                card.appendChild(dragHandle);
                
                // 设置拖动属性
                card.draggable = true;
                card.dataset.skinId = card.querySelector('input[name="skinFolder"]').value;
                
                // 添加拖动事件监听器
                card.addEventListener('dragstart', handleDragStart);
                card.addEventListener('dragend', handleDragEnd);
                card.addEventListener('dragover', handleDragOver);
                card.addEventListener('dragenter', handleDragEnter);
                card.addEventListener('dragleave', handleDragLeave);
                card.addEventListener('drop', handleDrop);
            });
        });
        
        // 拖动排序相关函数
        function handleDragStart(e) {
            draggedElement = this;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
            this.style.opacity = '0.5';
        }
        
        function handleDragEnd(e) {
            this.style.opacity = '1';
            
            const allCards = document.querySelectorAll('.skin-card');
            allCards.forEach(card => {
                card.classList.remove('sortable-ghost');
            });
        }
        
        function handleDragOver(e) {
            if (e.preventDefault) {
                e.preventDefault();
            }
            e.dataTransfer.dropEffect = 'move';
            return false;
        }
        
        function handleDragEnter(e) {
            if (draggedElement !== this) {
                this.classList.add('sortable-ghost');
            }
        }
        
        function handleDragLeave(e) {
            this.classList.remove('sortable-ghost');
        }
        
        function handleDrop(e) {
            if (e.stopPropagation) {
                e.stopPropagation();
            }
            
            if (draggedElement !== this) {
                // 获取所有皮肤卡片
                const allCards = Array.from(document.querySelectorAll('.skin-card'));
                const draggedIndex = allCards.indexOf(draggedElement);
                const targetIndex = allCards.indexOf(this);
                
                // 重新排序DOM元素
                if (draggedIndex < targetIndex) {
                    this.parentNode.insertBefore(draggedElement, this.nextSibling);
                } else {
                    this.parentNode.insertBefore(draggedElement, this);
                }
                
                // 保存排序
                saveSkinOrder();
            }
            
            return false;
        }
        
        // 置顶皮肤功能
        function moveToTop(button) {
            const skinCard = button.closest('.skin-card');
            const skinId = skinCard.dataset.skinId;
            const skinsGrid = document.querySelector('.skins-grid');
            const allCards = Array.from(document.querySelectorAll('.skin-card'));
            
            // 如果已经是第一个，不需要移动
            if (allCards[0] === skinCard) {
                showNotification('该皮肤已经在顶部', 'info');
                return;
            }
            
            // 将卡片移动到顶部（插入式置顶）
            skinsGrid.insertBefore(skinCard, skinsGrid.firstChild);
            
            // 添加动画效果
            skinCard.style.transition = 'transform 0.5s ease';
            skinCard.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                skinCard.style.transform = 'translateY(0)';
            }, 100);
            
            // 保存排序
            saveSkinOrder();
            
            // 显示成功提示
            showNotification('皮肤已置顶', 'success');
        }
        
        // 保存皮肤排序
        function saveSkinOrder() {
            const skinCards = document.querySelectorAll('.skin-card');
            const skinOrder = Array.from(skinCards).map(card => card.dataset.skinId);
            
            // 发送AJAX请求保存排序
            fetch('skin_viewer.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'action=save_skin_order&skin_order=' + encodeURIComponent(JSON.stringify(skinOrder))
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // 显示保存成功提示
                    showNotification('皮肤排序已保存', 'success');
                } else {
                    showNotification('保存排序失败: ' + data.message, 'error');
                }
            })
            .catch(error => {
                console.error('Error saving skin order:', error);
                showNotification('保存排序时发生错误', 'error');
            });
        }
        
        // 显示通知
        function showNotification(message, type) {
            // 移除已存在的通知
            const existingNotification = document.querySelector('.notification');
            if (existingNotification) {
                existingNotification.remove();
            }
            
            // 创建新通知
            const notification = document.createElement('div');
            notification.className = 'notification notification-' + type;
            notification.textContent = message;
            
            // 添加样式
            notification.style.position = 'fixed';
            notification.style.top = '20px';
            notification.style.right = '20px';
            notification.style.padding = '10px 20px';
            notification.style.borderRadius = '5px';
            notification.style.color = 'white';
            notification.style.zIndex = '9999';
            notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            
            if (type === 'success') {
                notification.style.backgroundColor = '#2ecc71';
            } else if (type === 'error') {
                notification.style.backgroundColor = '#e74c3c';
            } else if (type === 'info') {
                notification.style.backgroundColor = '#3498db';
            }
            
            // 添加到页面
            document.body.appendChild(notification);
            
            // 3秒后自动移除
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.5s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 500);
            }, 3000);
        }
    </script>
</head>
<body class="<?php echo getSkinBodyClass($currentSkin); ?>">
    <div class="container">
        <header>
            <h1>皮肤管理中心</h1>
            <p>预览并选择您喜欢的主题皮肤</p>
        </header>
        
        <?php if (isset($successMessage)): ?>
            <div class="success-message">
                <?php echo $successMessage; ?>
            </div>
        <?php endif; ?>
        
        <div class="skins-grid">
            <?php foreach ($skins as $skin): ?>
                <div class="skin-card">
                    <div class="skin-preview">
                        <!-- 调整iframe的src路径 -->
                        <iframe class="preview-content" src="../skin_preview.php?skin=<?php echo $skin['folder']; ?>" frameborder="0" sandbox="allow-same-origin"></iframe>
                    </div>
                    <div class="skin-info">
                        <h3><?php echo $skin['name']; ?></h3>
                        <p class="skin-description"><?php echo $skin['description']; ?></p>
                        <div class="skin-meta">
                            <span>作者: <?php echo $skin['author']; ?></span>
                            <span>版本: <?php echo $skin['version']; ?></span>
                        </div>
                        <div class="action-buttons">
                            <form method="post" style="display:inline;">
                                <input type="hidden" name="skinFolder" value="<?php echo $skin['folder']; ?>">
                                <button type="submit" name="enableSkin" class="btn <?php echo $currentSkin === $skin['folder'] ? 'btn-success btn-disabled' : 'btn-primary'; ?>" <?php echo $currentSkin === $skin['folder'] ? 'disabled' : ''; ?>>
                                    <?php echo $currentSkin === $skin['folder'] ? '当前已启用' : '启用皮肤'; ?>
                                </button>
                            </form>
                            <button type="button" class="btn btn-top" data-skin-folder="<?php echo $skin['folder']; ?>" onclick="moveToTop(this)">
                                置顶
                            </button>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
        

    </div>
</body>
</html>