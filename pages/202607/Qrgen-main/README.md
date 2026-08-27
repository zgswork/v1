# QRGen — QR Code Generator

```
  ● QRGen
  ─────────────────────────────────────────────────────────
  二维码生成器 / QR Code Generator / QRコード生成器
  한국어 / Español / Français — 6 languages supported
```

---

## 📦 Files

| File | Description |
|------|-------------|
| `QRGen.html` | **Web version** — open directly in any browser, no install needed |
| `qrgen_app.py` | **Desktop source** — Python source for the desktop app |
| `QRGen.exe` | **Windows app** — compiled desktop executable (see build below) |
| `README.md` | This file |

---

## ⚡ Quick Start

### 🌐 HTML Version (Recommended — Zero Install)

Simply double-click **`QRGen.html`** in your browser.

> Works in Chrome, Edge, Firefox, Safari. Requires internet only for Google Fonts (optional). QR generation is fully offline.

**Features:**
- Paste any text or URL → click Generate
- Custom foreground / background colors
- Choose QR size: 128 / 200 / 256 / 400 / 512 px
- Error correction: L / M / Q / H
- Download as PNG
- Copy image to clipboard
- Switch language in the top-right corner
- `Ctrl+Enter` shortcut to generate

---

### 🖥 Desktop App (Python)

#### Requirements

```bash
Python 3.8+
pip install qrcode[pil] pillow
```

#### Run

```bash
python qrgen_app.py
```

---

### 🔧 Build EXE (Windows)

```bash
# 1. Install dependencies
pip install qrcode[pil] pillow pyinstaller

# 2. Build (single file, no console window)
pyinstaller --onefile --windowed --name QRGen qrgen_app.py

# 3. Find your EXE in:
#    dist/QRGen.exe
```

#### Build on macOS (create .app)

```bash
pyinstaller --onefile --windowed --name QRGen qrgen_app.py
# Result: dist/QRGen (macOS app bundle)
```

#### Build on Linux

```bash
pyinstaller --onefile --name QRGen qrgen_app.py
# Result: dist/QRGen (Linux binary)
```

---

## 🌍 Supported Languages

| Code | Language |
|------|----------|
| 中文 | Chinese (Simplified) |
| EN | English |
| 日本語 | Japanese |
| 한국어 | Korean |
| ES | Spanish |
| FR | French |

---

## 🎨 Features

| Feature | HTML | Desktop |
|---------|------|---------|
| Generate QR code | ✅ | ✅ |
| Custom foreground color | ✅ | ✅ |
| Custom background color | ✅ | ✅ |
| Size options (128–512px) | ✅ | ✅ |
| Error correction L/M/Q/H | ✅ | ✅ |
| Download / Save PNG | ✅ | ✅ |
| Copy to clipboard | ✅ | ✅ |
| Multi-language UI | ✅ (6) | ✅ (6) |
| Works offline | ✅ | ✅ |
| No data sent to server | ✅ | ✅ |
| Keyboard shortcut | ✅ Ctrl+Enter | ✅ Ctrl+Enter |

---

## 🔒 Privacy

All QR code generation happens **100% locally** in your browser or on your machine.  
No text, URLs, or images are ever sent to any server.

---

## 📐 Error Correction Levels

| Level | Recovery | Best For |
|-------|----------|----------|
| **L** | 7% | Clean environments, small QR |
| **M** | 15% | General use (default) |
| **Q** | 25% | Slight damage possible |
| **H** | 30% | Printed materials, logos overlaid |

---

## 🛠 Tech Stack

- **HTML version**: Vanilla JS + [qrcode.js](https://github.com/davidshimjs/qrcodejs) + Google Fonts
- **Desktop version**: Python 3 + tkinter + [qrcode](https://github.com/lincolnloop/python-qrcode) + Pillow

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

```
QRGen v1.0.0  ·  Made with ♥  ·  Offline · Open Source
```
