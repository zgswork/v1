"""
QRGen — QR Code Generator Desktop App
Multi-language | Customizable | Export PNG/SVG
Requires: pip install qrcode[pil] pillow
Compile:  pyinstaller --onefile --windowed --name QRGen qrgen_app.py
"""

import tkinter as tk
from tkinter import ttk, colorchooser, messagebox, filedialog
import io, sys, os

try:
    import qrcode
    from PIL import Image, ImageTk, ImageDraw
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "qrcode[pil]", "pillow"])
    import qrcode
    from PIL import Image, ImageTk, ImageDraw

# ─── Translations ────────────────────────────────────────────────────────────
I18N = {
    "zh": {
        "title": "QRGen — 二维码生成器",
        "content_label": "输入内容（文字或链接）",
        "placeholder": "https://example.com 或任意文字...",
        "size_label": "尺寸",
        "ec_label": "纠错等级",
        "fg_label": "前景色",
        "bg_label": "背景色",
        "gen_btn": "⬡ 生成二维码",
        "save_btn": "↓ 保存图片",
        "copy_btn": "⎘ 复制",
        "preview_label": "预览",
        "chars": "字符数",
        "msg_empty": "请输入内容！",
        "msg_saved": "已保存至：",
        "msg_no_qr": "请先生成二维码！",
        "save_dialog": "保存二维码",
        "lang_label": "语言 / Language",
        "ec_L": "L — 低 (7%)",
        "ec_M": "M — 中 (15%)",
        "ec_Q": "Q — 高 (25%)",
        "ec_H": "H — 最高 (30%)",
    },
    "en": {
        "title": "QRGen — QR Code Generator",
        "content_label": "Enter text or URL",
        "placeholder": "https://example.com or any text...",
        "size_label": "Size",
        "ec_label": "Error Correction",
        "fg_label": "Foreground",
        "bg_label": "Background",
        "gen_btn": "⬡ Generate QR Code",
        "save_btn": "↓ Save Image",
        "copy_btn": "⎘ Copy",
        "preview_label": "Preview",
        "chars": "Chars",
        "msg_empty": "Please enter some content!",
        "msg_saved": "Saved to: ",
        "msg_no_qr": "Generate a QR code first!",
        "save_dialog": "Save QR Code",
        "lang_label": "Language",
        "ec_L": "L — Low (7%)",
        "ec_M": "M — Medium (15%)",
        "ec_Q": "Q — Quartile (25%)",
        "ec_H": "H — High (30%)",
    },
    "ja": {
        "title": "QRGen — QRコード生成器",
        "content_label": "テキストまたはURLを入力",
        "placeholder": "https://example.com またはテキスト...",
        "size_label": "サイズ",
        "ec_label": "誤り訂正",
        "fg_label": "前景色",
        "bg_label": "背景色",
        "gen_btn": "⬡ QRコードを生成",
        "save_btn": "↓ 画像を保存",
        "copy_btn": "⎘ コピー",
        "preview_label": "プレビュー",
        "chars": "文字数",
        "msg_empty": "コンテンツを入力してください！",
        "msg_saved": "保存先：",
        "msg_no_qr": "先にQRコードを生成してください！",
        "save_dialog": "QRコードを保存",
        "lang_label": "言語",
        "ec_L": "L — 低 (7%)",
        "ec_M": "M — 中 (15%)",
        "ec_Q": "Q — 高 (25%)",
        "ec_H": "H — 最高 (30%)",
    },
    "ko": {
        "title": "QRGen — QR 코드 생성기",
        "content_label": "텍스트 또는 URL 입력",
        "placeholder": "https://example.com 또는 텍스트...",
        "size_label": "크기",
        "ec_label": "오류 정정",
        "fg_label": "전경색",
        "bg_label": "배경색",
        "gen_btn": "⬡ QR 코드 생성",
        "save_btn": "↓ 이미지 저장",
        "copy_btn": "⎘ 복사",
        "preview_label": "미리보기",
        "chars": "글자 수",
        "msg_empty": "내용을 입력해 주세요!",
        "msg_saved": "저장 위치: ",
        "msg_no_qr": "먼저 QR 코드를 생성하세요!",
        "save_dialog": "QR 코드 저장",
        "lang_label": "언어",
        "ec_L": "L — 낮음 (7%)",
        "ec_M": "M — 보통 (15%)",
        "ec_Q": "Q — 높음 (25%)",
        "ec_H": "H — 최고 (30%)",
    },
    "es": {
        "title": "QRGen — Generador de Códigos QR",
        "content_label": "Introduce texto o URL",
        "placeholder": "https://example.com o cualquier texto...",
        "size_label": "Tamaño",
        "ec_label": "Corrección de error",
        "fg_label": "Primer plano",
        "bg_label": "Fondo",
        "gen_btn": "⬡ Generar QR Code",
        "save_btn": "↓ Guardar imagen",
        "copy_btn": "⎘ Copiar",
        "preview_label": "Vista previa",
        "chars": "Caracteres",
        "msg_empty": "¡Por favor ingresa contenido!",
        "msg_saved": "Guardado en: ",
        "msg_no_qr": "¡Genera un código QR primero!",
        "save_dialog": "Guardar código QR",
        "lang_label": "Idioma",
        "ec_L": "L — Bajo (7%)",
        "ec_M": "M — Medio (15%)",
        "ec_Q": "Q — Alto (25%)",
        "ec_H": "H — Máximo (30%)",
    },
    "fr": {
        "title": "QRGen — Générateur de QR Code",
        "content_label": "Entrez du texte ou une URL",
        "placeholder": "https://example.com ou du texte...",
        "size_label": "Taille",
        "ec_label": "Correction d'erreur",
        "fg_label": "Premier plan",
        "bg_label": "Arrière-plan",
        "gen_btn": "⬡ Générer le QR Code",
        "save_btn": "↓ Enregistrer",
        "copy_btn": "⎘ Copier",
        "preview_label": "Aperçu",
        "chars": "Caractères",
        "msg_empty": "Veuillez saisir du contenu !",
        "msg_saved": "Enregistré dans : ",
        "msg_no_qr": "Générez d'abord un QR code !",
        "save_dialog": "Enregistrer le QR Code",
        "lang_label": "Langue",
        "ec_L": "L — Faible (7%)",
        "ec_M": "M — Moyen (15%)",
        "ec_Q": "Q — Élevé (25%)",
        "ec_H": "H — Maximum (30%)",
    },
}

EC_MAP = {
    "L": qrcode.constants.ERROR_CORRECT_L,
    "M": qrcode.constants.ERROR_CORRECT_M,
    "Q": qrcode.constants.ERROR_CORRECT_Q,
    "H": qrcode.constants.ERROR_CORRECT_H,
}

# ─── Color palette ───────────────────────────────────────────────────────────
C = {
    "bg":       "#0a0a0a",
    "surface":  "#141414",
    "surface2": "#1e1e1e",
    "border":   "#2a2a2a",
    "accent":   "#e8ff47",
    "accent2":  "#ff6b35",
    "text":     "#f0f0f0",
    "text2":    "#888888",
    "text3":    "#555555",
}


class QRGenApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.lang = "zh"
        self.fg_color = "#000000"
        self.bg_color = "#ffffff"
        self.qr_image = None
        self.photo = None
        self._build_ui()
        self.apply_lang()
        self.update_char_count()

    # ── Build UI ──────────────────────────────────────────────────────────────
    def _build_ui(self):
        t = I18N[self.lang]
        self.title(t["title"])
        self.configure(bg=C["bg"])
        self.resizable(True, True)
        self.minsize(760, 560)
        self.geometry("860x620")

        # ── Top bar ──
        topbar = tk.Frame(self, bg=C["surface"], height=50)
        topbar.pack(fill="x", side="top")
        topbar.pack_propagate(False)

        logo_frame = tk.Frame(topbar, bg=C["surface"])
        logo_frame.pack(side="left", padx=20, pady=10)

        self.dot = tk.Canvas(logo_frame, width=10, height=10, bg=C["surface"],
                              highlightthickness=0)
        self.dot.create_oval(1,1,9,9, fill=C["accent"], outline="")
        self.dot.pack(side="left", padx=(0,8))

        self.logo_lbl = tk.Label(logo_frame, text="QRGen",
                                  bg=C["surface"], fg=C["text"],
                                  font=("Courier New", 14, "bold"))
        self.logo_lbl.pack(side="left")

        # Language selector
        lang_frame = tk.Frame(topbar, bg=C["surface"])
        lang_frame.pack(side="right", padx=20, pady=10)

        self.lang_label_w = tk.Label(lang_frame, text="Language",
                                      bg=C["surface"], fg=C["text3"],
                                      font=("Courier New", 9))
        self.lang_label_w.pack(side="left", padx=(0, 8))

        langs = [("中文","zh"),("EN","en"),("日本語","ja"),
                 ("한국어","ko"),("ES","es"),("FR","fr")]
        self.lang_buttons = {}
        for label, code in langs:
            btn = tk.Button(lang_frame, text=label, command=lambda c=code: self.set_lang(c),
                             bg=C["surface2"], fg=C["text2"],
                             activebackground=C["accent"], activeforeground="#000",
                             font=("Courier New", 9), relief="flat",
                             padx=8, pady=3, cursor="hand2",
                             bd=1, highlightbackground=C["border"])
            btn.pack(side="left", padx=2)
            self.lang_buttons[code] = btn

        # ── Separator ──
        sep = tk.Frame(self, bg=C["border"], height=1)
        sep.pack(fill="x")

        # ── Main body ──
        body = tk.Frame(self, bg=C["bg"])
        body.pack(fill="both", expand=True, padx=24, pady=20)
        body.columnconfigure(0, weight=3)
        body.columnconfigure(1, weight=2)
        body.rowconfigure(0, weight=1)

        # ── Left panel ──
        left = tk.Frame(body, bg=C["surface"], bd=1, relief="flat",
                         highlightbackground=C["border"], highlightthickness=1)
        left.grid(row=0, column=0, sticky="nsew", padx=(0,12))
        left.columnconfigure(0, weight=1)

        # Content label
        self.content_lbl = tk.Label(left, text="", bg=C["surface"], fg=C["text2"],
                                     font=("Courier New", 9, "bold"), anchor="w")
        self.content_lbl.pack(fill="x", padx=16, pady=(16,4))

        # Text area
        txt_frame = tk.Frame(left, bg=C["border"])
        txt_frame.pack(fill="both", padx=16, pady=(0,12))

        self.text_input = tk.Text(txt_frame, height=6, wrap="word",
                                   bg=C["bg"], fg=C["text"],
                                   insertbackground=C["accent"],
                                   font=("Courier New", 11),
                                   relief="flat", padx=10, pady=8,
                                   selectbackground=C["accent"],
                                   selectforeground="#000",
                                   bd=0)
        self.text_input.pack(fill="both", expand=True, padx=1, pady=1)
        self.text_input.bind("<KeyRelease>", lambda e: self.update_char_count())

        # Options grid
        opts = tk.Frame(left, bg=C["surface"])
        opts.pack(fill="x", padx=16, pady=(0,12))
        opts.columnconfigure(0, weight=1)
        opts.columnconfigure(1, weight=1)

        # Size
        self.size_lbl = tk.Label(opts, text="", bg=C["surface"], fg=C["text2"],
                                  font=("Courier New", 9, "bold"), anchor="w")
        self.size_lbl.grid(row=0, column=0, sticky="w", pady=(0,4))

        sizes = ["128×128","200×200","256×256","400×400","512×512"]
        self.size_var = tk.StringVar(value="256×256")
        self.size_combo = ttk.Combobox(opts, textvariable=self.size_var,
                                        values=sizes, state="readonly", width=14)
        self.size_combo.grid(row=1, column=0, sticky="ew", padx=(0,8))

        # EC Level
        self.ec_lbl = tk.Label(opts, text="", bg=C["surface"], fg=C["text2"],
                                font=("Courier New", 9, "bold"), anchor="w")
        self.ec_lbl.grid(row=0, column=1, sticky="w", pady=(0,4))

        self.ec_var = tk.StringVar(value="M")
        self.ec_combo = ttk.Combobox(opts, textvariable=self.ec_var,
                                      values=["L","M","Q","H"],
                                      state="readonly", width=14)
        self.ec_combo.grid(row=1, column=1, sticky="ew")

        # Colors
        color_frame = tk.Frame(left, bg=C["surface"])
        color_frame.pack(fill="x", padx=16, pady=(0,16))
        color_frame.columnconfigure(0, weight=1)
        color_frame.columnconfigure(1, weight=1)

        self.fg_lbl = tk.Label(color_frame, text="", bg=C["surface"], fg=C["text2"],
                                font=("Courier New", 9, "bold"), anchor="w")
        self.fg_lbl.grid(row=0, column=0, sticky="w", pady=(0,4))

        self.fg_btn = tk.Button(color_frame, text="  ██  #000000  ",
                                 command=self.pick_fg,
                                 bg=C["surface2"], fg=C["text"],
                                 font=("Courier New", 9), relief="flat",
                                 bd=1, highlightbackground=C["border"],
                                 padx=6, pady=5, cursor="hand2")
        self.fg_btn.grid(row=1, column=0, sticky="ew", padx=(0,8))

        self.bg_lbl = tk.Label(color_frame, text="", bg=C["surface"], fg=C["text2"],
                                font=("Courier New", 9, "bold"), anchor="w")
        self.bg_lbl.grid(row=0, column=1, sticky="w", pady=(0,4))

        self.bg_btn = tk.Button(color_frame, text="  ██  #ffffff  ",
                                 command=self.pick_bg,
                                 bg=C["surface2"], fg=C["text"],
                                 font=("Courier New", 9), relief="flat",
                                 bd=1, highlightbackground=C["border"],
                                 padx=6, pady=5, cursor="hand2")
        self.bg_btn.grid(row=1, column=1, sticky="ew")

        # Generate button
        self.gen_btn = tk.Button(left, text="", command=self.generate_qr,
                                  bg=C["accent"], fg="#000000",
                                  font=("Courier New", 12, "bold"),
                                  relief="flat", padx=20, pady=12,
                                  cursor="hand2", bd=0,
                                  activebackground="#c8df20",
                                  activeforeground="#000")
        self.gen_btn.pack(fill="x", padx=16, pady=(0,16))
        self.bind("<Control-Return>", lambda e: self.generate_qr())

        # Char count strip
        char_strip = tk.Frame(left, bg=C["border"], height=1)
        char_strip.pack(fill="x", padx=16)

        info_bar = tk.Frame(left, bg=C["surface"])
        info_bar.pack(fill="x", padx=16, pady=8)

        self.chars_lbl_prefix = tk.Label(info_bar, text="", bg=C["surface"],
                                          fg=C["text3"], font=("Courier New", 9))
        self.chars_lbl_prefix.pack(side="left")
        self.char_count_lbl = tk.Label(info_bar, text="0", bg=C["surface"],
                                        fg=C["accent"], font=("Courier New", 9, "bold"))
        self.char_count_lbl.pack(side="left", padx=(4,0))

        # Keyboard shortcut hint
        shortcut = tk.Label(info_bar, text="Ctrl+Enter", bg=C["surface"],
                             fg=C["text3"], font=("Courier New", 8))
        shortcut.pack(side="right")

        # ── Right panel ──
        right = tk.Frame(body, bg=C["surface"], bd=1, relief="flat",
                          highlightbackground=C["border"], highlightthickness=1)
        right.grid(row=0, column=1, sticky="nsew")
        right.rowconfigure(1, weight=1)
        right.columnconfigure(0, weight=1)

        # Preview label
        self.preview_lbl = tk.Label(right, text="", bg=C["surface"],
                                     fg=C["text2"], font=("Courier New", 9, "bold"),
                                     anchor="w")
        self.preview_lbl.pack(fill="x", padx=16, pady=(14,4))

        sep2 = tk.Frame(right, bg=C["border"], height=1)
        sep2.pack(fill="x")

        # Canvas for QR
        self.canvas = tk.Canvas(right, bg=C["bg"], highlightthickness=0,
                                  width=260, height=260)
        self.canvas.pack(fill="both", expand=True, padx=16, pady=16)
        self._draw_placeholder()

        # Action buttons
        sep3 = tk.Frame(right, bg=C["border"], height=1)
        sep3.pack(fill="x")

        btn_row = tk.Frame(right, bg=C["surface"])
        btn_row.pack(fill="x", padx=12, pady=12)
        btn_row.columnconfigure(0, weight=1)
        btn_row.columnconfigure(1, weight=1)

        self.save_btn_w = tk.Button(btn_row, text="", command=self.save_qr,
                                     bg=C["surface2"], fg=C["text"],
                                     font=("Courier New", 9), relief="flat",
                                     padx=10, pady=8, cursor="hand2",
                                     bd=1, highlightbackground=C["border"],
                                     activebackground=C["border"])
        self.save_btn_w.grid(row=0, column=0, sticky="ew", padx=(0,6))

        self.copy_btn_w = tk.Button(btn_row, text="", command=self.copy_qr,
                                     bg=C["surface2"], fg=C["accent2"],
                                     font=("Courier New", 9), relief="flat",
                                     padx=10, pady=8, cursor="hand2",
                                     bd=1, highlightbackground=C["accent2"],
                                     activebackground=C["border"])
        self.copy_btn_w.grid(row=0, column=1, sticky="ew")

        # ── Style ttk ──
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TCombobox",
                         fieldbackground=C["bg"],
                         background=C["surface2"],
                         foreground=C["text"],
                         bordercolor=C["border"],
                         arrowcolor=C["text2"],
                         selectbackground=C["accent"],
                         selectforeground="#000",
                         font=("Courier New", 10))
        style.map("TCombobox", fieldbackground=[("readonly", C["bg"])],
                  foreground=[("readonly", C["text"])])

    def _draw_placeholder(self):
        self.canvas.delete("all")
        w = self.canvas.winfo_reqwidth()
        h = self.canvas.winfo_reqheight()
        cx, cy = w//2, h//2
        sz = 80
        self.canvas.create_rectangle(cx-sz, cy-sz, cx+sz, cy+sz,
                                      outline=C["border"], width=2, dash=(6,4))
        # Accent corners
        cl = 12
        for dx,dy in [(-1,-1),(1,-1),(1,1),(-1,1)]:
            x = cx + dx*sz; y = cy + dy*sz
            if dx==-1 and dy==-1:
                self.canvas.create_line(x,y+cl,x,y, fill=C["accent"],width=2)
                self.canvas.create_line(x,y,x+cl,y, fill=C["accent"],width=2)
            elif dx==1 and dy==-1:
                self.canvas.create_line(x-cl,y,x,y, fill=C["accent"],width=2)
                self.canvas.create_line(x,y,x,y+cl, fill=C["accent"],width=2)
            elif dx==1 and dy==1:
                self.canvas.create_line(x,y-cl,x,y, fill=C["accent"],width=2)
                self.canvas.create_line(x,y,x-cl,y, fill=C["accent"],width=2)
            else:
                self.canvas.create_line(x+cl,y,x,y, fill=C["accent"],width=2)
                self.canvas.create_line(x,y,x,y-cl, fill=C["accent"],width=2)
        self.canvas.create_text(cx, cy, text="⬡",
                                 fill=C["text3"], font=("Courier New",24))

    # ── Language ──────────────────────────────────────────────────────────────
    def set_lang(self, lang):
        self.lang = lang
        self.apply_lang()

    def apply_lang(self):
        t = I18N[self.lang]
        self.title(t["title"])
        self.content_lbl.config(text=t["content_label"])
        self.size_lbl.config(text=t["size_label"])
        self.ec_lbl.config(text=t["ec_label"])
        self.fg_lbl.config(text=t["fg_label"])
        self.bg_lbl.config(text=t["bg_label"])
        self.gen_btn.config(text=t["gen_btn"])
        self.save_btn_w.config(text=t["save_btn"])
        self.copy_btn_w.config(text=t["copy_btn"])
        self.preview_lbl.config(text=t["preview_label"])
        self.chars_lbl_prefix.config(text=t["chars"] + ":")
        self.lang_label_w.config(text=t["lang_label"])
        # Update EC dropdown values
        ec_vals = [t["ec_L"], t["ec_M"], t["ec_Q"], t["ec_H"]]
        cur_ec = self.ec_var.get()
        self.ec_combo.config(values=ec_vals)
        idx = {"L":0,"M":1,"Q":2,"H":3}.get(cur_ec,1)
        self.ec_combo.current(idx)
        # Highlight active lang btn
        for code, btn in self.lang_buttons.items():
            if code == self.lang:
                btn.config(bg=C["accent"], fg="#000", font=("Courier New",9,"bold"))
            else:
                btn.config(bg=C["surface2"], fg=C["text2"], font=("Courier New",9,"normal"))

    # ── Colors ────────────────────────────────────────────────────────────────
    def pick_fg(self):
        color = colorchooser.askcolor(self.fg_color, title="Foreground color")[1]
        if color:
            self.fg_color = color
            self.fg_btn.config(text=f"  ██  {color}  ")

    def pick_bg(self):
        color = colorchooser.askcolor(self.bg_color, title="Background color")[1]
        if color:
            self.bg_color = color
            self.bg_btn.config(text=f"  ██  {color}  ")

    # ── Generate ──────────────────────────────────────────────────────────────
    def update_char_count(self):
        txt = self.text_input.get("1.0","end-1c")
        self.char_count_lbl.config(text=str(len(txt)))

    def generate_qr(self):
        t = I18N[self.lang]
        txt = self.text_input.get("1.0","end-1c").strip()
        if not txt:
            messagebox.showwarning("QRGen", t["msg_empty"])
            return

        size_str = self.size_var.get().split("×")[0]
        size = int(size_str)

        ec_display = self.ec_var.get()
        ec_key = ec_display[0] if ec_display else "M"
        ec = EC_MAP.get(ec_key, qrcode.constants.ERROR_CORRECT_M)

        qr = qrcode.QRCode(
            version=None,
            error_correction=ec,
            box_size=max(4, size//50),
            border=4,
        )
        qr.add_data(txt)
        qr.make(fit=True)
        self.qr_image = qr.make_image(
            fill_color=self.fg_color,
            back_color=self.bg_color
        ).convert("RGB")
        self.qr_image = self.qr_image.resize((size, size), Image.LANCZOS)

        # Display
        disp_size = min(240, size)
        disp = self.qr_image.resize((disp_size, disp_size), Image.LANCZOS)
        self.photo = ImageTk.PhotoImage(disp)

        cw = self.canvas.winfo_width() or 260
        ch = self.canvas.winfo_height() or 260
        self.canvas.delete("all")
        self.canvas.create_image(cw//2, ch//2, image=self.photo, anchor="center")

    # ── Save ──────────────────────────────────────────────────────────────────
    def save_qr(self):
        t = I18N[self.lang]
        if self.qr_image is None:
            messagebox.showwarning("QRGen", t["msg_no_qr"]); return
        path = filedialog.asksaveasfilename(
            defaultextension=".png",
            filetypes=[("PNG Image","*.png"),("JPEG Image","*.jpg"),("All files","*.*")],
            title=t["save_dialog"],
            initialfile="qrcode.png"
        )
        if path:
            self.qr_image.save(path)
            messagebox.showinfo("QRGen", t["msg_saved"] + os.path.basename(path))

    def copy_qr(self):
        t = I18N[self.lang]
        if self.qr_image is None:
            messagebox.showwarning("QRGen", t["msg_no_qr"]); return
        try:
            import subprocess, tempfile
            tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
            self.qr_image.save(tmp.name)
            tmp.close()
            if sys.platform == "darwin":
                subprocess.run(["osascript","-e",
                    f'set the clipboard to (read (POSIX file "{tmp.name}") as JPEG picture)'])
            elif sys.platform == "win32":
                import win32clipboard, win32con
                from io import BytesIO
                buf = BytesIO()
                self.qr_image.save(buf, "BMP")
                data = buf.getvalue()[14:]
                win32clipboard.OpenClipboard()
                win32clipboard.EmptyClipboard()
                win32clipboard.SetClipboardData(win32con.CF_DIB, data)
                win32clipboard.CloseClipboard()
            else:
                subprocess.run(["xclip","-selection","clipboard","-t","image/png",tmp.name])
        except Exception:
            self.save_qr()


if __name__ == "__main__":
    app = QRGenApp()
    app.mainloop()
