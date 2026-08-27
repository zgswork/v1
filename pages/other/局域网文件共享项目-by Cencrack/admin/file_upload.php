<?php
/**
 * 文件上传管理页面
 * 功能：支持批量上传文件，显示上传进度，选择目标分类目录
 */

// 设置错误报告（仅开发环境）
error_reporting(E_ALL);
ini_set('display_errors', 1);

// 引入错误日志配置
require_once 'error_log_config.php';

// 引入认证控制
require_once 'auth.php';

// 保护页面，确保只有登录用户才能访问
protectPage();

// 修复上传问题的初始化代码
// 确保session启动
if (session_status() === PHP_SESSION_NONE) {
    // 检查session目录是否可写
    $session_path = ini_get('session.save_path');
    if (!is_dir($session_path)) {
        // 尝试创建session目录
        if (!mkdir($session_path, 0777, true)) {
            // 如果无法创建，使用系统临时目录
            $session_path = sys_get_temp_dir();
            ini_set('session.save_path', $session_path);
        }
    }
    
    // 启动session
    session_start();
}

// 设置上传目录
$upload_tmp_dir = ini_get('upload_tmp_dir');
if (empty($upload_tmp_dir)) {
    // 使用系统临时目录
    $upload_tmp_dir = sys_get_temp_dir();
    ini_set('upload_tmp_dir', $upload_tmp_dir);
}

// 确保上传目录存在且可写
if (!is_dir($upload_tmp_dir)) {
    mkdir($upload_tmp_dir, 0777, true);
}

// 增加PHP执行时间和内存限制
set_time_limit(300);
ini_set('memory_limit', '256M');
ini_set('max_execution_time', 300);
ini_set('max_input_time', 300);

// 检查并增加上传限制
$current_upload_limit = ini_get('upload_max_filesize');
$current_post_limit = ini_get('post_max_size');

// 如果限制小于100M，尝试增加
if (return_bytes($current_upload_limit) < 100 * 1024 * 1024) {
    ini_set('upload_max_filesize', '100M');
}

if (return_bytes($current_post_limit) < 100 * 1024 * 1024) {
    ini_set('post_max_size', '100M');
}

/**
 * 将配置值转换为字节数
 */
function return_bytes($val) {
    $val = trim($val);
    $last = strtolower($val[strlen($val)-1]);
    $val = (int)$val;
    switch($last) {
        case 'g':
            $val *= 1024;
        case 'm':
            $val *= 1024;
        case 'k':
            $val *= 1024;
    }
    return $val;
}

/**
 * 安全地创建目录
 */
function secure_mkdir($dir, $mode = 0777) {
    if (!is_dir($dir)) {
        return mkdir($dir, $mode, true);
    }
    return true;
}

// 引入统一皮肤加载器
include_once __DIR__ . '/../skin_loader.php';

// 引入数据库配置
require_once __DIR__ . '/db_config.php';

// 引入安全工具
require_once __DIR__ . '/security_utils.php';
require_once __DIR__ . '/file_security_checker.php';

// 获取文件扩展名白名单
$whitelist = include_once __DIR__ . '/file_whitelist.php';

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

// 检查并创建禁止上传文件扩展名设置表
function createExtensionSettingsTable($db) {
    // 创建禁止上传文件扩展名设置表
    $createTableQuery = "
    CREATE TABLE IF NOT EXISTS file_extension_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        extension_name VARCHAR(20) NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )";
    
    $result = $db->exec($createTableQuery);
    
    if ($result === false) {
        throw new Exception('创建表失败: ' . $db->lastErrorMsg());
    }
    
    // 插入默认的禁止扩展名
    $defaultExtensions = [
        'php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'php8',
        'pl', 'py', 'rb', 'sh', 'bat', 'cmd', 'ps1',
        'exe', 'com', 'pif', 'scr', 'vbs', 'js', 'jar'
    ];
    
    // 检查是否已有数据
    $countQuery = "SELECT COUNT(*) as count FROM file_extension_settings";
    $countResult = $db->query($countQuery);
    $countRow = $countResult->fetchArray(SQLITE3_ASSOC);
    $existingCount = $countRow['count'];
    
    // 如果表为空，插入默认数据
    if ($existingCount == 0) {
        $db->exec('BEGIN TRANSACTION');
        
        foreach ($defaultExtensions as $extension) {
            $extension = strtolower(trim($extension));
            if (!empty($extension)) {
                $insertQuery = "INSERT OR IGNORE INTO file_extension_settings (extension_name, is_active) VALUES ('" . $db->escapeString($extension) . "', 1)";
                $db->exec($insertQuery);
            }
        }
        
        $db->exec('COMMIT');
    }
}

// 获取禁止上传的文件扩展名
function getForbiddenExtensions($db) {
    $query = "SELECT extension_name FROM file_extension_settings WHERE is_active = 1 ORDER BY extension_name";
    $result = $db->query($query);
    
    $extensions = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $extensions[] = $row['extension_name'];
    }
    
    return $extensions;
}

// 初始化数据库连接
$db = null;
try {
    $db = DatabaseConfig::getConnection('admin');
    if (!$db) {
        throw new Exception('无法连接到数据库');
    }
    
    // 调用函数创建表
    createExtensionSettingsTable($db);
    $forbiddenExtensions = getForbiddenExtensions($db);
} catch (Exception $e) {
    error_log('创建扩展名设置表失败: ' . $e->getMessage());
    // 如果获取失败，使用默认的禁止扩展名
    $forbiddenExtensions = [
        'php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'php8',
        'pl', 'py', 'rb', 'sh', 'bat', 'cmd', 'ps1',
        'exe', 'com', 'pif', 'scr', 'vbs', 'js', 'jar'
    ];
}

// 处理AJAX请求
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    if ($_POST['action'] === 'get_forbidden_extensions') {
        header('Content-Type: application/json');
        echo json_encode([
            'status' => 'success',
            'extensions' => $forbiddenExtensions
        ]);
        exit;
    }
}

// 获取分类目录
$categories = [];
try {
    // 查询数据库获取所有分类目录
    $query = "SELECT DISTINCT name FROM categories ORDER BY name";
    $result = $db->query($query);
    
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $categories[] = $row['name'];
    }
} catch (Exception $e) {
    // 如果查询失败，使用文件系统扫描作为后备
    $share_files_dir = __DIR__ . '/../分享文件';
    if (is_dir($share_files_dir)) {
        $dirs = secureScandir('.', $share_files_dir);
        if ($dirs !== false) {
            foreach ($dirs as $dir) {
                $full_path = $share_files_dir . '/' . $dir;
                if (is_dir($full_path)) {
                    $categories[] = $dir;
                }
            }
        }
    }
    
    // 如果仍然没有分类，使用默认分类
    if (empty($categories)) {
        $categories = ['默认分类'];
    }
}

// 处理文件上传请求
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['files']) && isset($_POST['category'])) {
        // 临时禁用错误显示，但保持错误报告开启以便我们可以捕获错误
        $original_display_errors = ini_set('display_errors', 0);
        $category = $_POST['category'];
        
        // 验证分类名称，防止目录遍历攻击
        if (strpos($category, '..') !== false || strpos($category, '/') !== false || strpos($category, '\\') !== false) {
            $errors[] = '分类名称包含非法字符';
        } else {
            $target_dir = $share_files_dir . '/' . $category . '/';
            $uploaded_files = [];
            
            // 验证分类是否存在
            if (!is_array($categories) || !in_array($category, $categories)) {
                $errors[] = '无效的分类目录';
            } else {
                // 使用安全目录创建
            if (!secure_mkdir($target_dir)) {
                $errors[] = '无法创建目标目录: ' . $target_dir;
            }
            }
            
            // 初始化数据库连接（仅连接一次，提高性能）
            $db = null;
            $forbiddenExtensions = [];
            try {
                // 使用配置文件获取数据库连接
                $db = DatabaseConfig::getConnection('admin');
                if (!$db) {
                    throw new Exception('无法连接到数据库');
                }
                
                // 启用异常处理
                $db->enableExceptions(true);
                
                // 获取禁止上传的文件扩展名
                $query = "SELECT extension_name FROM file_extension_settings WHERE is_active = 1 ORDER BY extension_name";
                $result = $db->query($query);
                
                while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                    $forbiddenExtensions[] = $row['extension_name'];
                }
                
                // 确保表存在（使用已更新的表结构）
                $db->exec("CREATE TABLE IF NOT EXISTS shared_files (
                    file_md5 TEXT PRIMARY KEY,
                    file_name TEXT NOT NULL,
                    file_icon_url TEXT,
                    download_count INTEGER DEFAULT 0,
                    file_remark TEXT,
                    upload_time TEXT,
                    file_path TEXT,
                    file_size INTEGER
                )");
            } catch (Exception $e) {
                $errors[] = '数据库初始化失败: ' . $e->getMessage();
            }
            
            // 检查是否收到了文件
            if (!empty($_FILES['files']['name'][0]) && is_array($_FILES['files']['tmp_name'])) {
                // 处理每个上传的文件
                foreach ($_FILES['files']['tmp_name'] as $key => $tmp_name) {
                    // 检查是否有文件和错误码
                    if (!isset($_FILES['files']['error'][$key])) {
                        $errors[] = '无效的文件数据';
                        continue;
                    }
                    
                    if ($_FILES['files']['error'][$key] === UPLOAD_ERR_OK) {
                        $file_name = basename($_FILES['files']['name'][$key]);
                        $tmp_file_path = $_FILES['files']['tmp_name'][$key];
                        
                        // 使用全面的安全检查（只检查危险扩展名）
                        $scan_result = scanUploadedFiles([
                            'name' => [$file_name],
                            'tmp_name' => [$tmp_file_path],
                            'size' => [$_FILES['files']['size'][$key]],
                            'error' => [$_FILES['files']['error'][$key]]
                        ], $forbiddenExtensions, 0); // 使用数据库中的禁止扩展名列表，0表示无大小限制
                        
                        if (!$scan_result[0]) {
                            $errors[] = '文件 ' . $file_name . ' 安全检查失败: ' . $scan_result[1];
                            continue;
                        }
                        
                        // 检查文件是否已存在
                        $counter = 1;
                        $original_file_name = $file_name;
                        $target_file = $target_dir . $file_name;
                        
                        // 先检查数据库中是否存在相同MD5的文件
                        $file_md5_temp = md5_file($tmp_file_path);
                        $check_md5_stmt = $db->prepare("SELECT file_name, file_path FROM shared_files WHERE file_md5 = :file_md5");
                        $check_md5_stmt->bindValue(':file_md5', $file_md5_temp, SQLITE3_TEXT);
                        $md5_result = $check_md5_stmt->execute();
                        $existing_md5_file = null;
                        if ($md5_result) {
                            $existing_md5_file = $md5_result->fetchArray(SQLITE3_ASSOC);
                        }
                        
                        // 如果存在相同MD5的文件，则不重命名，等待用户选择覆盖或跳过
                        if ($existing_md5_file) {
                            // 使用原始文件名，不重命名
                            $target_file = $target_dir . $original_file_name;
                        } else {
                            // 只有当没有相同MD5的文件时，才检查文件名是否重复
                            while (file_exists($target_file)) {
                                $file_info = pathinfo($original_file_name);
                                $file_name = $file_info['filename'] . '_' . $counter . '.' . $file_info['extension'];
                                $target_file = $target_dir . $file_name;
                                $counter++;
                            }
                        }
                        
                        // 移动上传的文件
                        // 确保目标目录存在
                        if (!is_dir($target_dir)) {
                            if (!secure_mkdir($target_dir)) {
                                $errors[] = '无法创建目标目录: ' . $target_dir;
                                continue;
                            }
                        }
                        
                        if (move_uploaded_file($tmp_file_path, $target_file)) {
                            try {
                                // 计算文件信息
                                $file_size = filesize($target_file);
                                $file_md5 = md5_file($target_file); // 计算文件MD5值
                                $upload_time = date('Y-m-d H:i:s'); // 记录上传时间
                                $file_path = '分享文件/' . $category . '/' . $file_name;
                                
                                        // 数据库操作
                                        if ($db) {
                                            // 检查文件是否已存在
                                            $check_stmt = $db->prepare("SELECT file_name, file_path FROM shared_files WHERE file_md5 = :file_md5");
                                            $check_stmt->bindValue(':file_md5', $file_md5, SQLITE3_TEXT);
                                            $result = $check_stmt->execute();
                                            
                                            $existing_file = null;
                                            if ($result) {
                                                $existing_file = $result->fetchArray(SQLITE3_ASSOC);
                                            }
                                            
                                            // 检查是否需要覆盖
                                            $overwrite = isset($_POST['overwrite']) && $_POST['overwrite'] === 'true';
                                            
                                            if ($existing_file && !$overwrite) {
                                                // 文件已存在且用户未选择覆盖，删除已上传的文件
                                                if (file_exists($target_file)) {
                                                    unlink($target_file);
                                                }
                                                
                                                // 返回需要覆盖的文件信息
                                                $uploaded_files[] = [
                                                    'name' => $file_name,
                                                    'size' => $file_size,
                                                    'path' => $file_path,
                                                    'md5' => $file_md5,
                                                    'upload_time' => $upload_time,
                                                    'existing' => true,
                                                    'existing_name' => $existing_file['file_name'],
                                                    'existing_path' => $existing_file['file_path']
                                                ];
                                            } else {
                                                // 文件不存在或用户选择覆盖，执行插入或更新
                                                if ($existing_file && $overwrite) {
                                                    // 如果是覆盖操作，先删除旧文件（无论文件名或路径是否相同）
                                                    $old_file_path = __DIR__ . '/../' . $existing_file['file_path'];
                                                    if (file_exists($old_file_path)) {
                                                        unlink($old_file_path);
                                                    }
                                                    
                                                    // 覆盖操作使用当前选择的分类路径，更新数据库中的分类信息
                                                    $file_path = '分享文件/' . $category . '/' . $file_name;
                                                    $target_file = $target_dir . $file_name;
                                                    
                                                    // 确保文件已移动到正确位置
                                                    if (file_exists($target_file)) {
                                                        unlink($target_file); // 删除可能存在的文件
                                                    }
                                                    move_uploaded_file($tmp_file_path, $target_file);
                                                    
                                                    // 更新数据库记录
                                                    $update_stmt = $db->prepare(
                                                        "UPDATE shared_files 
                                                        SET file_name = :file_name, file_path = :file_path, file_size = :file_size, upload_time = :upload_time 
                                                        WHERE file_md5 = :file_md5"
                                                    );
                                                    
                                                    if (!$update_stmt) {
                                                        throw new Exception('SQL语句准备失败: ' . $db->lastErrorMsg());
                                                    }
                                                    
                                                    $update_stmt->bindValue(':file_md5', $file_md5, SQLITE3_TEXT);
                                                    $update_stmt->bindValue(':file_name', $file_name, SQLITE3_TEXT);
                                                    $update_stmt->bindValue(':file_path', $file_path, SQLITE3_TEXT);
                                                    $update_stmt->bindValue(':file_size', $file_size, SQLITE3_INTEGER);
                                                    $update_stmt->bindValue(':upload_time', $upload_time, SQLITE3_TEXT);
                                                    
                                                    if (!$update_stmt->execute()) {
                                                        throw new Exception('数据库更新失败: ' . $db->lastErrorMsg());
                                                    }
                                                } else {
                                                    // 新文件，插入数据库
                                                    $insert_stmt = $db->prepare(
                                                        "INSERT INTO shared_files 
                                                        (file_md5, file_name, file_path, file_size, upload_time, download_count) 
                                                        VALUES (:file_md5, :file_name, :file_path, :file_size, :upload_time, 0)"
                                                    );
                                                    
                                                    if (!$insert_stmt) {
                                                        throw new Exception('SQL语句准备失败: ' . $db->lastErrorMsg());
                                                    }
                                                    
                                                    $insert_stmt->bindValue(':file_md5', $file_md5, SQLITE3_TEXT);
                                                    $insert_stmt->bindValue(':file_name', $file_name, SQLITE3_TEXT);
                                                    $insert_stmt->bindValue(':file_path', $file_path, SQLITE3_TEXT);
                                                    $insert_stmt->bindValue(':file_size', $file_size, SQLITE3_INTEGER);
                                                    $insert_stmt->bindValue(':upload_time', $upload_time, SQLITE3_TEXT);
                                                    
                                                    if (!$insert_stmt->execute()) {
                                                        throw new Exception('数据库插入失败: ' . $db->lastErrorMsg());
                                                    }
                                                }
                                        
                                        $uploaded_files[] = [
                                            'name' => $file_name,
                                            'size' => $file_size,
                                            'path' => $file_path,
                                            'md5' => $file_md5,
                                            'upload_time' => $upload_time,
                                            'existing' => false,
                                            'overwritten' => ($existing_file && $overwrite) ? true : false
                                        ];
                                    }
                                }
                            } catch (Exception $e) {
                                $errors[] = '文件 ' . $file_name . ' 处理失败: ' . $e->getMessage();
                                // 删除已上传但处理失败的文件
                                if (file_exists($target_file)) {
                                    unlink($target_file);
                                }
                            }
                        } else {
                            $errors[] = '文件 ' . $file_name . ' 上传失败';
                        }
                    } else {
                        $error_codes = [
                            UPLOAD_ERR_INI_SIZE => '超过了upload_max_filesize限制',
                            UPLOAD_ERR_FORM_SIZE => '超过了表单POST_MAX_SIZE限制',
                            UPLOAD_ERR_PARTIAL => '文件仅部分上传',
                            UPLOAD_ERR_NO_FILE => '没有文件被上传',
                            UPLOAD_ERR_NO_TMP_DIR => '缺少临时文件夹',
                            UPLOAD_ERR_CANT_WRITE => '写入文件失败',
                            UPLOAD_ERR_EXTENSION => 'PHP扩展阻止了文件上传'
                        ];
                        
                        $error_code = $_FILES['files']['error'][$key];
                        $error_msg = isset($error_codes[$error_code]) ? $error_codes[$error_code] : '未知错误';
                        $file_name = isset($_FILES['files']['name'][$key]) ? basename($_FILES['files']['name'][$key]) : '未知文件名';
                        $errors[] = '文件 ' . $file_name . ' 上传错误: ' . $error_msg . ' (错误代码: ' . $error_code . ')';
                    }
                }
            } else {
                $errors[] = '未收到有效的文件数据';
            }
            
            // 关闭数据库连接
            if ($db) {
                $db->close();
            }
        }
        
        // 确保没有任何之前的输出（包括可能的错误信息）
        ob_start(); // 开始捕获所有输出
        ob_clean(); // 清理之前可能的输出
        
        // 返回JSON响应，确保UTF-8编码
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        
        // 检查是否有PHP错误发生
        $error = error_get_last();
        if ($error) {
            $errors[] = '服务器错误: ' . $error['message'] . ' (行 ' . $error['line'] . ')';
        }
        
        // 准备响应数据
        $response = [
            'status' => empty($errors) ? 'success' : 'error',
            'message' => empty($errors) ? '文件上传成功' : implode(', ', $errors),
            'uploaded_files' => $uploaded_files
        ];
        
        // 确保JSON格式正确
        $json_response = json_encode($response, JSON_UNESCAPED_UNICODE);
        if ($json_response === false) {
            // 如果JSON编码失败，返回错误信息
            echo json_encode([
                'status' => 'error',
                'message' => '服务器JSON生成错误: ' . json_last_error_msg(),
                'uploaded_files' => []
            ]);
        } else {
            echo $json_response;
        }
        
        // 恢复原始的错误显示设置
        ini_set('display_errors', $original_display_errors);
        
        exit;
    }
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>文件上传管理</title>
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
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
            line-height: 1.6;
            color: var(--color-text-primary, #333);
            background-color: var(--color-bg-primary, #f5f7fa);
            padding: 20px;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        /* 顶部导航栏 */
        .header {
            display: none;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px;
            border-bottom: 1px solid #333;
            height: 0px;
            background-color: var(--color-bg-header, #2c3e50);
            color: var(--color-text-header, white);
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
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
            margin-top: 20px;
            margin-bottom: 60px;
            flex: 1;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: var(--color-bg-card, white);
            border-radius: 10px;
            padding: 30px;
            box-shadow: var(--color-shadow, 0 4px 20px rgba(0,0,0,0.1));
        }
        
        h2 {
            color: var(--color-text-secondary, #2c3e50);
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid var(--color-border, #e0e0e0);
        }
        
        /* 表单样式 */
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: var(--color-text-secondary, #333);
        }
        
        .form-control {
            width: 100%;
            padding: 10px 15px;
            border: 2px solid var(--color-border, #ddd);
            border-radius: 6px;
            font-size: 16px;
            transition: border-color 0.3s ease;
            background-color: var(--color-bg-input, white);
            color: var(--color-text-primary, #333);
        }
        
        .form-control:focus {
            outline: none;
            border-color: var(--color-primary, #3498db);
            box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
        }
        
        /* 文件上传区域 */
        .file-drop-area {
            border: 2px dashed var(--color-border, #ddd);
            border-radius: 6px;
            padding: 40px 20px;
            text-align: center;
            background-color: var(--color-bg-secondary, #f9f9f9);
            transition: all 0.3s ease;
            cursor: pointer;
        }
        
        .file-drop-area:hover {
            border-color: var(--color-primary, #3498db);
            background-color: var(--color-bg-hover, #f0f7ff);
        }
        
        .file-drop-area.dragging {
            border-color: var(--color-success, #2ecc71);
            background-color: var(--color-bg-success-light, #eafaf1);
        }
        
        .file-drop-icon {
            font-size: 48px;
            color: var(--color-text-muted, #95a5a6);
            margin-bottom: 15px;
        }
        
        .file-drop-text {
            font-size: 16px;
            color: var(--color-text-secondary, #7f8c8d);
            margin-bottom: 10px;
        }
        
        .file-drop-hint {
            font-size: 14px;
            color: var(--color-text-muted, #95a5a6);
        }
        
        /* 上传文件列表 */
        .files-list {
            margin-top: 20px;
        }
        
        .file-item {
            display: flex;
            flex-direction: column;
            padding: 10px 15px;
            border: 1px solid var(--color-border, #e0e0e0);
            border-radius: 6px;
            margin-bottom: 10px;
            background-color: var(--color-bg-secondary, #f9f9f9);
        }
        
        .file-item-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 10px;
        }
        
        .file-info {
            flex: 1;
        }
        
        .file-name {
            font-weight: 500;
            color: var(--color-text-primary, #333);
        }
        
        .file-size {
            font-size: 14px;
            color: var(--color-text-muted, #95a5a6);
        }
        
        .remove-file {
            background: none;
            border: none;
            color: var(--color-danger, #e74c3c);
            cursor: pointer;
            font-size: 18px;
            padding: 5px;
            transition: color 0.3s ease;
        }
        
        .remove-file:hover {
            color: var(--color-danger-dark, #c0392b);
        }
        
        /* 进度条 */
        .progress-container {
            margin-top: 10px;
            width: 100%;
            flex-shrink: 0;
        }
        
        .progress-bar {
            height: 12px;
            background-color: var(--color-bg-secondary, #ecf0f1);
            border-radius: 6px;
            overflow: hidden;
            width: 100%;
            box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
        }
        
        .progress-fill {
            height: 100%;
            background-color: var(--color-primary, #3498db);
            border-radius: 6px;
            width: 0%;
            transition: width 0.3s ease, background-color 0.3s ease;
            position: relative;
        }
        
        .progress-fill.completed {
            background-color: var(--color-success, #2ecc71);
        }
        
        .progress-fill::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(
                45deg,
                rgba(255, 255, 255, 0.2) 25%,
                transparent 25%,
                transparent 50%,
                rgba(255, 255, 255, 0.2) 50%,
                rgba(255, 255, 255, 0.2) 75%,
                transparent 75%,
                transparent
            );
            background-size: 10px 10px;
            animation: progress-stripes 1s linear infinite;
        }
        
        @keyframes progress-stripes {
            0% {
                background-position: 0 0;
            }
            100% {
                background-position: 10px 10px;
            }
        }
        
        .progress-fill.completed::after {
            animation: none;
        }
        
        .progress-text {
            font-size: 12px;
            color: var(--color-text-muted, #95a5a6);
            text-align: right;
            margin-top: 2px;
        }
        
        /* 按钮 */
        .btn {
            display: inline-block;
            padding: 12px 24px;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            text-decoration: none;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            transition: all 0.3s ease;
            background-color: var(--color-primary, #3498db);
            color: white;
        }
        
        .btn:hover {
            background-color: var(--color-primary-dark, #2980b9);
            transform: translateY(-2px);
            box-shadow: var(--color-shadow, 0 4px 12px rgba(52, 152, 219, 0.3));
        }
        
        .btn:active {
            transform: translateY(0);
        }
        
        .btn:disabled {
            background-color: var(--color-text-muted, #bdc3c7);
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        /* 提示框 */
        .alert {
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 6px;
            font-size: 16px;
        }
        
        .alert-success {
            background-color: var(--color-bg-success-light, #d4edda);
            color: var(--color-success, #155724);
            border: 1px solid var(--color-success-border, #c3e6cb);
        }
        
        .alert-error {
            background-color: var(--color-bg-danger-light, #f8d7da);
            color: var(--color-danger, #721c24);
            border: 1px solid var(--color-danger-border, #f5c6cb);
        }
        
        /* 底部状态栏 */
        .status-bar {
            height: 40px;
            background-color: rgba(0, 0, 0, 0.8);
            border-top: 1px solid #444;
            display: flex;
            align-items: center;
            padding: 0 20px;
            color: #ccc;
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
        
        /* 版权信息 - 中间 */
        .copyright-info {
            flex: 1;
            text-align: center;
        }
        
        /* 隐藏文件输入 */
        #fileInput {
            display: none;
        }
    </style>
</head>
<body class="<?php echo getSkinBodyClass($currentSkin); ?>">
    <!-- 顶部导航栏 -->
    <div class="header">
        <h1></h1>
        <div class="user-info">
        </div>
    </div>
    
    <!-- 主要内容区 -->
    <div class="main-container">
        <div class="container">
            <h2><i class="fa fa-upload"></i> 文件上传</h2>
            
            <!-- 上传表单 -->
            <form id="uploadForm" enctype="multipart/form-data">
                <div class="form-group">
                    <label for="category" class="form-label">选择分类目录</label>
                    <select id="category" name="category" class="form-control" required>
                        <option value="">请选择分类</option>
                        <?php foreach ($categories as $cat): ?>
                            <option value="<?php echo htmlspecialchars($cat); ?>"><?php echo htmlspecialchars($cat); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">选择文件</label>
                    <div id="dropArea" class="file-drop-area">
                        <input type="file" id="fileInput" name="files[]" multiple />
                        <div class="file-drop-icon">
                            <i class="fa fa-cloud-upload"></i>
                        </div>
                        <div class="file-drop-text">拖放文件到此处，或点击选择文件</div>
                        <div class="file-drop-hint">支持批量上传多个文件</div>
                        <div class="file-drop-hint" style="color: var(--color-danger, #e74c3c); margin-top: 10px;">
                            <i class="fa fa-exclamation-triangle"></i> 
                            禁止上传以下类型的文件：<span id="forbiddenExtensionsList">加载中...</span>
                        </div>
                    </div>
                </div>
                
                <!-- 文件列表 -->
                <div id="filesList" class="files-list"></div>
                
                <!-- 上传消息区域 -->
                <div id="uploadMessage" class="alert" style="display: none;"></div>
                
                <button type="submit" id="uploadBtn" class="btn">
                    <i class="fa fa-paper-plane"></i> 开始上传
                </button>
            </form>
        </div>
    </div>
    
    <!-- 底部状态栏 -->
    <div class="status-bar">
        <div class="file-path-display">当前文件：admin/file_upload.php</div>
        <div class="copyright-info"></div>
    </div>
    
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // 加载禁止上传的文件扩展名列表
            loadForbiddenExtensions();
            const dropArea = document.getElementById('dropArea');
            const fileInput = document.getElementById('fileInput');
            const filesList = document.getElementById('filesList');
            const uploadForm = document.getElementById('uploadForm');
            const uploadBtn = document.getElementById('uploadBtn');
            const uploadMessage = document.getElementById('uploadMessage');
            let selectedFiles = [];
            
            // 点击区域打开文件选择
            dropArea.addEventListener('click', () => fileInput.click());
            
            // 处理文件选择
            fileInput.addEventListener('change', handleFileSelect);
            
            // 拖放事件
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropArea.addEventListener(eventName, preventDefaults, false);
            });
            
            function preventDefaults(e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            ['dragenter', 'dragover'].forEach(eventName => {
                dropArea.addEventListener(eventName, highlight, false);
            });
            
            ['dragleave', 'drop'].forEach(eventName => {
                dropArea.addEventListener(eventName, unhighlight, false);
            });
            
            function highlight() {
                dropArea.classList.add('dragging');
            }
            
            function unhighlight() {
                dropArea.classList.remove('dragging');
            }
            
            // 处理拖放文件
            dropArea.addEventListener('drop', handleDrop, false);
            
            function handleDrop(e) {
                const dt = e.dataTransfer;
                const files = dt.files;
                
                if (files.length > 0) {
                    processFiles(files);
                }
            }
            
            function handleFileSelect(e) {
                const files = e.target.files;
                if (files.length > 0) {
                    processFiles(files);
                }
            }
            
            function processFiles(files) {
                selectedFiles = Array.from(files);
                renderFilesList();
                uploadBtn.disabled = selectedFiles.length === 0;
                // 隐藏之前的消息
                uploadMessage.style.display = 'none';
            }
            
            function renderFilesList() {
                filesList.innerHTML = '';
                
                if (selectedFiles.length === 0) {
                    uploadBtn.disabled = true;
                    return;
                }
                
                uploadBtn.disabled = false;
                
                selectedFiles.forEach((file, index) => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';
                    fileItem.dataset.index = index;
                    
                    const progressContainer = document.createElement('div');
                    progressContainer.className = 'progress-container';
                    
                    const progressBar = document.createElement('div');
                    progressBar.className = 'progress-bar';
                    
                    const progressFill = document.createElement('div');
                    progressFill.className = 'progress-fill';
                    progressFill.style.width = '0%';
                    
                    const progressText = document.createElement('div');
                    progressText.className = 'progress-text';
                    progressText.textContent = '0%';
                    
                    progressBar.appendChild(progressFill);
                    progressContainer.appendChild(progressBar);
                    progressContainer.appendChild(progressText);
                    
                    const fileItemContent = document.createElement('div');
                    fileItemContent.className = 'file-item-content';
                    
                    const fileInfo = document.createElement('div');
                    fileInfo.className = 'file-info';
                    
                    const fileName = document.createElement('div');
                    fileName.className = 'file-name';
                    fileName.textContent = truncateFileName(file.name, 40);
                    
                    const fileDetails = document.createElement('div');
                    fileDetails.className = 'file-size';
                    fileDetails.textContent = formatFileSize(file.size);
                    
                    fileInfo.appendChild(fileName);
                    fileInfo.appendChild(fileDetails);
                    
                    const removeBtn = document.createElement('button');
                    removeBtn.className = 'remove-file';
                    removeBtn.innerHTML = '<i class="fa fa-times"></i>';
                    removeBtn.addEventListener('click', () => {
                        removeFile(index);
                    });
                    
                    fileItemContent.appendChild(fileInfo);
                    fileItemContent.appendChild(removeBtn);
                    
                    fileItem.appendChild(progressContainer);
                    fileItem.appendChild(fileItemContent);
                    
                    filesList.appendChild(fileItem);
                });
            }
            
            // 处理表单提交
            uploadForm.addEventListener('submit', function(e) {
                e.preventDefault();
                
                const category = document.getElementById('category').value;
                if (!category) {
                    showMessage('请选择分类目录', 'error');
                    return;
                }
                
                if (selectedFiles.length === 0) {
                    showMessage('请选择要上传的文件', 'error');
                    return;
                }
                
                // 创建FormData
                const formData = new FormData();
                formData.append('category', category);
                formData.append('overwrite', 'false'); // 默认不覆盖
                
                // 添加所有文件
                selectedFiles.forEach((file, index) => {
                    formData.append('files[]', file);
                });
                
                // 执行上传
                performUpload(formData);
            });
            
            // 执行上传的函数
            function performUpload(formData) {
                // 创建XMLHttpRequest
                const xhr = new XMLHttpRequest();
                
                // 显示上传中状态
                uploadBtn.disabled = true;
                uploadBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 上传中...';
                
                // 监听上传进度
                xhr.upload.addEventListener('progress', function(e) {
                    if (e.lengthComputable) {
                        const percentComplete = Math.round((e.loaded / e.total) * 100);
                        // 更新所有文件的进度条
                        const progressFills = document.querySelectorAll('.progress-fill');
                        const progressTexts = document.querySelectorAll('.progress-text');
                        
                        progressFills.forEach(fill => {
                            fill.style.width = percentComplete + '%';
                            if (percentComplete === 100) {
                                fill.classList.add('completed');
                            }
                        });
                        
                        progressTexts.forEach(text => {
                            text.textContent = percentComplete + '%';
                        });
                    }
                });
                
                // 处理上传完成
                xhr.addEventListener('load', function() {
                    uploadBtn.disabled = false;
                    uploadBtn.innerHTML = '<i class="fa fa-paper-plane"></i> 开始上传';
                    
                    console.log('上传完成，状态码:', xhr.status);
                    console.log('响应类型:', xhr.getResponseHeader('Content-Type'));
                    console.log('响应内容:', xhr.responseText);
                    
                    if (xhr.status === 200) {
                        try {
                            // 检查响应是否为空
                            if (!xhr.responseText.trim()) {
                                throw new Error('响应内容为空');
                            }
                            
                            // 尝试解析JSON
                            const response = JSON.parse(xhr.responseText);
                            
                            // 验证响应结构
                            if (!response || typeof response !== 'object' || !('status' in response)) {
                                throw new Error('无效的响应格式');
                            }
                            
                            if (response.status === 'success') {
                                // 检查uploaded_files是否存在且为数组
                                if (!Array.isArray(response.uploaded_files)) {
                                    response.uploaded_files = [];
                                }
                                
                                // 检查是否有重复内容文件
                                    const duplicateFiles = response.uploaded_files.filter(file => file.existing);
                                    
                                    if (duplicateFiles.length > 0) {
                                        // 有重复内容文件，显示确认对话框
                                        showDuplicateConfirmDialog(duplicateFiles, formData, response.uploaded_files);
                                    } else {
                                        // 没有重复内容文件，显示成功消息
                                        showMessage(`成功上传 ${response.uploaded_files.length} 个文件`, 'success');
                                        // 清空文件列表
                                        selectedFiles = [];
                                        renderFilesList();
                                        fileInput.value = '';
                                    }
                            } else {
                                // 显示错误消息
                                showMessage(response.message || '上传失败', 'error');
                            }
                        } catch (error) {
                            console.error('JSON解析错误:', error);
                            // 提取响应的前100个字符用于调试
                            const preview = xhr.responseText.substring(0, 100) + (xhr.responseText.length > 100 ? '...' : '');
                            showMessage(`上传响应解析错误: ${error.message}。响应预览: ${preview}`, 'error');
                        }
                    } else {
                        showMessage('上传请求失败: ' + xhr.status + ' - ' + xhr.statusText, 'error');
                    }
                });
                
                // 处理上传错误
                xhr.addEventListener('error', function() {
                    uploadBtn.disabled = false;
                    uploadBtn.innerHTML = '<i class="fa fa-paper-plane"></i> 开始上传';
                    showMessage('网络错误，上传失败', 'error');
                });
                
                // 发送请求
                xhr.open('POST', 'file_upload.php', true);
                xhr.send(formData);
            }
            
            // 显示重复文件确认对话框
            function showDuplicateConfirmDialog(duplicateFiles, formData, allUploadedFiles) {
                // 创建遮罩层
                const overlay = document.createElement('div');
                overlay.className = 'duplicate-overlay';
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0,0,0,0.5);
                    z-index: 9999;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                `;
                
                // 创建对话框
                const dialog = document.createElement('div');
                dialog.className = 'duplicate-dialog';
                
                // 生成重复文件列表HTML
                let duplicateFilesHtml = '';
                duplicateFiles.forEach(file => {
                    // 从路径中提取分类信息
                    const pathParts = file.existing_path.split('/');
                    const category = pathParts.length > 1 ? pathParts[1] : '未知分类';
                    
                    duplicateFilesHtml += `
                        <div class="duplicate-file-item">
                            <div class="file-info">
                                <div class="file-name">${file.name}</div>
                                <div class="file-size">${formatFileSize(file.size)}</div>
                            </div>
                            <div class="existing-info">
                                <div>已存在: ${file.existing_name}</div>
                                <div>分类: <span class="category-tag">${category}</span></div>
                            </div>
                        </div>
                    `;
                });
                
                // 对话框内容
                dialog.innerHTML = `
                    <div class="dialog-header">
                        <h3><i class="fa fa-exclamation-triangle"></i> 发现内容重复文件</h3>
                    </div>
                    <div class="dialog-content">
                        <p>检测到 ${duplicateFiles.length} 个文件与现有文件<strong>内容相同</strong>：</p>
                        <div class="duplicate-files-list">
                            ${duplicateFilesHtml}
                        </div>
                        <p>这些文件的内容与系统中已有文件相同（MD5值相同），但文件名可能不同。请选择处理方式：</p>
                        <div class="options-explanation">
                            <div class="option">
                                <strong>覆盖重复文件：</strong>删除原文件，并将新文件上传到当前选择的分类目录（更新分类信息）
                            </div>
                            <div class="option">
                                <strong>跳过重复文件：</strong>保留原文件，不上传新文件
                            </div>
                        </div>
                    </div>
                    <div class="dialog-actions">
                        <button id="cancelBtn" class="btn btn-cancel">
                            <i class="fa fa-times"></i> 取消上传
                        </button>
                        <button id="skipBtn" class="btn btn-skip">
                            <i class="fa fa-forward"></i> 跳过重复文件
                        </button>
                        <button id="overwriteBtn" class="btn btn-overwrite">
                            <i class="fa fa-refresh"></i> 覆盖重复文件
                        </button>
                    </div>
                `;
                
                // 对话框样式
                dialog.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background-color: white;
                    border-radius: 12px;
                    padding: 0;
                    text-align: left;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    z-index: 10000;
                    min-width: 500px;
                    max-width: 90%;
                    max-height: 80vh;
                    overflow: hidden;
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.9);
                    transition: all 0.3s ease;
                `;
                
                // 添加样式
                const styles = `
                    .dialog-header {
                        background-color: #f8f9fa;
                        padding: 20px;
                        border-bottom: 1px solid #eee;
                        border-radius: 12px 12px 0 0;
                    }
                    
                    .dialog-header h3 {
                        margin: 0;
                        color: #e74c3c;
                        font-size: 18px;
                    }
                    
                    .dialog-content {
                        padding: 20px;
                        max-height: 50vh;
                        overflow-y: auto;
                    }
                    
                    .duplicate-files-list {
                        margin: 15px 0;
                        border: 1px solid #eee;
                        border-radius: 6px;
                        max-height: 200px;
                        overflow-y: auto;
                    }
                    
                    .duplicate-file-item {
                        padding: 10px;
                        border-bottom: 1px solid #eee;
                        display: flex;
                        justify-content: space-between;
                    }
                    
                    .duplicate-file-item:last-child {
                        border-bottom: none;
                    }
                    
                    .file-info .file-name {
                        font-weight: bold;
                    }
                    
                    .file-info .file-size {
                        font-size: 12px;
                        color: #666;
                    }
                    
                    .existing-info {
                        font-size: 12px;
                        color: #666;
                        text-align: right;
                    }
                    
                    .category-tag {
                        background-color: #3498db;
                        color: white;
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-size: 11px;
                        font-weight: bold;
                    }
                    
                    .options-explanation {
                        background-color: #f8f9fa;
                        border: 1px solid #e9ecef;
                        border-radius: 6px;
                        padding: 15px;
                        margin: 15px 0;
                    }
                    
                    .options-explanation .option {
                        margin-bottom: 10px;
                    }
                    
                    .options-explanation .option:last-child {
                        margin-bottom: 0;
                    }
                    
                    .dialog-actions {
                        padding: 15px 20px;
                        background-color: #f8f9fa;
                        border-top: 1px solid #eee;
                        border-radius: 0 0 12px 12px;
                        text-align: right;
                    }
                    
                    .dialog-actions button {
                        margin-left: 10px;
                    }
                    
                    .btn-cancel {
                        background-color: #95a5a6;
                    }
                    
                    .btn-cancel:hover {
                        background-color: #7f8c8d;
                    }
                    
                    .btn-skip {
                        background-color: #3498db;
                    }
                    
                    .btn-skip:hover {
                        background-color: #2980b9;
                    }
                    
                    .btn-overwrite {
                        background-color: #e74c3c;
                    }
                    
                    .btn-overwrite:hover {
                        background-color: #c0392b;
                    }
                `;
                
                const styleElement = document.createElement('style');
                styleElement.textContent = styles;
                
                document.body.appendChild(styleElement);
                document.body.appendChild(overlay);
                document.body.appendChild(dialog);
                
                // 显示对话框
                setTimeout(() => {
                    overlay.style.opacity = '1';
                    dialog.style.opacity = '1';
                    dialog.style.transform = 'translate(-50%, -50%) scale(1)';
                }, 10);
                
                // 按钮事件
                document.getElementById('cancelBtn').addEventListener('click', function() {
                    closeDialog();
                    showMessage('已取消上传', 'error');
                });
                
                document.getElementById('skipBtn').addEventListener('click', function() {
                    closeDialog();
                    // 计算成功上传的文件数（非重复内容文件）
                    const successCount = allUploadedFiles.filter(file => !file.existing).length;
                    showMessage(`成功上传 ${successCount} 个文件，跳过 ${duplicateFiles.length} 个重复内容文件`, 'success');
                    // 清空文件列表
                    selectedFiles = [];
                    renderFilesList();
                    fileInput.value = '';
                });
                
                document.getElementById('overwriteBtn').addEventListener('click', function() {
                    closeDialog();
                    // 设置覆盖标志并重新上传
                    formData.set('overwrite', 'true');
                    performUpload(formData);
                });
                
                // 关闭对话框函数
                function closeDialog() {
                    overlay.style.opacity = '0';
                    dialog.style.opacity = '0';
                    dialog.style.transform = 'translate(-50%, -50%) scale(0.9)';
                    
                    setTimeout(() => {
                        overlay.remove();
                        dialog.remove();
                        styleElement.remove();
                    }, 300);
                }
            }
            
            // 显示消息函数
            function showMessage(message, type) {
                uploadMessage.textContent = message;
                uploadMessage.className = 'alert';
                
                if (type === 'success') {
                    uploadMessage.classList.add('alert-success');
                } else if (type === 'error') {
                    uploadMessage.classList.add('alert-error');
                }
                
                uploadMessage.style.display = 'block';
                
                // 3秒后自动隐藏成功消息
                if (type === 'success') {
                    setTimeout(function() {
                        uploadMessage.style.display = 'none';
                    }, 3000);
                }
            }
            
            // 工具函数：格式化文件大小
            function formatFileSize(bytes) {
                if (bytes < 1024) return bytes + ' B';
                else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
                else if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
                else return (bytes / 1073741824).toFixed(2) + ' GB';
            }
            
            // 工具函数：截断文件名
            function truncateFileName(name, maxLength) {
                if (name.length <= maxLength) return name;
                return name.substring(0, maxLength - 3) + '...';
            }
            
            // 移除文件函数
            function removeFile(index) {
                selectedFiles.splice(index, 1);
                renderFilesList();
                // 如果没有文件了，清空文件输入
                if (selectedFiles.length === 0) {
                    fileInput.value = '';
                }
            }
            
            // 播放成功音效
            function playSuccessSound() {
                try {
                    // 创建音频上下文
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (AudioContext) {
                        const audioCtx = new AudioContext();
                        const oscillator = audioCtx.createOscillator();
                        const gainNode = audioCtx.createGain();
                        
                        // 连接节点
                        oscillator.connect(gainNode);
                        gainNode.connect(audioCtx.destination);
                        
                        // 设置成功音效参数
                        oscillator.frequency.value = 800; // 高音调开始
                        oscillator.type = 'sine';
                        gainNode.gain.value = 0.3; // 音量
                        
                        // 播放音效
                        oscillator.start();
                        
                        // 音调变化和淡出
                        setTimeout(() => {
                            oscillator.frequency.value = 600;
                        }, 100);
                        
                        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
                        
                        setTimeout(() => {
                            oscillator.stop();
                        }, 500);
                    }
                } catch (e) {
                    console.log('无法播放音效:', e);
                }
            }
            
            // 加载禁止上传的文件扩展名
            function loadForbiddenExtensions() {
                const formData = new FormData();
                formData.append('action', 'get_forbidden_extensions');
                
                fetch('file_upload.php', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success' && data.extensions) {
                        const extensionsList = document.getElementById('forbiddenExtensionsList');
                        if (extensionsList) {
                            extensionsList.textContent = data.extensions.join(', ');
                        }
                    }
                })
                .catch(error => {
                    console.error('加载禁止扩展名失败:', error);
                    // 使用默认扩展名作为后备
                    const defaultExtensions = ['php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'php8', 'pl', 'py', 'rb', 'sh', 'bat', 'cmd', 'ps1', 'exe', 'com', 'pif', 'scr', 'vbs', 'js', 'jar'];
                    const extensionsList = document.getElementById('forbiddenExtensionsList');
                    if (extensionsList) {
                        extensionsList.textContent = defaultExtensions.join(', ');
                    }
                });
            }
            
            // 显示增强的通知
            function showNotification(status, message) {
                const isSuccess = status === 'success';
                
                // 创建遮罩层
                const overlay = document.createElement('div');
                overlay.className = 'notification-overlay';
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0,0,0,0.5);
                    z-index: 9999;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                `;
                
                // 创建通知框
                const notification = document.createElement('div');
                notification.className = 'upload-notification';
                
                // 通知内容
                notification.innerHTML = `
                    <div class="notification-icon">
                        <i class="fa fa-${isSuccess ? 'check-circle' : 'exclamation-circle'} fa-4x"></i>
                    </div>
                    <h3>${isSuccess ? '上传成功' : '上传失败'}</h3>
                    <p>${message}</p>
                    <div class="notification-stats">
                        <span>总文件数: ${selectedFiles.length}</span>
                        ${isSuccess ? `<span>成功: ${selectedFiles.length}</span>` : ''}
                    </div>
                `;
                
                // 样式设置
                notification.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background-color: white;
                    border-radius: 12px;
                    padding: 30px;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    z-index: 10000;
                    min-width: 300px;
                    max-width: 90%;
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.9);
                    transition: all 0.3s ease;
                `;
                
                // 内部元素样式
                const styles = `
                    .notification-icon {
                        margin-bottom: 20px;
                        color: ${isSuccess ? '#4CAF50' : '#F44336'};
                        animation: ${isSuccess ? 'successPulse' : 'errorShake'} 0.5s ease;
                    }
                    
                    .notification-icon i {
                        animation: bounceIn 0.6s ease;
                    }
                    
                    .upload-notification h3 {
                        margin: 0 0 15px 0;
                        font-size: 24px;
                        color: ${isSuccess ? '#4CAF50' : '#F44336'};
                    }
                    
                    .upload-notification p {
                        margin: 0 0 20px 0;
                        color: #555;
                        font-size: 16px;
                        line-height: 1.4;
                    }
                    
                    .notification-stats {
                        display: flex;
                        justify-content: space-around;
                        padding-top: 15px;
                        border-top: 1px solid #eee;
                        color: #666;
                        font-size: 14px;
                    }
                    
                    @keyframes successPulse {
                        0% { transform: scale(0.8); opacity: 0.5; }
                        50% { transform: scale(1.1); opacity: 1; }
                        100% { transform: scale(1); opacity: 1; }
                    }
                    
                    @keyframes errorShake {
                        0%, 100% { transform: translateX(0); }
                        25% { transform: translateX(-5px); }
                        75% { transform: translateX(5px); }
                    }
                    
                    @keyframes bounceIn {
                        0% { transform: scale(0); }
                        50% { transform: scale(1.2); }
                        100% { transform: scale(1); }
                    }
                `;
                
                const styleElement = document.createElement('style');
                styleElement.textContent = styles;
                
                document.body.appendChild(styleElement);
                document.body.appendChild(overlay);
                document.body.appendChild(notification);
                
                // 显示通知
                setTimeout(() => {
                    overlay.style.opacity = '1';
                    notification.style.opacity = '1';
                    notification.style.transform = 'translate(-50%, -50%) scale(1)';
                }, 10);
                
                // 自动关闭通知
                setTimeout(() => {
                    overlay.style.opacity = '0';
                    notification.style.opacity = '0';
                    notification.style.transform = 'translate(-50%, -50%) scale(0.9)';
                    
                    setTimeout(() => {
                        overlay.remove();
                        notification.remove();
                        styleElement.remove();
                    }, 300);
                }, 3500); // 显示更长时间，让用户有足够时间看到
            }
        });
    </script>
</body>
</html>