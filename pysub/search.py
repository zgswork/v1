# -*- coding: utf-8 -*-
import os, sqlite3, jieba
from flask import Blueprint, request, jsonify, send_from_directory

bp = Blueprint("search", __name__, static_folder="static", static_url_path="/search/static")
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

@bp.route("/")
def index():#搜索主页（pages/search.html）"""
    return send_from_directory(os.path.join(PROJECT_ROOT, "pages"), "search.html")

@bp.route("/api/search", methods=["GET"])
def search():#搜索接口"""
    q = request.args.get("q", "")
    if not q: return jsonify([])    
    db_path = os.path.join(PROJECT_ROOT, "static", "data", "excel_search.db")# 获取数据库路径
    if not os.path.exists(db_path): return jsonify({"error": f"数据库文件不存在: {db_path}"}), 500
    try:
        words = [w.strip() for w in jieba.cut(q) if w.strip()]
        if not words: return jsonify([])
        and_query = " ".join(words)
        or_query = " OR ".join(words)
        phrase_query = f'"{q}"'
        prefix_query = " ".join([w + "*" for w in words])
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        sql = """
            SELECT r.* FROM fts_sentences f
            JOIN excel_rows r ON f.rowid = r.id
            WHERE f.content MATCH ?
            ORDER BY f.rank
        """
        rows = []
        for attempt in [and_query, or_query, phrase_query, prefix_query]:
            c.execute(sql, (attempt,))
            rows = c.fetchall()
            if rows: break
        if not rows:
            like_sql = """
                SELECT * FROM excel_rows 
                WHERE 标底内容 LIKE ? OR 备注 LIKE ?
            """
            like_param = f"%{q}%"
            c.execute(like_sql, (like_param, like_param))
            rows = c.fetchall()
        results = []
        for r in rows:
            item = dict(r)
            item["file"] = os.path.basename(item["filepath"])
            results.append(item)
        conn.close()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
