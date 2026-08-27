<?php
/**
 * 权限管理模块
 * 功能：处理用户角色权限的更新、保存和验证
 */

// 引入数据库配置文件
require_once __DIR__ . '/../db_config.php';

/**
 * 更新角色权限设置
 * @param string $role 角色名称
 * @param array $permissions 权限数组
 * @return array 操作结果 [success, message]
 */
function updateRolePermissions($role, $permissions) {
    try {
        // 参数验证
        if (empty($role)) {
            return [false, '角色名称不能为空'];
        }
        
        // 确保permissions是数组
        if (!is_array($permissions)) {
            $permissions = [];
        }
        
        // 使用配置文件获取数据库连接
        $db = DatabaseConfig::getConnection('admin');
        if (!$db) {
            throw new Exception('无法连接到数据库');
        }
        
        // 开启事务
        $db->exec('BEGIN TRANSACTION');
        
        try {
            // 删除该角色的所有现有权限
            $delete_stmt = $db->prepare("DELETE FROM role_permissions WHERE role = :role");
            $delete_stmt->bindValue(':role', $role, SQLITE3_TEXT);
            $delete_stmt->execute();
            
            // 插入新权限
            $insert_stmt = $db->prepare("INSERT INTO role_permissions (role, permission, has_access) VALUES (:role, :permission, :has_access)");
            
            foreach ($permissions as $permission_name => $has_access) {
                $insert_stmt->bindValue(':role', $role, SQLITE3_TEXT);
                $insert_stmt->bindValue(':permission', $permission_name, SQLITE3_TEXT);
                $insert_stmt->bindValue(':has_access', $has_access ? 1 : 0, SQLITE3_INTEGER);
                $insert_stmt->execute();
                $insert_stmt->reset();
            }
            
            // 提交事务
            $db->exec('COMMIT');
            $db->close();
            
            return [true, '权限设置已成功保存'];
            
        } catch (Exception $e) {
            // 回滚事务
            $db->exec('ROLLBACK');
            $db->close();
            throw $e;
        }
        
    } catch (Exception $e) {
        error_log('更新角色权限失败: ' . $e->getMessage());
        return [false, '保存失败: ' . $e->getMessage()];
    }
}

/**
 * 处理AJAX权限更新请求
 * @return void 直接输出JSON响应
 */
function handleAjaxPermissionUpdate() {
    // 设置正确的JSON响应头
    header('Content-Type: application/json; charset=utf-8');
    
    try {
        // 验证请求方法
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            throw new Exception('无效的请求方法');
        }
        
        // 验证数据格式
        if (!isset($_POST['action']) || $_POST['action'] !== 'update_permissions' || !isset($_POST['permissions'])) {
            throw new Exception('请求数据格式错误');
        }
        
        // 解析权限数据
        $permissions_data = json_decode($_POST['permissions'], true);
        if (!is_array($permissions_data)) {
            throw new Exception('权限数据格式错误');
        }
        
        // 使用配置文件获取数据库连接
        $db = DatabaseConfig::getConnection('admin');
        if (!$db) {
            throw new Exception('无法连接到数据库');
        }
        
        // 开启事务处理多个角色的权限更新
        $db->exec('BEGIN TRANSACTION');
        
        try {
            // 处理每个角色的权限更新
            foreach ($permissions_data as $role => $permissions) {
                $role = trim($role);
                if (empty($role)) continue;
                
                // 删除该角色的所有现有权限
                $delete_stmt = $db->prepare("DELETE FROM page_permissions WHERE role = :role");
                $delete_stmt->bindValue(':role', $role, SQLITE3_TEXT);
                $delete_stmt->execute();
                
                // 插入新权限
                $insert_stmt = $db->prepare("INSERT INTO page_permissions (role, page_path, can_access) VALUES (:role, :page_path, :can_access)");
                
                foreach ($permissions as $page_path => $can_access) {
                    $insert_stmt->bindValue(':role', $role, SQLITE3_TEXT);
                    $insert_stmt->bindValue(':page_path', $page_path, SQLITE3_TEXT);
                    $insert_stmt->bindValue(':can_access', $can_access ? 1 : 0, SQLITE3_INTEGER);
                    $insert_stmt->execute();
                    $insert_stmt->reset();
                }
            }
            
            // 提交事务
            $db->exec('COMMIT');
            $db->close();
            
            // 返回成功响应
            echo json_encode([
                'success' => true,
                'message' => '权限设置已成功保存'
            ]);
            exit;
            
        } catch (Exception $e) {
            // 回滚事务
            $db->exec('ROLLBACK');
            $db->close();
            throw $e;
        }
        
    } catch (Exception $e) {
        // 返回错误响应
        echo json_encode([
            'success' => false,
            'message' => '处理请求时发生错误: ' . $e->getMessage()
        ]);
    }
    
    exit;
}

/**
 * 获取指定角色的权限设置
 * @param string $role 角色名称
 * @return array 权限数组
 */
function getRolePermissions($role) {
    $permissions = [];
    
    try {
        // 使用配置文件获取数据库连接
        $db = DatabaseConfig::getConnection('admin');
        if (!$db) {
            throw new Exception('无法连接到数据库');
        }
        
        $stmt = $db->prepare("SELECT permission, has_access FROM role_permissions WHERE role = :role");
        $stmt->bindValue(':role', $role, SQLITE3_TEXT);
        $result = $stmt->execute();
        
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $permissions[$row['permission']] = $row['has_access'] === 1;
        }
        
        $db->close();
        
    } catch (Exception $e) {
        error_log('获取角色权限失败: ' . $e->getMessage());
    }
    
    return $permissions;
}
