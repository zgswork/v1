<?php
/**
 * 皮肤选择器组件
 * 用法：在任何页面中包含此文件，将显示一个皮肤选择下拉菜单
 */

require_once 'skin_loader.php';

// 获取所有可用皮肤
$allSkins = getAllSkins();
$currentSkin = getCurrentSkin();
?>

<div class="skin-selector" style="margin: 10px 0;">
    <label for="theme-selector" style="margin-right: 10px;">选择主题:</label>
    <select id="theme-selector" class="form-control" style="width: auto; display: inline-block;">
        <?php foreach ($allSkins as $skin): ?>
            <option value="<?php echo $skin['folder']; ?>" <?php echo ($skin['folder'] === $currentSkin) ? 'selected' : ''; ?>>
                <?php echo $skin['name']; ?>
            </option>
        <?php endforeach; ?>
    </select>
    <button id="apply-skin" class="btn btn-apply" style="margin-left: 10px;">应用</button>
    <a href="skin_manager.php" class="btn btn-preview" style="margin-left: 5px;">管理皮肤</a>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const themeSelector = document.getElementById('theme-selector');
    const applyButton = document.getElementById('apply-skin');
    
    // 当点击应用按钮时切换皮肤
    applyButton.addEventListener('click', function() {
        const selectedTheme = themeSelector.value;
        
        // 使用皮肤加载器中的函数切换皮肤
        if (typeof changeSkin === 'function') {
            changeSkin(selectedTheme, true);
            
            // 显示成功消息
            const message = document.createElement('div');
            message.className = 'alert alert-success';
            message.textContent = '主题已切换为: ' + selectedTheme;
            message.style.position = 'fixed';
            message.style.top = '20px';
            message.style.right = '20px';
            message.style.zIndex = '9999';
            message.style.padding = '10px 15px';
            message.style.borderRadius = '4px';
            message.style.backgroundColor = 'var(--success-bg, #d4edda)';
            message.style.border = '1px solid var(--success-border, #c3e6cb)';
            message.style.color = 'var(--success-text, #155724)';
            
            document.body.appendChild(message);
            
            // 3秒后移除消息
            setTimeout(function() {
                if (message.parentNode) {
                    message.parentNode.removeChild(message);
                }
            }, 3000);
        } else {
            // 如果changeSkin函数不可用，则刷新页面
            window.location.href = window.location.pathname + '?skin=' + selectedTheme;
        }
    });
    
    // 当选择器改变时，预览皮肤（不保存）
    themeSelector.addEventListener('change', function() {
        const selectedTheme = themeSelector.value;
        
        // 使用皮肤加载器中的函数预览皮肤
        if (typeof changeSkin === 'function') {
            changeSkin(selectedTheme, false);
        }
    });
});
</script>