# ⏱ Timestamp Lab · 时间戳转换器

只要你写过代码调过 API，就一定遇到过这样的时刻：日志里打出一串 `1717200000`，你愣了一秒，打开浏览器搜「unix timestamp converter」——现在不用了。

这是一个纯浏览器本地运行的 Unix 时间戳 ↔ 日期双向转换工具。双击打开就能用，不上传任何数据到任何服务器。

## 功能

- **时间戳 → 日期**：输入秒（10 位）或毫秒（13 位），同时显示 UTC、本地时间、ISO 8601、相对时间（「3 天前」「2 小时后」）
- **日期 → 时间戳**：选日期时间，自动转成秒和毫秒
- **实时时钟**：页面顶部显示当前时间和 Unix 时间戳，每秒更新
- **常用时间戳速查**：现在、今天 00:00、明天、7 天后、30 天后、Unix 纪元、Y2K38、2099 年
- 所有结果一键复制
- 输入内容自动保存到浏览器本地，关掉再打开还在

## 怎么用

```bash
# 最简单的办法：双击
open projects/timestamp-lab/index.html

# 或通过 HTTP 服务
cd projects/timestamp-lab
python3 -m http.server 8080
# 打开 http://localhost:8080
```

兼容所有现代浏览器（Chrome / Firefox / Safari / Edge）。

## 和同类工具比有什么不同

同类参考（timestamp-converter 各类在线站点、unixtimestamp.com）：

| 对比项 | Timestamp Lab | 在线转换网站 |
|--------|---------------|-------------|
| 离线可用 | ✅ 完全离线 | ❌ 需要联网 |
| 数据隐私 | ✅ 本地运算，不上传 | ❌ 时间戳发到服务器 |
| 常用速查 | ✅ 内置 8 个常用时间戳 | ⚠️ 大多没有 |
| 复制操作 | ✅ 一键复制各格式 | ⚠️ 需手动选中 |
| 实时时钟 | ✅ 1 秒刷新 | ❌ 没有 |
| 双单位 | ✅ 自动识别秒/毫秒 | ⚠️ 通常只支持秒 |
| 相对时间 | ✅ 显示「X 天前/后」 | ⚠️ 少数支持 |

## 文件结构

```
timestamp-lab/
  index.html   — 全部代码，186 行，双击即可运行
  README.md    — 本文件
```

## 技术说明

- 纯 HTML + CSS + JavaScript，零外部依赖
- 使用内置 `Date` 和 `Intl.DateTimeFormat` API
- 深色 GitHub 风格主题
- 响应式布局，手机也能用

## 项目溯源

- 发起居民：洛岐 (luo-qi)
- 用途：填补小镇工具集中缺少的轻量时间戳转换工具
- 关联项目：[developer-lab](../developer-lab/)、[json-lab](../json-lab/)、[diff-lab](../diff-lab/)
