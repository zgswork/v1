<?php
/**
 * 文件内容安全检查工具
 * 检查文件内容是否包含恶意代码
 */

// 防止直接访问
if (!defined('IN_ADMIN_PANEL')) {
    header('HTTP/1.0 403 Forbidden');
    exit('Access Denied');
}

/**
 * 检查文件内容是否安全
 * @param string $filePath 文件路径
 * @param array $dangerousPatterns 危险内容模式数组
 * @return array 检查结果 [是否安全, 发现的问题]
 */
function checkFileContentSecurity($filePath, $dangerousPatterns = []) {
    // 默认危险模式
    if (empty($dangerousPatterns) || !is_array($dangerousPatterns)) {
        $whitelist = include_once __DIR__ . '/file_whitelist.php';
        $dangerousPatterns = isset($whitelist['dangerous_content_patterns']) ? $whitelist['dangerous_content_patterns'] : [];
    }
    
    // 检查文件是否存在
    if (!file_exists($filePath)) {
        return [false, '文件不存在'];
    }
    
    // 获取文件大小
    $fileSize = filesize($filePath);
    
    // 限制检查的文件大小（避免内存问题）
    $maxCheckSize = 10 * 1024 * 1024; // 10MB
    if ($fileSize > $maxCheckSize) {
        return [true, '文件过大，跳过内容检查'];
    }
    
    // 读取文件内容
    $content = file_get_contents($filePath);
    if ($content === false) {
        return [false, '无法读取文件内容'];
    }
    
    // 检查是否包含危险内容
    $issues = [];
    if (is_array($dangerousPatterns)) {
        foreach ($dangerousPatterns as $pattern) {
            // 确保模式是字符串且不为空
            if (is_string($pattern) && !empty($pattern) && preg_match($pattern, $content)) {
                $issues[] = "发现潜在危险内容: " . $pattern;
            }
        }
    }
    
    // 检查文件头（魔术数字）是否与扩展名匹配
    $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    $fileHeader = substr($content, 0, 16);
    $mimeType = getMimeTypeFromHeader($fileHeader);
    
    if ($mimeType && !isMimeTypeMatchingExtension($mimeType, $extension)) {
        $issues[] = "文件类型与扩展名不匹配: 检测到 {$mimeType}，但扩展名为 {$extension}";
    }
    
    // 返回检查结果
    if (empty($issues)) {
        return [true, '文件内容安全'];
    } else {
        return [false, implode('; ', $issues)];
    }
}

/**
 * 从文件头获取MIME类型
 * @param string $header 文件头（前16字节）
 * @return string|null MIME类型
 */
function getMimeTypeFromHeader($header) {
    // 常见文件类型的魔术数字
    $signatures = [
        'image/jpeg' => ['FF D8 FF'],
        'image/png' => ['89 50 4E 47 0D 0A 1A 0A'],
        'image/gif' => ['47 49 46 38'],
        'image/bmp' => ['42 4D'],
        'image/webp' => ['52 49 46 46'],
        'application/pdf' => ['25 50 44 46'],
        'application/zip' => ['50 4B 03 04', '50 4B 05 06', '50 4B 07 08'],
        'application/x-rar-compressed' => ['52 61 72 21 1A 07 00'],
        'application/x-7z-compressed' => ['37 7A BC AF 27 1C'],
        'application/x-shockwave-flash' => ['46 57 53'],
        'application/msword' => ['D0 CF 11 E0 A1 B1 1A E1'],
        'application/vnd.ms-excel' => ['D0 CF 11 E0 A1 B1 1A E1'],
        'application/vnd.ms-powerpoint' => ['D0 CF 11 E0 A1 B1 1A E1'],
        'audio/mpeg' => ['49 44 33', 'FF FB', 'FF F3', 'FF F2'],
        'audio/wav' => ['52 49 46 46'],
        'video/mp4' => ['66 74 79 70 4D 53 4E 56', '66 74 79 70 69 73 6F 6D'],
        'video/avi' => ['52 49 46 46'],
    ];
    
    // 将二进制数据转换为十六进制表示
    $hexHeader = bin2hex($header);
    $hexHeader = strtoupper(chunk_split($hexHeader, 2, ' '));
    $hexHeader = rtrim($hexHeader);
    
    // 检查是否匹配任何已知签名
    foreach ($signatures as $mimeType => $patterns) {
        foreach ($patterns as $pattern) {
            if (strpos($hexHeader, $pattern) === 0) {
                return $mimeType;
            }
        }
    }
    
    return null;
}

/**
 * 检查MIME类型是否与扩展名匹配
 * @param string $mimeType MIME类型
 * @param string $extension 文件扩展名
 * @return bool 是否匹配
 */
function isMimeTypeMatchingExtension($mimeType, $extension) {
    // MIME类型与扩展名的映射
    $mimeToExtension = [
        'image/jpeg' => ['jpg', 'jpeg'],
        'image/png' => ['png'],
        'image/gif' => ['gif'],
        'image/bmp' => ['bmp'],
        'image/webp' => ['webp'],
        'application/pdf' => ['pdf'],
        'application/zip' => ['zip'],
        'application/x-rar-compressed' => ['rar'],
        'application/x-7z-compressed' => ['7z'],
        'application/x-shockwave-flash' => ['swf'],
        'application/msword' => ['doc'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => ['docx'],
        'application/vnd.ms-excel' => ['xls'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => ['xlsx'],
        'application/vnd.ms-powerpoint' => ['ppt'],
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' => ['pptx'],
        'audio/mpeg' => ['mp3'],
        'audio/wav' => ['wav'],
        'video/mp4' => ['mp4'],
        'video/avi' => ['avi'],
    ];
    
    // 检查是否有匹配的扩展名
    if (isset($mimeToExtension[$mimeType])) {
        return in_array($extension, $mimeToExtension[$mimeType]);
    }
    
    // 对于不常见的MIME类型，允许通过
    return true;
}

/**
 * 安全地扫描上传的文件
 * @param array $files $_FILES数组
 * @param array $forbiddenExtensions 禁止的扩展名
 * @param int $maxFileSize 最大文件大小
 * @return array 扫描结果 [是否通过, 错误消息]
 */
function scanUploadedFiles($files, $forbiddenExtensions = [], $maxFileSize = 0) {
    // 使用全局白名单配置
    global $whitelist;
    
    // 如果全局$whitelist不存在，则加载配置
    if (!isset($whitelist)) {
        $whitelist = include_once __DIR__ . '/file_whitelist.php';
    }
    
    // 确保危险扩展名列表是数组
    $allForbiddenExtensions = isset($whitelist['dangerous_extensions']) ? $whitelist['dangerous_extensions'] : [];
    
    // 合并禁止扩展名列表
    if (!empty($forbiddenExtensions) && is_array($forbiddenExtensions)) {
        // 确保$allForbiddenExtensions是数组
        if (!is_array($allForbiddenExtensions)) {
            $allForbiddenExtensions = [];
        }
        $allForbiddenExtensions = array_unique(array_merge($allForbiddenExtensions, $forbiddenExtensions));
    }
    
    // 检查每个文件
    foreach ($files['name'] as $key => $name) {
        // 检查上传错误
        if ($files['error'][$key] !== UPLOAD_ERR_OK) {
            return [false, "文件 {$name} 上传失败，错误代码: " . $files['error'][$key]];
        }
        
        // 检查文件大小
        if ($maxFileSize > 0 && $files['size'][$key] > $maxFileSize) {
            return [false, "文件 {$name} 大小超过限制"];
        }
        
        // 检查文件扩展名是否为危险类型
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (is_array($allForbiddenExtensions) && in_array($extension, $allForbiddenExtensions)) {
            return [false, "文件 {$name} 属于禁止上传的文件类型"];
        }
    }
    
    return [true, '所有文件通过安全检查'];
}
?>