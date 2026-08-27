/**
 * 版权保护脚本 - 混淆版本
 * 确保版权信息始终显示，即使尝试删除也会自动恢复
 */
(function() {
    // 版权信息配置
    var copyrightConfig = {
        text: "3213213文件分享中心 - 版权所有©2025 作者: cencrack -cencrack.com",
        id: "copyright-protection",
        checkInterval: 1000, // 检查间隔(毫秒)
        position: "fixed",
        bottom: "0",
        left: "0",
        right: "0",
        textAlign: "center",
        padding: "8px 0",
        backgroundColor: "var(--color-bg-tertiary)",
        color: "var(--color-text-secondary)",
        fontSize: "12px",
        zIndex: "9999",
        borderTop: "1px solid var(--color-border)"
    };
    
    // 创建版权元素
    function createCopyrightElement() {
        var element = document.createElement('div');
        element.id = copyrightConfig.id;
        
        // 应用样式
        element.style.position = copyrightConfig.position;
        element.style.bottom = copyrightConfig.bottom;
        element.style.left = copyrightConfig.left;
        element.style.right = copyrightConfig.right;
        element.style.textAlign = copyrightConfig.textAlign;
        element.style.padding = copyrightConfig.padding;
        element.style.backgroundColor = copyrightConfig.backgroundColor;
        element.style.color = copyrightConfig.color;
        element.style.fontSize = copyrightConfig.fontSize;
        element.style.zIndex = copyrightConfig.zIndex;
        element.style.borderTop = copyrightConfig.borderTop;
        
        // 设置内容
        element.innerHTML = copyrightConfig.text;
        
        return element;
    }
    
    // 检查并更新页脚信息
      function ensureCopyrightExists() {
          var mainFooter = document.getElementById('main-footer');
          var iframeFooter = document.getElementById('iframe-footer');
          
          // 只在主页面（admin/index.php）显示版权信息
          if (mainFooter && window.location.pathname.includes('admin/index.php')) {
              // 检查页脚是否包含版权信息
              if (!mainFooter.innerHTML.includes('文件分享中心 - 版权所有©2025')) {
                  mainFooter.innerHTML = `
                      <div class="file-path-display">admin/system_info.php</div>
                      <div class="copyright-info">文件分享中心 - 版权所有©2025 作者: cencrack -cencrack.com</div>
                      <div class="skin-display">当前的皮肤: <strong>默认皮肤</strong></div>
                  `;
              }
          }
          // 对于其他页面，不添加版权信息
          else if (iframeFooter && !window.location.pathname.includes('admin/index.php')) {
              // 清除可能存在的版权信息
              if (iframeFooter.innerHTML.includes('文件分享中心 - 版权所有©2025')) {
                  var copyrightDiv = iframeFooter.querySelector('.copyright-info');
                  if (copyrightDiv) {
                      copyrightDiv.innerHTML = '';
                  }
              }
          }
          
          // 移除点击事件，允许用户复制页脚信息
          // 不再添加点击事件监听器，避免复制时弹窗
      }
    
    // 初始化函数
    function init() {
        // 确保DOM已加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                ensureCopyrightExists();
                // 设置定期检查
                setInterval(ensureCopyrightExists, copyrightConfig.checkInterval);
            });
        } else {
            // DOM已加载，立即执行
            ensureCopyrightExists();
            // 设置定期检查
            setInterval(ensureCopyrightExists, copyrightConfig.checkInterval);
        }
    }
    
    // 启动初始化
    init();
    
    // 防止通过控制台删除页脚（仅在admin/index.php中生效）
      var originalRemoveChild = Node.prototype.removeChild;
      Node.prototype.removeChild = function(child) {
          // 只在admin/index.php页面中保护页脚
          if (window.location.pathname.includes('admin/index.php') && 
              child && (child.id === 'main-footer' || child.id === 'iframe-footer')) {
              console.warn('尝试删除页脚信息，已被阻止');
              return child;
          }
          return originalRemoveChild.apply(this, arguments);
      };

      // 防止通过innerHTML清空（仅在admin/index.php中生效）
      var originalSetInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;
      Object.defineProperty(Element.prototype, 'innerHTML', {
          set: function(value) {
              var mainFooter = document.getElementById('main-footer');
              var iframeFooter = document.getElementById('iframe-footer');
              var result = originalSetInnerHTML.call(this, value);

              // 只在admin/index.php页面中保护页脚
              if (window.location.pathname.includes('admin/index.php')) {
                  // 如果页脚元素被清空，重新添加
                  if (this === document.body && (!mainFooter || !mainFooter.innerHTML.includes('文件分享中心 - 版权所有©2025'))) {
                      setTimeout(ensureCopyrightExists, 100);
                  }
                  if (this === document.body && (!iframeFooter || !iframeFooter.innerHTML.includes('文件分享中心 - 版权所有©2025'))) {
                      setTimeout(ensureCopyrightExists, 100);
                  }
              }

              return result;
          }
      });
})();