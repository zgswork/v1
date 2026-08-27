import os, sqlite3, jieba,datetime,random,string
import pandas as pd

DEFAULT_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_DIR = input(f"请输入要扫描的Excel文件目录(默认：{DEFAULT_DIR}):").strip()
if not EXCEL_DIR:EXCEL_DIR = DEFAULT_DIR
today = datetime.datetime.now().strftime("%Y%m%d")
random_str = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
DB_PATH = os.path.join(EXCEL_DIR, f"ExcelToDb_{today}_{random_str.upper()}.db")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS excel_rows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filepath TEXT,
            sheet TEXT,
            row_index INTEGER,
            序号 TEXT,
            产品型号 TEXT,
            封装方式 TEXT,
            标底内容 TEXT,
            资料类型 TEXT,
            信息来源 TEXT,
            登记日期 TEXT,
            收集人姓名 TEXT,
            备注 TEXT
        )
    """)
    c.execute("CREATE VIRTUAL TABLE IF NOT EXISTS fts_sentences USING fts5(content,content_rowid=id)")
    conn.commit()
    conn.close()


def safe_str(val):
    if pd.isna(val):
        return ""
    return str(val).strip()


def index_excel_files():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM excel_rows")
    c.execute("DELETE FROM fts_sentences")

    for root, dirs, files in os.walk(EXCEL_DIR):
        for file in files:
            if file.endswith((".xlsx", ".xls")):
                filepath = os.path.join(root, file)
                print(f"索引 {filepath}...")
                try:
                    xl = pd.ExcelFile(filepath)
                    for sheet_name in xl.sheet_names:
                        df = xl.parse(sheet_name, header=None, dtype=str).fillna("")
                        for row_idx, row in df.iterrows():
                            if row.isnull().all():
                                continue
                            col_a = safe_str(row[0])
                            col_b = safe_str(row[1])
                            col_c = safe_str(row[2])
                            col_d = safe_str(row[3])
                            col_e = safe_str(row[4])
                            col_f = safe_str(row[5])
                            col_g = safe_str(row[6])
                            col_h = safe_str(row[7])
                            col_i = safe_str(row[8]) if len(row) > 8 else ""

                            c.execute(
                                "INSERT INTO excel_rows (filepath, sheet, row_index,序号, 产品型号, 封装方式, 标底内容, 资料类型, 信息来源, 登记日期, 收集人姓名, 备注) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                (filepath, sheet_name, row_idx + 1, col_a, col_b, col_c, col_d, col_e, col_f, col_g, col_h, col_i),
                            )
                            row_id = c.lastrowid

                            if col_d:
                                words = [w.strip() for w in jieba.cut(col_d) if w.strip()]
                                search_text = " ".join(words)
                            else:
                                search_text = ""
                            c.execute("INSERT INTO fts_sentences (rowid, content) VALUES (?, ?)", (row_id, search_text))
                    conn.commit()
                except Exception as e:
                    print(f"出错： 索引 {filepath}: {e}")
                    conn.rollback()
    conn.close()
    print("索引库生成完成！")


if __name__ == "__main__":
    init_db()
    index_excel_files()
