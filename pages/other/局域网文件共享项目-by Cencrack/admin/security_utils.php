<?php
/**
 * 安全路径验证工具
 * 防止目录遍历攻击和未授权文件访问
 */

// 防止直接访问
if (!defined('IN_ADMIN_PANEL')) {
    header('HTTP/1.0 403 Forbidden');
    exit('Access Denied');
}

/**
 * 验证路径是否在允许的基础目录内
 * @param string $path 要验证的路径
 * @param string $baseDir 基础目录（白名单目录）
 * @return bool 是否安全
 */
function isSecurePath($path, $baseDir = null) {
    // 如果没有指定基础目录，使用项目根目录
    if ($baseDir === null) {
        $baseDir = realpath(__DIR__ . '/..');
    }
    
    // 获取规范化后的绝对路径
    $realBaseDir = realpath($baseDir);
    $realPath = realpath($path);
    
    // 检查路径是否存在
    if ($realPath === false) {
        return false;
    }
    
    // 检查路径是否在基础目录内
    if (strpos($realPath, $realBaseDir) !== 0) {
        return false;
    }
    
    return true;
}

/**
 * 安全地获取文件路径
 * @param string $relativePath 相对路径
 * @param string $baseDir 基础目录
 * @return string|false 安全的绝对路径，失败返回false
 */
function getSecureFilePath($relativePath, $baseDir = null) {
    // 如果没有指定基础目录，使用项目根目录
    if ($baseDir === null) {
        $baseDir = realpath(__DIR__ . '/..');
    }
    
    // 清理路径，移除多余的斜杠
    $relativePath = trim($relativePath, '/\\');
    
    // 检查是否包含危险字符
    if (strpos($relativePath, '..') !== false || 
        strpos($relativePath, ':') !== false || 
        strpos($relativePath, "\0") !== false) {
        return false;
    }
    
    // 构建完整路径
    $fullPath = $baseDir . DIRECTORY_SEPARATOR . $relativePath;
    
    // 验证路径安全性
    if (!isSecurePath($fullPath, $baseDir)) {
        return false;
    }
    
    return $fullPath;
}

/**
 * 验证文件扩展名是否在白名单中
 * @param string $filename 文件名
 * @param array $allowedExtensions 允许的扩展名数组
 * @return bool 是否允许
 */
function isAllowedExtension($filename, $allowedExtensions = []) {
    if (empty($allowedExtensions)) {
        // 默认允许的扩展名
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt', 'zip', 'rar'];
    }
    
    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    return in_array($extension, $allowedExtensions);
}

/**
 * 安全地创建目录
 * @param string $dirPath 目录路径
 * @param string $baseDir 基础目录
 * @param int $permissions 目录权限
 * @return bool 是否成功
 */
function secureMkdir($dirPath, $baseDir = null, $permissions = 0755) {
    $securePath = getSecureFilePath($dirPath, $baseDir);
    if ($securePath === false) {
        return false;
    }
    
    // 检查是否已存在且是目录
    if (is_dir($securePath)) {
        return true;
    }
    
    // 创建目录
    return mkdir($securePath, $permissions, true);
}

/**
 * 安全地读取文件
 * @param string $filePath 文件路径
 * @param string $baseDir 基础目录
 * @return string|false 文件内容，失败返回false
 */
function secureFileGetContents($filePath, $baseDir = null) {
    $securePath = getSecureFilePath($filePath, $baseDir);
    if ($securePath === false || !is_file($securePath)) {
        return false;
    }
    
    return file_get_contents($securePath);
}

/**
 * 安全地写入文件
 * @param string $filePath 文件路径
 * @param string $content 文件内容
 * @param string $baseDir 基础目录
 * @return bool 是否成功
 */
function secureFilePutContents($filePath, $content, $baseDir = null) {
    $securePath = getSecureFilePath($filePath, $baseDir);
    if ($securePath === false) {
        return false;
    }
    
    // 确保目录存在
    $dir = dirname($securePath);
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0755, true)) {
            return false;
        }
    }
    
    return file_put_contents($securePath, $content) !== false;
}

/**
 * 安全地删除文件
 * @param string $filePath 文件路径
 * @param string $baseDir 基础目录
 * @return bool 是否成功
 */
function secureUnlink($filePath, $baseDir = null) {
    $securePath = getSecureFilePath($filePath, $baseDir);
    if ($securePath === false || !is_file($securePath)) {
        return false;
    }
    
    return unlink($securePath);
}

/**
 * 安全地删除目录及其内容
 * @param string $dirPath 目录路径
 * @param string $baseDir 基础目录
 * @return bool 是否成功
 */
function secureRmdir($dirPath, $baseDir = null) {
    $securePath = getSecureFilePath($dirPath, $baseDir);
    if ($securePath === false || !is_dir($securePath)) {
        return false;
    }
    
    // 递归删除目录内容
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($securePath, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    
    foreach ($files as $fileinfo) {
        if ($fileinfo->isDir()) {
            if (!rmdir($fileinfo->getRealPath())) {
                return false;
            }
        } else {
            if (!unlink($fileinfo->getRealPath())) {
                return false;
            }
        }
    }
    
    return rmdir($securePath);
}

/**
 * 获取安全的目录列表
 * @param string $dirPath 目录路径
 * @param string $baseDir 基础目录
 * @return array|false 文件列表，失败返回false
 */
function secureScandir($dirPath, $baseDir = null) {
    $securePath = getSecureFilePath($dirPath, $baseDir);
    if ($securePath === false || !is_dir($securePath)) {
        return false;
    }
    
    $files = [];
    $items = scandir($securePath);
    
    if ($items === false) {
        return false;
    }
    
    foreach ($items as $item) {
        if ($item !== '.' && $item !== '..') {
            $files[] = $item;
        }
    }
    
    return $files;
}

/**
 * 检查文件名是否安全
 * @param string $fileName 文件名
 * @return bool 是否安全
 */
function isSafeFileName($fileName) {
    // 检查文件名是否为空
    if (empty($fileName)) {
        return false;
    }
    
    // 检查文件名长度
    if (strlen($fileName) > 255) {
        return false;
    }
    
    // 检查是否包含危险字符
    $dangerousChars = ['..', '/', '\\', ':', '*', '?', '"', '<', '>', '|', "\0"];
    foreach ($dangerousChars as $char) {
        if (strpos($fileName, $char) !== false) {
            return false;
        }
    }
    
    // 检查是否为保留名称（Windows）
    $reservedNames = [
        'CON', 'PRN', 'AUX', 'NUL',
        'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
        'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];
    
    $nameWithoutExt = explode('.', $fileName)[0];
    if (in_array(strtoupper($nameWithoutExt), $reservedNames)) {
        return false;
    }
    
    // 检查是否以点开头（隐藏文件）
    if (substr($fileName, 0, 1) === '.') {
        return false;
    }
    
    return true;
}

/**
 * 清理和验证路径
 * @param string $path 要清理的路径
 * @return string 清理后的路径
 */
function sanitizePath($path) {
    // 移除多余的斜杠
    $path = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
    
    // 移除开头的斜杠
    $path = ltrim($path, DIRECTORY_SEPARATOR);
    
    // 移除路径遍历尝试
    $path = str_replace('..' . DIRECTORY_SEPARATOR, '', $path);
    $path = str_replace(DIRECTORY_SEPARATOR . '..', '', $path);
    
    // 移除空目录
    $path = str_replace(DIRECTORY_SEPARATOR . DIRECTORY_SEPARATOR, DIRECTORY_SEPARATOR, $path);
    
    // 移除结尾的斜杠
    $path = rtrim($path, DIRECTORY_SEPARATOR);
    
    return $path;
}
?>