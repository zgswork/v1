<?php
// 后台管理入口 - 重构版
// 启用错误报告（开发环境）
error_reporting(E_ALL);
ini_set('display_errors', 1);

// 引入认证控制
require_once 'auth.php';

// 保护页面，确保只有登录用户才能访问
protectPage();

// 获取当前登录用户信息
$admin_username = $_SESSION['admin_username'] ?? '未知用户';
$admin_nickname = $_SESSION['admin_nickname'] ?? $admin_username;
$admin_role = $_SESSION['admin_role'] ?? 'user';

// 引入统一皮肤加载器
include_once __DIR__ . '/../skin_loader.php';

// 获取当前页面路径，用于菜单高亮
$current_page = basename($_SERVER['PHP_SELF']);

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
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>后台管理中心</title>
    <link rel="stylesheet" href="../css/font-awesome/font-awesome.min.css">
    <!-- 加载皮肤CSS -->
    <?php echo getSkinHTMLHead($currentSkin); ?>
    <style>
        /* 基础重置 */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        html, body {
            height: 100%;
            overflow: hidden;
        }
        
        /* 顶部导航栏 */
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px;
            border-bottom: 1px solid var(--color-border);
            background-color: var(--color-bg-secondary);
        }
        
        .header h1 {
            font-size: 20px;
            font-weight: 500;
        }
        
        .user-info {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        /* 主要内容容器 */
        .main-container {
            display: flex;
            height: calc(100vh - 40px); /* 减少高度给状态栏留出空间 */
        }
        
        /* 右侧浏览器区域 */
        .browser-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            height: calc(100% - 40px); /* 减少高度给状态栏留出空间 */
            background-color: var(--color-bg-primary);
            margin-top: 10px;
            margin-bottom: 10px; /* 增加底部边距，避免被页脚遮挡 */
        }
        
        /* 底部状态栏 */
        .status-bar {
            height: 40px;
            background-color: var(--color-bg-tertiary);
            border-top: 1px solid var(--color-border);
            display: flex;
            align-items: center;
            padding: 0 20px;
            color: var(--color-text-secondary);
            font-size: 14px;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 1000;
        }
        
        /* 文件路径显示 - 靠左 */
        .file-path-display {
            font-family: monospace;
            flex: 0 0 auto;
        }
        
        /* 版权信息 - 居中 */
        .copyright-info {
            flex: 1;
            text-align: center;
            margin: 0 20px;
        }
        
        /* 皮肤显示 - 靠右 */
        .skin-display {
            flex: 0 0 auto;
            font-family: monospace;
            color: var(--theme-color);
        }
        
        /* 左侧功能菜单 */
        .menu-container {
            width: 300px;
            background-color: transparent;
            border-right: 1px solid var(--color-border);
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: var(--color-spacing-md);
            padding-bottom: 35px; /* 添加底部边距，避免被页脚遮挡 */
        }
        
        /* 菜单容器边框样式 */
        .menu-box {
            border: 2px solid var(--color-border);
            border-radius: var(--color-radius-md);
            background-color: var(--color-bg-secondary);
            padding: var(--color-spacing-md);
        }
        
        .menu-title {
            color: var(--theme-color);
            font-size: 16px;
            font-weight: 500;
            margin-bottom: 15px;
            text-align: center;
        }
        
        /* 导航菜单样式 */
        .nav-menu {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .nav-item {
            margin-bottom: 5px;
            position: relative;
        }
        
        .nav-link {
            display: flex;
            align-items: center;
            padding: 12px 15px;
            color: var(--color-text-primary);
            text-decoration: none;
            border-radius: var(--color-radius-sm);
            transition: all var(--color-transition-normal) ease;
            font-size: 14px;
            position: relative;
            overflow: hidden;
        }
        
        .nav-link::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background-color: var(--theme-color);
            transform: scaleY(0);
            transition: transform var(--color-transition-normal) ease;
        }
        
        .nav-link:hover {
            background-color: var(--color-bg-hover, rgba(0, 0, 0, 0.05));
            color: var(--theme-color);
            padding-left: 20px;
        }
        
        .nav-link:hover::before {
            transform: scaleY(1);
        }
        
        .nav-link.active {
            background-color: var(--color-bg-active, rgba(0, 0, 0, 0.1));
            color: var(--theme-color);
            font-weight: 500;
        }
        
        .nav-link.active::before {
            transform: scaleY(1);
        }
        
        .nav-link i {
            width: 20px;
            height: 20px;
            margin-right: 10px;
            text-align: center;
            font-size: 16px;
            display: inline-block;
            line-height: 20px;
        }
        
        /* 菜单分组样式 */
        .nav-group {
            margin-bottom: 20px;
        }
        
        .nav-group-title {
            color: var(--color-text-secondary);
            font-size: 12px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 15px 0 8px 15px;
            padding-bottom: 5px;
            border-bottom: 1px solid var(--color-border-light);
        }
        
        /* 浏览器控制栏 */
        .browser-controls {
            height: 40px;
            background-color: var(--color-bg-tertiary);
            border-bottom: 1px solid var(--color-border);
            display: flex;
            align-items: center;
            padding: 0 var(--color-spacing-md);
        }
        
        /* 标签页 */
        .tabs {
            display: flex;
            gap: 5px;
        }
        
        .tab {
            padding: 8px 15px;
            background-color: var(--color-bg-secondary);
            border-radius: var(--color-radius-sm) var(--color-radius-sm) 0 0;
            color: var(--color-text-secondary);
            font-size: 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .tab i {
            font-size: 14px;
        }
        
        .tab span {
            white-space: nowrap;
        }
        
        .tab.active {
            background-color: var(--color-bg-primary);
            color: var(--color-text-primary);
            border-bottom: 2px solid var(--theme-color);
        }
        
        .tab-close {
            font-size: 16px;
            opacity: 0.7;
            cursor: pointer;
            margin-left: 5px;
        }
        
        .tab-close:hover {
            opacity: 1;
        }
        
        /* iframe容器 */
        .iframe-container {
            flex: 1;
            position: relative;
            width: 100%;
            height: calc(100% - 40px);
        }
        
        .iframe-container iframe {
            width: 100%;
            height: 100%;
            border: none;
        }
        
        /* 加载状态 */
        .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: var(--color-bg-overlay, rgba(0, 0, 0, 0.5));
            display: flex;
            align-items: center;
            justify-content: center;
            display: none;
            z-index: 1000;
        }
        
        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid var(--color-border-light, #f3f3f3);
            border-top: 3px solid var(--theme-color);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
    <!-- 皮肤切换JavaScript -->
    <?php echo getSkinSwitchJS(); ?>
</head>
<body class="<?php echo getSkinBodyClass($currentSkin); ?>" data-theme="<?php echo $currentSkin; ?>">
    <div class="cyberpunk-noise"></div>
    <!-- 顶部导航栏 -->
    <header class="header">
        <h1>后台管理中心</h1>
        <div class="user-info">
            <i class="fa fa-user-circle-o"></i> 
            <span><?php echo htmlspecialchars($admin_nickname, ENT_QUOTES, 'UTF-8'); ?></span>
            <small style="color: var(--color-text-secondary);">(<?php echo htmlspecialchars($admin_role, ENT_QUOTES, 'UTF-8'); ?>)</small>
            <a href="reset_password.php" class="logout-btn" style="margin-left: 10px; color: var(--theme-color); text-decoration: none;" target="_blank">
                <i class="fa fa-key"></i> 修改密码
            </a>
            <a href="logout.php" class="logout-btn" style="margin-left: 10px; color: var(--color-danger); text-decoration: none;">
                <i class="fa fa-sign-out"></i> 退出
            </a>
        </div>
    </header>
    
    <!-- 主要内容区域 -->
    <div class="main-container">
        <!-- 左侧功能菜单容器 -->
        <div class="menu-container">
            <!-- 功能菜单边框容器 -->
            <div class="menu-box">
                <div class="menu-title">功能菜单</div>
                
                <!-- 系统管理分组 -->
                <?php if (hasPagePermission('system_info.php') || hasPagePermission('admin_db_viewer.php') || hasPagePermission('user_management.php')): ?>
                <div class="nav-group">
                    <div class="nav-group-title">系统管理</div>
                    <ul class="nav-menu">
                        <?php if (hasPagePermission('system_info.php')): ?>
                        <li class="nav-item">
                            <a href="#" class="nav-link" onclick="loadPage('system_info.php', '服务器环境')">
                                <i class="fa fa-server"></i>
                                <span>服务器环境</span>
                            </a>
                        </li>
                        <?php endif; ?>
                        <?php if (hasPagePermission('admin_db_viewer.php')): ?>
                        <li class="nav-item">
                            <a href="#" class="nav-link" onclick="loadPage('admin_db_viewer.php', '查看数据库')">
                                <i class="fa fa-database"></i>
                                <span>查看数据库</span>
                            </a>
                        </li>
                        <?php endif; ?>
                        <?php if (hasPagePermission('user_management.php')): ?>
                        <li class="nav-item">
                            <a href="#" class="nav-link" onclick="loadPage('user_management.php', '用户管理')">
                                <i class="fa fa-users"></i>
                                <span>用户管理</span>
                            </a>
                        </li>
                        <?php endif; ?>
                    </ul>
                </div>
                <?php endif; ?>
                
                <!-- 文件管理分组 -->
                <?php if (hasPagePermission('category_management.php') || hasPagePermission('file_preview.php') || hasPagePermission('file_upload.php')): ?>
                <div class="nav-group">
                    <div class="nav-group-title">文件管理</div>
                    <ul class="nav-menu">
                        <?php if (hasPagePermission('category_management.php')): ?>
                        <li class="nav-item">
                            <a href="#" class="nav-link" onclick="loadPage('category_management.php', '分类管理')">
                                <i class="fa fa-folder-open"></i>
                                <span>分类管理</span>
                            </a>
                        </li>
                        <?php endif; ?>
                        <?php if (hasPagePermission('file_preview.php')): ?>
                        <li class="nav-item">
                            <a href="#" class="nav-link" onclick="loadPage('file_preview.php', '文件管理')">
                                <i class="fa fa-folder"></i>
                                <span>文件管理</span>
                            </a>
                        </li>
                        <?php endif; ?>
                        <?php if (hasPagePermission('file_upload.php')): ?>
                        <li class="nav-item">
                            <a href="#" class="nav-link" onclick="loadPage('file_upload.php', '上传文件')">
                                <i class="fa fa-upload"></i>
                                <span>上传文件</span>
                            </a>
                        </li>
                        <?php endif; ?>
                    </ul>
                </div>
                <?php endif; ?>
                
                <!-- 界面设置分组 -->
                <?php if (hasPagePermission('skin_viewer.php') || hasPagePermission('ui_settings.php')): ?>
                <div class="nav-group">
                    <div class="nav-group-title">界面设置</div>
                    <ul class="nav-menu">
                        <?php if (hasPagePermission('skin_viewer.php')): ?>
                        <li class="nav-item">
                            <a href="#" class="nav-link" onclick="loadPage('skin_viewer.php', '皮肤管理')">
                                <i class="fa fa-paint-brush"></i>
                                <span>皮肤管理</span>
                            </a>
                        </li>
                        <?php endif; ?>
                        <?php if (hasPagePermission('ui_settings.php')): ?>
                        <li class="nav-item">
                            <a href="#" class="nav-link" onclick="loadPage('ui_settings.php', '界面设置')">
                                <i class="fa fa-cog"></i>
                                <span>界面设置</span>
                            </a>
                        </li>
                        <?php endif; ?>
                        <li class="nav-item">
                            <a href="<?php 
                                // 获取协议
                                $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
                                // 获取主机名
                                $host = $_SERVER['HTTP_HOST'];
                                // 获取网站根目录
                                $basePath = rtrim(dirname($_SERVER['PHP_SELF']), '/\\');
                                // 计算前台URL路径
                                $frontendPath = str_replace('/admin', '', $basePath);
                                // 确保以/开头
                                $frontendPath = '/' . ltrim($frontendPath, '/');
                                // 组合完整URL
                                $frontendUrl = $protocol . '://' . $host . $frontendPath;
                                echo $frontendUrl;
                            ?>" target="_blank" class="nav-link">
                                <i class="fa fa-home"></i>
                                <span>返回前台</span>
                            </a>
                        </li>
                    </ul>
                </div>
                <?php endif; ?>
            </div>
        </div>
        
        <!-- 右侧浏览器区域 -->
        <div class="browser-container">
            <!-- 浏览器控制栏 -->
            <div class="browser-controls">
                <div class="tabs" id="tabs">
                    <!-- 标签页将通过JavaScript动态创建 -->
                </div>
            </div>
            
            <!-- iframe容器 -->
            <div class="iframe-container">
                <div class="loading-overlay" id="loading-overlay">
                    <div class="loading-spinner"></div>
                </div>
                <iframe id="content-frame" src="about:blank"></iframe>
            </div>
        </div>
    </div>
    
    <!-- 底部状态栏 -->
    <footer class="status-bar" id="main-footer">
        <div class="file-path-display">admin/system_info.php</div>
        <div class="copyright-info">文件分享中心 - 版权所有©2025 作者: cencrack -cencrack.com</div>
        <div class="skin-display">当前皮肤: <strong><?php echo $currentSkin; ?></strong></div>
    </footer>
    
    <!-- 版权保护脚本 -->
    <script src="copyright_protection.js?ver=<?php echo time(); ?>"></script>
    
    <script>
        // 当前活跃标签
        let activeTab = '';
        
        // 标签页映射
        let tabPages = {};
        
        // 页面加载完成后初始化
          document.addEventListener('DOMContentLoaded', function() {
              // 初始化加载服务器环境页面
              loadPage('system_info.php', '服务器环境');
              // 菜单功能已简化，移除折叠功能
              
              // 确保主页面的页脚内容正确显示
              const mainFooter = document.getElementById('main-footer');
              if (mainFooter) {
                  const currentSkin = '<?php echo $currentSkin; ?>';
                  mainFooter.innerHTML = `
                      <div class="file-path-display">admin/system_info.php</div>
                      <div class="copyright-info">文件分享中心 - 版权所有©2025 作者: cencrack -cencrack.com</div>
                      <div class="skin-display">当前的皮肤: <strong>${currentSkin}</strong></div>
                  `;
              }
          });
        
        // 加载页面到iframe
          function loadPage(url, title) {
              // 显示加载状态
              showLoading();

              // 显示文件路径在菜单顶部
              document.querySelector('.file-path-display').textContent = 'admin/' + url;

              // 更新主页面的页脚内容
              const mainFooter = document.getElementById('main-footer');
              if (mainFooter) {
                  const currentSkin = '<?php echo $currentSkin; ?>';
                  mainFooter.innerHTML = `
                      <div class="file-path-display">admin/${url}</div>
                      <div class="copyright-info">文件分享中心 - 版权所有©2025 作者: cencrack -cencrack.com</div>
                      <div class="skin-display">当前的皮肤: <strong>${currentSkin}</strong></div>
                  `;
              }

              // 更新导航菜单的活动状态
              updateActiveNavLink(url);

              // 生成唯一标签ID
              const tabId = 'tab_' + Date.now();
            
            // 检查是否已存在相同URL的标签
            for (let id in tabPages) {
                if (tabPages[id].url === url) {
                    // 激活已存在的标签
                    activateTab(id);
                    document.getElementById('content-frame').src = url;
                    hideLoading();
                    return;
                }
            }
            
            // 创建新标签
            const tabsContainer = document.getElementById('tabs');
            const newTab = document.createElement('div');
            newTab.className = 'tab active';
            newTab.id = tabId;
            newTab.dataset.page = tabId;
            
            // 根据URL获取对应的图标
            let iconClass = 'fa-file'; // 默认图标
            if (url.includes('system_info.php')) {
                iconClass = 'fa-server';
            } else if (url.includes('admin_db_viewer.php')) {
                iconClass = 'fa-database';
            } else if (url.includes('user_management.php')) {
                iconClass = 'fa-users';
            } else if (url.includes('category_management.php')) {
                iconClass = 'fa-folder-open';
            } else if (url.includes('file_preview.php')) {
                iconClass = 'fa-folder';
            } else if (url.includes('file_upload.php')) {
                iconClass = 'fa-upload';
            } else if (url.includes('skin_viewer.php')) {
                iconClass = 'fa-paint-brush';
            } else if (url.includes('ui_settings.php')) {
                iconClass = 'fa-cog';
            }
            
            newTab.innerHTML = `
                <i class="fa ${iconClass}"></i>
                <span>${title}</span>
                <span class="tab-close" onclick="closeTab('${tabId}', event)">&times;</span>
            `;
            
            // 添加点击事件
            newTab.addEventListener('click', function() {
                activateTab(tabId);
                document.getElementById('content-frame').src = tabPages[tabId].url;
                updateActiveNavLink(tabPages[tabId].url);
            });
            
            // 保存标签信息
            tabPages[tabId] = { title: title, url: url };
            
            // 添加新标签并激活
            tabsContainer.appendChild(newTab);
            activateTab(tabId);
            
            // 加载页面到iframe
            const iframe = document.getElementById('content-frame');
            iframe.src = url;
            
            // 添加iframe加载完成事件监听器
            iframe.onload = function() {
                hideLoading();
                // 移除事件监听器以避免多次调用
                iframe.onload = null;
            };
        }
        
        // 更新导航菜单的活动状态
        function updateActiveNavLink(url) {
            // 移除所有导航链接的活动状态
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });
            
            // 根据URL设置对应的导航链接为活动状态
            document.querySelectorAll('.nav-link').forEach(link => {
                const onclickAttr = link.getAttribute('onclick');
                if (onclickAttr && onclickAttr.includes(`'${url}'`)) {
                    link.classList.add('active');
                }
            });
        }
        
        // 激活标签
          function activateTab(tabId) {
              // 移除所有标签的激活状态
              document.querySelectorAll('.tab').forEach(tab => {
                  tab.classList.remove('active');
              });

              // 激活指定标签
              const tab = document.getElementById(tabId);
              if (tab) {
                  tab.classList.add('active');
                  activeTab = tabId;
                  
                  // 更新主页面的页脚内容
                  const tabInfo = tabPages[tabId];
                  if (tabInfo && tabInfo.url) {
                      const mainFooter = document.getElementById('main-footer');
                      if (mainFooter) {
                          const currentSkin = '<?php echo $currentSkin; ?>';
                          mainFooter.innerHTML = `
                              <div class="file-path-display">admin/${tabInfo.url}</div>
                              <div class="copyright-info">文件分享中心 - 版权所有©2025 作者: cencrack -cencrack.com</div>
                              <div class="skin-display">当前的皮肤: <strong>${currentSkin}</strong></div>
                          `;
                      }
                  }
              }
          }
        
        // 关闭标签
        function closeTab(tabId, event) {
            // 阻止事件冒泡
            if (event) {
                event.stopPropagation();
            }
            
            // 不能关闭最后一个标签
            if (Object.keys(tabPages).length <= 1) {
                return;
            }
            
            const tabElement = document.getElementById(tabId);
            if (tabElement) {
                // 移除标签元素
                tabElement.remove();
                
                // 从映射中删除
                delete tabPages[tabId];
                
                // 如果关闭的是当前激活标签，激活第一个标签
                  if (tabId === activeTab) {
                      const firstTabId = Object.keys(tabPages)[0];
                      activateTab(firstTabId);
                      const iframe = document.getElementById('content-frame');
                      iframe.src = tabPages[firstTabId].url;

                      // 更新主页面的页脚内容
                      const mainFooter = document.getElementById('main-footer');
                      if (mainFooter) {
                          const currentSkin = '<?php echo $currentSkin; ?>';
                          mainFooter.innerHTML = `
                              <div class="file-path-display">admin/${tabPages[firstTabId].url}</div>
                              <div class="copyright-info">文件分享中心 - 版权所有©2025 作者: cencrack -cencrack.com</div>
                              <div class="skin-display">当前的皮肤: <strong>${currentSkin}</strong></div>
                          `;
                      }
                    
                    // 添加iframe加载完成事件监听器
                    iframe.onload = function() {
                        hideLoading();
                        // 移除事件监听器以避免多次调用
                        iframe.onload = null;
                    };
                }
            }
        }
        
        // 显示加载状态
        function showLoading() {
            document.getElementById('loading-overlay').style.display = 'flex';
        }
        
        // 隐藏加载状态
        function hideLoading() {
            document.getElementById('loading-overlay').style.display = 'none';
        }
    </script>
</body>
</html>