# 墨舟 InkNote — 架构文档

> 一款轻量、离线可用的 Markdown 学习助手

## 项目简介

墨舟 InkNote 是一个**单 HTML 文件**的 Markdown 学习工具，零依赖、离线可用。打开即用，无需安装。后续还会持续更新...

### 核心功能

- **文件夹导入** — 拖入整个笔记目录，自动生成文件树
- **全文搜索** — 支持多关键词、正则表达式
- **学习进度** — 右侧面板标记每章学习状态
- **复习提醒** — 标记完成后自动设置复习
- **原地编辑** — 点击 ✎ 按钮直接编辑笔记
- **实时分享** — 通过 PeerJS 与他人分享文件，支持连接管理
- **代码高亮** — 支持 50+ 种语言语法高亮
- **暗色/亮色** — 右上角切换主题
- **数据持久化** — 笔记自动保存到 IndexedDB，刷新不丢失
- **历史记录** — 点击 📚 历史 按钮查看和恢复之前的笔记
- **一键清理** — 历史记录支持单条删除和全部清空

---

## 架构地图

```
┌─────────────────────────────────────────────────────────┐
│                    InkNote.html (~2900行)                │
│                  单文件，零依赖，离线可用                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─── 表现层 ──────────────────────────────────────┐    │
│  │  CSS (~400行)                                    │    │
│  │  ├─ 主题变量 (dark/light)                        │    │
│  │  ├─ 布局 (header/sidebar/main/content)           │    │
│  │  ├─ 组件 (modal/toast/ripple/progress)           │    │
│  │  └─ 响应式 (@media 900/640/480)                  │    │
│  │                                                  │    │
│  │  HTML (~160行)                                   │    │
│  │  ├─ Header (搜索/导入/历史/分享/主题)             │    │
│  │  ├─ Sidebar (文件树/TOC/复习)                    │    │
│  │  ├─ Main (drop-zone/content)                     │    │
│  │  ├─ Modal Overlay (自定义弹框)                   │    │
│  │  ├─ History Panel (历史记录)                     │    │
│  │  └─ Share Overlay (分享面板)                     │    │
│  └──────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─── 数据层 ──────────────────────────────────────┐    │
│  │  state (全局状态对象)                             │    │
│  │  ├─ files[]          所有文件                     │    │
│  │  ├─ currentFile      当前打开的文件               │    │
│  │  ├─ progress{}       学习进度 {path: {id: true}}  │    │
│  │  ├─ theme            主题 dark/light              │    │
│  │  ├─ _folderId        当前文件夹 ID                │    │
│  │  └─ _imageMap{}      图片 base64 缓存             │    │
│  └──────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─── 核心模块 ────────────────────────────────────┐    │
│  │                                                  │    │
│  │  文件系统 (L566-771)                             │    │
│  │  ├─ isTextFile()     扩展名检测                   │    │
│  │  ├─ getLangFromExt() 语法语言映射                 │    │
│  │  ├─ scanDirectory()  递归扫描文件夹               │    │
│  │  ├─ buildFileTree()  构建树结构                   │    │
│  │  ├─ renderTree()     渲染侧边栏文件树             │    │
│  │  └─ loadFiles()      导入文件 + 触发持久化        │    │
│  │                                                  │    │
│  │  Markdown 解析器 (L1081-1211)                     │    │
│  │  ├─ parseMd()        全量解析 → {html, toc}       │    │
│  │  ├─ inline()         行内语法 (粗体/斜体/代码/链接) │    │
│  │  ├─ restoreInlineCodes() 占位符还原               │    │
│  │  └─ slugify()        标题 ID 生成                 │    │
│  │                                                  │    │
│  │  打开/编辑 (L1211-1480)                          │    │
│  │  ├─ openFile()       渲染文件内容                 │    │
│  │  ├─ closeFile()      回到拖拽区                   │    │
│  │  ├─ enterEditMode()  进入编辑模式                 │    │
│  │  ├─ saveEdit()       保存编辑                     │    │
│  │  └─ formatEdit()     编辑器工具栏格式化            │    │
│  │                                                  │    │
│  │  进度系统 (L1480-1579)                            │    │
│  │  ├─ buildToc()       渲染侧边栏目录               │    │
│  │  ├─ buildProgress()  渲染进度面板                 │    │
│  │  ├─ toggleProgress() 标记章节完成                 │    │
│  │  └─ getTodayReviews() 获取今日复习                │    │
│  │                                                  │    │
│  │  搜索 (L1579-1658)                               │    │
│  │  ├─ parseSearchQuery() 解析搜索语法               │    │
│  │  ├─ doSearch()       执行搜索                     │    │
│  │  └─ jumpToResult()   跳转到搜索结果               │    │
│  └──────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─── 存储模块 ────────────────────────────────────┐    │
│  │                                                  │    │
│  │  StorageCore (L2163-2285) — IndexedDB 封装        │    │
│  │  ├─ openDB()         打开/创建数据库              │    │
│  │  ├─ saveFolder()     保存文件夹                   │    │
│  │  ├─ loadFolders()    加载所有文件夹               │    │
│  │  ├─ deleteFolder()   删除文件夹                   │    │
│  │  ├─ getLatest()      获取最近打开                 │    │
│  │  └─ checkQuota()     检查存储配额                 │    │
│  │                                                  │    │
│  │  持久化桥接 (L852-870)                            │    │
│  │  ├─ persistToIndexedDB() 写入 + 配额检查          │    │
│  │  ├─ clearAllStorage()    清空全部                 │    │
│  │  └─ renderHistoryList()  渲染历史列表             │    │
│  │                                                  │    │
│  │  localStorage (轻量数据)                          │    │
│  │  ├─ md-theme         主题偏好                     │    │
│  │  ├─ md-progress      学习进度                     │    │
│  │  └─ md-app-state     当前打开的文件路径            │    │
│  └──────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─── 分享模块 ────────────────────────────────────┐    │
│  │                                                  │    │
│  │  ShareCore (L2102-2163) — 纯函数，可测试           │    │
│  │  ├─ genId()          生成房间号                    │    │
│  │  ├─ serializeFiles() 序列化文件                    │    │
│  │  ├─ mergeReceivedFiles() 合并接收到的文件          │    │
│  │  ├─ parseMessage()   解析消息                     │    │
│  │  └─ isValidFile()    验证文件完整性                │    │
│  │                                                  │    │
│  │  PeerJS UI (L2496-2890)                           │    │
│  │  ├─ initPeer()       初始化 PeerJS 连接           │    │
│  │  ├─ startHeartbeat() 心跳检测 (15s/30s)           │    │
│  │  ├─ disconnectPeer() 断开单个连接                  │    │
│  │  ├─ disconnectAll()  断开全部                     │    │
│  │  ├─ handleReceivedData() 处理接收数据             │    │
│  │  └─ updateConnectedUsers() 更新连接用户 UI        │    │
│  └──────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─── UI 交互层 ───────────────────────────────────┐    │
│  │  showModal / showConfirm / showAlert 自定义弹框    │    │
│  │  showToast()         Toast 提示                    │    │
│  │  addRipple()         按钮涟漪效果                  │    │
│  │  setupScrollSpy()    滚动监听高亮目录              │    │
│  │  bindAnchorLinks()   锚点链接跳转                  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─── 自测 (内置) ─────────────────────────────────┐    │
│  │  backTop 自测 (2项)                               │    │
│  │  ShareCore 自测 (14项)                            │    │
│  │  图片路径解析自测 (5项)                            │    │
│  │  StorageCore 自测 (5项)                           │    │
│  └──────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─── 外部依赖 (CDN) ──────────────────────────────┐    │
│  │  Prism.js (代码高亮)                              │    │
│  │  PeerJS (P2P 实时分享)                            │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 模块依赖关系

```
文件导入 → 文件系统 → parseMd → 渲染
                ↓              ↓
          persistToIndexedDB  buildToc/Progress
                ↓
          StorageCore (IndexedDB)

页面启动 → 自动恢复 (StorageCore.getLatest)
        → loadDemo (无历史时)
        → renderHistoryList

分享 → ShareCore (纯函数)
     → PeerJS UI (连接管理 + 心跳)

全局 → state (中央状态)
     → localStorage (轻量持久化)
     → IndexedDB (重量持久化)
```

---

## 数据流

### 导入流程

```
用户拖入文件夹
  → scanDirectory() 递归扫描
  → loadFiles() 写入 state.files[]
  → persistToIndexedDB() 写入 IndexedDB
  → refreshTree() 渲染侧边栏
  → openFile() → parseMd() → 渲染内容
  → buildProgress() → 更新进度面板
```

### 启动恢复流程

```
页面加载
  → StorageCore.getLatest() 从 IndexedDB 恢复
  → state.files = folder.files
  → 自动打开上次的文件
  → renderHistoryList() 渲染历史列表
```

### 分享通信流程

```
打开分享面板
  → initPeer() 创建 PeerJS 连接
  → 生成房间号 md-xxxxxx
  → 对方输入房间号连接
  → 建立 DataConnection
  → startHeartbeat() 心跳检测
  → send/recv 文件数据 (JSON)
```

---

## 存储策略

| 数据类型 | 存储位置 | 容量 | 用途 |
|---------|---------|------|------|
| 主题偏好 | localStorage `md-theme` | ~10B | dark/light 切换 |
| 学习进度 | localStorage `md-progress` | ~1KB | 章节勾选状态 |
| 当前文件路径 | localStorage `md-app-state` | ~100B | 刷新后恢复 |
| 文件夹内容 | IndexedDB `inknote-db` | ~50-200MB | 文件持久化 |
| 图片文件 | 内存 `state._imageMap` | 运行时 | base64 缓存 |

---

## 自测体系

内置 4 组自测，打开浏览器控制台（F12）可查看结果：

| 模块 | 测试项数 | 覆盖内容 |
|------|---------|---------|
| backTop | 2 | 按钮存在性、scrollTo API |
| ShareCore | 14 | genId、serializeFiles、mergeReceivedFiles、parseMessage、isValidFile |
| 图片路径解析 | 5 | 完整路径、相对路径、文件名回退、外部URL、绝对路径 |
| StorageCore | 5 | openDB、saveFolder、loadFolders、deleteFolder、checkQuota |

---

## 外部依赖

| 库 | 用途 | CDN |
|----|------|-----|
| Prism.js 1.29.0 | 代码语法高亮 | cdnjs.cloudflare.com |
| PeerJS 1.5.4 | P2P 实时分享 | unpkg.com |

---

## 开发历程

1. **BackTop 修复** — 添加缺失的 click 事件处理器
2. **IndexedDB 持久化** — StorageCore 模块 + 自动恢复
3. **历史记录** — 拖拽区内嵌 + header 📚 历史按钮双入口
4. **自定义弹框** — 替换所有原生 confirm/alert
5. **清空全部** — 侧边栏 + 存储 + 进度一键清理
6. **侧边栏修复** — overflow-x:hidden 消除横向滚动条
7. **Markdown 解析器** — restoreInlineCodes 修复 TOC 占位符
8. **分享连接管理** — 心跳检测 + 断开按钮 + 状态指示
9. **命名** — 墨舟 InkNote
10. **风险修复** — showModal 事件清理、IndexedDB fallback、多标签页同步
