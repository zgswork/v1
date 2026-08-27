<?php
// 文件监控和同步脚本 - 安全增强版

// 引入数据库配置文件
require_once __DIR__ . '/db_config.php';

/**
 * 获取数据库连接
 * @return SQLite3|null 数据库连接对象或null
 */
function getDbConnection() {
    try {
        // 使用数据库配置类获取连接
        $db = DatabaseConfig::getConnection('admin');
        if (!$db) {
            throw new Exception('无法创建数据库连接');
        }
        
        return $db;
    } catch (Exception $e) {
        error_log('数据库连接错误: ' . $e->getMessage());
        return null;
    }
}

/**
 * 获取文件图标的替代函数
 * @param string $extension 文件扩展名
 * @return string 默认图标路径
 */
function getFileIcon($extension) {
    return 'default.png'; // 返回默认图标，因为图标功能已移除
}

/**
 * 同步文件到数据库
 * @param string $action 操作类型：add, delete, modify
 * @param string $file_path 文件路径
 * @return array 操作结果
 */
function syncFileToDb($action, $file_path) {
    $db = getDbConnection();
    if (!$db) {
        return ['status' => 'error', 'message' => '数据库连接失败'];
    }
    
    try {
        if ($action === 'add' || $action === 'modify') {
            if (is_file($file_path)) {
                $file_md5 = md5_file($file_path);
                $file_name = basename($file_path);
                $file_size = filesize($file_path);
                $upload_time = date('Y-m-d H:i:s');
                
                // 计算相对路径
                $share_dir = realpath(dirname(__FILE__) . '/../分享文件');
                $relative_path = str_replace($share_dir, '', $file_path);
                $relative_path = '/' . ltrim($relative_path, '\\/'); // 确保以/开头
                
                // 检查文件是否已存在
                $stmt = $db->prepare("SELECT * FROM shared_files WHERE file_md5 = :md5");
                $stmt->bindValue(':md5', $file_md5, SQLITE3_TEXT);
                $result = $stmt->execute();
                $row = $result->fetchArray(SQLITE3_ASSOC);
                
                if ($row) {
                    // 文件已存在，更新信息
                    $stmt = $db->prepare("UPDATE shared_files SET file_name = :name, file_size = :size, file_path = :path, upload_time = :time WHERE file_md5 = :md5");
                    $stmt->bindValue(':name', $file_name, SQLITE3_TEXT);
                    $stmt->bindValue(':size', $file_size, SQLITE3_INTEGER);
                    $stmt->bindValue(':path', $relative_path, SQLITE3_TEXT);
                    $stmt->bindValue(':time', $upload_time, SQLITE3_TEXT);
                    $stmt->bindValue(':md5', $file_md5, SQLITE3_TEXT);
                    $stmt->execute();
                    return ['status' => 'success', 'message' => "更新文件: $file_name"];
                } else {
                    // 插入新文件
                    $stmt = $db->prepare("INSERT INTO shared_files (file_md5, file_name, file_size, file_path, upload_time) VALUES (:md5, :name, :size, :path, :time)");
                    $stmt->bindValue(':md5', $file_md5, SQLITE3_TEXT);
                    $stmt->bindValue(':name', $file_name, SQLITE3_TEXT);
                    $stmt->bindValue(':size', $file_size, SQLITE3_INTEGER);
                    $stmt->bindValue(':path', $relative_path, SQLITE3_TEXT);
                    $stmt->bindValue(':time', $upload_time, SQLITE3_TEXT);
                    $stmt->execute();
                    return ['status' => 'success', 'message' => "新增文件: $file_name"];
                }
            }
        } else if ($action === 'delete') {
            // 获取文件名，通过文件名查找记录
            $file_name = basename($file_path);
            $stmt = $db->prepare("DELETE FROM shared_files WHERE file_name = :name");
            $stmt->bindValue(':name', $file_name, SQLITE3_TEXT);
            $stmt->execute();
            return ['status' => 'success', 'message' => "删除文件记录: $file_name"];
        }
        return ['status' => 'error', 'message' => '无效的操作或文件路径'];
    } catch (Exception $e) {
        error_log('同步文件错误: ' . $e->getMessage());
        return ['status' => 'error', 'message' => '同步文件时出错: ' . $e->getMessage()];
    } finally {
        $db->close();
    }
}

/**
 * 全量同步文件到数据库
 * @return array 同步结果
 */
function fullSyncFiles() {
    $db = getDbConnection();
    if (!$db) {
        return ['status' => 'error', 'message' => '数据库连接失败', 'added' => 0, 'updated' => 0, 'deleted' => 0];
    }
    
    try {
        // 获取数据库中所有文件
        $existing_files = [];
        $result = $db->query('SELECT file_md5, file_name FROM shared_files');
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $existing_files[$row['file_md5']] = $row['file_name'];
        }
        
        // 扫描所有文件
        $share_dir = realpath(dirname(__FILE__) . '/../分享文件');
        if (!$share_dir || !is_dir($share_dir)) {
            throw new Exception('分享文件目录不存在');
        }
        
        $current_files = [];
        $stats = ['added' => 0, 'updated' => 0, 'deleted' => 0];
        
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($share_dir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        
        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $file_path = $file->getPathname();
                $file_md5 = md5_file($file_path);
                $file_name = $file->getFilename();
                $file_size = $file->getSize();
                $upload_time = date('Y-m-d H:i:s');
                
                // 计算相对路径
                $relative_path = str_replace($share_dir, '', $file_path);
                $relative_path = '/' . ltrim($relative_path, '\\/'); // 确保以/开头
                
                $current_files[$file_md5] = $file_name;
                
                // 检查是否需要新增或更新
                if (!isset($existing_files[$file_md5])) {
                    // 新增文件
                    $stmt = $db->prepare("INSERT INTO shared_files (file_md5, file_name, file_size, file_path, upload_time) VALUES (:md5, :name, :size, :path, :time)");
                    $stmt->bindValue(':md5', $file_md5, SQLITE3_TEXT);
                    $stmt->bindValue(':name', $file_name, SQLITE3_TEXT);
                    $stmt->bindValue(':size', $file_size, SQLITE3_INTEGER);
                    $stmt->bindValue(':path', $relative_path, SQLITE3_TEXT);
                    $stmt->bindValue(':time', $upload_time, SQLITE3_TEXT);
                    $stmt->execute();
                    $stats['added']++;
                    echo "新增: $file_name\n";
                } else {
                    // 检查文件名是否已更改
                    if ($existing_files[$file_md5] !== $file_name) {
                        // 更新文件信息
                        $stmt = $db->prepare("UPDATE shared_files SET file_name = :name, file_size = :size, file_path = :path, upload_time = :time WHERE file_md5 = :md5");
                        $stmt->bindValue(':name', $file_name, SQLITE3_TEXT);
                        $stmt->bindValue(':size', $file_size, SQLITE3_INTEGER);
                        $stmt->bindValue(':path', $relative_path, SQLITE3_TEXT);
                        $stmt->bindValue(':time', $upload_time, SQLITE3_TEXT);
                        $stmt->bindValue(':md5', $file_md5, SQLITE3_TEXT);
                        $stmt->execute();
                        $stats['updated']++;
                        echo "更新: $file_name\n";
                    }
                }
            }
        }
        
        // 删除数据库中不存在的文件
        foreach ($existing_files as $md5 => $name) {
            if (!isset($current_files[$md5])) {
                $stmt = $db->prepare("DELETE FROM shared_files WHERE file_md5 = :md5");
                $stmt->bindValue(':md5', $md5, SQLITE3_TEXT);
                $stmt->execute();
                $stats['deleted']++;
                echo "删除: $name\n";
            }
        }
        
        $db->close();
        echo "全量同步完成\n";
        return ['status' => 'success', 'message' => '全量同步完成', 'stats' => $stats];
    } catch (Exception $e) {
        error_log('全量同步错误: ' . $e->getMessage());
        return ['status' => 'error', 'message' => '全量同步时出错: ' . $e->getMessage()];
    } finally {
        if (isset($db)) {
            $db->close();
        }
    }
}

/**
 * 重命名文件并同步到数据库
 * @param string $file_md5 文件MD5
 * @param string $new_name 新文件名
 * @return array 操作结果
 */
function renameFileAndSync($file_md5, $new_name) {
    $db = getDbConnection();
    if (!$db) {
        return ['status' => 'error', 'message' => '数据库连接失败'];
    }
    
    try {
        // 验证文件名
        if (!preg_match('/^[a-zA-Z0-9_\-\.\u4e00-\u9fa5]+$/', $new_name)) {
            throw new Exception('文件名包含非法字符');
        }
        
        // 从数据库获取文件信息
        $stmt = $db->prepare("SELECT file_name, file_path FROM shared_files WHERE file_md5 = :md5");
        $stmt->bindValue(':md5', $file_md5, SQLITE3_TEXT);
        $result = $stmt->execute();
        $file_info = $result->fetchArray(SQLITE3_ASSOC);
        
        if (!$file_info) {
            throw new Exception('文件不存在');
        }
        
        // 构建实际文件路径
        $share_dir = realpath(dirname(__FILE__) . '/../分享文件');
        $old_file_path = $share_dir . $file_info['file_path'];
        
        // 确保文件存在
        if (!file_exists($old_file_path)) {
            throw new Exception('文件在文件系统中不存在');
        }
        
        // 构建新文件路径
        $dir_path = dirname($old_file_path);
        $new_file_path = $dir_path . '/' . $new_name;
        
        // 检查新文件名是否已存在
        if (file_exists($new_file_path)) {
            throw new Exception('新文件名已存在');
        }
        
        // 重命名文件
        if (!rename($old_file_path, $new_file_path)) {
            throw new Exception('文件重命名失败');
        }
        
        // 更新数据库
        $relative_path = str_replace($share_dir, '', $new_file_path);
        $relative_path = '/' . ltrim($relative_path, '\\/'); // 确保以/开头
        
        $stmt = $db->prepare("UPDATE shared_files SET file_name = :name, file_path = :path WHERE file_md5 = :md5");
        $stmt->bindValue(':name', $new_name, SQLITE3_TEXT);
        $stmt->bindValue(':path', $relative_path, SQLITE3_TEXT);
        $stmt->bindValue(':md5', $file_md5, SQLITE3_TEXT);
        $stmt->execute();
        
        return ['status' => 'success', 'message' => "文件重命名成功: '{$file_info['file_name']}' -> '$new_name'"];
    } catch (Exception $e) {
        error_log('文件重命名错误: ' . $e->getMessage());
        return ['status' => 'error', 'message' => '文件重命名失败: ' . $e->getMessage()];
    } finally {
        $db->close();
    }
}

// 主逻辑
try {
    // 设置错误报告
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
    
    // 检查是否为AJAX请求
    $is_ajax = isset($_SERVER['HTTP_X_REQUESTED_WITH']) && $_SERVER['HTTP_X_REQUESTED_WITH'] === 'XMLHttpRequest';
    
    if ($is_ajax) {
        header('Content-Type: application/json');
    }
    
    // 处理JSON请求
    $json_data = null;
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_SERVER['CONTENT_TYPE']) && 
        strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false) {
        $json_data = json_decode(file_get_contents('php://input'), true);
    }
    
    if (isset($_GET['action'])) {
        $action = $_GET['action'];
        
        switch ($action) {
            case 'sync':
                $result = fullSyncFiles();
                if ($is_ajax) {
                    echo json_encode($result);
                } else {
                    echo $result['message'] . "\n";
                    if (isset($result['stats'])) {
                        echo "新增: " . $result['stats']['added'] . " 个文件\n";
                        echo "更新: " . $result['stats']['updated'] . " 个文件\n";
                        echo "删除: " . $result['stats']['deleted'] . " 个文件\n";
                    }
                }
                break;
                
            case 'rename':
            case 'rename_sync':
                // 处理文件重命名请求
                // 支持传统POST和JSON请求
                $file_md5 = isset($json_data['file_md5']) ? $json_data['file_md5'] : (isset($_POST['file_md5']) ? $_POST['file_md5'] : null);
                $new_name = isset($json_data['new_name']) ? $json_data['new_name'] : (isset($_POST['new_name']) ? $_POST['new_name'] : null);
                
                if ($file_md5 && $new_name) {
                    $result = renameFileAndSync($file_md5, $new_name);
                    echo json_encode($result);
                } else {
                    echo json_encode(['status' => 'error', 'message' => '缺少必要参数']);
                }
                break;
                
            default:
                $response = ['status' => 'error', 'message' => '未知操作'];
                if ($is_ajax) {
                    echo json_encode($response);
                } else {
                    echo $response['message'] . "\n";
                }
        }
    } else {
        $response = ['status' => 'error', 'message' => '请指定操作参数'];
        if ($is_ajax) {
            echo json_encode($response);
        } else {
            echo $response['message'] . "\n";
        }
    }
} catch (Exception $e) {
    error_log('文件监控脚本错误: ' . $e->getMessage());
    $response = ['status' => 'error', 'message' => '操作失败: ' . $e->getMessage()];
    if (isset($is_ajax) && $is_ajax) {
        header('Content-Type: application/json');
        echo json_encode($response);
    } else {
        echo $response['message'] . "\n";
    }
}
?>