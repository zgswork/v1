# SQL QueryMaster

**离线 SQL 查询编辑器与美化工具**（纯 HTML + CSS + JS 单页面应用）

## 项目概述

SQL QueryMaster 是一个完全离线的 SQL 查询编辑与分析工具，采用纯前端技术实现，无需任何服务器或外部依赖。它提供了美观、实用的 SQL 开发体验，支持多种数据库方言，具备基本执行模拟能力。

## 主要功能

### 1. 多标签页编辑
- 支持创建、关闭、重命名多个 SQL 编辑标签页
- 每个标签页独立保存内容（使用 localStorage 持久化）
- 新建标签默认名为 "Query 1"、"Query 2" 等
- 支持双击标签页重命名

### 2. SQL 自动格式化与美化
- 一键格式化选中文本或整个查询
- 支持标准 SQL 美化规则：
  - 关键词大写
  - 适当缩进（4个空格）
  - 逗号对齐
  - 子查询换行
- 可配置美化风格（通过代码修改）

### 3. 语法高亮（支持多种数据库方言）
- 使用 CodeMirror 6 实现语法高亮
- 支持以下 4 种方言的关键词区别高亮：
  - MySQL
  - PostgreSQL
  - SQLite
  - Oracle
- 用户可通过下拉菜单切换当前方言
- 支持字符串、注释、数字、操作符等通用高亮

### 4. 离线执行模拟（虚拟数据库）
- 支持上传 CSV 或 JSON 文件作为 "虚拟表"
  - **CSV 格式**：第一行为列名，自动解析为表
  - **JSON 格式**：支持数组对象格式 `[{col1: ..., col2: ...}, ...]`
- 用户可自定义表名（上传时输入或自动生成）
- 仅支持 SELECT 查询的模拟执行（不支持 INSERT/UPDATE/DELETE）
- 执行结果以可排序、可分页的 HTML 表格显示
- 支持基本过滤、分页、列宽自适应

### 5. 简单执行计划模拟（Explain Simulator）
- 对 SELECT 查询生成伪执行计划
- 显示内容包括：
  - 估计扫描行数（基于上传数据行数）
  - 涉及的表和列
  - 建议可能的索引（WHERE 中频繁出现的列）
  - 潜在全表扫描警告（无 WHERE 或无索引列过滤）

### 6. 查询历史与结果导出
- 自动记录最近 20 条执行过的查询
- 每条记录包含：时间、方言、执行状态、返回行数
- 点击历史项可重新加载到编辑器
- 支持将查询结果导出为 CSV 文件（带 BOM 头，支持中文）
- 支持导出当前 SQL 脚本为 .sql 文件

## 技术实现

- **纯前端技术栈**：HTML5 + CSS3 + JavaScript (ES6+)
- **代码编辑器**：CodeMirror 6（来自 CDN）
- **数据存储**：localStorage（浏览器本地存储）
- **文件格式支持**：
  - CSV（逗号分隔值）
  - JSON（JavaScript 对象表示法）
- **数据库方言支持**：MySQL、PostgreSQL、SQLite、Oracle

## 快速开始

### 方式一：直接打开（推荐）
1. 下载项目文件
2. 直接用浏览器打开 `index.html` 文件即可使用
3. 无需安装任何依赖或服务器

### 方式二：本地服务器（可选）
如果需要通过本地服务器访问，可以使用以下方式：

```bash
# 使用 Python 3
python -m http.server 8000

# 使用 Node.js (需要先安装 http-server)
npx http-server -p 8000

# 使用 PHP
php -S localhost:8000
```

然后在浏览器中访问 `http://localhost:8000`

## 使用指南

### 1. 上传数据文件
1. 点击顶部工具栏的「📂 上传数据」按钮
2. 在弹出的对话框中，拖拽文件到上传区域或点击选择文件
3. 支持 CSV 和 JSON 格式
4. 可以自定义表名（可选）
5. 点击「上传」按钮完成上传

### 2. 编写 SQL 查询
1. 在左侧编辑器中编写 SQL 查询
2. 支持多标签页编辑，点击「+」按钮创建新标签
3. 双击标签页可以重命名
4. 编辑器支持语法高亮和基本的自动补全

### 3. 格式化 SQL
1. 编写完 SQL 后，点击工具栏的「🔧 格式化」按钮
2. 系统会自动格式化 SQL，包括关键词大写、缩进等

### 4. 执行 SQL 查询
1. 确保已经上传了数据文件
2. 编写 SELECT 查询语句
3. 点击工具栏的「▶️ 执行」按钮
4. 查询结果会显示在右侧的结果面板中
5. 结果表格支持点击表头排序

### 5. 查看执行计划
1. 编写 SELECT 查询语句
2. 点击工具栏的「📊 执行计划」按钮
3. 系统会生成伪执行计划，显示查询的执行步骤和建议

### 6. 导出数据
- **导出 SQL**：点击工具栏的「💾 导出 SQL」按钮，将当前编辑器中的 SQL 导出为 .sql 文件
- **导出结果**：执行查询后，点击结果面板顶部的「📥 导出结果」按钮，将查询结果导出为 CSV 文件（带 BOM 头，支持中文）

### 7. 查询历史
1. 点击顶部工具栏的「📜 查询历史」按钮
2. 在弹出的对话框中可以看到最近执行的查询
3. 点击任意历史项可以将其重新加载到编辑器中
4. 可以点击「清空历史」按钮清除所有查询历史

## 支持的 SQL 语法

### 基础查询
```sql
SELECT column1, column2 FROM table;
SELECT * FROM table WHERE condition;
SELECT * FROM table ORDER BY column;
SELECT * FROM table LIMIT 10;
```

### 聚合函数
```sql
SELECT COUNT(*) FROM table;
SELECT SUM(column) FROM table;
SELECT AVG(column) FROM table;
SELECT MAX(column) FROM table;
SELECT MIN(column) FROM table;
```

### 分组查询
```sql
SELECT column, COUNT(*) FROM table GROUP BY column;
SELECT column, COUNT(*) FROM table GROUP BY column HAVING COUNT(*) > 1;
```

### 连接查询
```sql
SELECT * FROM table1 JOIN table2 ON table1.id = table2.table1_id;
SELECT * FROM table1 LEFT JOIN table2 ON table1.id = table2.table1_id;
SELECT * FROM table1 RIGHT JOIN table2 ON table1.id = table2.table1_id;
```

### 子查询
```sql
SELECT * FROM table WHERE column IN (SELECT column FROM table2);
SELECT * FROM (SELECT * FROM table WHERE condition) AS subquery;
```

### 数据库方言特有语法

#### PostgreSQL
```sql
SELECT column::type FROM table;  -- 类型转换
SELECT * FROM table LIMIT 10 OFFSET 5;  -- 分页
SELECT * FROM table WHERE column ILIKE '%value%';  -- 不区分大小写匹配
```

#### Oracle
```sql
SELECT * FROM table WHERE ROWNUM <= 10;  -- 分页
SELECT TO_CHAR(date_column, 'YYYY-MM-DD') FROM table;  -- 日期格式化
SELECT NVL(column, 'default') FROM table;  -- 空值处理
```

#### MySQL
```sql
SELECT * FROM table LIMIT 5, 10;  -- 分页（偏移量, 数量）
SELECT DATE_FORMAT(date_column, '%Y-%m-%d') FROM table;  -- 日期格式化
SELECT IFNULL(column, 'default') FROM table;  -- 空值处理
```

#### SQLite
```sql
SELECT * FROM table LIMIT 10;  -- 分页
SELECT DATE(date_column) FROM table;  -- 日期处理
SELECT COALESCE(column, 'default') FROM table;  -- 空值处理
```

## 示例数据

项目提供了以下示例数据文件，位于 `tests/` 目录下：

### 1. `sample_customers.csv`
客户信息表，包含以下列：
- `id` - 客户ID
- `name` - 客户姓名
- `email` - 客户邮箱
- `age` - 客户年龄
- `city` - 客户所在城市

### 2. `sample_orders.json`
订单信息表，包含以下列：
- `id` - 订单ID
- `customer_id` - 客户ID（外键）
- `product` - 产品名称
- `amount` - 订单金额
- `quantity` - 购买数量
- `order_date` - 订单日期
- `status` - 订单状态

### 3. `preset_queries.sql`
包含各种 SQL 查询示例，包括：
- 简单 SELECT 查询
- JOIN 查询
- GROUP BY + HAVING 查询
- 子查询
- 各种数据库方言特有语法
- 高级查询示例

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 注意事项

1. **离线使用**：本工具完全离线运行，所有数据都存储在浏览器的 localStorage 中，不会上传到任何服务器。

2. **数据持久化**：
   - 编辑的 SQL 会自动保存到 localStorage
   - 上传的数据文件仅在当前浏览器会话中有效（刷新页面后需要重新上传）
   - 查询历史会持久化保存

3. **查询限制**：
   - 仅支持 SELECT 查询
   - 不支持 INSERT、UPDATE、DELETE 等数据修改操作
   - 不支持创建表、索引等 DDL 操作
   - 不支持存储过程、函数等高级特性

4. **性能考虑**：
   - 由于是纯前端工具，处理大量数据时可能会影响性能
   - 建议每个数据文件不超过 10MB
   - 建议每个表的行数不超过 10,000 行

5. **安全性**：
   - 本工具仅用于本地开发和学习
   - 不要在生产环境中使用
   - 不要处理敏感数据

## 自定义配置

可以通过修改 `index.html` 文件中的 JavaScript 代码来自定义一些配置：

### 1. 修改默认缩进
```javascript
// 在 initEditor 函数中修改
indentUnit: 4,  // 改为 2 或其他值
tabSize: 4,     // 改为 2 或其他值
```

### 2. 修改查询历史保留数量
```javascript
// 在 saveQueryToHistory 函数中修改
if (queryHistory.length > 20) {  // 改为其他数字
    queryHistory = queryHistory.slice(0, 20);
}
```

### 3. 修改美化规则
可以修改 `formatSQLSimple` 函数中的正则表达式和格式化逻辑。

## 常见问题

### Q: 为什么上传的数据文件在刷新页面后消失了？
A: 上传的数据文件仅存储在浏览器的内存中，刷新页面后会被清除。如果需要长期保存数据，建议将数据导出为文件。

### Q: 为什么有些 SQL 查询无法执行？
A: 本工具仅支持基本的 SELECT 查询，不支持复杂的 SQL 特性。如果遇到无法执行的查询，请检查 SQL 语法是否符合支持的范围。

### Q: 为什么查询结果显示不正确？
A: 本工具的查询执行是模拟的，可能与真实数据库的执行结果有差异。如果遇到查询结果不正确的情况，请检查 SQL 语法和数据文件格式。

### Q: 为什么无法导出查询结果？
A: 只有在执行查询后，才能导出查询结果。请确保已经执行了查询，并且查询返回了结果。

### Q: 为什么编辑器中的 SQL 没有语法高亮？
A: 语法高亮需要加载 CodeMirror 库。请确保网络连接正常，或者使用方式一（直接打开）使用本工具。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 Issue
- 发送邮件

---

**注意**：本工具仅供学习和开发使用，不保证查询结果的准确性。在生产环境中，请使用真实的数据库系统。