<?php
// 添加file_category字段到shared_files表

// 设置错误报告
error_reporting(E_ALL);
ini_set('display_errors', 1);

// 定义常量，允许访问配置文件
define('IN_ADMIN_PANEL', true);

// 引入数据库配置
require_once __DIR__ . '/db_config.php';

try {
    // 使用配置文件获取数据库连接
    $db = DatabaseConfig::getConnection('admin');
    if (!$db) {
        die('数据库连接失败');
    }
    
    echo "开始添加file_category字段...\n";
    
    // 检查字段是否已存在
    $result = $db->query("PRAGMA table_info(shared_files)");
    $field_exists = false;
    
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        if ($row['name'] === 'file_category') {
            $field_exists = true;
            break;
        }
    }
    
    if ($field_exists) {
        echo "file_category字段已存在，跳过添加\n";
    } else {
        // 添加字段
        $result = $db->exec("ALTER TABLE shared_files ADD COLUMN file_category TEXT");
        
        if ($result) {
            echo "成功添加file_category字段\n";
        } else {
            echo "添加file_category字段失败: " . $db->lastErrorMsg() . "\n";
        }
    }
    
    // 显示更新后的表结构
    echo "\n更新后的shared_files表结构:\n";
    $result = $db->query("PRAGMA table_info(shared_files)");
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        echo '  ' . $row['name'] . ' (' . $row['type'] . ")\n";
    }
    
    $db->close();
    echo "\n操作完成\n";
    
} catch (Exception $e) {
    echo '错误: ' . $e->getMessage() . "\n";
}
?>