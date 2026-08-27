<?php
/**
 * 统一皮肤加载器
 * 功能：为所有页面提供一致的皮肤加载机制，确保样式统一且不影响布局
 * 用法：在任何需要加载皮肤的页面中包含此文件即可
 * 基于皮肤规则.md的设计规范实现
 */

/**
 * 获取当前皮肤名称
 * @return string 当前皮肤名称
 */
function getCurrentSkin() {
    // 1. 检查URL参数
    if (isset($_GET['skin'])) {
        return $_GET['skin'];
    }
    if (isset($_GET['theme'])) {
        return $_GET['theme'];
    }
    
    // 2. 检查持久化配置
    $configFile = __DIR__ . '/skin_config.json';
    if (file_exists($configFile)) {
        $config = json_decode(file_get_contents($configFile), true);
        if ($config && isset($config['selectedSkin'])) {
            return $config['selectedSkin'];
        }
    }
    
    // 3. 默认返回warcraft3
    return 'warcraft3';
}

/**
 * 加载选定的皮肤
 * @return array|null 包含皮肤类名和主题的数组
 */
function loadSelectedSkin() {
    $skinName = getCurrentSkin();
    $skinsDir = __DIR__ . '/skins';
    
    // 检查是否为有效皮肤（存在对应的文件夹）
    if (is_dir($skinsDir . '/' . $skinName)) {
        return [
            'theme' => $skinName,
            'class' => "skin-$skinName" // 遵循规范，使用skin-前缀
        ];
    }
    
    // 默认使用warcraft3皮肤
    return [
        'theme' => 'warcraft3',
        'class' => 'skin-warcraft3'
    ];
}

/**
 * 获取标准化的HTML头部皮肤引用代码
 * @param string|null $skinName 指定皮肤名称，如果为null则使用当前皮肤
 * @return string HTML代码片段，用于设置皮肤主题
 */
function getSkinHTMLHead($skinName = null) {
    $skinData = $skinName ? ['theme' => $skinName, 'class' => 'skin-' . $skinName] : loadSelectedSkin();
    if ($skinData) {
        $output = '';
        
        // 检查主题是否有自定义样式文件
        $stylePath = __DIR__ . '/skins/' . $skinData['theme'] . '/style.css';
        if (file_exists($stylePath)) {
            // 生成相对于根目录的路径，确保从任何位置调用都能正确加载
            $output .= "
<link rel=\"stylesheet\" href=\"/skins/{$skinData['theme']}/style.css\" type=\"text/css\" />";
            
            // 读取皮肤CSS文件内容，提取CSS变量
            $cssContent = file_get_contents($stylePath);
            
            // 提取所有:root规则中的CSS变量
            preg_match_all('/:root\s*{([^}]*)}/', $cssContent, $matches);
            $variables = '';
            
            foreach ($matches[1] as $rootContent) {
                // 提取所有以--开头的变量，不仅限于--color-
                preg_match_all('/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/', $rootContent, $varMatches);
                
                foreach ($varMatches[1] as $index => $varName) {
                    $varValue = trim($varMatches[2][$index]);
                    $variables .= "  {$varName}: {$varValue};\n";
                }
            }
            
            // 如果找到变量，创建样式标签
            if (!empty($variables)) {
                $output .= "<style id=\"skin-variables\">
                    :root {
                        --current-theme: {$skinData['theme']};
{$variables}
                    }
                </style>";
            } else {
                // 如果没有找到:root规则，至少设置当前主题变量
                $output .= "<style id=\"skin-variables\">
                    :root {
                        --current-theme: {$skinData['theme']};
                    }
                </style>";
            }
        } else {
            // 如果没有找到样式文件，至少设置当前主题变量
            $output .= "<style id=\"skin-variables\">
                :root {
                    --current-theme: {$skinData['theme']};
                }
            </style>";
        }
        
        return $output;
    }
    return '';
}

/**
 * 获取标准化的body类名
 * @param string|null $skinName 指定皮肤名称，如果为null则使用当前皮肤
 * @return string body标签的类名
 */
function getSkinBodyClass($skinName = null) {
    $skinData = $skinName ? ['theme' => $skinName, 'class' => 'skin-' . $skinName] : loadSelectedSkin();
    if ($skinData) {
        return $skinData['class'];
    }
    return '';
}

/**
 * 获取所有可用皮肤
 * @return array 皮肤信息数组
 */
function getAllSkins() {
    $skinsDir = __DIR__ . '/skins';
    $skins = [];
    
    if (is_dir($skinsDir)) {
        $skinFolders = scandir($skinsDir);
        
        foreach ($skinFolders as $folder) {
            if ($folder === '.' || $folder === '..' || !is_dir($skinsDir . '/' . $folder)) {
                continue;
            }
            
            $skinPath = $skinsDir . '/' . $folder;
            $configFile = $skinPath . '/skin.json';
            
            // 默认皮肤信息
            $skinInfo = [
                'folder' => $folder,
                'name' => ucfirst($folder), // 首字母大写作为默认名称
                'description' => '',
                'previewColor' => '#0066cc', // 默认预览色
                'author' => 'System',
                'version' => '1.0.0'
            ];
            
            // 合并配置文件中的信息
            if (file_exists($configFile)) {
                $config = json_decode(file_get_contents($configFile), true);
                if ($config) {
                    $skinInfo = array_merge($skinInfo, $config);
                }
            }
            
            $skins[] = $skinInfo;
        }
    }
    
    return $skins;
}

/**
 * 保存用户选择的皮肤
 * @param string $skinFolder 皮肤文件夹名
 * @return bool 是否保存成功
 */
function saveSelectedSkin($skinFolder) {
    try {
        $config = ['selectedSkin' => $skinFolder];
        file_put_contents(__DIR__ . '/skin_config.json', json_encode($config));
        return true;
    } catch (Exception $e) {
        return false;
    }
}

// 已在文件上方定义了改进版本的getCurrentSkin()函数，支持URL参数和默认皮肤

/**
 * 输出标准化的皮肤切换JavaScript代码
 * @return string JavaScript代码片段
 */
function getSkinSwitchJS() {
    return <<<JS
<script>
/**
 * 动态切换皮肤
 * @param {string} skinName 皮肤名称
 * @param {boolean} save 是否保存选择到配置文件
 */
function changeSkin(skinName, save = false) {
    // 1. 更新body类名 - 移除所有皮肤类并添加新类
    const body = document.body;
    const skinClasses = Array.from(body.classList).filter(cls => cls.startsWith('skin-'));
    skinClasses.forEach(cls => body.classList.remove(cls));
    body.classList.add('skin-' + skinName);
    
    // 2. 更新data-theme属性
    body.setAttribute('data-theme', skinName);
    
    // 3. 更新CSS变量
    const styleElement = document.getElementById('skin-variables');
    if (styleElement) {
        styleElement.textContent = ":root { --current-theme: " + skinName + "; }";
    }
    
    // 4. 处理自定义覆盖样式（如果存在）
    let overridesLink = document.getElementById('skin-overrides');
    if (!overridesLink) {
        overridesLink = document.createElement('link');
        overridesLink.id = 'skin-overrides';
        overridesLink.rel = 'stylesheet';
        document.head.appendChild(overridesLink);
    }
    
    // 清除旧链接，让浏览器重新加载新主题的覆盖样式
    overridesLink.href = '';
    
    // 异步加载新的样式（如果存在）
    fetch('/skins/' + skinName + '/style.css')
        .then(response => {
            if (response.ok) {
                return response.text();
            }
            throw new Error('Skin CSS not found');
        })
        .then(cssText => {
            // 更新链接引用
            overridesLink.href = '/skins/' + skinName + '/style.css';
            
            // 立即应用CSS变量，确保样式立即生效
            const rootStyle = document.getElementById('skin-variables');
            if (rootStyle) {
                // 提取所有:root规则中的CSS变量
                const rootMatches = cssText.matchAll(/:root\s*\{([^}]*)\}/g);
                let allVariables = '--current-theme: ' + skinName + ';';
                
                for (const match of rootMatches) {
                    // 提取所有以--开头的变量，不仅限于--color-
                    const varMatches = match[1].matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g);
                    for (const varMatch of varMatches) {
                        allVariables += ' ' + varMatch[0];
                    }
                }
                
                rootStyle.textContent = ':root { ' + allVariables + ' }';
            }
            
            // 强制重新渲染以确保样式生效
            setTimeout(() => {
                // 触发重排，确保新样式生效
                document.body.style.display = 'none';
                document.body.offsetHeight; // 触发重排
                document.body.style.display = '';
                
                // 特别处理按钮元素，确保样式正确应用
                const buttons = document.querySelectorAll('.btn, .category-btn, button');
                buttons.forEach(btn => {
                    // 强制重新计算样式
                    const display = btn.style.display;
                    btn.style.display = 'none';
                    btn.offsetHeight; // 触发重排
                    btn.style.display = display;
                });
                
                // 强制重新渲染所有表单元素，确保皮肤样式正确应用
                const formElements = document.querySelectorAll('input, select, textarea');
                formElements.forEach(el => {
                    // 强制重新计算样式
                    const display = el.style.display;
                    el.style.display = 'none';
                    el.offsetHeight; // 触发重排
                    el.style.display = display;
                });
                
                // 添加版权信息
                ensureCopyrightExists();
            }, 100);
        })
        .catch(() => {
            // 忽略错误，继续切换主题
            console.warn('Failed to load skin CSS for:', skinName);
        });
    
    // 5. 强制重新渲染以确保样式生效
    void body.offsetHeight;
    
    // 6. 特别处理表单元素，确保样式正确应用
    const formElements = document.querySelectorAll('input, select, textarea');
    formElements.forEach(el => {
        // 强制重新计算样式
        el.style.display = 'none';
        setTimeout(() => {
            el.style.display = '';
        }, 10);
    });
    
    // 7. 特别处理表格元素，确保样式正确应用
    const tableElements = document.querySelectorAll('table, tr, td, th');
    tableElements.forEach(el => {
        // 强制重新计算样式
        const display = el.style.display;
        el.style.display = 'none';
        el.offsetHeight; // 触发重排
        el.style.display = display;
    });
    
    // 8. 保存用户选择（如果需要）
    if (save) {
        saveUserSkinSelection(skinName);
    }
    
    // 9. 触发主题切换事件
    document.dispatchEvent(new CustomEvent('themeChanged', {
        detail: { theme: skinName }
    }));
    
    // 10. 添加版权信息
    ensureCopyrightExists();
}

/**
 * 保存用户的皮肤选择到服务器
 * @param {string} skinName 皮肤名称
 */
function saveUserSkinSelection(skinName) {
    if (typeof XMLHttpRequest !== 'undefined') {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', window.location.href, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.send('save_skin=' + encodeURIComponent(skinName));
    }
}

// 监听主题切换事件，允许第三方脚本响应主题变化
document.addEventListener('themeChanged', function(event) {
    console.log('主题已切换为:', event.detail.theme);
});

// 页面加载完成后，确保皮肤样式正确应用
document.addEventListener('DOMContentLoaded', function() {
    // 添加版权信息
    ensureCopyrightExists();
    
    // 获取当前皮肤名称，优先从data-theme属性获取
    let currentTheme = document.body.getAttribute('data-theme');
    
    // 如果data-theme不存在，从body类名获取
    if (!currentTheme) {
        const match = document.body.className.match(/skin-(\w+)/);
        currentTheme = match ? match[1] : null;
    }
    
    // 如果还是没有，尝试从URL参数获取
    if (!currentTheme) {
        const urlParams = new URLSearchParams(window.location.search);
        currentTheme = urlParams.get('skin') || urlParams.get('theme');
    }
    
    // 检查皮肤变量样式标签是否存在且包含CSS变量
    const skinVarsElement = document.getElementById('skin-variables');
    const hasVariables = skinVarsElement && skinVarsElement.textContent.includes('--');
    
    // 如果找到了当前主题，但皮肤变量样式标签不存在或不包含CSS变量
    if (currentTheme && !hasVariables) {
        // 加载皮肤CSS文件
        fetch('/skins/' + currentTheme + '/style.css')
            .then(response => {
                if (response.ok) {
                    return response.text();
                }
                throw new Error('Skin CSS not found');
            })
            .then(cssText => {
                // 提取所有:root规则中的CSS变量
                const rootMatches = cssText.matchAll(/:root\s*\{([^}]*)\}/g);
                let allVariables = '--current-theme: ' + currentTheme + ';';
                
                for (const match of rootMatches) {
                    // 提取所有以--开头的变量，不仅限于--color-
                    const varMatches = match[1].matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g);
                    for (const varMatch of varMatches) {
                        allVariables += ' ' + varMatch[0];
                    }
                }
                
                // 更新根样式变量
                skinVarsElement.textContent = ':root { ' + allVariables + ' }';
                
                // 延迟执行按钮重排，确保样式已应用
                setTimeout(() => {
                    const buttons = document.querySelectorAll('.btn, .category-btn, button');
                    buttons.forEach(btn => {
                        // 强制重新计算样式
                        const display = btn.style.display;
                        btn.style.display = 'none';
                        btn.offsetHeight; // 触发重排
                        btn.style.display = display;
                    });
                }, 50);
            })
            .catch(() => {
                console.warn('Failed to load skin CSS for:', currentTheme);
            });
    }
    
    // 设置data-theme属性，确保主题属性始终存在
    if (currentTheme) {
        document.body.setAttribute('data-theme', currentTheme);
        
        // 确保body包含对应的skin类名
        if (!document.body.classList.contains('skin-' + currentTheme)) {
            // 移除所有现有的skin类
            const skinClasses = Array.from(document.body.classList).filter(cls => cls.startsWith('skin-'));
            skinClasses.forEach(cls => document.body.classList.remove(cls));
            
            // 添加新的skin类
            document.body.classList.add('skin-' + currentTheme);
        }
    }
    
    // 强制重新渲染所有按钮元素，确保皮肤样式正确应用
    const buttons = document.querySelectorAll('.btn, .category-btn, button');
    buttons.forEach(btn => {
        // 强制重新计算样式
        const display = btn.style.display;
        btn.style.display = 'none';
        btn.offsetHeight; // 触发重排
        btn.style.display = display;
    });
    
    // 强制重新渲染所有表单元素，确保皮肤样式正确应用
    const formElements = document.querySelectorAll('input, select, textarea');
    formElements.forEach(el => {
        // 强制重新计算样式
        const display = el.style.display;
        el.style.display = 'none';
        el.offsetHeight; // 触发重排
        el.style.display = display;
    });
});

// 版权信息保护函数 - 已禁用
function ensureCopyrightExists() {
    // 不再添加版权信息
}
</script>
JS;
}
