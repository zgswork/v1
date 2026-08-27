<?php
// 批量调整文件分类处理程序

// 引入认证控制
require_once 'auth.php';

// 引入数据库配置
require_once __DIR__ . '/db_config.php';

// 设置JSON响应头
header('Content-Type: application/json');

// 检查是否登录
if (!isLoggedIn()) {
    echo json_encode(['status' => 'error', 'message' => '未授权访问，请登录后重试']);
    exit;
}

// 检查请求方法
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'message' => '仅支持POST请求']);
    exit;
}

// 获取请求数据
$data = json_decode(file_get_contents('php://input'), true);

if (!$data || !isset($data['file_md5s']) || !isset($data['new_category'])) {
    echo json_encode(['status' => 'error', 'message' => '请求参数不完整']);
    exit;
}

$files = $data['file_md5s']; // 文件MD5数组
$category = $data['new_category']; // 目标分类

// 验证参数
if (empty($files) || !is_array($files)) {
    echo json_encode(['status' => 'error', 'message' => '文件列表不能为空']);
    exit;
}

if (empty($category)) {
    echo json_encode(['status' => 'error', 'message' => '分类不能为空']);
    exit;
}

// 验证分类名称（防止目录遍历攻击）
if (strpos($category, '..') !== false || strpos($category, '/') !== false || strpos($category, '\\') !== false) {
    echo json_encode(['status' => 'error', 'message' => '分类名称包含非法字符']);
    exit;
}

try {
    // 获取数据库连接
    $db = DatabaseConfig::getConnection('admin');
    if (!$db) {
        throw new Exception('数据库连接失败');
    }
    
    // 开始事务
    $db->exec('BEGIN TRANSACTION');
    
    $movedFiles = [];
    $failedFiles = [];
    
    // 获取分享文件目录路径
    $sharedDir = __DIR__ . '/../分享文件';
    
    // 确保目标分类目录存在
    $targetDir = $sharedDir . '/' . $category;
    if (!is_dir($targetDir)) {
        if (!mkdir($targetDir, 0755, true)) {
            throw new Exception('无法创建目标分类目录: ' . $category);
        }
    }
    
    // 处理每个文件
    foreach ($files as $md5) {
        // 查询文件信息
        $stmt = $db->prepare("SELECT file_md5, file_name, file_path, file_category FROM shared_files WHERE file_md5 = :md5");
        $stmt->bindValue(':md5', $md5, SQLITE3_TEXT);
        $result = $stmt->execute();
        
        $fileInfo = $result->fetchArray(SQLITE3_ASSOC);
        
        if (!$fileInfo) {
            $failedFiles[] = ['md5' => $md5, 'reason' => '文件不存在'];
            continue;
        }
        
        $fileName = $fileInfo['file_name'];
        $currentPath = $fileInfo['file_path'];
        $currentCategory = $fileInfo['file_category'];
        
        // 如果文件已经在目标分类中，跳过
        if ($currentCategory === $category) {
            $movedFiles[] = ['name' => $fileName, 'status' => 'already_in_category'];
            continue;
        }
        
        // 构建源文件路径和目标文件路径
        $sourceFilePath = __DIR__ . '/../' . $currentPath;
        $targetFilePath = $targetDir . '/' . $fileName;
        
        // 检查源文件是否存在
        if (!file_exists($sourceFilePath)) {
            $failedFiles[] = ['name' => $fileName, 'reason' => '源文件不存在'];
            continue;
        }
        
        // 检查目标位置是否已存在同名文件
        if (file_exists($targetFilePath)) {
            // 生成唯一文件名
            $fileInfo = pathinfo($fileName);
            $baseName = $fileInfo['filename'];
            $extension = isset($fileInfo['extension']) ? '.' . $fileInfo['extension'] : '';
            $counter = 1;
            
            do {
                $newFileName = $baseName . '(' . $counter . ')' . $extension;
                $targetFilePath = $targetDir . '/' . $newFileName;
                $counter++;
            } while (file_exists($targetFilePath));
            
            $fileName = $newFileName;
        }
        
        // 移动文件
        if (rename($sourceFilePath, $targetFilePath)) {
            // 更新数据库记录
            $newPath = '分享文件/' . $category . '/' . $fileName;
            $updateStmt = $db->prepare("UPDATE shared_files SET file_path = :path, file_category = :category WHERE file_md5 = :md5");
            $updateStmt->bindValue(':path', $newPath, SQLITE3_TEXT);
            $updateStmt->bindValue(':category', $category, SQLITE3_TEXT);
            $updateStmt->bindValue(':md5', $md5, SQLITE3_TEXT);
            
            if ($updateStmt->execute()) {
                $movedFiles[] = ['name' => $fileName, 'status' => 'moved'];
            } else {
                // 如果数据库更新失败，尝试将文件移回原位置
                rename($targetFilePath, $sourceFilePath);
                $failedFiles[] = ['name' => $fileName, 'reason' => '数据库更新失败'];
            }
        } else {
            $failedFiles[] = ['name' => $fileName, 'reason' => '文件移动失败'];
        }
    }
    
    // 提交事务
    $db->exec('COMMIT');
    
    // 返回结果
    echo json_encode([
        'status' => 'success',
        'message' => '批量调整分类完成',
        'success_count' => count($movedFiles),
        'failed_count' => count($failedFiles),
        'moved_files' => $movedFiles,
        'failed_files' => $failedFiles
    ]);
    
} catch (Exception $e) {
    // 回滚事务
    if (isset($db)) {
        $db->exec('ROLLBACK');
    }
    
    echo json_encode(['status' => 'error', 'message' => '操作失败: ' . $e->getMessage()]);
}
?>