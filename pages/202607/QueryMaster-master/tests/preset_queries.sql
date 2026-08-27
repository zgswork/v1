-- =============================================
-- SQL QueryMaster 预置查询示例
-- 包含各种 SQL 查询类型和数据库方言特有语法
-- =============================================

-- =============================================
-- 1. 简单 SELECT 查询
-- =============================================
-- 查询所有客户信息
SELECT * FROM customers;

-- 查询客户的基本信息（指定列）
SELECT id, name, email, city
FROM customers;

-- 查询年龄大于等于30岁的客户
SELECT * FROM customers
WHERE age >= 30;


-- =============================================
-- 2. JOIN 查询
-- =============================================
-- 查询客户的订单信息（INNER JOIN）
SELECT
    c.id as customer_id,
    c.name as customer_name,
    c.email,
    o.id as order_id,
    o.product,
    o.amount,
    o.order_date
FROM customers c
INNER JOIN orders o ON c.id = o.customer_id;

-- 查询所有客户及其订单（LEFT JOIN）
-- 包括没有订单的客户
SELECT
    c.name as customer_name,
    COUNT(o.id) as order_count,
    COALESCE(SUM(o.amount), 0) as total_spent
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.name
ORDER BY total_spent DESC;


-- =============================================
-- 3. GROUP BY + HAVING 查询
-- =============================================
-- 按城市分组统计客户数量
SELECT city, COUNT(*) as customer_count
FROM customers
GROUP BY city
ORDER BY customer_count DESC;

-- 统计每个客户的订单总数和总金额
-- 只显示有订单的客户
SELECT
    c.name,
    COUNT(o.id) as order_count,
    SUM(o.amount) as total_amount
FROM customers c
JOIN orders o ON c.id = o.customer_id
GROUP BY c.name
HAVING COUNT(o.id) >= 1;

-- 统计不同产品的销售数量和总金额
SELECT
    product,
    SUM(quantity) as total_quantity,
    SUM(amount) as total_amount
FROM orders
GROUP BY product
HAVING SUM(amount) > 1000;


-- =============================================
-- 4. 子查询
-- =============================================
-- 查询订单金额大于平均金额的订单
SELECT * FROM orders
WHERE amount > (SELECT AVG(amount) FROM orders);

-- 查询购买过 iPhone 的客户信息
SELECT * FROM customers
WHERE id IN (SELECT customer_id FROM orders WHERE product LIKE '%iPhone%');

-- 使用子查询作为派生表
SELECT
    customer_name,
    order_count,
    total_amount
FROM (
    SELECT
        c.name as customer_name,
        COUNT(o.id) as order_count,
        SUM(o.amount) as total_amount
    FROM customers c
    JOIN orders o ON c.id = o.customer_id
    GROUP BY c.name
) as customer_stats
WHERE total_amount > 5000;


-- =============================================
-- 5. 数据库方言特有语法
-- =============================================
-- PostgreSQL 特有语法
-- 使用 :: 进行类型转换
SELECT
    id,
    name,
    age::text as age_string,
    created_at::date as create_date
FROM customers;

-- PostgreSQL 的 LIMIT 和 OFFSET
SELECT * FROM customers
ORDER BY id
LIMIT 5 OFFSET 1;

-- PostgreSQL 的 ILIKE（不区分大小写的 LIKE）
SELECT * FROM customers
WHERE name ILIKE '%张%';


-- =============================================
-- Oracle 特有语法
-- =============================================
-- Oracle 的 ROWNUM（用于分页）
SELECT * FROM (
    SELECT
        id, name, email, age, city,
        ROWNUM as rn
    FROM customers
    ORDER BY id
)
WHERE rn BETWEEN 1 AND 5;

-- Oracle 的 TO_CHAR 函数（日期格式化）
SELECT
    id, product, amount,
    TO_CHAR(order_date, 'YYYY-MM-DD HH24:MI:SS') as formatted_date
FROM orders;

-- Oracle 的 NVL 函数（空值处理）
SELECT
    customer_id,
    product,
    NVL(status, 'UNKNOWN') as order_status
FROM orders;


-- =============================================
-- MySQL 特有语法
-- =============================================
-- MySQL 的 LIMIT 语法（分页）
SELECT * FROM customers
ORDER BY id
LIMIT 0, 5;  -- 从第0行开始，取5行

-- MySQL 的 DATE_FORMAT 函数
SELECT
    id, product, amount,
    DATE_FORMAT(order_date, '%Y-%m-%d %H:%i:%s') as formatted_date
FROM orders;

-- MySQL 的 IFNULL 函数
SELECT
    customer_id,
    product,
    IFNULL(status, 'UNKNOWN') as order_status
FROM orders;


-- =============================================
-- SQLite 特有语法
-- =============================================
-- SQLite 的 LIMIT 语法
SELECT * FROM customers
ORDER BY id
LIMIT 5;

-- SQLite 的日期函数
SELECT
    id, product, amount,
    DATE(order_date) as order_date,
    TIME(order_date) as order_time
FROM orders;

-- SQLite 的 COALESCE 函数
SELECT
    customer_id,
    product,
    COALESCE(status, 'UNKNOWN') as order_status
FROM orders;


-- =============================================
-- 6. 高级查询示例
-- =============================================
-- 窗口函数示例（PostgreSQL/Oracle/MySQL 8+）
-- 计算每个客户的订单金额排名
SELECT
    c.name as customer_name,
    o.product,
    o.amount,
    RANK() OVER (PARTITION BY c.name ORDER BY o.amount DESC) as amount_rank
FROM customers c
JOIN orders o ON c.id = o.customer_id;

-- 计算累计销售额
SELECT
    order_date,
    amount,
    SUM(amount) OVER (ORDER BY order_date) as cumulative_total
FROM orders
ORDER BY order_date;

-- =============================================
-- 7. 数据导出查询
-- =============================================
-- 查询结果可导出为 CSV
SELECT
    c.name as "客户姓名",
    c.email as "邮箱",
    o.product as "产品",
    o.amount as "金额",
    o.order_date as "订单日期"
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'completed';