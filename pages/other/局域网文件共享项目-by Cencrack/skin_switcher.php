<?php
/**
 * 皮肤切换处理器
 * 处理皮肤切换请求并保存用户选择
 */

// 设置响应头
header('Content-Type: application/json');

// 引入皮肤加载器
require_once __DIR__ . '/skin_loader.php';

// 只处理POST请求
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        'success' => false,
        'message' => '只支持POST请求'
    ]);
    exit;
}

// 获取皮肤名称
$skinName = $_POST['skin'] ?? '';

// 验证皮肤名称
if (empty($skinName)) {
    echo json_encode([
        'success' => false,
        'message' => '皮肤名称不能为空'
    ]);
    exit;
}

// 获取所有可用皮肤
$availableSkins = getAllSkins();
$validSkinNames = array_column($availableSkins, 'folder');

// 验证皮肤是否存在
if (!in_array($skinName, $validSkinNames)) {
    echo json_encode([
        'success' => false,
        'message' => '无效的皮肤名称'
    ]);
    exit;
}

// 保存皮肤选择
if (saveSelectedSkin($skinName)) {
    echo json_encode([
        'success' => true,
        'message' => '皮肤切换成功',
        'skin' => $skinName
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => '保存皮肤选择失败'
    ]);
}
?>