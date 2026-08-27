<?php
/**
 * 安全文件下载处理程序
 * 修复任意文件下载漏洞，同时保留分享文件的基础下载功能
 */

// 防止直接访问
if (!defined('IN_FILE_DOWNLOAD')) {
    header('HTTP/1.0 403 Forbidden');
    exit('Access Denied');
}

/**
 * 安全文件下载函数
 * @param string $filePath 相对于分享文件目录的文件路径
 * @param string $shareFolderPath 分享文件目录的绝对路径
 * @return bool 下载是否成功
 */
function secureFileDownload($filePath, $shareFolderPath) {
    // 1. 输入验证和清理
    if (empty($filePath)) {
        error_log('安全下载: 文件路径为空');
        return false;
    }
    
    // 2. 路径安全验证
    $realSharePath = realpath($shareFolderPath);
    if ($realSharePath === false || !is_dir($realSharePath)) {
        error_log('安全下载: 分享目录不存在或无效');
        return false;
    }
    
    // 3. 构建并验证文件路径
    // 移除路径开头的斜杠，确保是相对路径
    $cleanPath = ltrim($filePath, '/\\');
    
    // 如果路径以"分享文件/"开头，移除它，因为我们已经知道这是分享文件目录
    if (strpos($cleanPath, '分享文件/') === 0) {
        $cleanPath = substr($cleanPath, strlen('分享文件/'));
    }
    
    // 检查路径遍历攻击
    if (strpos($cleanPath, '..') !== false || 
        strpos($cleanPath, ':') !== false || 
        strpos($cleanPath, "\0") !== false) {
        error_log('安全下载: 检测到潜在路径遍历攻击: ' . $filePath);
        return false;
    }
    
    // 构建完整文件路径
    $fullFilePath = $realSharePath . DIRECTORY_SEPARATOR . $cleanPath;
    $realFilePath = realpath($fullFilePath);
    
    // 4. 验证文件是否在分享目录内
    if ($realFilePath === false || 
        strpos($realFilePath, $realSharePath) !== 0) {
        error_log('安全下载: 文件不在分享目录内: ' . $filePath . ' (full path: ' . $fullFilePath . ')');
        return false;
    }
    
    // 5. 验证文件是否存在且可读
    if (!is_file($realFilePath) || !is_readable($realFilePath)) {
        error_log('安全下载: 文件不存在或不可读: ' . $realFilePath);
        return false;
    }
    
    // 6. 获取文件信息
    $fileName = basename($realFilePath);
    $fileSize = filesize($realFilePath);
    $fileMime = getMimeType($realFilePath);
    
    // 7. 设置安全下载头
    header('Content-Description: File Transfer');
    header('Content-Type: ' . $fileMime);
    header('Content-Disposition: attachment; filename="' . addslashes($fileName) . '"');
    header('Expires: 0');
    header('Cache-Control: must-revalidate');
    header('Pragma: public');
    header('Content-Length: ' . $fileSize);
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    
    // 8. 安全地输出文件内容
    $handle = fopen($realFilePath, 'rb');
    if ($handle === false) {
        error_log('安全下载: 无法打开文件: ' . $realFilePath);
        return false;
    }
    
    while (!feof($handle)) {
        $buffer = fread($handle, 8192);
        if ($buffer !== false) {
            echo $buffer;
        }
    }
    
    fclose($handle);
    return true;
}

/**
 * 根据文件扩展名获取MIME类型
 * @param string $filePath 文件路径
 * @return string MIME类型
 */
function getMimeType($filePath) {
    // 优先使用finfo扩展获取精确MIME类型
    if (function_exists('finfo_file')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $filePath);
        finfo_close($finfo);
        
        // 如果获取到有效的MIME类型，直接返回
        if ($mimeType !== false && !empty($mimeType)) {
            return $mimeType;
        }
    }
    
    // 备用方案：根据文件扩展名判断
    $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    $mimeTypes = [
        'txt' => 'text/plain',
        'html' => 'text/html',
        'htm' => 'text/html',
        'css' => 'text/css',
        'js' => 'application/javascript',
        'json' => 'application/json',
        'xml' => 'application/xml',
        'pdf' => 'application/pdf',
        'doc' => 'application/msword',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls' => 'application/vnd.ms-excel',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt' => 'application/vnd.ms-powerpoint',
        'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'zip' => 'application/zip',
        'rar' => 'application/x-rar-compressed',
        'tar' => 'application/x-tar',
        'gz' => 'application/gzip',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'bmp' => 'image/bmp',
        'ico' => 'image/x-icon',
        'svg' => 'image/svg+xml',
        'mp3' => 'audio/mpeg',
        'wav' => 'audio/wav',
        'mp4' => 'video/mp4',
        'avi' => 'video/x-msvideo',
        'mov' => 'video/quicktime',
        'exe' => 'application/octet-stream',
        'dll' => 'application/octet-stream',
        'sys' => 'application/octet-stream',
    ];
    
    return isset($mimeTypes[$extension]) ? $mimeTypes[$extension] : 'application/octet-stream';
}

/**
 * 验证文件是否在数据库中存在
 * @param string $fileMd5 文件MD5
 * @param SQLite3 $db 数据库连接
 * @return bool 是否存在
 */
function isFileInDatabase($fileMd5, $db) {
    if ($db === null) {
        return false;
    }
    
    try {
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM shared_files WHERE file_md5 = :md5");
        $stmt->bindValue(':md5', $fileMd5, SQLITE3_TEXT);
        $result = $stmt->execute();
        
        if ($result === false) {
            return false;
        }
        
        $row = $result->fetchArray(SQLITE3_ASSOC);
        return $row && $row['count'] > 0;
    } catch (Exception $e) {
        error_log('数据库查询失败: ' . $e->getMessage());
        return false;
    }
}

/**
 * 更新文件下载计数
 * @param string $fileMd5 文件MD5
 * @param SQLite3 $db 数据库连接
 * @return bool 是否成功
 */
function updateDownloadCount($fileMd5, $db) {
    if ($db === null) {
        return false;
    }
    
    try {
        $stmt = $db->prepare("UPDATE shared_files SET download_count = download_count + 1 WHERE file_md5 = :md5");
        $stmt->bindValue(':md5', $fileMd5, SQLITE3_TEXT);
        return $stmt->execute() !== false;
    } catch (Exception $e) {
        error_log('更新下载计数失败: ' . $e->getMessage());
        return false;
    }
}
?>