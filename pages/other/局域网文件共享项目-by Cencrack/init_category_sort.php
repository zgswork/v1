<?php
// 初始化分类排序数据
error_reporting(E_ALL);
ini_set('display_errors', 1);

// 引入数据库配置
require_once 'admin/db_config.php';

try {
    // 连接数据库
    $db = new SQLite3($dbPath);
    
    // 检查category_sort表是否有数据
    $result = $db->query("SELECT COUNT(*) as count FROM category_sort");
    $row = $result->fetchArray(SQLITE3_ASSOC);
    $count = $row['count'];
    
    echo "当前category_sort表中有 {$count} 条记录\n";
    
    if ($count == 0) {
        echo "category_sort表为空，正在添加初始数据...\n";
        
        // 获取分享文件目录中的所有分类
        $shareFolderPath = __DIR__ . '/分享文件';
        $categories = [];
        
        if (is_dir($shareFolderPath)) {
            $dirs = scandir($shareFolderPath);
            foreach ($dirs as $dir) {
                if ($dir !== '.' && $dir !== '..' && is_dir($shareFolderPath . '/' . $dir)) {
                    $categories[] = $dir;
                }
            }
        }
        
        // 添加默认分类
        if (!in_array('默认分类', $categories)) {
            $categories[] = '默认分类';
        }
        
        // 插入分类排序数据
        $sortOrder = 1;
        foreach ($categories as $category) {
            $stmt = $db->prepare("INSERT INTO category_sort (category_name, sort_order) VALUES (:name, :order)");
            $stmt->bindValue(':name', $category, SQLITE3_TEXT);
            $stmt->bindValue(':order', $sortOrder, SQLITE3_INTEGER);
            $stmt->execute();
            echo "已添加分类: {$category}, 排序: {$sortOrder}\n";
            $sortOrder++;
        }
        
        echo "初始数据添加完成！\n";
    } else {
        echo "category_sort表已有数据，无需初始化。\n";
        
        // 显示当前排序数据
        echo "\n当前分类排序:\n";
        $result = $db->query("SELECT category_name, sort_order FROM category_sort ORDER BY sort_order");
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            echo "- {$row['category_name']}: {$row['sort_order']}\n";
        }
    }
    
    $db->close();
} catch (Exception $e) {
    echo "错误: " . $e->getMessage() . "\n";
}
?>