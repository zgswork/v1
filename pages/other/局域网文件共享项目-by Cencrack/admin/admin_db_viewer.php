<?php
// admin_db_viewer.php - 数据库可视化工具
// 连接到admin.db并展示所有表信息和数据

// 引入认证控制
require_once __DIR__ . '/auth.php';

// 保护页面，确保只有登录用户才能访问
protectPage();

// 设置错误报告
ini_set('display_errors', 0); // 关闭错误显示，避免干扰JSON响应
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

// 引入数据库配置
require_once __DIR__ . '/db_config.php';

// 引入统一皮肤加载器
include_once __DIR__ . '/../skin_loader.php';

// 获取当前皮肤
$currentSkin = getCurrentSkin();

// 使用配置文件获取数据库路径
$dbPath = DatabaseConfig::getAdminDbPath();

// 处理AJAX请求
if (isset($_GET['action'])) {
    // 设置JSON响应头
    header('Content-Type: application/json');
    
    $response = [
        'status' => 'error',
        'message' => '未知错误'
    ];
    
    try {
        // 使用配置文件获取数据库连接
        $db = DatabaseConfig::getConnection('admin');
        if (!$db) {
            throw new Exception('无法连接到数据库');
        }
        
        switch ($_GET['action']) {
            case 'get_tables':
                // 获取数据库中的所有表名
                $tables = [];
                $result = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
                if (!$result) {
                    throw new Exception('查询表列表失败: ' . $db->lastErrorMsg());
                }
                
                while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                    $tables[] = $row['name'];
                }
                
                $response = [
                    'status' => 'success',
                    'tables' => $tables
                ];
                break;
                
            case 'backup_database':
                // 备份数据库
                $backupDir = __DIR__ . '/backups';
                
                // 创建备份目录（如果不存在）
                if (!is_dir($backupDir)) {
                    mkdir($backupDir, 0755, true);
                }
                
                // 生成备份文件名（包含时间戳）
                $timestamp = date('Y-m-d_H-i-s');
                $backupFile = $backupDir . '/admin_backup_' . $timestamp . '.db';
                
                // 使用SQLite的.backup命令创建备份
                $sourceDb = DatabaseConfig::getAdminDbPath();
                $command = sprintf('"%s" "%s" ".backup" "%s"', 
                    $db->escapeString($sourceDb), 
                    $db->escapeString($sourceDb), 
                    $db->escapeString($backupFile)
                );
                
                // 使用PDO的SQLite驱动创建备份
                try {
                    $sourceDb = DatabaseConfig::getAdminDbPath();
                    $backupDb = new SQLite3($backupFile);
                    
                    // 获取源数据库的所有表
                    $tables = [];
                    $result = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
                    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                        $tables[] = $row['name'];
                    }
                    
                    // 对每个表执行备份
                    foreach ($tables as $table) {
                        // 获取表结构
                        $createTableResult = $db->query("SELECT sql FROM sqlite_master WHERE type='table' AND name='$table'");
                        $createTableRow = $createTableResult->fetchArray(SQLITE3_ASSOC);
                        $createTableSql = $createTableRow['sql'];
                        
                        // 在备份数据库中创建表
                        $backupDb->exec($createTableSql);
                        
                        // 获取表数据并插入到备份数据库
                        $dataResult = $db->query("SELECT * FROM $table");
                        $columns = [];
                        $columnInfo = $db->query("PRAGMA table_info($table)");
                        while ($colRow = $columnInfo->fetchArray(SQLITE3_ASSOC)) {
                            $columns[] = $colRow['name'];
                        }
                        
                        while ($dataRow = $dataResult->fetchArray(SQLITE3_ASSOC)) {
                            $values = [];
                            foreach ($columns as $col) {
                                $value = $dataRow[$col];
                                if ($value === null) {
                                    $values[] = 'NULL';
                                } else {
                                    $values[] = "'" . SQLite3::escapeString($value) . "'";
                                }
                            }
                            
                            $insertSql = "INSERT INTO $table (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $values) . ")";
                            $backupDb->exec($insertSql);
                        }
                    }
                    
                    $backupDb->close();
                    
                    $response = [
                        'status' => 'success',
                        'message' => '数据库备份成功',
                        'backup_file' => basename($backupFile),
                        'backup_dir' => 'admin/backups',
                        'backup_size' => filesize($backupFile)
                    ];
                } catch (Exception $e) {
                    // 如果备份文件已创建但失败，则删除
                    if (file_exists($backupFile)) {
                        unlink($backupFile);
                    }
                    throw new Exception('数据库备份失败: ' . $e->getMessage());
                }
                break;
                
            case 'get_table_info':
                // 获取表结构和数据
                $table = $_GET['table'] ?? '';
                // 验证表名安全性
                if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
                    throw new Exception('无效的表名');
                }
                
                // 检查表是否存在
                $existsResult = $db->querySingle("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='$table'");
                if ($existsResult == 0) {
                    throw new Exception('表不存在');
                }
                
                // 获取表结构
                $columns = [];
                $result = $db->query("PRAGMA table_info('$table')");
                while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                    $columns[] = [
                        'name' => $row['name'],
                        'type' => $row['type'],
                        'notnull' => $row['notnull'],
                        'dflt_value' => $row['dflt_value'],
                        'pk' => $row['pk']
                    ];
                }
                
                // 获取表数据（限制50条）
                $data = [];
                $query = "SELECT * FROM '$table' LIMIT 50";
                $result = $db->query($query);
                if (!$result) {
                    throw new Exception('查询表数据失败: ' . $db->lastErrorMsg());
                }
                
                while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                    $data[] = $row;
                }
                
                // 获取总行数
                $totalRows = $db->querySingle("SELECT COUNT(*) FROM '$table'");
                
                $response = [
                    'status' => 'success',
                    'table' => $table,
                    'columns' => $columns,
                    'data' => $data,
                    'total_rows' => $totalRows,
                    'limited' => $totalRows > 50
                ];
                break;
                
            default:
                throw new Exception('未知操作');
        }
        
        $db->close();
        
    } catch (Exception $e) {
        $response = [
            'status' => 'error',
            'message' => $e->getMessage()
        ];
    }
    
    // 确保只输出一次JSON
    echo json_encode($response);
    exit;
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin数据库可视化工具</title>
    
    <!-- 引入皮肤CSS和变量 -->
    <?php echo getSkinHTMLHead(); ?>
    
    <style>
        /* 基础样式 - 使用CSS变量以便与皮肤系统兼容 */
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: var(--color-text-primary, #333);
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: var(--color-bg-primary, #f5f5f5);
        }
        
        h1 {
            color: var(--color-secondary, #2c3e50);
            margin-bottom: 30px;
            border-bottom: 2px solid var(--color-secondary, #3498db);
            padding-bottom: 10px;
        }
        
        /* 数据库信息面板 */
        .db-info {
            background: var(--color-bg-card, #fff);
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        
        .db-info p {
            margin: 5px 0;
            font-size: 14px;
        }
        
        /* 表按钮容器 */
        .table-buttons {
            background: var(--color-bg-card, #fff);
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        
        .table-buttons h2 {
            margin-top: 0;
            color: var(--color-secondary, #2c3e50);
            font-size: 18px;
            margin-bottom: 20px;
        }
        
        .buttons-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
        }
        
        /* 表按钮样式 */
        .table-btn {
            background: var(--color-bg-btn-primary, #3498db);
            color: var(--color-text-btn-primary, white);
            border: none;
            padding: 12px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s ease;
            text-align: center;
        }
        
        .table-btn:hover {
            background: var(--color-bg-btn-primary-hover, #2980b9);
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        
        .table-btn.active {
            background: var(--color-bg-btn-success, #2ecc71);
        }
        
        /* 表信息容器 */
        .table-info-container {
            background: var(--color-bg-card, #fff);
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: none;
        }
        
        .table-info-container.visible {
            display: block;
        }
        
        /* 表结构样式 */
        .table-structure {
            margin-bottom: 30px;
        }
        
        .table-structure h3 {
            margin-top: 0;
            color: var(--color-secondary, #2c3e50);
            font-size: 16px;
            margin-bottom: 15px;
        }
        
        .structure-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .structure-table th,
        .structure-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid var(--color-border-table, #e0e0e0);
        }
        
        .structure-table th {
            background-color: var(--color-bg-table-header, var(--color-primary, #3498db));
            font-weight: 600;
            color: var(--color-text-table-header, white);
            border-bottom: 2px solid var(--color-primary, #3498db);
        }
        
        .structure-table tr:hover {
            background-color: var(--color-bg-hover, rgba(52, 152, 219, 0.1));
        }
        
        /* 表数据样式 */
        .table-data {
            margin-top: 30px;
        }
        
        .table-data h3 {
            margin-top: 0;
            color: var(--color-secondary, #2c3e50);
            font-size: 16px;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .data-table {
            width: 100%;
            border-collapse: collapse;
            overflow-x: auto;
            display: block;
            max-height: 500px;
            background-color: var(--color-bg-secondary, #ffffff);
            border-radius: var(--border-radius, 8px);
            overflow: hidden;
            box-shadow: var(--shadow, 0 2px 4px rgba(0, 0, 0, 0.1));
        }
        
        .data-table th,
        .data-table td {
            padding: 10px 12px;
            text-align: left;
            border-bottom: 1px solid var(--color-border-table, #e0e0e0);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 200px;
            background-color: var(--color-bg-secondary, #ffffff);
        }
        
        .data-table th {
            background-color: var(--color-bg-table-header, var(--color-primary, #3498db));
            color: var(--color-text-table-header, white);
            font-weight: 600;
            position: sticky;
            top: 0;
            border-bottom: 2px solid var(--color-primary, #3498db);
        }
        
        .data-table tbody tr:nth-child(even) {
            background-color: transparent;
        }
        
        .data-table tbody tr:hover {
            background-color: var(--color-bg-hover, rgba(52, 152, 219, 0.1));
        }
        
        /* 状态消息样式 */
        .status-message {
            padding: 15px;
            margin: 20px 0;
            border-radius: 6px;
            font-weight: 500;
        }
        
        .status-success {
            background-color: var(--color-bg-alert-success, #d4edda);
            color: var(--color-text-alert-success, #155724);
            border: 1px solid var(--color-border-alert-success, #c3e6cb);
        }
        
        .status-error {
            background-color: var(--color-bg-alert-danger, #f8d7da);
            color: var(--color-text-alert-danger, #721c24);
            border: 1px solid var(--color-border-alert-danger, #f5c6cb);
        }
        
        .status-info {
            background-color: var(--color-bg-alert-info, var(--color-bg-secondary, #d1ecf1));
            color: var(--color-text-alert-info, var(--color-primary, #0c5460));
            border: 1px solid var(--color-border-alert-info, var(--color-primary, #bee5eb));
        }
        
        /* 加载动画 */
        .loading {
            display: none;
            text-align: center;
            padding: 40px;
        }
        
        .loading-spinner {
            border: 4px solid var(--color-border, #f3f3f3);
            border-top: 4px solid var(--color-primary, #3498db);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* 表信息提示块样式 */
        .table-info-tip {
            background: var(--color-bg-alert-info, var(--color-bg-secondary, #e8f4fd));
            border-left: 4px solid var(--color-primary, #3498db);
            padding: 15px 20px;
            margin-bottom: 20px;
            border-radius: 0 6px 6px 0;
            display: none;
            box-shadow: var(--shadow, 0 2px 4px rgba(0, 0, 0, 0.1));
        }
        
        .table-info-tip.visible {
            display: block;
        }
        
        .table-info-tip h3 {
            margin-top: 0;
            margin-bottom: 10px;
            color: var(--color-text-alert-info, var(--color-primary, #2980b9));
            font-size: 16px;
        }
        
        .table-info-tip p {
            margin: 0 0 10px 0;
            color: var(--color-text-primary, #34495e);
            font-size: 14px;
        }
        
        /* 响应式设计 */
        @media (max-width: 768px) {
            .buttons-grid {
                grid-template-columns: 1fr;
            }
            
            .data-table,
            .structure-table {
                font-size: 14px;
            }
            
            .data-table th,
            .data-table td,
            .structure-table th,
            .structure-table td {
                padding: 8px;
            }
        }
    </style>
</head>
<body class="<?php echo getSkinBodyClass(); ?>">
    <h1>Admin数据库可视化工具</h1>
    
    <!-- 数据库信息面板 -->
    <div class="db-info">
        <h2>数据库信息</h2>
        <p><strong>数据库文件:</strong> admin.db</p>
        <p><strong>数据库类型:</strong> SQLite3</p>
        <p><strong>PHP版本:</strong> <?php echo PHP_VERSION; ?></p>
        <div style="margin-top: 15px;">
            <button id="backupBtn" class="table-btn" style="background: var(--color-bg-btn-success, #2ecc71);">
                <i class="fa fa-download"></i> 备份数据库
            </button>
            <div id="backupStatus" style="margin-top: 10px; font-size: 14px;"></div>
        </div>
    </div>
    
    <!-- 表按钮容器 -->
    <div class="table-buttons">
        <h2>数据库表</h2>
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>正在加载表信息...</p>
        </div>
        <div class="buttons-grid" id="tableButtonsGrid">
            <!-- 表按钮将通过JavaScript动态加载 -->
        </div>
    </div>
    
    <!-- 表信息提示块 -->
    <div class="table-info-tip" id="tableInfoTip">
        <h3 id="tipTableName">表名</h3>
        <p id="tipTableDescription">表描述</p>
    </div>
    
    <!-- 表信息容器 -->
    <div class="table-info-container" id="tableInfoContainer">
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>正在加载表数据...</p>
        </div>
        
        <!-- 表结构 -->
        <div class="table-structure">
            <h3>表结构 - <span id="currentTableName"></span></h3>
            <table class="structure-table" id="structureTable">
                <thead>
                    <tr>
                        <th>字段名</th>
                        <th>数据类型</th>
                        <th>是否为空</th>
                        <th>默认值</th>
                        <th>主键</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- 表结构将通过JavaScript动态加载 -->
                </tbody>
            </table>
        </div>
        
        <!-- 表数据 -->
        <div class="table-data">
            <h3>
                表数据 - <span id="dataTableName"></span>
                <span id="rowCountInfo" class="status-info" style="display: inline-block; padding: 5px 10px; font-size: 12px; margin-left: 10px;"></span>
            </h3>
            <table class="data-table" id="dataTable">
                <thead>
                    <!-- 表头将通过JavaScript动态加载 -->
                </thead>
                <tbody>
                    <!-- 表数据将通过JavaScript动态加载 -->
                </tbody>
            </table>
            <div id="dataTableEmpty" style="text-align: center; padding: 40px; color: var(--color-text-primary, #666); display: none;">
                该表中没有数据
            </div>
        </div>
    </div>
    
    <!-- 状态消息 -->
    <div id="statusMessage" class="status-message"></div>
    
    <script>
        // 当前选中的表
        let currentTable = '';
        
        // 表信息描述
        const tableDescriptions = {
            'shared_files': '存储分享文件信息的表，包含文件名、文件路径、上传时间、下载次数等信息。用于管理用户分享的各种文件资源。',
            'administrators': '管理员账户表，存储管理员用户信息，包括用户名、密码哈希、角色权限、登录记录等。用于系统管理员身份验证和权限管理。',
            'page_permissions': '页面权限控制表，定义不同角色用户对各个页面的访问权限。用于实现基于角色的访问控制(RBAC)系统。',
            'category_sort': '文件分类排序表，存储文件分类的显示顺序。用于控制文件分类在前端的展示顺序，提供更好的用户体验。',
            'shared_files_new': '新版分享文件表，使用文件MD5作为主键，存储文件基本信息。用于文件去重和快速检索，提高文件管理效率。',
            'file_extension_settings': '文件扩展名设置表，定义系统允许上传的文件类型及其状态。用于文件上传安全控制，防止恶意文件上传。'
        };
        

        
        // 备份数据库
        function backupDatabase() {
            const backupBtn = document.getElementById('backupBtn');
            const backupStatus = document.getElementById('backupStatus');
            
            // 禁用按钮并显示加载状态
            backupBtn.disabled = true;
            backupBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 备份中...';
            backupStatus.innerHTML = '';
            
            // 发送备份请求
            fetch('admin_db_viewer.php?action=backup_database')
                .then(response => response.json())
                .then(data => {
                    // 恢复按钮状态
                    backupBtn.disabled = false;
                    backupBtn.innerHTML = '<i class="fa fa-download"></i> 备份数据库';
                    
                    if (data.status === 'success') {
                        // 显示成功消息
                        backupStatus.innerHTML = `<div class="status-success" style="padding: 10px; border-radius: 4px;">
                            备份成功！文件名: ${data.backup_dir}/${data.backup_file}，大小: ${formatFileSize(data.backup_size)}
                        </div>`;
                        
                        // 显示全局状态消息
                        showStatus(`数据库备份成功！备份文件已保存到 ${data.backup_dir}/ 目录`, 'success');
                    } else {
                        // 显示错误消息
                        backupStatus.innerHTML = `<div class="status-error" style="padding: 10px; border-radius: 4px;">
                            备份失败: ${data.message}
                        </div>`;
                        
                        // 显示全局状态消息
                        showStatus('数据库备份失败: ' + (data.message || '未知错误'), 'error');
                    }
                })
                .catch(error => {
                    // 恢复按钮状态
                    backupBtn.disabled = false;
                    backupBtn.innerHTML = '<i class="fa fa-download"></i> 备份数据库';
                    
                    // 显示错误消息
                    backupStatus.innerHTML = `<div class="status-error" style="padding: 10px; border-radius: 4px;">
                        请求错误: ${error.message}
                    </div>`;
                    
                    // 显示全局状态消息
                    showStatus('备份请求失败: ' + error.message, 'error');
                });
        }
        
        // 格式化文件大小
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        // DOM加载完成后初始化
        // 注意：loadTables函数现在在initSkinSystem中的DOMContentLoaded事件中调用
        
        // 加载数据库表列表
        function loadTables() {
            showLoading('tableButtonsGrid');
            
            fetch('admin_db_viewer.php?action=get_tables')
                .then(response => response.json())
                .then(data => {
                    hideLoading('tableButtonsGrid');
                    
                    const buttonsGrid = document.getElementById('tableButtonsGrid');
                    buttonsGrid.innerHTML = '';
                    
                    if (data.status === 'success') {
                        if (data.tables.length === 0) {
                            buttonsGrid.innerHTML = '<p style="color: var(--color-text-primary, #666); text-align: center; padding: 20px;">数据库中没有表</p>';
                        } else {
                            // 创建表按钮
                            data.tables.forEach(table => {
                                const button = document.createElement('button');
                                button.className = 'table-btn';
                                button.textContent = table;
                                button.onclick = () => loadTableInfo(table);
                                buttonsGrid.appendChild(button);
                            });
                        }
                    } else {
                        showStatus('加载表列表失败: ' + (data.message || '未知错误'), 'error');
                    }
                })
                .catch(error => {
                    hideLoading('tableButtonsGrid');
                    showStatus('加载表列表时发生错误: ' + error.message, 'error');
                });
        }
        
        // 加载表信息
        function loadTableInfo(table) {
            // 更新按钮状态
            const buttons = document.querySelectorAll('.table-btn');
            buttons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.textContent === table) {
                    btn.classList.add('active');
                }
            });
            
            // 保存当前表
            currentTable = table;
            
            // 显示表信息提示块
            showTableInfoTip(table);
            
            // 显示表信息容器
            const tableInfoContainer = document.getElementById('tableInfoContainer');
            tableInfoContainer.classList.add('visible');
            
            // 显示加载动画
            showLoading('tableInfoContainer');
            
            // 清空之前的数据
            document.getElementById('currentTableName').textContent = '';
            document.getElementById('dataTableName').textContent = '';
            document.getElementById('structureTable').querySelector('tbody').innerHTML = '';
            document.getElementById('dataTable').querySelector('thead').innerHTML = '';
            document.getElementById('dataTable').querySelector('tbody').innerHTML = '';
            document.getElementById('dataTableEmpty').style.display = 'none';
            document.getElementById('rowCountInfo').textContent = '';
            
            // 获取表信息
            fetch(`admin_db_viewer.php?action=get_table_info&table=${encodeURIComponent(table)}`)
                .then(response => response.json())
                .then(data => {
                    hideLoading('tableInfoContainer');
                    
                    if (data.status === 'success') {
                        // 更新表名
                        document.getElementById('currentTableName').textContent = data.table;
                        document.getElementById('dataTableName').textContent = data.table;
                        
                        // 更新行数信息
                        const rowCountText = `共 ${data.total_rows} 条记录`;
                        const limitedText = data.limited ? ' (仅显示前50条)' : '';
                        document.getElementById('rowCountInfo').textContent = rowCountText + limitedText;
                        
                        // 填充表结构
                        const structureBody = document.getElementById('structureTable').querySelector('tbody');
                        data.columns.forEach(column => {
                            const row = structureBody.insertRow();
                            row.insertCell(0).textContent = column.name;
                            row.insertCell(1).textContent = column.type;
                            row.insertCell(2).textContent = column.notnull ? '否' : '是';
                            row.insertCell(3).textContent = column.dflt_value !== null ? column.dflt_value : '';
                            row.insertCell(4).textContent = column.pk ? '是' : '否';
                        });
                        
                        // 填充表数据
                        const dataTable = document.getElementById('dataTable');
                        const dataTableHead = dataTable.querySelector('thead');
                        const dataTableBody = dataTable.querySelector('tbody');
                        
                        if (data.data.length === 0) {
                            document.getElementById('dataTableEmpty').style.display = 'block';
                            dataTable.style.display = 'none';
                        } else {
                            dataTable.style.display = 'block';
                            
                            // 创建表头
                            const headerRow = document.createElement('tr');
                            Object.keys(data.data[0]).forEach(key => {
                                const th = document.createElement('th');
                                th.textContent = key;
                                headerRow.appendChild(th);
                            });
                            dataTableHead.appendChild(headerRow);
                            
                            // 创建数据行
                            data.data.forEach(row => {
                                const tr = document.createElement('tr');
                                Object.values(row).forEach(value => {
                                    const td = document.createElement('td');
                                    // 处理null值
                                    td.textContent = value !== null ? value : 'NULL';
                                    // 处理长文本
                                    if (td.textContent.length > 100) {
                                        td.title = td.textContent;
                                    }
                                    tr.appendChild(td);
                                });
                                dataTableBody.appendChild(tr);
                            });
                        }
                        
                    } else {
                        showStatus('加载表信息失败: ' + (data.message || '未知错误'), 'error');
                    }
                })
                .catch(error => {
                    hideLoading('tableInfoContainer');
                    showStatus('加载表信息时发生错误: ' + error.message, 'error');
                });
        }
        
        // 显示表信息提示
        function showTableInfoTip(table) {
            const tableInfoTip = document.getElementById('tableInfoTip');
            const tipTableName = document.getElementById('tipTableName');
            const tipTableDescription = document.getElementById('tipTableDescription');
            
            // 设置表名
            tipTableName.textContent = table + ' 表';
            
            // 设置表描述
            const description = tableDescriptions[table] || '暂无此表的描述信息。';
            tipTableDescription.textContent = description;
            
            // 显示提示块
            tableInfoTip.classList.add('visible');
        }
        
        // 显示加载动画
        function showLoading(containerId) {
            const container = document.getElementById(containerId);
            const loading = container.querySelector('.loading');
            if (loading) {
                loading.style.display = 'block';
            }
        }
        
        // 隐藏加载动画
        function hideLoading(containerId) {
            const container = document.getElementById(containerId);
            const loading = container.querySelector('.loading');
            if (loading) {
                loading.style.display = 'none';
            }
        }
        
        // 显示状态消息
        function showStatus(message, type = 'info') {
            const statusMessage = document.getElementById('statusMessage');
            statusMessage.textContent = message;
            
            // 移除所有状态类
            statusMessage.className = 'status-message';
            
            // 添加对应的状态类
            statusMessage.classList.add('status-' + type);
            
            // 显示消息
            statusMessage.style.display = 'block';
            
            // 5秒后隐藏消息
            setTimeout(() => {
                statusMessage.style.display = 'none';
            }, 5000);
        }
        
        // 皮肤系统初始化
        document.addEventListener('DOMContentLoaded', function() {
            // 初始化皮肤
            initSkinSystem();
            
            // 加载数据库表列表
            loadTables();
            
            // 绑定备份按钮事件
            const backupBtn = document.getElementById('backupBtn');
            if (backupBtn) {
                backupBtn.addEventListener('click', backupDatabase);
            }
        });
        
        // 初始化皮肤系统
        function initSkinSystem() {
            // 获取当前皮肤
            const currentTheme = '<?php echo getCurrentSkin(); ?>';
            
            // 设置body类
            const body = document.body;
            body.setAttribute('data-theme', currentTheme);
            
            // 移除所有皮肤类
            body.classList.remove('skin-warcraft3', 'skin-cyberpunk', 'skin-dark', 'skin-light');
            
            // 添加当前皮肤类
            body.classList.add('skin-' + currentTheme);
            
            // 处理按钮样式
            const buttons = document.querySelectorAll('button, .table-btn');
            buttons.forEach(button => {
                // 如果按钮没有特定的皮肤类，则添加当前皮肤类
                if (!button.classList.contains('btn-primary') && 
                    !button.classList.contains('btn-secondary') && 
                    !button.classList.contains('btn-success') && 
                    !button.classList.contains('btn-danger') && 
                    !button.classList.contains('btn-warning') && 
                    !button.classList.contains('btn-info') && 
                    !button.classList.contains('btn-light') && 
                    !button.classList.contains('btn-dark')) {
                    button.classList.add('btn-' + currentTheme);
                }
            });
            
            // 处理表单元素样式
            const inputs = document.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                if (!input.classList.contains('form-control')) {
                    input.classList.add('form-control');
                }
            });
            
            // 处理表格样式
            const tables = document.querySelectorAll('table');
            tables.forEach(table => {
                if (!table.classList.contains('table')) {
                    table.classList.add('table');
                }
            });
            
            // 处理卡片样式
            const cards = document.querySelectorAll('.db-info, .table-buttons, .table-info-container');
            cards.forEach(card => {
                if (!card.classList.contains('card')) {
                    card.classList.add('card');
                }
            });
            
            // 处理提示框样式
            const alerts = document.querySelectorAll('.status-message, .table-info-tip');
            alerts.forEach(alert => {
                if (!alert.classList.contains('alert')) {
                    alert.classList.add('alert');
                }
                // 确保提示框使用皮肤的颜色变量
                alert.style.backgroundColor = 'var(--color-bg-alert-info, var(--color-bg-secondary, #e8f4fd))';
                alert.style.color = 'var(--color-text-primary, #34495e)';
                alert.style.borderLeft = '4px solid var(--color-primary, #3498db)';
            });
        }
    </script>


</body>
</html>