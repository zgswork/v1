<?php
// 文件扫描同步页面
require_once __DIR__ . '/access_control.php';

// 引入数据库配置
require_once __DIR__ . '/db_config.php';

// 设置错误报告
error_reporting(E_ALL);
ini_set('display_errors', 1);

// 处理AJAX请求
if (isset($_GET['action'])) {
    $action = $_GET['action'];
    
    if ($action === 'sync_files') {
        // 执行文件同步
        header('Content-Type: application/json');
        
        try {
            // 调用file_monitor.php的同步功能
            $sync_url = __DIR__ . '/file_monitor.php?action=sync';
            
            // 使用cURL执行同步
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $sync_url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 300); // 5分钟超时
            
            $response = curl_exec($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            
            if (curl_errno($ch)) {
                throw new Exception('cURL错误: ' . curl_error($ch));
            }
            
            curl_close($ch);
            
            if ($http_code !== 200) {
                throw new Exception('HTTP错误: ' . $http_code);
            }
            
            $result = json_decode($response, true);
            if (!$result) {
                throw new Exception('解析响应失败');
            }
            
            echo json_encode($result);
        } catch (Exception $e) {
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>文件扫描同步 - 后台管理</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css">
    <style>
        :root {
            --primary-color: #3498db;
            --success-color: #2ecc71;
            --danger-color: #e74c3c;
            --warning-color: #f39c12;
            --light-color: #f8f9fa;
            --dark-color: #343a40;
            --border-radius: 5px;
            --box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            --transition: all 0.3s ease;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1000px;
            margin: 20px auto;
            padding: 20px;
            background-color: #fff;
            border-radius: var(--border-radius);
            box-shadow: var(--box-shadow);
        }
        
        .header {
            display: flex;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 15px;
            border-bottom: 1px solid #eee;
        }
        
        .header h1 {
            font-size: 24px;
            color: var(--dark-color);
            margin-left: 10px;
        }
        
        .header i {
            font-size: 28px;
            color: var(--primary-color);
        }
        
        .card {
            background-color: #fff;
            border-radius: var(--border-radius);
            box-shadow: var(--box-shadow);
            margin-bottom: 20px;
            overflow: hidden;
        }
        
        .card-header {
            background-color: var(--primary-color);
            color: #fff;
            padding: 15px 20px;
            font-weight: bold;
            display: flex;
            align-items: center;
        }
        
        .card-header i {
            margin-right: 10px;
        }
        
        .card-body {
            padding: 20px;
        }
        
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background-color: var(--primary-color);
            color: #fff;
            border: none;
            border-radius: var(--border-radius);
            cursor: pointer;
            font-size: 16px;
            transition: var(--transition);
            text-decoration: none;
        }
        
        .btn:hover {
            background-color: #2980b9;
        }
        
        .btn-success {
            background-color: var(--success-color);
        }
        
        .btn-success:hover {
            background-color: #27ae60;
        }
        
        .btn-danger {
            background-color: var(--danger-color);
        }
        
        .btn-danger:hover {
            background-color: #c0392b;
        }
        
        .btn:disabled {
            background-color: #bdc3c7;
            cursor: not-allowed;
        }
        
        .progress-container {
            margin-top: 20px;
            display: none;
        }
        
        .progress-bar {
            height: 20px;
            background-color: #f1f1f1;
            border-radius: var(--border-radius);
            overflow: hidden;
            margin-bottom: 10px;
        }
        
        .progress {
            height: 100%;
            background-color: var(--primary-color);
            width: 0%;
            transition: width 0.3s;
        }
        
        .log-container {
            margin-top: 20px;
            background-color: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: var(--border-radius);
            padding: 15px;
            height: 300px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 14px;
            display: none;
        }
        
        .log-line {
            margin-bottom: 5px;
            padding: 2px 0;
        }
        
        .log-line.success {
            color: var(--success-color);
        }
        
        .log-line.error {
            color: var(--danger-color);
        }
        
        .log-line.info {
            color: var(--primary-color);
        }
        
        .stats-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .stat-card {
            background-color: #fff;
            border-radius: var(--border-radius);
            box-shadow: var(--box-shadow);
            padding: 20px;
            text-align: center;
            border-left: 4px solid var(--primary-color);
        }
        
        .stat-card.success {
            border-left-color: var(--success-color);
        }
        
        .stat-card.warning {
            border-left-color: var(--warning-color);
        }
        
        .stat-card.danger {
            border-left-color: var(--danger-color);
        }
        
        .stat-number {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .stat-label {
            color: #666;
            font-size: 14px;
        }
        
        .alert {
            padding: 15px;
            margin-bottom: 20px;
            border-radius: var(--border-radius);
        }
        
        .alert-info {
            background-color: #d1ecf1;
            border: 1px solid #bee5eb;
            color: #0c5460;
        }
        
        .alert-success {
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        
        .alert-danger {
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <i class="fas fa-sync-alt"></i>
            <h1>文件扫描同步</h1>
        </div>
        
        <div class="card">
            <div class="card-header">
                <i class="fas fa-info-circle"></i>
                功能说明
            </div>
            <div class="card-body">
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i> 
                    文件扫描同步功能将扫描"分享文件"目录下的所有文件，并将文件信息同步到数据库中。这可以确保前台显示的文件列表与实际文件系统保持一致。
                </div>
                <p>此功能将执行以下操作：</p>
                <ul>
                    <li>扫描"分享文件"目录及其子目录中的所有文件</li>
                    <li>计算每个文件的MD5哈希值</li>
                    <li>将新发现的文件添加到数据库</li>
                    <li>更新已存在文件的信息（如文件名、大小等）</li>
                    <li>从数据库中删除已被移除的文件记录</li>
                </ul>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <i class="fas fa-play"></i>
                执行同步
            </div>
            <div class="card-body">
                <button id="syncBtn" class="btn">
                    <i class="fas fa-sync-alt"></i> 开始同步
                </button>
                
                <div class="progress-container" id="progressContainer">
                    <div class="progress-bar">
                        <div class="progress" id="progressBar"></div>
                    </div>
                    <div id="progressText">准备中...</div>
                </div>
                
                <div class="log-container" id="logContainer"></div>
                
                <div class="stats-container" id="statsContainer" style="display: none;">
                    <div class="stat-card success">
                        <div class="stat-number" id="addedCount">0</div>
                        <div class="stat-label">新增文件</div>
                    </div>
                    <div class="stat-card warning">
                        <div class="stat-number" id="updatedCount">0</div>
                        <div class="stat-label">更新文件</div>
                    </div>
                    <div class="stat-card danger">
                        <div class="stat-number" id="deletedCount">0</div>
                        <div class="stat-label">删除文件</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const syncBtn = document.getElementById('syncBtn');
            const progressContainer = document.getElementById('progressContainer');
            const progressBar = document.getElementById('progressBar');
            const progressText = document.getElementById('progressText');
            const logContainer = document.getElementById('logContainer');
            const statsContainer = document.getElementById('statsContainer');
            
            syncBtn.addEventListener('click', function() {
                // 禁用按钮
                syncBtn.disabled = true;
                syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 同步中...';
                
                // 显示进度条
                progressContainer.style.display = 'block';
                progressBar.style.width = '0%';
                progressText.textContent = '准备中...';
                
                // 显示日志容器
                logContainer.style.display = 'block';
                logContainer.innerHTML = '';
                
                // 隐藏统计信息
                statsContainer.style.display = 'none';
                
                // 添加日志
                addLog('开始同步文件...', 'info');
                
                // 模拟进度更新
                let progress = 0;
                const progressInterval = setInterval(function() {
                    progress += Math.random() * 10;
                    if (progress > 90) progress = 90;
                    progressBar.style.width = progress + '%';
                    progressText.textContent = '同步中... ' + Math.round(progress) + '%';
                }, 500);
                
                // 发送同步请求
                fetch('file_sync.php?action=sync_files')
                    .then(response => response.json())
                    .then(data => {
                        // 清除进度更新
                        clearInterval(progressInterval);
                        
                        // 更新进度到100%
                        progressBar.style.width = '100%';
                        progressText.textContent = '同步完成';
                        
                        // 处理结果
                        if (data.status === 'success') {
                            addLog('同步成功完成!', 'success');
                            
                            // 显示统计信息
                            if (data.stats) {
                                document.getElementById('addedCount').textContent = data.stats.added || 0;
                                document.getElementById('updatedCount').textContent = data.stats.updated || 0;
                                document.getElementById('deletedCount').textContent = data.stats.deleted || 0;
                                statsContainer.style.display = 'grid';
                                
                                addLog(`新增: ${data.stats.added} 个文件`, 'success');
                                addLog(`更新: ${data.stats.updated} 个文件`, 'info');
                                addLog(`删除: ${data.stats.deleted} 个文件`, 'warning');
                            }
                        } else {
                            addLog('同步失败: ' + data.message, 'error');
                        }
                        
                        // 恢复按钮
                        syncBtn.disabled = false;
                        syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 重新同步';
                    })
                    .catch(error => {
                        // 清除进度更新
                        clearInterval(progressInterval);
                        
                        // 更新进度
                        progressBar.style.width = '100%';
                        progressBar.style.backgroundColor = '#e74c3c';
                        progressText.textContent = '同步失败';
                        
                        // 添加错误日志
                        addLog('同步过程中发生错误: ' + error.message, 'error');
                        
                        // 恢复按钮
                        syncBtn.disabled = false;
                        syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 重新同步';
                    });
            });
            
            function addLog(message, type) {
                const logLine = document.createElement('div');
                logLine.className = 'log-line ' + type;
                logLine.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
                logContainer.appendChild(logLine);
                logContainer.scrollTop = logContainer.scrollHeight;
            }
        });
    </script>
</body>
</html>