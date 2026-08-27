<?php
/**
 * 测试分类管理页面自动添加新分类功能
 */

// 引入数据库配置
require_once 'db_config.php';

try {
    // 获取数据库连接
    $db = DatabaseConfig::getConnection('admin');
    if (!$db) {
        die('数据库连接失败');
    }
    
    // 创建测试分类文件夹
    $shareFolderPath = __DIR__ . '/../分享文件';
    $testCategoryName = '自动测试分类_' . date('YmdHis');
    $testCategoryPath = $shareFolderPath . '/' . $testCategoryName;
    
    if (!mkdir($testCategoryPath, 0755, true)) {
        die('创建测试分类文件夹失败');
    }
    
    echo "成功创建测试分类文件夹: $testCategoryName\n";
    
    // 调用getCategories接口测试
    $url = "http://127.0.0.1/admin/category_management.php?action=getCategories";
    $response = file_get_contents($url);
    $data = json_decode($response, true);
    
    if ($data['code'] === 200) {
        echo "成功获取分类列表\n";
        
        // 检查新分类是否在返回列表中
        $found = false;
        foreach ($data['data'] as $category) {
            if ($category['name'] === $testCategoryName) {
                $found = true;
                echo "新分类 $testCategoryName 已正确添加到分类列表\n";
                break;
            }
        }
        
        if (!$found) {
            echo "警告: 新分类 $testCategoryName 未在分类列表中找到\n";
        }
    } else {
        echo "获取分类列表失败: " . $data['message'] . "\n";
    }
    
    // 检查数据库中是否添加了新分类
    $stmt = $db->prepare("SELECT * FROM category_sort WHERE category_name = :name");
    $stmt->bindValue(':name', $testCategoryName, SQLITE3_TEXT);
    $result = $stmt->execute();
    
    if ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        echo "新分类 $testCategoryName 已正确添加到数据库 category_sort 表，排序值为: " . $row['sort_order'] . "\n";
    } else {
        echo "警告: 新分类 $testCategoryName 未在数据库 category_sort 表中找到\n";
    }
    
    // 清理测试数据
    rmdir($testCategoryPath);
    $stmt = $db->prepare("DELETE FROM category_sort WHERE category_name = :name");
    $stmt->bindValue(':name', $testCategoryName, SQLITE3_TEXT);
    $stmt->execute();
    
    echo "测试完成，已清理测试数据\n";
    
} catch (Exception $e) {
    echo "测试过程中发生错误: " . $e->getMessage() . "\n";
}
?>