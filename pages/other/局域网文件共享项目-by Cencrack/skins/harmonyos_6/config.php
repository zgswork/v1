<?php
/**
 * 鸿蒙6.0风格皮肤配置
 * 设计理念：简洁、现代、科技感，采用蓝色系为主色调
 */

return [
    'name' => '鸿蒙6.0',
    'description' => '鸿蒙6.0风格界面，简洁现代的科技蓝设计，清新明亮的视觉体验',
    'version' => '1.0.0',
    'author' => '鸿蒙设计团队',
    'preview' => 'harmonyos_6_preview.jpg',
    'css_file' => 'harmonyos_6/style.css',
    'colors' => [
        'primary' => '#007aff',      // 主色调：科技蓝
        'secondary' => '#34c759',    // 次要色：清新绿
        'success' => '#34c759',      // 成功色：清新绿色
        'danger' => '#ff3b30',       // 危险色：醒目红色
        'warning' => '#ff9500',      // 警告色：温暖橙色
        'info' => '#5ac8fa',         // 信息色：天空蓝
        'light' => '#f2f2f7',       // 浅色背景
        'dark' => '#333333',         // 深色文本
    ],
    'features' => [
        'rounded_corners' => true,   // 圆角设计
        'shadows' => true,           // 阴影效果
        'animations' => true,        // 动画效果
        'responsive' => true,        // 响应式设计
        'dark_mode' => true,         // 支持深色模式
    ],
    'compatibility' => [
        'admin_panel' => true,       // 后台管理面板兼容
        'file_manager' => true,      // 文件管理器兼容
        'login_page' => true,        // 登录页面兼容
        'upload_page' => true,       // 上传页面兼容
        'user_management' => true,   // 用户管理兼容
        'system_info' => true,       // 系统信息兼容
        'skin_manager' => true,      // 皮肤管理兼容
    ]
];
?>