<?php
// 文件预览管理页面 - 修复版

// 引入统一皮肤加载器
include_once __DIR__ . '/../skin_loader.php';
// 引入UI配置加载器
include_once __DIR__ . '/../ui_config_loader.php';

// 设置错误报告（仅开发环境）
// 在AJAX请求模式下，关闭错误显示，避免干扰JSON响应
if (isset($_GET['table']) || isset($_GET['action'])) {
    error_reporting(0); // 关闭所有错误报告，避免干扰JSON输出
    ini_set('display_errors', 0); // 不显示错误到输出
} else {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
}

// 所有AJAX请求（包含table或action参数）都返回纯JSON
if (isset($_GET['table']) || isset($_GET['action'])) {
    // 标记为AJAX请求模式
    define('AJAX_MODE', true);
    // 强制设置JSON Content-Type
    header('Content-Type: application/json');
} else {
    define('AJAX_MODE', false);
}

// 引入认证控制
require_once 'auth.php';

// 引入数据库配置
require_once __DIR__ . '/db_config.php';

// 引入文件安全检查器
require_once __DIR__ . '/file_security_checker.php';

// 引入文件白名单配置
$whitelist = include_once __DIR__ . '/file_whitelist.php';

// 如果是AJAX请求且未通过认证，返回JSON错误
if (AJAX_MODE && !isLoggedIn()) {
    // 对于get_categories请求，完全跳过认证检查
    if (isset($_GET['action']) && $_GET['action'] === 'get_categories') {
        // 跳过认证检查，直接继续处理
    } else {
        echo json_encode(['code' => 401, 'message' => '未授权访问，请登录后重试']);
        exit;
    }
}

// 保护页面，确保只有登录用户才能访问（非AJAX请求）
if (!AJAX_MODE) {
    protectPage();
}

// 自定义调试日志函数
function debugLog($message) {
    // 使用相对路径确保日志文件位置正确
    $logFile = __DIR__ . '/debug_log.txt';
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[$timestamp] $message\n";
    $result = file_put_contents($logFile, $logEntry, FILE_APPEND);
    error_log($logEntry); // 将完整日志条目输出到PHP错误日志
    return $logEntry; // 返回实际写入的日志条目
}

// 获取当前脚本所在目录的绝对路径
$script_dir = dirname(__FILE__);
// 使用绝对路径连接数据库
$db_path = $script_dir . '/admin.db';
// 暂时关闭debugLog输出，避免干扰JSON响应
// 仅在文件操作或错误处理时使用

// 连接数据库并优化配置
try {
    // 使用配置文件获取数据库连接
    $db = DatabaseConfig::getConnection('admin');
    if (!$db) {
        throw new Exception('数据库连接失败：创建SQLite3对象返回false');
    }
    
    // 检查数据库是否正常工作
    $result = $db->query("SELECT sqlite_version() as version");
    
    // 列出所有表
    $tables_result = $db->query("SELECT name FROM sqlite_master WHERE type='table'");
    $tables = [];
    while ($table = $tables_result->fetchArray(SQLITE3_ASSOC)) {
        $tables[] = $table['name'];
    }
    
} catch (Exception $e) {
    $errorMsg = '数据库连接错误: ' . $e->getMessage();
    error_log($errorMsg); // 使用error_log替代debugLog，避免干扰JSON输出
    header('Content-Type: application/json');
    echo json_encode(['status' => 'error', 'message' => '数据库连接失败: ' . $e->getMessage()]);
    exit;
}

// 优化SQLite查询性能
$db->busyTimeout(5000); // 设置超时时间
$db->exec('PRAGMA synchronous = OFF'); // 非事务模式下提高写入性能
$db->exec('PRAGMA journal_mode = MEMORY'); // 提高性能

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

// 调用函数创建表
try {
    createExtensionSettingsTable($db);
} catch (Exception $e) {
    error_log('创建扩展名设置表失败: ' . $e->getMessage());
}

// 预加载所有表信息的缓存
$tables_cache = [];
$tables_data_cache = [];

// 判断路径是否为绝对路径
function is_absolute_path($path) {
    return strpos($path, '/') === 0 || strpos($path, '\\') === 0 || preg_match('/^[a-zA-Z]:/', $path);
}

// 将绝对路径转换为相对于指定目录的路径
function make_path_relative($path, $base) {
    // 对于Windows路径，统一使用正斜杠
    $path = str_replace('\\', '/', $path);
    $base = str_replace('\\', '/', $base);
    
    // 如果已经是相对路径，直接返回
    if (!is_absolute_path($path)) {
        return $path;
    }
    
    // 尝试计算相对路径
    $path_parts = explode('/', trim($path, '/'));
    $base_parts = explode('/', trim($base, '/'));
    
    // 找到共同的父目录
    $i = 0;
    while (isset($path_parts[$i]) && isset($base_parts[$i]) && $path_parts[$i] === $base_parts[$i]) {
        $i++;
    }
    
    // 构建相对路径
    $relative_parts = array_fill(0, count($base_parts) - $i, '..');
    $relative_parts = array_merge($relative_parts, array_slice($path_parts, $i));
    
    return implode('/', $relative_parts);
}

// 处理获取文件列表请求
if (isset($_GET['table']) && !isset($_GET['action'])) {
    $table = $_GET['table'];
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $limit = 50; // 默认加载50条
    $offset = ($page - 1) * $limit;
    $search = isset($_GET['search']) ? $_GET['search'] : '';
    $category = isset($_GET['category']) ? $_GET['category'] : '';
    
    // 验证表名安全性
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
        // 仅在错误时记录日志
        error_log('表名验证失败: ' . $table);
        echo json_encode(['status' => 'error', 'message' => '表名非法']);
        exit;
    }
    
    try {
        // 检查表是否存在
        $check_table_query = "SELECT name FROM sqlite_master WHERE type='table' AND name='" . $db->escapeString($table) . "'";
        $check_result = $db->query($check_table_query);
        if (!$check_result) {
            error_log('表检查查询失败: ' . $db->lastErrorMsg());
            echo json_encode(['status' => 'error', 'message' => '表检查失败']);
            exit;
        }
        
        $table_exists = false;
        while ($row = $check_result->fetchArray(SQLITE3_ASSOC)) {
            $table_exists = true;
            break;
        }
        
        if (!$table_exists) {
            echo json_encode(['status' => 'error', 'message' => '表不存在: ' . $table]);
            exit;
        }
        
        // 构建查询条件
        $conditions = [];
        if (!empty($search)) {
            $search_escaped = $db->escapeString($search);
            $conditions[] = "file_name LIKE '%$search_escaped%'";
            debugLog('添加搜索条件: file_name LIKE %' . $search_escaped . '%');
        }
        if (!empty($category)) {
            $category_escaped = $db->escapeString($category);
            $conditions[] = "file_path LIKE '%/$category_escaped/%'";
            debugLog('添加分类条件: file_path LIKE %/' . $category_escaped . '/%');
        }
        
        $where_clause = '';
        if (!empty($conditions)) {
            $where_clause = "WHERE " . implode(' AND ', $conditions);
            debugLog('生成WHERE子句: ' . $where_clause);
        } else {
            // 无查询条件，查询所有记录
        }
        
        // 获取文件列表
        try {
            // 检查表结构
            $schema_query = "PRAGMA table_info($table)";
            $schema_result = $db->query($schema_query);
            $columns = [];
            while ($col = $schema_result->fetchArray(SQLITE3_ASSOC)) {
                $columns[] = $col['name'];
            }
            // 表' . $table . '的列: ' . implode(', ', $columns)
            
            // 构建并执行查询
            $query = "SELECT file_md5, file_name, file_size, file_path, file_remark, upload_time FROM $table $where_clause ORDER BY upload_time DESC LIMIT $limit OFFSET $offset";
            // 执行查询: ' . $query
            $result = $db->query($query);
            
            if (!$result) {
                throw new Exception('查询执行失败: ' . $db->lastErrorMsg());
            }
            // 查询执行成功
        } catch (Exception $e) {
            $errorMsg = '查询错误: ' . $e->getMessage();
            error_log($errorMsg);
            header('Content-Type: application/json');
            echo json_encode(['status' => 'error', 'message' => '数据查询失败: ' . $e->getMessage()]);
            exit;
        }
        
        $files = [];
        $row_count = 0;
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $row_count++;
            // 提取分类信息 - 改进的路径解析逻辑
            $path_parts = explode('/', trim($row['file_path'], '/'));
            
            // 处理可能的路径格式:
            // 1. "分享文件/分类/文件名"
            // 2. "分类/文件名"
            // 3. "文件名" (无分类)
            
            if (count($path_parts) >= 2) {
                // 检查第一个部分是否是"分享文件"
                if ($path_parts[0] === '分享文件') {
                    // 格式为"分享文件/分类/文件名"，取第二个部分作为分类
                    $row['category'] = $path_parts[1];
                } else {
                    // 格式为"分类/文件名"，取第一个部分作为分类
                    $row['category'] = $path_parts[0];
                }
            } else {
                // 只有一个部分，表示没有分类信息
                $row['category'] = '未分类';
            }
            $files[] = $row;
        }
        // 成功获取 ' . $row_count . ' 条记录
        
        // 获取总记录数
        try {
            $count_query = "SELECT COUNT(*) as total FROM $table $where_clause";
            // 执行计数查询: ' . $count_query
            $count_result = $db->query($count_query);
            
            if (!$count_result) {
                throw new Exception('计数查询失败: ' . $db->lastErrorMsg());
            }
            
            $total_row = $count_result->fetchArray(SQLITE3_ASSOC);
            $total = isset($total_row['total']) ? $total_row['total'] : 0;
            // 总记录数: ' . $total
        } catch (Exception $e) {
            $errorMsg = '计数查询错误: ' . $e->getMessage();
            error_log($errorMsg);
            header('Content-Type: application/json');
            echo json_encode(['status' => 'error', 'message' => '获取记录总数失败: ' . $e->getMessage()]);
            exit;
        }
        
        // 获取所有分类 - 从分享文件目录获取
        $categories = [];
        try {
            $shared_files_dir = __DIR__ . '/../分享文件';
            
            if (is_dir($shared_files_dir)) {
                $dirs = scandir($shared_files_dir);
                foreach ($dirs as $dir) {
                    if ($dir !== '.' && $dir !== '..' && is_dir($shared_files_dir . '/' . $dir)) {
                        $categories[] = $dir;
                    }
                }
                // 获取到分类: ' . implode(', ', $categories)
            }
        } catch (Exception $e) {
            $errorMsg = '分类查询错误: ' . $e->getMessage();
            error_log($errorMsg);
            // 分类查询失败不影响主功能，只记录错误
            $categories = [];
        }
        
        // 准备返回数据
        $response_data = [
            'status' => 'success',
            'files' => $files,
            'total' => $total,
            'page' => $page,
            'pages' => ceil($total / $limit),
            'categories' => $categories
        ];
        
        // 添加status字段确保JSON格式统一
        $response_data['status'] = 'success';
        // 设置正确的Content-Type头
        header('Content-Type: application/json');
        echo json_encode($response_data);
        exit;
    } catch (Exception $e) {
        error_log('查询异常: ' . $e->getMessage());
        header('Content-Type: application/json');
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        exit;
    }
    
    exit;
}

// 处理AJAX请求
if (isset($_GET['action'])) {
    switch ($_GET['action']) {
        case 'scan_and_add_files':
            // 扫描分享文件目录并将文件添加到数据库
            try {
                // 获取分享文件目录路径
                $share_files_dir = dirname(__DIR__) . '/分享文件';
                
                if (!is_dir($share_files_dir)) {
                    throw new Exception('分享文件目录不存在');
                }
                
                // 获取表名
                $table = isset($_GET['table']) ? $_GET['table'] : 'shared_files';
                if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
                    throw new Exception('表名非法');
                }
                
                // 检查表是否存在
                $check_table_query = "SELECT name FROM sqlite_master WHERE type='table' AND name='" . $db->escapeString($table) . "'";
                $check_result = $db->query($check_table_query);
                if (!$check_result) {
                    throw new Exception('表检查失败');
                }
                
                $table_exists = false;
                while ($row = $check_result->fetchArray(SQLITE3_ASSOC)) {
                    $table_exists = true;
                    break;
                }
                
                if (!$table_exists) {
                    throw new Exception('表不存在: ' . $table);
                }
                
                // 开始事务
                $db->exec('BEGIN TRANSACTION');
                
                $added_count = 0;
                $skipped_count = 0;
                $error_files = [];
                
                // 扫描一级文件夹
                $mainFolders = scandir($share_files_dir);
                
                foreach ($mainFolders as $folder) {
                    // 跳过.和..
                    if ($folder === '.' || $folder === '..') {
                        continue;
                    }
                    
                    $folderPath = $share_files_dir . '/' . $folder;
                    
                    // 如果是目录
                    if (is_dir($folderPath)) {
                        // 扫描子文件夹中的文件
                        $subFiles = scandir($folderPath);
                        
                        foreach ($subFiles as $file) {
                            if ($file === '.' || $file === '..') {
                                continue;
                            }
                            
                            $filePath = $folderPath . '/' . $file;
                            
                            // 如果是文件
                            if (is_file($filePath)) {
                                try {
                                    // 彻底简化扫描逻辑 - 直接处理所有文件
                                    $file_md5 = md5_file($filePath);
                                    $file_size = filesize($filePath);
                                    
                                    // 检查文件是否已存在于数据库（使用MD5值）
                                    $stmt = $db->prepare("SELECT id, file_path FROM $table WHERE file_md5 = :md5");
                                    $stmt->bindValue(':md5', $file_md5, SQLITE3_TEXT);
                                    $result = $stmt->execute();
                                    $existing_row = $result->fetchArray(SQLITE3_ASSOC);
                                    
                                    if (!$existing_row) {
                                        // 文件不存在，插入新记录
                                        $relative_path = '分享文件/' . $folder . '/' . $file;
                                        
                                        $insert_stmt = $db->prepare("INSERT INTO $table (file_md5, file_name, file_icon_url, download_count, file_remark, upload_time, file_path, file_size, file_category) VALUES (:md5, :name, :icon, :count, :remark, :time, :path, :size, :category)");
                                        $insert_stmt->bindValue(':md5', $file_md5, SQLITE3_TEXT);
                                        $insert_stmt->bindValue(':name', $file, SQLITE3_TEXT);
                                        $insert_stmt->bindValue(':icon', '', SQLITE3_TEXT);
                                        $insert_stmt->bindValue(':count', 0, SQLITE3_INTEGER);
                                        $insert_stmt->bindValue(':remark', '', SQLITE3_TEXT);
                                        $insert_stmt->bindValue(':time', date('Y-m-d H:i:s'), SQLITE3_TEXT);
                                        $insert_stmt->bindValue(':path', $relative_path, SQLITE3_TEXT);
                                        $insert_stmt->bindValue(':size', $file_size, SQLITE3_INTEGER);
                                        $insert_stmt->bindValue(':category', $folder, SQLITE3_TEXT);
                                        
                                        if ($insert_stmt->execute()) {
                                            $added_count++;
                                        } else {
                                            throw new Exception('插入记录失败');
                                        }
                                    } else {
                                        // 文件已存在，检查路径是否一致
                                        $relative_path = '分享文件/' . $folder . '/' . $file;
                                        if ($existing_row['file_path'] !== $relative_path) {
                                            // 路径不一致，更新数据库中的路径和分类
                                            $update_stmt = $db->prepare("UPDATE $table SET file_path = :path, file_category = :category WHERE file_md5 = :md5");
                                            $update_stmt->bindValue(':path', $relative_path, SQLITE3_TEXT);
                                            $update_stmt->bindValue(':category', $folder, SQLITE3_TEXT);
                                            $update_stmt->bindValue(':md5', $file_md5, SQLITE3_TEXT);
                                            
                                            if ($update_stmt->execute()) {
                                                $added_count++; // 计为更新记录
                                            } else {
                                                throw new Exception('更新记录失败');
                                            }
                                        } else {
                                            $skipped_count++;
                                        }
                                    }
                                } catch (Exception $e) {
                                    $error_files[] = "处理文件失败: $file - " . $e->getMessage();
                                }
                            }
                        }
                    }
                }
                
                // 提交事务
                $db->exec('COMMIT');
                
                // 构建响应消息
                $message = "扫描完成，新增 $added_count 个文件";
                if ($skipped_count > 0) {
                    $message .= "，跳过已存在的 $skipped_count 个文件";
                }
                if (!empty($error_files)) {
                    $message .= "，但有 " . count($error_files) . " 个文件处理失败";
                    // 在开发环境下记录详细错误
                    if (count($error_files) <= 5) {
                        error_log('扫描部分失败: ' . implode('; ', $error_files));
                    }
                }
                
                header('Content-Type: application/json');
                  echo json_encode([
                      'status' => 'success',
                      'message' => $message,
                      'data' => [
                          'new_files' => $added_count,
                          'skipped_files' => $skipped_count,
                          'failed_files' => count($error_files)
                      ]
                  ]);
            } catch (Exception $e) {
                // 回滚事务
                if (isset($db) && $db) {
                    $db->exec('ROLLBACK');
                }
                header('Content-Type: application/json');
                echo json_encode([
                    'status' => 'error', 
                    'message' => $e->getMessage()
                ]);
            }
            exit;
            
        case 'get_categories':
            // 获取文件分类
            try {
                $categories = [];
                $shared_dir = dirname(__DIR__) . '/分享文件';
                
                if (is_dir($shared_dir)) {
                    $dirs = scandir($shared_dir);
                    foreach ($dirs as $dir) {
                        if ($dir !== '.' && $dir !== '..' && is_dir($shared_dir . '/' . $dir)) {
                            $categories[] = $dir;
                        }
                    }
                    sort($categories);
                }
                
                header('Content-Type: application/json');
                echo json_encode([
                    'status' => 'success',
                    'categories' => $categories
                ]);
            } catch (Exception $e) {
                header('Content-Type: application/json');
                echo json_encode([
                    'status' => 'error',
                    'message' => $e->getMessage()
                ]);
            }
            exit;
            
        case 'get_extension_settings':
            // 获取禁止上传的文件扩展名设置
            try {
                $query = "SELECT extension_name, is_active FROM file_extension_settings ORDER BY extension_name";
                $result = $db->query($query);
                
                $extensions = [];
                while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                    $extensions[] = [
                        'extension' => $row['extension_name'],
                        'active' => $row['is_active'] == 1
                    ];
                }
                
                echo json_encode([
                    'status' => 'success',
                    'extensions' => $extensions
                ]);
            } catch (Exception $e) {
                echo json_encode([
                    'status' => 'error',
                    'message' => '获取扩展名设置失败: ' . $e->getMessage()
                ]);
            }
            exit;
            
        case 'save_extension_settings':
            // 保存禁止上传的文件扩展名设置
            $json_data = file_get_contents('php://input');
            $data = json_decode($json_data, true);
            
            if (!isset($data['extensions']) || !is_array($data['extensions'])) {
                echo json_encode([
                    'status' => 'error',
                    'message' => '无效的请求数据'
                ]);
                exit;
            }
            
            try {
                $db->exec('BEGIN TRANSACTION');
                
                // 先清空现有设置
                $db->exec("DELETE FROM file_extension_settings");
                
                // 插入新的设置
                foreach ($data['extensions'] as $extension) {
                    $extension_name = strtolower(trim($extension['extension']));
                    $is_active = isset($extension['active']) && $extension['active'] ? 1 : 0;
                    
                    if (!empty($extension_name)) {
                        $insertQuery = "INSERT INTO file_extension_settings (extension_name, is_active) VALUES ('" . $db->escapeString($extension_name) . "', $is_active)";
                        $db->exec($insertQuery);
                    }
                }
                
                $db->exec('COMMIT');
                
                echo json_encode([
                    'status' => 'success',
                    'message' => '扩展名设置已保存'
                ]);
            } catch (Exception $e) {
                $db->exec('ROLLBACK');
                echo json_encode([
                    'status' => 'error',
                    'message' => '保存扩展名设置失败: ' . $e->getMessage()
                ]);
            }
            exit;
            
        case 'update_remark':
            // 更新文件备注功能
            $json_data = file_get_contents('php://input');
            $data = json_decode($json_data, true);
            
            $table = $data['table'] ?? '';
            $file_md5 = $data['file_md5'] ?? '';
            $file_remark = $data['file_remark'] ?? '';
            
            // 验证表名安全性
            if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
                header('Content-Type: application/json');
                echo json_encode(['status' => 'error', 'message' => '表名非法']);
                exit;
            }
            
            // 验证文件MD5
            if (!preg_match('/^[a-f0-9]{32}$/', $file_md5)) {
                header('Content-Type: application/json');
                echo json_encode(['status' => 'error', 'message' => '无效的文件ID']);
                exit;
            }
            
            // 验证备注长度
            if (strlen($file_remark) > 255) {
                header('Content-Type: application/json');
                echo json_encode(['status' => 'error', 'message' => '备注长度不能超过255个字符']);
                exit;
            }
            
            try {
                // 检查文件是否存在 - 使用预处理语句提高安全性
                $stmt = $db->prepare("SELECT file_name FROM $table WHERE file_md5 = :md5");
                $stmt->bindValue(':md5', $file_md5);
                $result = $stmt->execute();
                $row = $result->fetchArray(SQLITE3_ASSOC);
                
                if (!$row) {
                    throw new Exception('文件不存在');
                }
                
                $file_name = $row['file_name'];
                
                // 更新备注
                $stmt = $db->prepare("UPDATE $table SET file_remark = :remark WHERE file_md5 = :md5");
                $stmt->bindValue(':remark', $file_remark);
                $stmt->bindValue(':md5', $file_md5);
                
                if ($stmt->execute()) {
                    header('Content-Type: application/json');
                    echo json_encode([
                    'status' => 'success', 
                    'message' => "文件备注更新成功: $file_name",
                    'files' => [],
                    'total' => 0,
                    'categories' => []
                ]);
                } else {
                    throw new Exception('备注更新失败');
                }
            } catch (Exception $e) {
                header('Content-Type: application/json');
                echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
            }
            
            exit;
            
        case 'rename_file':
            // 文件重命名功能
            $json_data = file_get_contents('php://input');
            $data = json_decode($json_data, true);
            
            $table = $data['table'] ?? '';
            $file_md5 = $data['file_md5'] ?? '';
            $new_name = $data['new_name'] ?? '';
            
            // 验证表名安全性
            if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
                header('Content-Type: application/json');
                echo json_encode(['status' => 'error', 'message' => '表名非法']);
                exit;
            }
            
            // 验证文件MD5
            if (!preg_match('/^[a-f0-9]{32}$/', $file_md5)) {
                echo json_encode(['status' => 'error', 'message' => '无效的文件ID']);
                exit;
            }
            
            // 验证新文件名
            if (empty($new_name) || strlen($new_name) > 255) {
                echo json_encode(['status' => 'error', 'message' => '文件名不能为空且长度不能超过255个字符']);
                exit;
            }
            
            // 开始事务
            $db->exec('BEGIN TRANSACTION');
            
            try {
                // 检查文件是否存在 - 使用预处理语句提高安全性
                $stmt = $db->prepare("SELECT file_path, file_name FROM $table WHERE file_md5 = :md5");
                $stmt->bindValue(':md5', $file_md5);
                $result = $stmt->execute();
                $row = $result->fetchArray(SQLITE3_ASSOC);
                
                if (!$row) {
                    throw new Exception('文件不存在');
                }
                
                $old_path = $row['file_path'];
                $old_name = $row['file_name'];
                
                // 确保路径是绝对路径
                if (!is_absolute_path($old_path)) {
                    $old_path = $script_dir . '/' . $old_path;
                }
                
                // 物理文件重命名
                $new_path = dirname($old_path) . '/' . $new_name;
                if (file_exists($old_path) && !rename($old_path, $new_path)) {
                    throw new Exception('物理文件重命名失败: ' . error_get_last()['message']);
                }
                
                // 更新数据库中的文件名和路径
                $stmt = $db->prepare("UPDATE $table SET file_name = :new_name, file_path = :new_path WHERE file_md5 = :md5");
                $stmt->bindValue(':new_name', $new_name);
                // 存储相对路径到数据库
                $relative_new_path = make_path_relative($new_path, $script_dir);
                $stmt->bindValue(':new_path', $relative_new_path);
                $stmt->bindValue(':md5', $file_md5);
                
                if (!$stmt->execute()) {
                    throw new Exception('数据库更新失败');
                }
                
                // 提交事务
                $db->exec('COMMIT');
                
                header('Content-Type: application/json');
                echo json_encode([
                    'status' => 'success',
                    'message' => "文件重命名成功: $old_name -> $new_name",
                    'files' => [],
                    'total' => 0,
                    'categories' => []
                ]);
            } catch (Exception $e) {
                // 回滚事务
                $db->exec('ROLLBACK');
                header('Content-Type: application/json');
                echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
            }
            
            exit;
            
        case 'delete_files':
            // 批量删除文件功能 - 调用专门的删除脚本
            try {
                $json_data = file_get_contents('php://input');
                if ($json_data === false) {
                    throw new Exception('无法读取请求数据');
                }
                
                // 记录请求数据（用于调试）
                error_log("批量删除请求: " . $json_data);
                
                $data = json_decode($json_data, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    throw new Exception('JSON解析错误: ' . json_last_error_msg());
                }
                
                $table = $data['table'] ?? '';
                $ids = $data['ids'] ?? [];
                
                // 验证表名安全性
                if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
                    throw new Exception('表名非法');
                }
                
                if (empty($ids)) {
                    throw new Exception('请选择要删除的文件');
                }
                
                // 调用专门的删除脚本
                $script_url = 'http://127.0.0.1/admin/file_delete.php?action=delete_files';
                
                // 准备请求数据 - 使用JSON格式
                $post_data = json_encode([
                    'table' => $table,
                    'ids' => $ids,
                    'api_key' => 'file_delete_api_key_2023' // 简单的API密钥验证
                ]);
                
                // 使用cURL调用删除脚本
                $ch = curl_init();
                curl_setopt($ch, CURLOPT_URL, $script_url);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, $post_data);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 60); // 设置超时时间为60秒
                curl_setopt($ch, CURLOPT_HEADER, false);
                curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']); // 设置Content-Type为JSON
                
                $response = curl_exec($ch);
                $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $curl_error = curl_error($ch);
                curl_close($ch);
                
                if ($curl_error) {
                    throw new Exception('调用删除脚本失败: ' . $curl_error);
                }
                
                if ($http_code !== 200) {
                    throw new Exception('删除脚本返回异常状态码: ' . $http_code);
                }
                
                // 解析删除脚本的响应
                $result = json_decode($response, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    throw new Exception('解析删除脚本响应失败: ' . json_last_error_msg());
                }
                
                // 记录删除脚本的响应（用于调试）
                error_log("删除脚本响应: " . $response);
                
                // 返回删除脚本的结果
                echo json_encode($result);
            } catch (Exception $e) {
                echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
            }
            
            exit;
            
        case 'cleanup_orphaned_records':
            // 清理不存在文件的数据库记录
            try {
                $table = isset($_GET['table']) ? $_GET['table'] : 'shared_files';
                if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
                    throw new Exception('表名非法');
                }
                
                // 检查表是否存在
                $check_table_query = "SELECT name FROM sqlite_master WHERE type='table' AND name='" . $db->escapeString($table) . "'";
                $check_result = $db->query($check_table_query);
                if (!$check_result) {
                    throw new Exception('表检查失败');
                }
                
                $table_exists = false;
                while ($row = $check_result->fetchArray(SQLITE3_ASSOC)) {
                    $table_exists = true;
                    break;
                }
                
                if (!$table_exists) {
                    throw new Exception('表不存在: ' . $table);
                }
                
                // 获取脚本目录路径
                $script_dir = __DIR__;
                $base_path = dirname($script_dir);
                
                // 查询所有文件记录
                $query = "SELECT file_md5, file_path, file_name FROM $table";
                $result = $db->query($query);
                
                if (!$result) {
                    throw new Exception('查询文件记录失败: ' . $db->lastErrorMsg());
                }
                
                $orphaned_count = 0;
                $total_count = 0;
                $orphaned_files = [];
                
                // 开始事务
                $db->exec('BEGIN TRANSACTION');
                
                // 检查每个文件记录
                while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                    $total_count++;
                    
                    $file_md5 = $row['file_md5'];
                    $file_path = $row['file_path'];
                    $file_name = $row['file_name'];
                    
                    // 构建完整的文件路径
                    if (strpos($file_path, "分享文件") !== 0) {
                        $file_path = "分享文件/" . ltrim($file_path, '/\\');
                    }
                    
                    // 构建绝对路径
                    $absolute_path = $base_path . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $file_path);
                    
                    // 检查物理文件是否存在
                    if (!file_exists($absolute_path)) {
                        // 文件不存在，删除数据库记录
                        $delete_stmt = $db->prepare("DELETE FROM $table WHERE file_md5 = :md5");
                        $delete_stmt->bindValue(':md5', $file_md5);
                        
                        if ($delete_stmt->execute()) {
                            $orphaned_count++;
                            $orphaned_files[] = [
                                'name' => $file_name,
                                'path' => $file_path,
                                'md5' => $file_md5
                            ];
                        }
                    }
                }
                
                // 提交事务
                $db->exec('COMMIT');
                
                // 构建响应消息
                $message = "清理完成，共检查 $total_count 个文件记录";
                if ($orphaned_count > 0) {
                    $message .= "，删除了 $orphaned_count 个不存在文件的记录";
                } else {
                    $message .= "，没有发现需要清理的记录";
                }
                
                header('Content-Type: application/json');
                echo json_encode([
                    'status' => 'success',
                    'message' => $message,
                    'data' => [
                        'total_checked' => $total_count,
                        'orphaned_deleted' => $orphaned_count,
                        'orphaned_files' => $orphaned_files
                    ]
                ]);
            } catch (Exception $e) {
                // 回滚事务
                if (isset($db) && $db) {
                    $db->exec('ROLLBACK');
                }
                header('Content-Type: application/json');
                echo json_encode([
                    'status' => 'error',
                    'message' => $e->getMessage()
                ]);
            }
            exit;
            
        default:
            header('Content-Type: application/json');
            echo json_encode(['status' => 'error', 'message' => '未知的操作类型']);
            exit;
    }
}

// HTML页面内容
if (!defined('AJAX_MODE') || !AJAX_MODE) {
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>文件预览管理</title>
    <!-- 引入本地Font Awesome CSS -->
    <link rel="stylesheet" href="../css/font-awesome/font-awesome.min.css">
    <!-- 加载皮肤CSS -->
    <?php echo getSkinHTMLHead(); ?>
    
    <!-- 基础重置样式，确保布局不受皮肤影响 -->
    <style>
        /* 使用皮肤变量覆盖默认样式 */
        body {
            font-family: var(--color-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
            margin: 20px;
            background-color: var(--color-bg-primary, #f5f5f5);
            color: var(--color-text-primary, #000);
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: var(--color-bg-secondary, white);
            padding: 20px;
            border-radius: var(--color-radius-lg, 8px);
            box-shadow: 0 2px 4px var(--color-shadow, rgba(0,0,0,0.1));
        }
        h1 {
            color: var(--color-text-heading, #000);
            margin-bottom: 0px;
            font-family: var(--color-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
            font-weight: 600;
            height: 0px;
            overflow: hidden;
        }
        .button-group {
            margin-bottom: 20px;
            text-align: right;
        }
        .btn {
            padding: 5px 10px;
            margin-left: 10px;
            border: 1px solid var(--color-border, #808080);
            background-color: var(--color-bg-btn-primary, #f0f0f0);
            color: var(--color-text-btn-primary, #000);
            border-radius: var(--color-radius-sm, 3px);
            cursor: pointer;
            font-size: 12px;
            font-family: var(--color-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
            transition: all var(--color-transition-normal, 0.2s);
            white-space: nowrap;
            display: inline-block;
            text-align: center;
            line-height: 1.3;
            min-width: 70px;
            max-width: 120px;
            overflow: hidden;
            text-overflow: ellipsis;
            box-sizing: border-box;
            flex-shrink: 0;
        }
        .btn-primary {
            background-color: var(--color-bg-btn-primary, #0078d4);
            color: var(--color-text-btn-primary, white);
            border-color: var(--color-bg-btn-primary, #0078d4);
        }
        .btn-primary:hover:not(:disabled) {
            background-color: var(--color-bg-btn-primary-hover, #106ebe);
            border-color: var(--color-bg-btn-primary-hover, #106ebe);
        }
        .btn:hover:not(:disabled) {
            background-color: var(--color-bg-btn-secondary-hover, #e0e0e0);
        }
        .btn:disabled {
            background-color: var(--color-bg-btn-disabled, #f4f4f4);
            color: var(--color-text-btn-disabled, #a0a0a0);
            border-color: var(--color-border-input-disabled, #d0d0d0);
            cursor: not-allowed;
        }
        
        /* 搜索和分类区域样式 */
        .search-category-container {
            margin-bottom: 20px;
            border: 1px solid var(--color-border, #d0d0d0);
            padding: 15px;
            background-color: var(--color-bg-tertiary, #f9f9f9);
        }
        .search-box {
            margin-bottom: 15px;
        }
        .category-tabs {
            margin-top: 15px;
        }
        
        /* SQL Server表格样式 - 鸿蒙6.0优化版 */
        .sql-server-table-container {
            border: 1px solid var(--color-border-table, rgba(0, 122, 255, 0.2));
            border-radius: var(--color-radius-lg, 12px);
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            margin-bottom: 16px;
            background: var(--color-bg-card, #ffffff);
        }
        .sql-server-table {
            width: 100%;
            border-collapse: collapse;
            font-family: var(--color-font-family, 'SF Pro Display', 'PingFang SC', 'Microsoft YaHei', sans-serif);
            font-size: 14px;
        }
        .sql-server-table th {
            background: linear-gradient(to right, var(--color-primary, #007aff), var(--color-primary-light, #5ac8fa));
            color: var(--color-text-inverse, #ffffff);
            padding: 12px 16px;
            text-align: left;
            border: none;
            font-weight: 600;
            font-size: 14px;
            letter-spacing: 0.3px;
        }
        .sql-server-table td {
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid var(--color-border-table-row, rgba(0, 0, 0, 0.06));
            background-color: var(--color-bg-card, #ffffff);
            color: var(--color-text-primary, #333333);
            font-size: 14px;
            transition: all var(--color-transition-normal, 0.2s);
        }
        .sql-server-table tr:last-child td {
            border-bottom: none;
        }
        .sql-server-table tr:hover td {
            background-color: var(--color-bg-hover, rgba(0, 122, 255, 0.04));
        }
        .sql-server-table tr:nth-child(even) td {
            background-color: var(--color-bg-secondary, rgba(0, 0, 0, 0.01));
        }
        .sql-server-table tr:nth-child(even):hover td {
            background-color: var(--color-bg-hover, rgba(0, 122, 255, 0.04));
        }
        .sql-server-footer {
            padding: 12px 16px;
            background: linear-gradient(to right, var(--color-bg-tertiary, #f8f9fa), var(--color-bg-secondary, #ffffff));
            border-top: 1px solid var(--color-border-table, rgba(0, 122, 255, 0.2));
            font-family: var(--color-font-family, 'SF Pro Display', 'PingFang SC', 'Microsoft YaHei', sans-serif);
            font-size: 13px;
            color: var(--color-text-secondary, #666666);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        /* 复选框样式优化 */
        .sql-server-table input[type="checkbox"] {
            width: 18px;
            height: 18px;
            border-radius: var(--color-radius-sm, 4px);
            border: 2px solid var(--color-border, rgba(0, 122, 255, 0.3));
            background-color: var(--color-bg-card, #ffffff);
            cursor: pointer;
            transition: all var(--color-transition-normal, 0.2s);
            position: relative;
            appearance: none;
            -webkit-appearance: none;
        }
        .sql-server-table input[type="checkbox"]:checked {
            background-color: var(--color-primary, #007aff);
            border-color: var(--color-primary, #007aff);
        }
        .sql-server-table input[type="checkbox"]:checked::after {
            content: '✓';
            position: absolute;
            top: -2px;
            left: 3px;
            color: var(--color-text-inverse, #ffffff);
            font-size: 14px;
            font-weight: bold;
        }
        .sql-server-table input[type="checkbox"]:hover {
            border-color: var(--color-primary, #007aff);
            box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
        }
        
        /* 表格中的MD5值样式 */
        .sql-server-table td:last-child {
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 12px;
            color: var(--color-text-muted, #666666);
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .sql-server-table td:last-child span {
            cursor: pointer;
            transition: color var(--color-transition-normal, 0.2s);
        }
        .sql-server-table td:last-child span:hover {
            color: var(--color-primary, #007aff);
        }
        
        /* 深色模式适配 */
        [data-theme="harmonyos_6"] .sql-server-table-container {
            border-color: rgba(0, 122, 255, 0.3);
            background: var(--color-bg-card, rgba(255, 255, 255, 0.05));
        }
        [data-theme="harmonyos_6"] .sql-server-table th {
            background: linear-gradient(to right, var(--color-primary, #007aff), var(--color-primary-light, #5ac8fa));
        }
        [data-theme="harmonyos_6"] .sql-server-table td {
            background-color: var(--color-bg-card, rgba(255, 255, 255, 0.05));
            color: var(--color-text-primary, #ffffff);
            border-bottom-color: rgba(255, 255, 255, 0.1);
        }
        [data-theme="harmonyos_6"] .sql-server-table tr:hover td {
            background-color: rgba(0, 122, 255, 0.15);
        }
        [data-theme="harmonyos_6"] .sql-server-table tr:nth-child(even) td {
            background-color: rgba(255, 255, 255, 0.02);
        }
        [data-theme="harmonyos_6"] .sql-server-table tr:nth-child(even):hover td {
            background-color: rgba(0, 122, 255, 0.15);
        }
        [data-theme="harmonyos_6"] .sql-server-footer {
            background: linear-gradient(to right, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.1));
            border-top-color: rgba(0, 122, 255, 0.3);
            color: var(--color-text-secondary, #cccccc);
        }
        [data-theme="harmonyos_6"] .sql-server-table td:last-child {
            color: var(--color-text-muted, #aaaaaa);
        }
        [data-theme="harmonyos_6"] .sql-server-table input[type="checkbox"] {
            background-color: rgba(255, 255, 255, 0.1);
            border-color: rgba(0, 122, 255, 0.5);
        }
        [data-theme="harmonyos_6"] .sql-server-table input[type="checkbox"]:checked {
            background-color: var(--color-primary, #007aff);
            border-color: var(--color-primary, #007aff);
        }
        
        /* 分页按钮样式 */
        .pagination-container {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 5px;
        }
        .pagination-btn {
            padding: 4px 8px;
            border: 1px solid var(--color-border, #ccc);
            background-color: var(--color-bg-secondary, white);
            color: var(--color-text-secondary, #000);
            border-radius: var(--color-radius-sm, 3px);
            cursor: pointer;
            font-size: 11px;
            transition: all var(--color-transition-normal, 0.2s);
            min-width: 28px;
            text-align: center;
        }
        .pagination-btn:hover:not(:disabled) {
            background-color: var(--color-bg-nav-link-hover, #f0f0f0);
        }
        .pagination-btn.active {
            background-color: var(--color-bg-btn-primary, #0078d4);
            color: var(--color-text-btn-primary, white);
            border-color: var(--color-bg-btn-primary, #0078d4);
        }
        .pagination-btn:disabled {
            background-color: var(--color-bg-btn-disabled, #f4f4f4);
            color: var(--color-text-btn-disabled, #a0a0a0);
            border-color: var(--color-border-input-disabled, #d0d0d0);
            cursor: not-allowed;
        }
        
        /* 复选框样式 */
        input[type="checkbox"] {
            cursor: pointer;
        }
        
        /* 分类按钮样式 */
        .category-btn {
            padding: 3px 8px;
            border: 1px solid var(--color-border, #ccc);
            background-color: var(--color-bg-secondary, white);
            border-radius: var(--color-radius-sm, 3px);
            cursor: pointer;
            font-size: 11px;
            transition: all var(--color-transition-normal, 0.2s);
            color: var(--color-text-secondary, #000);
            white-space: nowrap;
            display: inline-block;
            text-align: center;
            line-height: 1.3;
            min-width: 50px;
            max-width: 100px;
            overflow: hidden;
            text-overflow: ellipsis;
            box-sizing: border-box;
            flex-shrink: 0;
        }
        .category-btn:hover {
            background-color: var(--color-bg-nav-link-hover, #f0f0f0);
        }
        .category-btn.active {
            background-color: var(--color-bg-btn-primary, #0078d4);
            color: var(--color-text-btn-primary, white);
            border-color: var(--color-bg-btn-primary, #0078d4);
        }
        
        /* 状态消息固定容器样式 */
        .status-container-fixed {
            height: 40px;
            margin-bottom: 10px;
            position: relative;
        }
        
        /* 状态消息样式 */
        .status-message {
            padding: 10px;
            margin: 0;
            border: 1px solid transparent;
            border-radius: var(--color-radius-sm, 3px);
            display: none;
            font-family: var(--color-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
        }
        .status-success {
            background-color: var(--color-bg-alert-success, #d4edda);
            color: var(--color-text-alert-success, #155724);
            border-color: var(--color-border-alert-success, #c3e6cb);
        }
        .status-error {
            background-color: var(--color-bg-alert-danger, #f8d7da);
            color: var(--color-text-alert-danger, #721c24);
            border-color: var(--color-border-alert-danger, #f5c6cb);
        }
        .status-info {
            background-color: var(--color-bg-alert-info, #d1ecf1);
            color: var(--color-text-alert-info, #0c5460);
            border-color: var(--color-border-alert-info, #bee5eb);
        }
        
        /* 模态框样式 */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: var(--color-shadow-dark, rgba(0,0,0,0.5));
            z-index: 1000;
            animation: fadeIn 0.2s ease;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        .modal-container {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--color-bg-card, var(--color-bg-secondary, #fff));
            border-radius: var(--color-radius-lg, 12px);
            padding: 0;
            width: 600px;
            max-width: 95%;
            max-height: 80vh;
            box-shadow: var(--color-shadow, 0 10px 25px rgba(0,0,0,0.15));
            overflow: hidden;
            animation: slideUp 0.3s ease;
            display: flex;
            flex-direction: column;
        }
        
        @keyframes slideUp {
            from { 
                opacity: 0;
                transform: translate(-50%, -40%);
            }
            to { 
                opacity: 1;
                transform: translate(-50%, -50%);
            }
        }
        
        .modal-header {
            padding: 15px 20px;
            background: var(--color-bg-tertiary, #f8f9fa);
            border-bottom: 1px solid var(--color-border, #eee);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .modal-header h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: var(--color-text-primary, #333);
        }
        
        .modal-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--color-text-muted, #999);
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .modal-close:hover {
            color: var(--color-text-primary, #333);
        }
        
        .modal-body {
            padding: 20px;
            overflow-y: auto;
            background: var(--color-bg-card, var(--color-bg-secondary, #fff));
            flex: 1;
        }
        
        .modal-footer {
            padding: 15px 20px;
            background: var(--color-bg-tertiary, #f8f9fa);
            border-top: 1px solid var(--color-border, #eee);
            text-align: right;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        
        .input-group {
            display: flex;
            margin-bottom: 10px;
        }
        
        .input-group-append {
            display: flex;
        }
        
        .form-text {
            font-size: 12px;
            color: var(--color-text-muted, #666);
            margin-top: 5px;
        }
    </style>
    
    <!-- 皮肤切换JavaScript -->
    <?php echo getSkinSwitchJS(); ?>
</head>
<body class="<?php echo getSkinBodyClass(); ?>" data-theme="<?php echo getCurrentSkin(); ?>">
    <div class="container">
        <!-- 页眉 -->
        <header>
            <?php 
            // 获取页眉内容但不显示header_description
            $config = loadUIConfig();
            echo '<div style="display: flex; justify-content: center; align-items: center;">
                <h1 style="text-align: center; margin: 0;">' . $config['header_title'] . '</h1>
            </div>';
            // 不显示header_description
            ?>
        </header>
        
        <h1></h1>
        
        <!-- 状态消息固定容器 -->
        <div class="status-container-fixed">
            <div id="statusContainer" class="status-message"></div>
        </div>
        
        <!-- 搜索和分类区域 -->
        <div class="search-category-container">
            <div class="search-box">
                <input type="text" id="fileSearch" placeholder="搜索文件名..." style="padding: 8px; width: 300px; margin-right: 10px;">
                <button id="searchButton" class="btn btn-primary">搜索</button>
                <button id="resetSearchButton" class="btn">重置</button>
            </div>
            
            <div class="category-tabs">
                <div style="margin-bottom: 10px; font-weight: bold;">文件分类：</div>
                <div id="categoryButtons" style="display: flex; flex-wrap: wrap; gap: 10px;">
                    <!-- 分类按钮将动态生成 -->
                </div>
            </div>
        </div>
        
        <div class="button-group">
            <button id="scanAndAddButton" class="btn btn-primary">扫描并添加文件</button>
            <button id="cleanupOrphanedButton" class="btn btn-warning">清理无效记录</button>
            <button id="updateRemarkButton" class="btn btn-primary" disabled>修改备注</button>
            <button id="renameSelectedButton" class="btn btn-primary" disabled>重命名</button>
            <button id="batchCategoryButton" class="btn btn-primary" disabled>批量调整分类</button>
            <button id="deleteSelectedButton" class="btn btn-primary" disabled>批量删除</button>
            <button id="editExtensionsButton" class="btn btn-warning">编辑禁止上传扩展名</button>
        </div>
        
        <!-- SQL Server风格的表格 -->
        <div class="sql-server-table-container">
            <table class="sql-server-table">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="selectAll"></th>
                        <th>文件名</th>
                        <th>大小</th>
                        <th>上传时间</th>
                        <th>备注</th>
                        <th>分类</th>
                        <th>MD5值</th>
                    </tr>
                </thead>
                <tbody id="fileList">
                <!-- 文件列表将通过JavaScript动态加载 -->
            </tbody>
        </table>
        <div class="sql-server-footer">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span id="recordInfo" style="font-style: italic;">加载中...</span>
                <div id="paginationContainer" class="pagination-container">
                    <!-- 分页按钮将通过JavaScript动态生成 -->
                </div>
            </div>
        </div>
        </div>
    </div>
    
    <script>
        // 全局变量
        let currentTable = 'shared_files';
        let currentPage = 1;
        let currentSearch = '';
        let currentCategory = '';
        let allCategories = [];
        
        // 显示状态消息
        function showStatus(type, message) {
            const container = document.getElementById('statusContainer');
            container.className = 'status-message status-' + type;
            container.textContent = message;
            container.style.display = 'block';
            
            // 3秒后自动隐藏
            setTimeout(() => {
                container.style.display = 'none';
            }, 3000);
        }
        
        // 更新删除按钮状态
        function updateDeleteButtonState() {
            const checkboxes = document.querySelectorAll('.file-checkbox:checked');
            const deleteButton = document.getElementById('deleteSelectedButton');
            
            if (deleteButton) {
                // 至少选中一个文件时启用删除按钮
                deleteButton.disabled = checkboxes.length === 0;
                
                // 更新按钮文本，显示选中数量
                if (checkboxes.length === 0) {
                    deleteButton.textContent = '批量删除';
                } else {
                    deleteButton.textContent = '批量删除(' + checkboxes.length + ')';
                }
            }
        }
        
        // 更新批量调整分类按钮状态
        function updateBatchCategoryButtonState() {
            const checkboxes = document.querySelectorAll('.file-checkbox:checked');
            const batchCategoryButton = document.getElementById('batchCategoryButton');
            
            if (batchCategoryButton) {
                // 至少选中一个文件时启用批量调整分类按钮
                batchCategoryButton.disabled = checkboxes.length === 0;
                
                // 更新按钮文本，显示选中数量
                if (checkboxes.length === 0) {
                    batchCategoryButton.textContent = '批量调整分类';
                } else {
                    batchCategoryButton.textContent = '批量调整分类(' + checkboxes.length + ')';
                }
            }
        }
        
        // 更新备注按钮状态
        function updateRemarkButtonState() {
            const checkboxes = document.querySelectorAll('.file-checkbox:checked');
            const remarkButton = document.getElementById('updateRemarkButton');
            
            if (remarkButton) {
                // 仅当勾选单个文件时启用备注按钮
                remarkButton.disabled = checkboxes.length !== 1;
            }
        }
        
        // 更新重命名按钮状态
        function updateRenameButtonState() {
            const checkboxes = document.querySelectorAll('.file-checkbox:checked');
            const renameButton = document.getElementById('renameSelectedButton');
            
            if (renameButton) {
                // 仅当勾选单个文件时启用重命名按钮
                renameButton.disabled = checkboxes.length !== 1;
            }
        }
        
        // 高亮显示复选框区域
        function highlightCheckboxArea() {
            const tableHead = document.querySelector('table thead');
            if (tableHead) {
                tableHead.style.backgroundColor = '#ffeb3b';
                setTimeout(() => {
                    tableHead.style.backgroundColor = '#f8f9fa';
                }, 800);
            }
        }
        
        // 批量删除选中的文件
        function deleteSelectedFiles(event) {
            // 阻止默认行为和事件冒泡
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            
            const checkboxes = document.querySelectorAll('.file-checkbox:checked');
            const selectedIds = Array.from(checkboxes).map(checkbox => checkbox.value);
            
            if (selectedIds.length === 0) {
                showStatus('error', '请先选择要删除的文件');
                highlightCheckboxArea();
                return false;
            }
            
            // 使用同步方式处理确认对话框，确保用户确认后再执行删除
            const isConfirmed = confirm('⚠️ 确认删除操作\n\n确定要删除选中的 ' + selectedIds.length + ' 个文件吗？\n\n注意：此操作不可恢复，删除后文件将无法找回！');
            
            // 只有用户明确点击确认按钮，才继续执行删除操作
            if (!isConfirmed) {
                return false;
            }
            
            // 只有在用户确认后，才显示删除状态和禁用按钮
            showStatus('info', '正在删除文件，请稍候...');
            
            const deleteButton = document.getElementById('deleteSelectedButton');
            if (deleteButton) {
                deleteButton.disabled = true;
                deleteButton.textContent = '删除中...';
            }
            
            // 添加超时处理
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
            
            fetch('file_preview.php?action=delete_files&page=' + currentPage + '&search=' + encodeURIComponent(currentSearch) + '&category=' + encodeURIComponent(currentCategory), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    table: 'shared_files',
                    ids: selectedIds
                }),
                signal: controller.signal
            })
            .then(response => {
                // 清除超时
                clearTimeout(timeoutId);
                
                // 检查响应状态
                if (!response.ok) {
                    throw new Error('HTTP错误! 状态: ' + response.status);
                }
                
                // 检查响应Content-Type
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('服务器返回了非JSON格式的响应');
                }
                
                return response.json();
            })
            .then(data => {
                if (deleteButton) {
                    deleteButton.disabled = false;
                    // 不再硬编码按钮文本，而是调用updateDeleteButtonState()让它自动计算选中数量
                    updateDeleteButtonState();
                }
                
                if (data.status === 'success') {
                    // 显示详细的删除状态信息
                    let statusMessage = data.message;
                    
                    // 如果有错误信息，显示这些错误
                    if (data.errors && data.errors.length > 0) {
                        statusMessage += "\n\n删除失败的文件：";
                        data.errors.forEach(error => {
                            statusMessage += "\n- " + error;
                        });
                    }
                    
                    showStatus('success', statusMessage);
                    
                    // 删除成功后强制刷新文件列表
                    // 添加短暂延迟确保状态消息先显示
                    setTimeout(() => {
                        // 检查是否需要跳转到上一页
                        if (data.deleted_count > 0) {
                            // 获取当前页的文件数量
                            const checkboxes = document.querySelectorAll('.file-checkbox');
                            // 如果删除的文件数量等于当前页的文件数量，且不是第一页，则跳转到上一页
                            if (checkboxes.length === data.deleted_count && currentPage > 1) {
                                currentPage--;
                            }
                        }
                        
                        // 重新加载数据
                        loadTableData(currentTable, currentPage);
                    }, 500);
                } else {
                    showStatus('error', data.message || '删除操作失败');
                    updateDeleteButtonState();
                }
            })
            .catch(error => {
                // 清除超时
                clearTimeout(timeoutId);
                
                if (deleteButton) {
                    deleteButton.disabled = false;
                    // 不再硬编码按钮文本，而是调用updateDeleteButtonState()让它自动计算选中数量
                    updateDeleteButtonState();
                }
                
                updateDeleteButtonState();
                updateRenameButtonState();
                updateRemarkButtonState();
                
                // 提供更详细的错误信息
                let errorMessage = '删除操作出错';
                if (error.name === 'AbortError') {
                    errorMessage = '删除操作超时，可能是由于文件数量过多或服务器响应缓慢。请稍后再试。';
                } else if (error.message) {
                    errorMessage += ': ' + error.message;
                }
                
                // 如果是JSON解析错误，提供更具体的提示
                if (error.message.includes('JSON')) {
                    errorMessage = '服务器响应格式错误，可能是由于PHP错误导致。请检查服务器日志。';
                }
                
                showStatus('error', errorMessage);
            });
        }
        
        // 显示重命名对话框
        function showRenameDialog(fileMd5, oldFileName, table) {
            const dialogOverlay = document.createElement('div');
            dialogOverlay.style.position = 'fixed';
            dialogOverlay.style.top = '0';
            dialogOverlay.style.left = '0';
            dialogOverlay.style.width = '100%';
            dialogOverlay.style.height = '100%';
            dialogOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            dialogOverlay.style.display = 'flex';
            dialogOverlay.style.justifyContent = 'center';
            dialogOverlay.style.alignItems = 'center';
            dialogOverlay.style.zIndex = '1001';
            
            const dialog = document.createElement('div');
            dialog.style.backgroundColor = 'white';
            dialog.style.padding = '20px';
            dialog.style.borderRadius = '4px';
            dialog.style.width = '400px';
            dialog.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            
            const dialogTitle = document.createElement('h3');
            dialogTitle.textContent = '重命名文件';
            dialogTitle.style.marginTop = '0';
            dialogTitle.style.marginBottom = '15px';
            dialogTitle.style.color = '#333';
            
            const oldNameDiv = document.createElement('div');
            oldNameDiv.style.marginBottom = '10px';
            oldNameDiv.innerHTML = '<strong>原文件名:</strong> ' + oldFileName;
            
            const newNameDiv = document.createElement('div');
            newNameDiv.style.marginBottom = '15px';
            newNameDiv.innerHTML = 
                '<label style="display: block; margin-bottom: 5px;"><strong>新文件名:</strong></label>' +
                '<input ' +
                    'type="text" ' +
                    'id="newFileNameInput" ' +
                    'value="' + oldFileName + '" ' +
                    'style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;"' +
                '>';
            
            const errorMessageDiv = document.createElement('div');
            errorMessageDiv.id = 'renameErrorMessage';
            errorMessageDiv.style.color = '#dc3545';
            errorMessageDiv.style.fontSize = '12px';
            errorMessageDiv.style.minHeight = '20px';
            errorMessageDiv.style.marginBottom = '15px';
            
            const buttonsDiv = document.createElement('div');
            buttonsDiv.style.display = 'flex';
            buttonsDiv.style.justifyContent = 'flex-end';
            buttonsDiv.style.gap = '10px';
            
            const cancelButton = document.createElement('button');
            cancelButton.textContent = '取消';
            cancelButton.className = 'btn';
            cancelButton.addEventListener('click', () => {
                document.body.removeChild(dialogOverlay);
            });
            
            const confirmButton = document.createElement('button');
            confirmButton.textContent = '确定';
            confirmButton.className = 'btn btn-primary';
            confirmButton.addEventListener('click', () => {
                const newFileName = document.getElementById('newFileNameInput').value.trim();
                const errorDiv = document.getElementById('renameErrorMessage');
                
                if (!newFileName) {
                    errorDiv.textContent = '文件名不能为空';
                    return;
                }
                
                if (!/^[a-zA-Z0-9_\-\.\u4e00-\u9fa5]+$/.test(newFileName)) {
                    errorDiv.textContent = '文件名包含非法字符，只能使用字母、数字、下划线、连字符、点号和中文字符';
                    return;
                }
                
                errorDiv.textContent = '';
                
                confirmButton.disabled = true;
                confirmButton.textContent = '处理中...';
                
                renameFile(fileMd5, newFileName, table, () => {
                    document.body.removeChild(dialogOverlay);
                });
            });
            
            buttonsDiv.appendChild(cancelButton);
            buttonsDiv.appendChild(confirmButton);
            
            dialog.appendChild(dialogTitle);
            dialog.appendChild(oldNameDiv);
            dialog.appendChild(newNameDiv);
            dialog.appendChild(errorMessageDiv);
            dialog.appendChild(buttonsDiv);
            
            dialogOverlay.appendChild(dialog);
            document.body.appendChild(dialogOverlay);
            
            const input = document.getElementById('newFileNameInput');
            if (input) {
                input.focus();
                input.select();
            }
        }
        
        // 执行文件重命名
        function renameFile(fileMd5, newFileName, table, callback) {
            showStatus('info', '正在重命名文件，请稍候...');
            
            fetch('file_preview.php?action=rename_file', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    table: table,
                    file_md5: fileMd5,
                    new_name: newFileName
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    showStatus('success', data.message);
                    
                    // 调用file_monitor.php进行文件重命名同步
                    fetch('file_monitor.php?action=rename_sync', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            file_md5: fileMd5,
                            new_name: newFileName
                        })
                    })
                    .then(syncResponse => syncResponse.json())
                    .then(syncData => {
                        console.log('文件同步结果:', syncData);
                        loadTableData(currentTable, currentPage);
                    })
                    .catch(syncError => {
                        console.error('文件同步失败:', syncError);
                        loadTableData(currentTable, currentPage); // 即使同步失败也重新加载数据
                    });
                } else {
                    showStatus('error', data.message);
                }
                
                if (typeof callback === 'function') {
                    callback();
                }
            })
            .catch(error => {
                showStatus('error', '重命名操作出错: ' + error.message);
                
                if (typeof callback === 'function') {
                    callback();
                }
            });
        }
        
        // 显示修改备注对话框
        function showRemarkDialog(fileMd5, currentRemark, table) {
            const dialogOverlay = document.createElement('div');
            dialogOverlay.style.position = 'fixed';
            dialogOverlay.style.top = '0';
            dialogOverlay.style.left = '0';
            dialogOverlay.style.width = '100%';
            dialogOverlay.style.height = '100%';
            dialogOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            dialogOverlay.style.display = 'flex';
            dialogOverlay.style.justifyContent = 'center';
            dialogOverlay.style.alignItems = 'center';
            dialogOverlay.style.zIndex = '1001';
            
            const dialog = document.createElement('div');
            dialog.style.backgroundColor = 'white';
            dialog.style.padding = '20px';
            dialog.style.borderRadius = '4px';
            dialog.style.width = '400px';
            dialog.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            
            const dialogTitle = document.createElement('h3');
            dialogTitle.textContent = '修改文件备注';
            dialogTitle.style.marginTop = '0';
            dialogTitle.style.marginBottom = '15px';
            dialogTitle.style.color = '#333';
            
            const currentRemarkDiv = document.createElement('div');
            currentRemarkDiv.style.marginBottom = '10px';
            currentRemarkDiv.innerHTML = '<strong>当前备注:</strong> ' + (currentRemark || '无备注');
            
            const newRemarkDiv = document.createElement('div');
            newRemarkDiv.style.marginBottom = '15px';
            newRemarkDiv.innerHTML = 
                '<label style="display: block; margin-bottom: 5px;"><strong>新备注:</strong></label>' +
                '<textarea ' +
                    'id="newRemarkInput" ' +
                    'style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; min-height: 100px; resize: vertical;"' +
                '>' + (currentRemark || '') + '</textarea>' +
                '<small style="color: #666; display: block; margin-top: 5px;">备注最多255个字符，留空表示清除备注</small>';
            
            const errorMessageDiv = document.createElement('div');
            errorMessageDiv.id = 'remarkErrorMessage';
            errorMessageDiv.style.color = '#dc3545';
            errorMessageDiv.style.fontSize = '12px';
            errorMessageDiv.style.minHeight = '20px';
            errorMessageDiv.style.marginBottom = '15px';
            
            const buttonsDiv = document.createElement('div');
            buttonsDiv.style.display = 'flex';
            buttonsDiv.style.justifyContent = 'flex-end';
            buttonsDiv.style.gap = '10px';
            
            const cancelButton = document.createElement('button');
            cancelButton.textContent = '取消';
            cancelButton.className = 'btn';
            cancelButton.addEventListener('click', () => {
                document.body.removeChild(dialogOverlay);
            });
            
            const confirmButton = document.createElement('button');
            confirmButton.textContent = '确定';
            confirmButton.className = 'btn btn-primary';
            confirmButton.addEventListener('click', () => {
                const newRemark = document.getElementById('newRemarkInput').value.trim();
                const errorDiv = document.getElementById('remarkErrorMessage');
                
                if (newRemark.length > 255) {
                    errorDiv.textContent = '备注长度不能超过255个字符';
                    return;
                }
                
                errorDiv.textContent = '';
                
                confirmButton.disabled = true;
                confirmButton.textContent = '处理中...';
                
                updateFileRemark(fileMd5, newRemark, table, () => {
                    document.body.removeChild(dialogOverlay);
                });
            });
            
            buttonsDiv.appendChild(cancelButton);
            buttonsDiv.appendChild(confirmButton);
            
            dialog.appendChild(dialogTitle);
            dialog.appendChild(currentRemarkDiv);
            dialog.appendChild(newRemarkDiv);
            dialog.appendChild(errorMessageDiv);
            dialog.appendChild(buttonsDiv);
            
            dialogOverlay.appendChild(dialog);
            document.body.appendChild(dialogOverlay);
            
            const input = document.getElementById('newRemarkInput');
            if (input) {
                input.focus();
            }
        }
        
        // 执行文件备注更新
        function updateFileRemark(fileMd5, newRemark, table, callback) {
            showStatus('info', '正在更新备注，请稍候...');
            
            fetch('file_preview.php?action=update_remark', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    table: table,
                    file_md5: fileMd5,
                    file_remark: newRemark
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    showStatus('success', data.message);
                    loadTableData(currentTable, currentPage);
                } else {
                    showStatus('error', data.message);
                }
                
                if (typeof callback === 'function') {
                    callback();
                }
            })
            .catch(error => {
                showStatus('error', '更新备注出错: ' + error.message);
                
                if (typeof callback === 'function') {
                    callback();
                }
            });
        }
        
        // 加载分类
        function loadCategories() {
            console.log('开始加载分类...');
            fetch('file_preview.php?action=get_categories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => {
                console.log('分类响应状态:', response.status);
                return response.json();
            })
            .then(data => {
                console.log('分类数据:', data);
                if (data.status === 'success') {
                    console.log('分类数组:', data.categories);
                    renderCategoryButtons(data.categories);
                } else {
                    console.error('加载分类失败:', data.message);
                }
            })
            .catch(error => {
                console.error('加载分类失败:', error);
            });
        }
        
        // 加载数据表
        function loadTableData(table, page) {
            const fileList = document.getElementById('fileList');
            fileList.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">正在加载数据...</td></tr>';
            
            // 构建查询参数
            const params = new URLSearchParams();
            params.append('table', table);
            params.append('page', page);
            if (currentSearch) {
                params.append('search', currentSearch);
            }
            if (currentCategory) {
                params.append('category', currentCategory);
            }
            
            // 实际从服务器加载数据 - 使用专门的数据处理程序
            console.log('准备加载数据，参数:', params.toString());
            showStatus('info', '正在请求数据...');
            fetch('file_data_handler.php?' + params.toString(), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => {
                console.log('响应状态:', response.status, response.statusText);
                if (!response.ok) {
                    throw new Error('服务器响应错误: ' + response.status);
                }
                return response.text().then(text => {
                    console.log('原始响应内容:', text);
                    try {
                        return JSON.parse(text);
                    } catch (e) {
                        throw new Error('响应内容不是有效的JSON格式');
                    }
                });
            })
            .then(data => {
                console.log('解析后的数据:', data);
                if (data.status === 'success' && data.files) {
                    renderFileList(data.files, data.total, page);
                    
                    // 渲染分类按钮（如果返回了分类数据）
                    if (data.categories && data.categories.length > 0) {
                        renderCategoryButtons(data.categories);
                    }
                    
                    // 更新当前分类显示
                    const categoryDisplay = document.getElementById('currentCategoryDisplay');
                    if (categoryDisplay) {
                        if (currentCategory) {
                            categoryDisplay.textContent = '当前分类: ' + currentCategory;
                        } else {
                            categoryDisplay.textContent = '所有分类';
                        }
                    }
                    
                    // 更新搜索框的值
                    const searchInput = document.getElementById('searchInput');
                    if (searchInput && searchInput.value !== currentSearch) {
                        searchInput.value = currentSearch;
                    }
                    
                    // 更新全选复选框状态
                    const selectAllCheckbox = document.getElementById('selectAll');
                    if (selectAllCheckbox) {
                        selectAllCheckbox.checked = false;
                        selectAllCheckbox.indeterminate = false;
                    }
                    
                    // 重置所有单个文件复选框状态
                    setTimeout(() => {
                        const fileCheckboxes = document.querySelectorAll('.file-checkbox');
                        fileCheckboxes.forEach(checkbox => {
                            checkbox.checked = false;
                        });
                    }, 100);
                    
                    // 更新按钮状态
                    updateDeleteButtonState();
                    updateBatchCategoryButtonState();
                    updateRenameButtonState();
                    updateRemarkButtonState();
                    
                    // 如果当前页没有数据且是第一页，显示空状态提示
                    if (data.files.length === 0 && currentPage === 1) {
                        showStatus('info', '当前分类下没有文件');
                    } else {
                        showStatus('success', '数据加载成功');
                    }
                } else {
                    fileList.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: orange;">' + (data.message || '无数据') + '</td></tr>';
                    showStatus('info', data.message || '未找到数据');
                }
            })
            .catch(error => {
                console.error('加载文件列表失败:', error);
                fileList.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: red;">加载失败: ' + error.message + '</td></tr>';
                showStatus('error', '加载失败: ' + error.message);
            });
        }
        
        // 渲染文件列表
        function updatePageInfo(page) {
            const pageInfoElement = document.getElementById('pageInfo');
            if (pageInfoElement) {
                const totalRecords = parseInt(document.getElementById('totalRecords').value);
                const recordsPerPage = 20; // 与后端保持一致，每页20条记录
                const totalPages = Math.ceil(totalRecords / recordsPerPage);
                pageInfoElement.textContent = `第 ${page} 页，共 ${totalPages} 页`;
            }
        }
        
        function renderFileList(files, total, page) {
            const fileList = document.getElementById('fileList');
            const totalRecordsElement = document.getElementById('totalRecords');
            
            // 更新总记录数
            if (totalRecordsElement) {
                totalRecordsElement.value = total;
            }
            
            // 更新页码信息
            updatePageInfo(page);
            
            // 计算总页数
            const recordsPerPage = 20; // 与后端保持一致，每页20条记录
            const totalPages = Math.ceil(total / recordsPerPage);
            
            // 渲染分页按钮
            renderPagination(page, totalPages);
            
            const recordInfo = document.getElementById('recordInfo');
            
            if (files.length === 0) {
                fileList.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">无数据</td></tr>';
                recordInfo.textContent = '显示 0 条记录';
                return;
            }
            
            let html = '';
            files.forEach(file => {
                // 从文件路径提取分类信息
                let category = '未分类';
                if (file.category) {
                    category = file.category;
                } else if (file.file_path) {
                    const pathParts = file.file_path.split('/');
                    if (pathParts.length > 1 && pathParts[1]) {
                        category = pathParts[1];
                    }
                }
                
                // 添加复制MD5的函数
                const copyMd5 = 'copyToClipboard(\'' + file.file_md5 + '\')';
                
                html += 
                    '<tr>' +
                        '<td><input type="checkbox" class="file-checkbox" value="' + escapeHtml(file.file_md5) + '" data-category="' + escapeHtml(category) + '" data-filename="' + escapeHtml(file.file_name) + '"></td>' +
                        '<td>' + escapeHtml(file.file_name) + '</td>' +
                        '<td>' + formatFileSize(file.file_size || 0) + '</td>' +
                        '<td>' + (file.upload_time && file.upload_time.trim() !== '' ? file.upload_time : '-') + '</td>' +
                        '<td>' + escapeHtml(file.file_remark || '') + '</td>' +
                        '<td>' + escapeHtml(category) + '</td>' +
                        '<td>' +
                            '<div style="display: flex; align-items: center;">' +
                                '<span title="点击复制MD5" style="cursor: pointer;" onclick="copyToClipboard(\'' + escapeHtml(file.file_md5).replace(/'/g, '\\\'') + '\')">' + escapeHtml(file.file_md5) + '</span>' +
                            '</div>' +
                        '</td>' +
                    '</tr>';
            });
            
            fileList.innerHTML = html;
            recordInfo.textContent = '显示 ' + files.length + ' 条记录，共 ' + total + ' 条';
            
            // 确保新渲染的复选框状态正确
            const fileCheckboxes = document.querySelectorAll('.file-checkbox');
            fileCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            
            // 重置全选复选框状态
            const selectAllCheckbox = document.getElementById('selectAll');
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            }
        }
        
        // 渲染分类按钮
        function renderCategoryButtons(categories) {
            console.log('渲染分类按钮，分类数据:', categories);
            const categoryButtons = document.getElementById('categoryButtons');
            console.log('categoryButtons元素:', categoryButtons);
            
            // 保存分类列表
            allCategories = categories;
            
            // 清空现有的按钮
            categoryButtons.innerHTML = '';
            
            // 添加"全部"按钮
            const allButton = document.createElement('button');
            allButton.className = 'category-btn ' + (currentCategory === '' ? 'active' : '');
            allButton.textContent = '全部';
            allButton.addEventListener('click', () => {
                currentCategory = '';
                currentPage = 1;
                renderCategoryButtons(categories); // 重新渲染按钮状态
                loadTableData(currentTable, currentPage);
            });
            categoryButtons.appendChild(allButton);
            
            // 添加各个分类按钮
            if (categories && categories.length > 0) {
                categories.forEach(category => {
                    console.log('添加分类按钮:', category);
                    const button = document.createElement('button');
                    button.className = 'category-btn ' + (currentCategory === category ? 'active' : '');
                    button.textContent = category;
                    button.addEventListener('click', () => {
                        currentCategory = category;
                        currentPage = 1;
                        renderCategoryButtons(categories); // 重新渲染按钮状态
                        loadTableData(currentTable, currentPage);
                    });
                    categoryButtons.appendChild(button);
                });
            } else {
                console.log('没有分类数据');
            }
        }
        
        // 渲染分页按钮
        function renderPagination(currentPage, totalPages) {
            const paginationContainer = document.getElementById('paginationContainer');
            
            // 清空现有的分页按钮
            paginationContainer.innerHTML = '';
            
            // 如果总页数小于等于1，不显示分页按钮
            if (totalPages <= 1) {
                return;
            }
            
            // 创建上一页按钮
            const prevButton = document.createElement('button');
            prevButton.className = 'pagination-btn';
            prevButton.textContent = '上一页';
            prevButton.disabled = currentPage <= 1;
            prevButton.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    loadTableData(currentTable, currentPage);
                }
            });
            paginationContainer.appendChild(prevButton);
            
            // 计算显示的页码范围
            let startPage = Math.max(1, currentPage - 2);
            let endPage = Math.min(totalPages, startPage + 4);
            
            // 调整起始页，确保显示5个页码（如果总页数足够）
            if (endPage - startPage < 4 && totalPages > 5) {
                startPage = Math.max(1, endPage - 4);
            }
            
            // 如果不是从第1页开始，显示第1页和省略号
            if (startPage > 1) {
                // 第1页按钮
                const firstPageButton = document.createElement('button');
                firstPageButton.className = 'pagination-btn';
                firstPageButton.textContent = '1';
                firstPageButton.addEventListener('click', () => {
                    currentPage = 1;
                    loadTableData(currentTable, currentPage);
                });
                paginationContainer.appendChild(firstPageButton);
                
                // 如果第1页和起始页之间有间隔，显示省略号
                if (startPage > 2) {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '...';
                    ellipsis.style.padding = '0 5px';
                    paginationContainer.appendChild(ellipsis);
                }
            }
            
            // 显示页码按钮
            for (let i = startPage; i <= endPage; i++) {
                const pageButton = document.createElement('button');
                // 确保当前页按钮正确高亮显示
                pageButton.className = 'pagination-btn' + (i === currentPage ? ' active' : '');
                pageButton.textContent = i;
                pageButton.addEventListener('click', () => {
                    currentPage = i;
                    loadTableData(currentTable, currentPage);
                });
                paginationContainer.appendChild(pageButton);
            }
            
            // 如果不是到最后一页结束，显示省略号和最后一页
            if (endPage < totalPages) {
                // 如果结束页和最后一页之间有间隔，显示省略号
                if (endPage < totalPages - 1) {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '...';
                    ellipsis.style.padding = '0 5px';
                    paginationContainer.appendChild(ellipsis);
                }
                
                // 最后一页按钮
                const lastPageButton = document.createElement('button');
                lastPageButton.className = 'pagination-btn';
                lastPageButton.textContent = totalPages;
                lastPageButton.addEventListener('click', () => {
                    currentPage = totalPages;
                    loadTableData(currentTable, currentPage);
                });
                paginationContainer.appendChild(lastPageButton);
            }
            
            // 创建下一页按钮
            const nextButton = document.createElement('button');
            nextButton.className = 'pagination-btn';
            nextButton.textContent = '下一页';
            nextButton.disabled = currentPage >= totalPages;
            nextButton.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    loadTableData(currentTable, currentPage);
                }
            });
            paginationContainer.appendChild(nextButton);
        }
        
        // 格式化文件大小
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 B';
            
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        // HTML转义
        function escapeHtml(text) {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;')
                .replace(/\\/g, '&#92;');
        }
        
        // 复制MD5到剪贴板
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    showStatus('success', 'MD5值已复制到剪贴板');
                })
                .catch(err => {
                    showStatus('error', '复制失败，请手动复制');
                    console.error('复制失败:', err);
                });
        }
        
        // 处理搜索
        function handleSearch() {
            currentSearch = document.getElementById('fileSearch').value.trim();
            currentPage = 1;
            loadTableData(currentTable, currentPage);
        }
        
        // 重置搜索
        function resetSearch() {
            document.getElementById('fileSearch').value = '';
            currentSearch = '';
            currentPage = 1;
            loadTableData(currentTable, currentPage);
        }
        
        // 显示编辑扩展名设置对话框
        function showExtensionSettingsDialog() {
            // 创建遮罩层
            const dialogOverlay = document.createElement('div');
            dialogOverlay.className = 'modal';
            dialogOverlay.style.display = 'flex';
            
            // 创建对话框容器
            const dialogContainer = document.createElement('div');
            dialogContainer.className = 'modal-container';
            dialogContainer.style.width = '600px';
            dialogContainer.style.maxWidth = '90%';
            
            // 创建对话框头部
            const dialogHeader = document.createElement('div');
            dialogHeader.className = 'modal-header';
            
            // 对话框标题
            const dialogTitle = document.createElement('h3');
            dialogTitle.textContent = '编辑禁止上传的文件扩展名';
            
            // 关闭按钮
            const closeButton = document.createElement('button');
            closeButton.className = 'modal-close';
            closeButton.innerHTML = '&times;';
            closeButton.addEventListener('click', () => {
                const dialogOverlay = document.querySelector('.modal');
                if (dialogOverlay) {
                    document.body.removeChild(dialogOverlay);
                }
            });
            
            dialogHeader.appendChild(dialogTitle);
            dialogHeader.appendChild(closeButton);
            
            // 创建对话框主体
            const dialogBody = document.createElement('div');
            dialogBody.className = 'modal-body';
            
            // 添加新扩展名区域
            const addExtensionDiv = document.createElement('div');
            addExtensionDiv.className = 'form-group';
            addExtensionDiv.innerHTML = 
                '<div class="input-group">' +
                    '<input type="text" id="newExtensionInput" class="form-control" placeholder="输入新的扩展名（如：txt）">' +
                    '<div class="input-group-append">' +
                        '<button id="addExtensionButton" class="btn btn-primary">添加</button>' +
                    '</div>' +
                '</div>' +
                '<div class="form-text">提示：扩展名不需要加点（.），例如输入 "txt" 而不是 ".txt"</div>';
            
            // 扩展名列表容器
            const extensionsContainer = document.createElement('div');
            extensionsContainer.className = 'card';
            extensionsContainer.style.marginBottom = '20px';
            
            // 创建对话框底部
            const dialogFooter = document.createElement('div');
            dialogFooter.className = 'modal-footer';
            
            const cancelButton = document.createElement('button');
            cancelButton.textContent = '取消';
            cancelButton.className = 'btn btn-secondary';
            cancelButton.addEventListener('click', () => {
                const dialogOverlay = document.querySelector('.modal');
                if (dialogOverlay) {
                    document.body.removeChild(dialogOverlay);
                }
            });
            
            const saveButton = document.createElement('button');
            saveButton.textContent = '保存';
            saveButton.id = 'saveExtensionButton';
            saveButton.className = 'btn btn-primary';
            saveButton.addEventListener('click', () => {
                saveExtensionSettings();
            });
            
            // 组装对话框
            dialogFooter.appendChild(cancelButton);
            dialogFooter.appendChild(saveButton);
            
            dialogBody.appendChild(addExtensionDiv);
            dialogBody.appendChild(extensionsContainer);
            
            dialogContainer.appendChild(dialogHeader);
            dialogContainer.appendChild(dialogBody);
            dialogContainer.appendChild(dialogFooter);
            
            dialogOverlay.appendChild(dialogContainer);
            document.body.appendChild(dialogOverlay);
            
            // 加载当前扩展名设置
            loadExtensionSettings(extensionsContainer);
            
            // 添加新扩展名的事件
            document.getElementById('addExtensionButton').addEventListener('click', () => {
                const input = document.getElementById('newExtensionInput');
                const extension = input.value.trim().toLowerCase();
                
                if (extension === '') {
                    showStatus('error', '请输入扩展名');
                    return;
                }
                
                // 检查是否已存在
                const existingCheckboxes = document.querySelectorAll('.extension-checkbox');
                for (let checkbox of existingCheckboxes) {
                    if (checkbox.value === extension) {
                        showStatus('error', '该扩展名已存在');
                        return;
                    }
                }
                
                // 添加新的扩展名
                addExtensionItem(extensionsContainer, extension, true);
                input.value = '';
                showStatus('success', '已添加新扩展名');
            });
            
            // 回车添加扩展名
            document.getElementById('newExtensionInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('addExtensionButton').click();
                }
            });
        }
        
        // 加载扩展名设置
        function loadExtensionSettings(container) {
            container.innerHTML = '<div style="text-align: center; padding: 20px;">加载中...</div>';
            
            fetch('file_preview.php?action=get_extension_settings', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    container.innerHTML = '';
                    
                    if (data.extensions.length === 0) {
                        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--color-text-muted);">暂无扩展名设置</div>';
                        return;
                    }
                    
                    // 创建表格
                    const table = document.createElement('table');
                    table.className = 'table';
                    
                    // 表头
                    const thead = document.createElement('thead');
                    const headerRow = document.createElement('tr');
                    headerRow.innerHTML = 
                '<th style="width: 50px;">启用</th>' +
                '<th>扩展名</th>' +
                '<th style="width: 80px;">操作</th>';
                    thead.appendChild(headerRow);
                    table.appendChild(thead);
                    
                    // 表体
                    const tbody = document.createElement('tbody');
                    data.extensions.forEach(item => {
                        const row = document.createElement('tr');
                        row.innerHTML = 
                        '<td style="text-align: center;">' +
                            '<input type="checkbox" class="extension-checkbox" value="' + item.extension + '" ' + (item.active ? 'checked' : '') + '>' +
                        '</td>' +
                        '<td>' + item.extension + '</td>' +
                        '<td style="text-align: center;">' +
                            '<button class="btn btn-sm btn-danger remove-extension" data-extension="' + item.extension + '">删除</button>' +
                        '</td>';
                        tbody.appendChild(row);
                    });
                    table.appendChild(tbody);
                    
                    container.appendChild(table);
                    
                    // 添加删除扩展名的事件
                    document.querySelectorAll('.remove-extension').forEach(button => {
                        button.addEventListener('click', (e) => {
                            const extension = e.target.getAttribute('data-extension');
                            if (confirm('确定要删除扩展名 "' + extension + '" 吗？')) {
                                e.target.closest('tr').remove();
                                showStatus('success', '已删除扩展名');
                            }
                        });
                    });
                } else {
                    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--color-danger);">加载失败: ' + data.message + '</div>';
                }
            })
            .catch(error => {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--color-danger);">加载失败: ' + error.message + '</div>';
            });
        }
        
        // 添加扩展名项
        function addExtensionItem(container, extension, active = true) {
            const tbody = container.querySelector('tbody');
            if (!tbody) {
                // 如果表格不存在，创建表格
                const table = document.createElement('table');
                table.className = 'table';
                
                // 表头
                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');
                headerRow.innerHTML = 
                '<th style="width: 50px;">启用</th>' +
                '<th>扩展名</th>' +
                '<th style="width: 80px;">操作</th>';
                thead.appendChild(headerRow);
                table.appendChild(thead);
                
                // 表体
                const newTbody = document.createElement('tbody');
                table.appendChild(newTbody);
                container.appendChild(table);
                
                // 更新tbody引用
                tbody = newTbody;
            }
            
            const row = document.createElement('tr');
            row.innerHTML = 
                    '<td style="text-align: center;">' +
                        '<input type="checkbox" class="extension-checkbox" value="' + extension + '" ' + (active ? 'checked' : '') + '>' +
                    '</td>' +
                    '<td>' + extension + '</td>' +
                    '<td style="text-align: center;">' +
                        '<button class="btn btn-sm btn-danger remove-extension" data-extension="' + extension + '">删除</button>' +
                    '</td>';
            tbody.appendChild(row);
            
            // 添加删除扩展名的事件
            row.querySelector('.remove-extension').addEventListener('click', (e) => {
                const extension = e.target.getAttribute('data-extension');
                if (confirm('确定要删除扩展名 "' + extension + '" 吗？')) {
                    e.target.closest('tr').remove();
                    showStatus('success', '已删除扩展名');
                }
            });
        }
        
        // 保存扩展名设置
        function saveExtensionSettings() {
            const checkboxes = document.querySelectorAll('.extension-checkbox');
            const extensions = [];
            
            checkboxes.forEach(checkbox => {
                extensions.push({
                    extension: checkbox.value,
                    active: checkbox.checked
                });
            });
            
            const saveButton = document.querySelector('#saveExtensionButton');
            if (saveButton) {
                saveButton.disabled = true;
                saveButton.textContent = '保存中...';
            }
            
            fetch('file_preview.php?action=save_extension_settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    extensions: extensions
                })
            })
            .then(response => response.json())
            .then(data => {
                if (saveButton) {
                    saveButton.disabled = false;
                    saveButton.textContent = '保存';
                }
                
                if (data.status === 'success') {
                    showStatus('success', data.message);
                    // 关闭对话框
                    const dialogOverlay = document.querySelector('.modal');
                    if (dialogOverlay) {
                        document.body.removeChild(dialogOverlay);
                    }
                } else {
                    showStatus('error', data.message);
                }
            })
            .catch(error => {
                if (saveButton) {
                    saveButton.disabled = false;
                    saveButton.textContent = '保存';
                }
                showStatus('error', '保存失败: ' + error.message);
            });
        }
        
        // 显示批量调整分类对话框
        function showBatchCategoryDialog() {
            const checkedCheckboxes = document.querySelectorAll('.file-checkbox:checked');
            if (checkedCheckboxes.length === 0) {
                showStatus('error', '请先选择要调整分类的文件');
                return;
            }
            
            // 创建遮罩层
            const dialogOverlay = document.createElement('div');
            dialogOverlay.className = 'modal';
            dialogOverlay.style.display = 'flex';
            
            // 创建对话框容器
            const dialogContainer = document.createElement('div');
            dialogContainer.className = 'modal-container';
            dialogContainer.style.width = '500px';
            dialogContainer.style.maxWidth = '90%';
            
            // 创建对话框头部
            const dialogHeader = document.createElement('div');
            dialogHeader.className = 'modal-header';
            
            // 对话框标题
            const dialogTitle = document.createElement('h3');
            dialogTitle.textContent = '批量调整文件分类';
            
            // 关闭按钮
            const closeButton = document.createElement('button');
            closeButton.className = 'modal-close';
            closeButton.innerHTML = '&times;';
            closeButton.addEventListener('click', () => {
                const dialogOverlay = document.querySelector('.modal');
                if (dialogOverlay) {
                    document.body.removeChild(dialogOverlay);
                }
            });
            
            dialogHeader.appendChild(dialogTitle);
            dialogHeader.appendChild(closeButton);
            
            // 创建对话框主体
            const dialogBody = document.createElement('div');
            dialogBody.className = 'modal-body';
            
            // 添加提示信息
            const infoDiv = document.createElement('div');
            infoDiv.className = 'form-group';
            infoDiv.innerHTML = '<p>已选择 <strong>' + checkedCheckboxes.length + '</strong> 个文件，请选择新的分类：</p>';
            
            // 添加分类选择区域
            const categorySelectDiv = document.createElement('div');
            categorySelectDiv.className = 'form-group';
            categorySelectDiv.innerHTML = 
                '<label for="newCategory" class="form-label">新分类：</label>' +
                '<select id="newCategory" class="form-control">' +
                    '<option value="">请选择分类</option>' +
                '</select>';
            
            // 添加自定义分类输入区域
            const customCategoryDiv = document.createElement('div');
            customCategoryDiv.className = 'form-group';
            customCategoryDiv.innerHTML = 
                '<label for="customCategory" class="form-label">或输入新分类名称：</label>' +
                '<input type="text" id="customCategory" class="form-control" placeholder="输入新分类名称">';
            
            // 创建对话框底部
            const dialogFooter = document.createElement('div');
            dialogFooter.className = 'modal-footer';
            
            const cancelButton = document.createElement('button');
            cancelButton.textContent = '取消';
            cancelButton.className = 'btn btn-secondary';
            cancelButton.addEventListener('click', () => {
                const dialogOverlay = document.querySelector('.modal');
                if (dialogOverlay) {
                    document.body.removeChild(dialogOverlay);
                }
            });
            
            const confirmButton = document.createElement('button');
            confirmButton.textContent = '确定';
            confirmButton.id = 'confirmBatchCategory';
            confirmButton.className = 'btn btn-primary';
            confirmButton.addEventListener('click', () => {
                let selectedCategory = document.getElementById('newCategory').value;
                const customCategory = document.getElementById('customCategory').value.trim();
                
                // 如果输入了自定义分类，使用自定义分类
                if (customCategory) {
                    selectedCategory = customCategory;
                }
                
                if (!selectedCategory) {
                    showStatus('error', '请选择或输入分类名称');
                    return;
                }
                
                // 收集选中的文件MD5
                const fileMd5s = [];
                checkedCheckboxes.forEach(checkbox => {
                    fileMd5s.push(checkbox.value);
                });
                
                // 禁用按钮
                confirmButton.disabled = true;
                confirmButton.textContent = '处理中...';
                
                // 发送请求
                fetch('file_batch_category.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        file_md5s: fileMd5s,
                        new_category: selectedCategory
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        showStatus('success', data.message);
                        // 关闭对话框
                        const dialogOverlay = document.querySelector('.modal');
                        if (dialogOverlay) {
                            document.body.removeChild(dialogOverlay);
                        }
                        // 刷新文件列表
                        loadTableData(currentTable, currentPage);
                        // 刷新分类按钮
                        loadCategories();
                    } else {
                        showStatus('error', data.message);
                    }
                })
                .catch(error => {
                    showStatus('error', '操作失败: ' + error.message);
                })
                .finally(() => {
                    // 恢复按钮状态
                    confirmButton.disabled = false;
                    confirmButton.textContent = '确定';
                });
            });
            
            // 组装对话框
            dialogFooter.appendChild(cancelButton);
            dialogFooter.appendChild(confirmButton);
            
            dialogBody.appendChild(infoDiv);
            dialogBody.appendChild(categorySelectDiv);
            dialogBody.appendChild(customCategoryDiv);
            
            dialogContainer.appendChild(dialogHeader);
            dialogContainer.appendChild(dialogBody);
            dialogContainer.appendChild(dialogFooter);
            
            dialogOverlay.appendChild(dialogContainer);
            document.body.appendChild(dialogOverlay);
            
            // 获取DOM元素
            const categorySelect = document.getElementById('newCategory');
            const customCategoryInput = document.getElementById('customCategory');
            
            // 加载分类列表
            loadCategoriesForDialog(categorySelect);
            
            // 监听分类选择变化
            categorySelect.addEventListener('change', function() {
                if (this.value) {
                    customCategoryInput.value = '';
                }
            });
            
            // 监听自定义分类输入变化
            customCategoryInput.addEventListener('input', function() {
                if (this.value.trim()) {
                    categorySelect.value = '';
                }
            });
            
            // 点击对话框外部关闭
            dialogOverlay.addEventListener('click', function(event) {
                if (event.target === dialogOverlay) {
                    const dialogOverlay = document.querySelector('.modal');
                    if (dialogOverlay) {
                        document.body.removeChild(dialogOverlay);
                    }
                }
            });
        }
        
        // 加载分类列表到对话框
        function loadCategoriesForDialog(selectElement) {
            fetch('file_preview.php?action=get_categories')
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success' && data.categories) {
                    // 清空现有选项（保留第一个默认选项）
                    while (selectElement.options.length > 1) {
                        selectElement.remove(1);
                    }
                    
                    // 添加分类选项
                    data.categories.forEach(category => {
                        const option = document.createElement('option');
                        option.value = category;
                        option.textContent = category;
                        selectElement.appendChild(option);
                    });
                }
            })
            .catch(error => {
                console.error('加载分类失败:', error);
            });
        }
        
        // DOM加载完成后初始化
        document.addEventListener('DOMContentLoaded', function() {
            // 初始化按钮事件
            const deleteButton = document.getElementById('deleteSelectedButton');
            if (deleteButton) {
                deleteButton.addEventListener('click', function(event) {
                    deleteSelectedFiles(event);
                });
            }
            
            const remarkButton = document.getElementById('updateRemarkButton');
            if (remarkButton) {
                remarkButton.addEventListener('click', function() {
                    const checkedCheckboxes = document.querySelectorAll('.file-checkbox:checked');
                    if (checkedCheckboxes.length === 1) {
                        const fileMd5 = checkedCheckboxes[0].value;
                        const tr = checkedCheckboxes[0].closest('tr');
                        const remarkCell = tr.querySelector('td:nth-child(5)');
                        const currentRemark = remarkCell ? remarkCell.textContent : '';
                        showRemarkDialog(fileMd5, currentRemark, 'shared_files');
                    }
                });
            }
            
            const renameButton = document.getElementById('renameSelectedButton');
            if (renameButton) {
                renameButton.addEventListener('click', function() {
                    const checkedCheckboxes = document.querySelectorAll('.file-checkbox:checked');
                    if (checkedCheckboxes.length === 1) {
                        const fileMd5 = checkedCheckboxes[0].value;
                        const filename = checkedCheckboxes[0].dataset.filename || '文件名';
                        showRenameDialog(fileMd5, filename, 'shared_files');
                    }
                });
            }
            
            // 批量调整分类按钮事件
            const batchCategoryButton = document.getElementById('batchCategoryButton');
            if (batchCategoryButton) {
                batchCategoryButton.addEventListener('click', function() {
                    showBatchCategoryDialog();
                });
            }
            
            // 扫描并添加文件按钮事件
            const scanAndAddButton = document.getElementById('scanAndAddButton');
            if (scanAndAddButton) {
                scanAndAddButton.addEventListener('click', function() {
                    if (confirm('确定要扫描"分享文件"目录下的所有文件并添加到数据库吗？\n\n注意：此操作可能需要较长时间，取决于文件数量。')) {
                        scanAndAddButton.disabled = true;
                        scanAndAddButton.textContent = '扫描中...';
                        
                        fetch('file_preview.php?action=scan_and_add_files', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        })
                        .then(response => response.json())
                        .then(data => {
                            scanAndAddButton.disabled = false;
                            scanAndAddButton.textContent = '扫描并添加文件';
                            
                            if (data.status === 'success') {
                                showStatus('success', `扫描完成！新增 ${data.data.new_files} 个文件，跳过 ${data.data.skipped_files} 个文件，失败 ${data.data.failed_files} 个文件。`);
                                // 刷新文件列表
                                loadTableData(currentTable, currentPage);
                                // 刷新分类按钮
                                loadCategories();
                            } else {
                                showStatus('error', data.message || '扫描失败');
                            }
                        })
                        .catch(error => {
                            scanAndAddButton.disabled = false;
                            scanAndAddButton.textContent = '扫描并添加文件';
                            showStatus('error', '扫描失败: ' + error.message);
                        });
                    }
                });
            }
            
            // 搜索功能
            const searchButton = document.getElementById('searchButton');
            if (searchButton) {
                searchButton.addEventListener('click', handleSearch);
            }
            
            const resetSearchButton = document.getElementById('resetSearchButton');
            if (resetSearchButton) {
                resetSearchButton.addEventListener('click', resetSearch);
            }
            
            const fileSearch = document.getElementById('fileSearch');
            if (fileSearch) {
                fileSearch.addEventListener('keypress', function(event) {
                    if (event.key === 'Enter') {
                        handleSearch();
                    }
                });
            }
            
            // 全选/取消全选
            const selectAllCheckbox = document.getElementById('selectAll');
            if (selectAllCheckbox) {
                selectAllCheckbox.addEventListener('change', function() {
                    const checkboxes = document.querySelectorAll('.file-checkbox');
                    checkboxes.forEach(checkbox => {
                        checkbox.checked = selectAllCheckbox.checked;
                    });
                    
                    updateDeleteButtonState();
                    updateBatchCategoryButtonState();
                    updateRenameButtonState();
                    updateRemarkButtonState();
                });
            }
            
            // 复选框变化事件
            document.addEventListener('change', function(event) {
                if (event.target.classList.contains('file-checkbox')) {
                    updateDeleteButtonState();
                    updateBatchCategoryButtonState();
                    updateRenameButtonState();
                    updateRemarkButtonState();
                    
                    const allCheckboxes = document.querySelectorAll('.file-checkbox');
                    const checkedCheckboxes = document.querySelectorAll('.file-checkbox:checked');
                    const selectAllCheckbox = document.getElementById('selectAll');
                    
                    if (selectAllCheckbox) {
                        selectAllCheckbox.checked = allCheckboxes.length > 0 && allCheckboxes.length === checkedCheckboxes.length;
                    }
                }
            });
            
            // 编辑扩展名按钮事件
            const editExtensionsButton = document.getElementById('editExtensionsButton');
            if (editExtensionsButton) {
                editExtensionsButton.addEventListener('click', showExtensionSettingsDialog);
            }
            
            // 清理无效记录按钮事件
            const cleanupOrphanedButton = document.getElementById('cleanupOrphanedButton');
            if (cleanupOrphanedButton) {
                cleanupOrphanedButton.addEventListener('click', function() {
                    if (confirm('确定要清理所有无效的文件记录吗？\n\n此操作将删除数据库中记录但物理文件不存在的记录。')) {
                        cleanupOrphanedButton.disabled = true;
                        cleanupOrphanedButton.textContent = '清理中...';
                        
                        fetch('file_preview.php?action=cleanup_orphaned_records', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        })
                        .then(response => response.json())
                        .then(data => {
                            cleanupOrphanedButton.disabled = false;
                            cleanupOrphanedButton.textContent = '清理无效记录';
                            
                            if (data.status === 'success') {
                                showStatus('success', `清理完成！删除了 ${data.deleted_count} 条无效记录。`);
                                // 刷新文件列表
                                loadTableData(currentTable, currentPage);
                            } else {
                                showStatus('error', data.message || '清理失败');
                            }
                        })
                        .catch(error => {
                            cleanupOrphanedButton.disabled = false;
                            cleanupOrphanedButton.textContent = '清理无效记录';
                            showStatus('error', '清理失败: ' + error.message);
                        });
                    }
                });
            }
            
            // 初始加载数据
            loadTableData(currentTable, currentPage);
            // 加载分类
            loadCategories();
        });
    </script>
<?php
} // 闭合if (!defined('AJAX_MODE') || !AJAX_MODE)条件
?>
</body>
</html>
