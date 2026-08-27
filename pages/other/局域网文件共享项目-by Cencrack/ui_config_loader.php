<?php
/**
 * UI配置加载器
 * 功能：加载和管理界面配置，包括页眉和页脚
 */

// 配置文件路径
$ui_config_file = __DIR__ . '/ui_config.json';

// 默认配置
$default_ui_config = [
    'header_title' => '文件分享中心',
    'header_description' => '提供各类软件、工具和资料的下载服务',
    'footer_content' => ''
];

/**
 * 加载UI配置
 * @return array 包含header_title, header_description和footer_content的配置数组
 */
function loadUIConfig() {
    global $ui_config_file, $default_ui_config;
    
    if (file_exists($ui_config_file)) {
        $json_content = file_get_contents($ui_config_file);
        $config = json_decode($json_content, true);
        if ($config !== null) {
            // 合并配置，确保所有必需字段都存在
            return array_merge($default_ui_config, $config);
        }
    }
    return $default_ui_config;
}

/**
 * 生成完整的页眉HTML
 * @param array $config 配置数组
 * @return string 完整的页眉HTML
 */
function generateHeaderHTML($config) {
    return '<div style="display: flex; justify-content: center; align-items: center;">
        <h1 style="text-align: center; margin: 0;">' . $config['header_title'] . '</h1>
    </div>
    <p style="text-align: center; margin-top: 30px;">' . $config['header_description'] . '</p>';
}

/**
 * 获取自定义页眉内容
 * @return string 页眉HTML内容
 */
function getCustomHeader() {
    global $ui_config_file, $default_ui_config;
    $config = loadUIConfig();
    
    // 向后兼容：如果是旧版配置格式
    if (isset($config['header_content']) && !isset($config['header_title'])) {
        return $config['header_content'];
    }
    
    // 使用新格式生成页眉
    return generateHeaderHTML($config);
}

/**
 * 获取页脚HTML内容
 * @return string 页脚HTML内容
 */
function getCustomFooter() {
    global $default_ui_config;
    $config = loadUIConfig();
    return isset($config['footer_content']) ? $config['footer_content'] : $default_ui_config['footer_content'];
}