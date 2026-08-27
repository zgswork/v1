<?php
/**
 * 专门用于删除文件的脚本
 * 接收文件MD5列表，执行物理文件删除和数据库记录删除
 */

// 定义访问控制常量
define('IN_ADMIN_PANEL', true);

// 设置错误报告
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/logs/file_delete.log');

// 引入必要的配置文件
require_once 'db_config.php';
require_once 'file_whitelist.php';
require_once 'file_security_checker.php';

// 记录脚本开始执行
error_log("文件删除脚本开始执行: " . date('Y-m-d H:i:s'));

// 获取请求参数
$action = $_GET['action'] ?? '';

// 获取POST数据，支持JSON和表单格式
$content_type = $_SERVER['CONTENT_TYPE'] ?? '';
$post_data = [];

if (strpos($content_type, 'application/json') !== false) {
    // JSON格式数据
    $json_data = file_get_contents('php://input');
    if ($json_data !== false) {
        $post_data = json_decode($json_data, true) ?? [];
    }
} else {
    // 表单格式数据
    $post_data = $_POST;
}

$table = $post_data['table'] ?? '';
$ids = $post_data['ids'] ?? [];

// 验证请求
if ($action !== 'delete_files') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => '无效的请求操作']);
    exit;
}

if (empty($table) || !in_array($table, ['uploaded_files', 'shared_files'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => '无效的表名']);
    exit;
}

if (empty($ids) || !is_array($ids)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => '请提供要删除的文件ID列表']);
    exit;
}

// 记录请求参数
error_log("删除请求参数: 表名=$table, 文件ID=" . implode(', ', $ids));

// 初始化响应数据
$response = [
    'status' => 'success',
    'message' => '',
    'deleted_count' => 0,
    'failed_files' => [],
    'errors' => [],
    'debug_info' => []
];

try {
    // 连接数据库
    $db = new SQLite3('admin.db');
    $db->busyTimeout(5000);
    
    // 开始事务
    $db->exec('BEGIN TRANSACTION');
    
    // 获取脚本目录路径
    $script_dir = __DIR__;
    $base_path = dirname($script_dir);
    
    error_log("基础路径: $base_path");
    
    // 处理每个文件
    foreach ($ids as $file_md5) {
        $debug_info = [
            'md5' => $file_md5,
            'db_record_found' => false,
            'file_exists' => false,
            'physical_deleted' => false,
            'db_deleted' => false,
            'error' => null
        ];
        
        try {
            // 验证文件MD5格式
            if (!preg_match('/^[a-f0-9]{32}$/', $file_md5)) {
                throw new Exception("无效的文件MD5格式: $file_md5");
            }
            
            // 查询数据库记录
            $stmt = $db->prepare("SELECT file_path, file_name FROM $table WHERE file_md5 = :md5");
            $stmt->bindValue(':md5', $file_md5);
            $result = $stmt->execute();
            $row = $result->fetchArray(SQLITE3_ASSOC);
            
            if (!$row) {
                $debug_info['error'] = "数据库中未找到MD5为 $file_md5 的记录";
                error_log($debug_info['error']);
                $response['failed_files'][] = $debug_info['error'];
                continue;
            }
            
            $debug_info['db_record_found'] = true;
            $debug_info['file_name'] = $row['file_name'];
            $debug_info['original_path'] = $row['file_path'];
            
            // 构建完整的文件路径
            $file_path = $row['file_path'];
            
            // 确保路径以"分享文件"开头
            if (strpos($file_path, "分享文件") !== 0) {
                $file_path = "分享文件/" . ltrim($file_path, '/\\');
            }
            
            // 构建绝对路径
            $file_path = $base_path . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $file_path);
            
            $debug_info['final_path'] = $file_path;
            
            // 检查文件是否存在
            if (file_exists($file_path)) {
                $debug_info['file_exists'] = true;
                
                // 尝试删除物理文件
                $deleted = deletePhysicalFile($file_path, $row['file_name']);
                
                if ($deleted) {
                    $debug_info['physical_deleted'] = true;
                    error_log("成功删除物理文件: " . $file_path);
                } else {
                    $debug_info['error'] = "无法删除物理文件: " . $file_path;
                    error_log($debug_info['error']);
                    $response['failed_files'][] = $debug_info['error'];
                    continue;
                }
            } else {
                // 文件不存在，但继续删除数据库记录
                error_log("物理文件不存在，跳过删除: " . $file_path);
                $debug_info['error'] = "物理文件不存在";
            }
            
            // 删除数据库记录
            $stmt = $db->prepare("DELETE FROM $table WHERE file_md5 = :md5");
            $stmt->bindValue(':md5', $file_md5);
            
            if ($stmt->execute()) {
                $debug_info['db_deleted'] = true;
                $response['deleted_count']++;
                error_log("成功删除数据库记录: MD5 $file_md5");
            } else {
                $debug_info['error'] = "删除数据库记录失败: MD5 $file_md5";
                error_log($debug_info['error']);
                $response['failed_files'][] = $debug_info['error'];
            }
            
        } catch (Exception $e) {
            $debug_info['error'] = $e->getMessage();
            error_log("处理文件时出错: " . $e->getMessage());
            $response['failed_files'][] = $debug_info['error'];
        }
        
        $response['debug_info'][] = $debug_info;
    }
    
    // 提交事务
    $db->exec('COMMIT');
    
    // 设置响应消息
    if ($response['deleted_count'] > 0) {
        $response['message'] = "成功删除 {$response['deleted_count']} 个文件";
    } else {
        $response['status'] = 'error';
        $response['message'] = "没有文件被删除";
    }
    
    // 如果有失败的文件，添加到响应中
    if (!empty($response['failed_files'])) {
        $response['message'] .= "，失败 " . count($response['failed_files']) . " 个文件";
        $response['errors'] = $response['failed_files'];
        if ($response['deleted_count'] === 0) {
            $response['status'] = 'error';
        }
    }
    
} catch (Exception $e) {
    // 回滚事务
    if (isset($db)) {
        $db->exec('ROLLBACK');
    }
    
    error_log("删除操作失败: " . $e->getMessage());
    $response['status'] = 'error';
    $response['message'] = "删除操作失败: " . $e->getMessage();
}

// 记录脚本执行结束
error_log("文件删除脚本执行结束: " . date('Y-m-d H:i:s'));

// 返回JSON响应
header('Content-Type: application/json');
echo json_encode($response);
exit;

/**
 * 删除物理文件的函数
 * 
 * @param string $file_path 文件路径
 * @param string $file_name 文件名
 * @return bool 是否成功删除
 */
function deletePhysicalFile($file_path, $file_name) {
    global $whitelist;
    
    // 检查文件是否在"分享文件"目录中
    $normalized_path = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $file_path);
    $share_dir = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, dirname(__DIR__) . DIRECTORY_SEPARATOR . '分享文件');
    
    // 如果文件在"分享文件"目录中，跳过所有安全检查，直接删除
    if (strpos($normalized_path, $share_dir) === 0) {
        error_log("文件位于分享目录，跳过安全检查: $file_name");
        
        // 尝试修改文件权限
        if (!is_writable($file_path)) {
            @chmod($file_path, 0644);
            if (!is_writable($file_path)) {
                @chmod($file_path, 0755);
            }
        }
        
        // 尝试直接删除
        if (unlink($file_path)) {
            return true;
        }
        
        // Windows环境下的特殊处理
        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            // 尝试移除只读属性
            @exec('attrib -R "' . $file_path . '"');
            
            // 再次尝试删除
            if (unlink($file_path)) {
                return true;
            }
            
            // 使用CMD命令删除
            $cmd = 'del /F /Q "' . $file_path . '"';
            exec($cmd, $output, $return_var);
            if ($return_var === 0 && !file_exists($file_path)) {
                return true;
            }
            
            // 使用PowerShell命令删除
            $escaped_path = str_replace("'", "''", $file_path);
            $ps_cmd = "powershell -Command \"Remove-Item -Path '$escaped_path' -Force -ErrorAction SilentlyContinue\"";
            exec($ps_cmd, $ps_output, $ps_return_var);
            if (!file_exists($file_path)) {
                return true;
            }
            
            // 最后尝试：使用WScript.Shell对象删除
            $shell_cmd = "cscript //nologo //E:JScript \"var fso = new ActiveXObject('Scripting.FileSystemObject'); fso.DeleteFile('$file_path', true);\"";
            exec($shell_cmd, $shell_output, $shell_return_var);
            if (!file_exists($file_path)) {
                return true;
            }
        }
        
        return false;
    }
    
    // 对于不在"分享文件"目录中的文件，执行常规安全检查
    // 获取文件扩展名
    $extension = strtolower(pathinfo($file_path, PATHINFO_EXTENSION));
    
    // 检查文件扩展名是否为危险类型
    if (is_array($whitelist['dangerous_extensions']) && in_array($extension, $whitelist['dangerous_extensions'])) {
        error_log("拒绝删除危险文件类型: $file_name (扩展名: $extension)");
        return false;
    }
    
    // 检查文件内容安全性
    $securityCheck = checkFileContentSecurity($file_path, $whitelist['dangerous_content_patterns']);
    // 放宽安全检查，即使文件类型不匹配也允许删除
    if (!$securityCheck[0] && strpos($securityCheck[1], '文件类型与扩展名不匹配') === false) {
        error_log("拒绝删除不安全文件: $file_name (原因: {$securityCheck[1]})");
        return false;
    }
    
    // 尝试修改文件权限
    if (!is_writable($file_path)) {
        @chmod($file_path, 0644);
        if (!is_writable($file_path)) {
            @chmod($file_path, 0755);
        }
    }
    
    // 尝试直接删除
    if (unlink($file_path)) {
        return true;
    }
    
    // Windows环境下的特殊处理
    if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
        // 尝试移除只读属性
        @exec('attrib -R "' . $file_path . '"');
        
        // 再次尝试删除
        if (unlink($file_path)) {
            return true;
        }
        
        // 使用CMD命令删除
        $cmd = 'del /F /Q "' . $file_path . '"';
        exec($cmd, $output, $return_var);
        if ($return_var === 0 && !file_exists($file_path)) {
            return true;
        }
        
        // 使用PowerShell命令删除
        $escaped_path = str_replace("'", "''", $file_path);
        $ps_cmd = "powershell -Command \"Remove-Item -Path '$escaped_path' -Force -ErrorAction SilentlyContinue\"";
        exec($ps_cmd, $ps_output, $ps_return_var);
        if (!file_exists($file_path)) {
            return true;
        }
        
        // 最后尝试：使用WScript.Shell对象删除
        $shell_cmd = "cscript //nologo //E:JScript \"var fso = new ActiveXObject('Scripting.FileSystemObject'); fso.DeleteFile('$file_path', true);\"";
        exec($shell_cmd, $shell_output, $shell_return_var);
        if (!file_exists($file_path)) {
            return true;
        }
    }
    
    return false;
}
?>