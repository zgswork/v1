<?php
/**
 * 数据库配置文件
 * 统一管理项目中的数据库路径配置
 */

// 防止直接访问
if (!defined('IN_ADMIN_PANEL')) {
    header('HTTP/1.0 403 Forbidden');
    exit('Access Denied');
}

// 数据库配置
class DatabaseConfig {
    /**
     * 获取admin.db数据库路径
     * @return string 数据库文件的绝对路径
     */
    public static function getAdminDbPath() {
        return __DIR__ . DIRECTORY_SEPARATOR . 'admin.db';
    }
    
    /**
     * 获取test.db数据库路径
     * @return string 数据库文件的绝对路径
     */
    public static function getTestDbPath() {
        return __DIR__ . DIRECTORY_SEPARATOR . 'test.db';
    }
    
    /**
     * 检查数据库文件是否存在，不存在则创建
     * @param string $dbPath 数据库文件路径
     * @return bool 是否成功
     */
    public static function ensureDbExists($dbPath) {
        if (!file_exists($dbPath)) {
            try {
                $db = new SQLite3($dbPath);
                $db->close();
                return true;
            } catch (Exception $e) {
                error_log("创建数据库文件失败: " . $e->getMessage());
                return false;
            }
        }
        return true;
    }
    
    /**
     * 获取数据库连接
     * @param string $type 数据库类型 (admin/test)
     * @return SQLite3|null 数据库连接对象
     */
    public static function getConnection($type = 'admin') {
        $dbPath = $type === 'test' ? self::getTestDbPath() : self::getAdminDbPath();
        
        if (!self::ensureDbExists($dbPath)) {
            return null;
        }
        
        try {
            $db = new SQLite3($dbPath);
            // 设置SQLite错误模式为异常
            $db->enableExceptions(true);
            return $db;
        } catch (Exception $e) {
            error_log("连接数据库失败: " . $e->getMessage());
            return null;
        }
    }
}

// 为了向后兼容，提供全局函数
function get_admin_db_path() {
    return DatabaseConfig::getAdminDbPath();
}

function get_test_db_path() {
    return DatabaseConfig::getTestDbPath();
}
?>