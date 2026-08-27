<?php
/**
 * 文件操作白名单配置
 * 定义允许的文件扩展名、目录和操作
 */

// 防止直接访问
if (!defined('IN_ADMIN_PANEL')) {
    header('HTTP/1.0 403 Forbidden');
    exit('Access Denied');
}

// 从数据库获取禁止上传的扩展名
if (!function_exists('getDangerousExtensionsFromDB')) {
    function getDangerousExtensionsFromDB() {
        $dangerousExtensions = [];
        
        try {
            // 数据库文件路径
            $dbPath = __DIR__ . '/admin.db';
            
            // 检查数据库文件是否存在
            if (!file_exists($dbPath)) {
                return [
                    'php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'php8',
                    'pl', 'py', 'rb', 'sh', 'bat', 'cmd', 'ps1',
                    'exe', 'com', 'pif', 'scr', 'vbs', 'js', 'jar'
                ];
            }
            
            // 连接SQLite数据库
            $db = new SQLite3($dbPath);
            
            // 查询启用的禁止扩展名
            $query = "SELECT extension_name FROM file_extension_settings WHERE is_active = 1";
            $result = $db->query($query);
            
            if ($result) {
                while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                    $dangerousExtensions[] = $row['extension_name'];
                }
            }
            
            // 关闭数据库连接
            $db->close();
            
            // 如果数据库中没有数据，返回默认值
            if (empty($dangerousExtensions)) {
                return [
                    'php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'php8',
                    'pl', 'py', 'rb', 'sh', 'bat', 'cmd', 'ps1',
                    'exe', 'com', 'pif', 'scr', 'vbs', 'js', 'jar'
                ];
            }
            
        } catch (Exception $e) {
            // 出错时返回默认值
            return [
                'php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'php8',
                'pl', 'py', 'rb', 'sh', 'bat', 'cmd', 'ps1',
                'exe', 'com', 'pif', 'scr', 'vbs', 'js', 'jar'
            ];
        }
        
        return $dangerousExtensions;
    }
}

// 获取危险扩展名
$dangerousExtensions = getDangerousExtensionsFromDB();

// 允许的文件扩展名（按类型分组）
return [
    // 图片文件
    'images' => [
        'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'
    ],
    
    // 文档文件
    'documents' => [
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 
        'txt', 'rtf', 'odt', 'ods', 'odp'
    ],
    
    // 压缩文件
    'archives' => [
        'zip', 'rar', '7z', 'tar', 'gz', 'bz2'
    ],
    
    // 音频文件
    'audio' => [
        'mp3', 'wav', 'ogg', 'flac', 'aac', 'wma'
    ],
    
    // 视频文件
    'video' => [
        'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'
    ],
    
    // 可执行文件（谨慎使用）
    'executables' => [
        'exe', 'msi', 'deb', 'rpm', 'dmg', 'app'
    ],
    
    // 系统文件（谨慎使用）
    'system' => [
        'dll', 'sys', 'drv', 'ocx', 'cpl'
    ],
    
    // 代码文件
    'code' => [
        'php', 'html', 'htm', 'css', 'js', 'json', 'xml', 
        'sql', 'py', 'java', 'cpp', 'c', 'h', 'sh', 'bat'
    ],
    
    // 默认允许的扩展名（用于上传）- 允许所有扩展名（除了危险扩展名）
    'default_upload' => [], // 空数组表示允许所有扩展名（除了危险扩展名）
    
    // 允许的目录（相对于项目根目录）
    'allowed_directories' => [
        '分享文件',
        'temp',
        'logs',
        'backups'
    ],
    
    // 允许的操作
    'allowed_operations' => [
        'read', 'write', 'create', 'delete', 'move', 'copy'
    ],
    
    // 文件大小限制（字节）- 已移除限制
    'max_file_sizes' => [
        'default' => 0, // 0 表示无限制
    ],
    
    // 危险文件扩展名（禁止上传）- 从数据库获取
    'dangerous_extensions' => $dangerousExtensions,
    
    // 危险文件内容模式
    'dangerous_content_patterns' => [
        '/<\?php/i',
        '/<script/i',
        '/<%/i',
        '/eval\s*\(/i',
        '/exec\s*\(/i',
        '/system\s*\(/i',
        '/shell_exec\s*\(/i',
        '/passthru\s*\(/i',
    ],
];
?>