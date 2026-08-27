<p align="center">
  <img src="https://img.shields.io/badge/tools-500-blue?style=flat-square" alt="500 tools">
  <img src="https://img.shields.io/badge/tests-500%2F500-green?style=flat-square" alt="All tests passing">
  <img src="https://img.shields.io/badge/license-MIT-white?style=flat-square" alt="MIT">
  <img src="https://img.shields.io/badge/dependencies-0-orange?style=flat-square" alt="Zero dependencies">
</p>

<h1 align="center">🧰 Dev Vault</h1>

<p align="center">500 browser-based developer tools · All offline · Zero dependencies · One HTML file each</p>

<p align="center"><a href="README.zh.md">🌐 中文</a></p>

---

## 📖 About

**Dev Vault** is a collection of **500 standalone HTML tools** covering CSS, JavaScript, security, networking, design, data, DevOps, and more.

Every tool is a single HTML file — open it in a browser and it just works. No build step, no npm install, no signup, no tracking.

- 🌐 **Open the portal** — open `index.html` to browse all tools by category
- 📁 **Browse files** — `tools/<category>/<name>.html`
- 🧪 **Run tests** — `node tests/run.mjs`

## 📂 Categories

| Category | Count | Examples |
|----------|-------|---------|
| JavaScript | 132 | Web APIs, patterns, visualizers, engine internals |
| Code | 109 | JSON, regex, JWT, hash, cron, docker, git |
| CSS | 63 | Layout, animation, painting, responsive, container queries |
| Design | 52 | Color, typography, SVG, icon, image, CSS generators |
| Data | 26 | npm, GitHub, pypi, crate, SSL, license |
| Converter | 20 | JSON↔TOML↔YAML↔XML, temperature, IBAN, date |
| Network | 18 | DNS, IPv4/6, HTTP, TLS, WebSocket, MAC |
| Security | 17 | CSP, CORS, JWT, SRI, cookie inspector |
| Crypto | 10 | Hash, HMAC, RSA, Bcrypt, BIP39, OTP |
| Text | 8 | Case convert, slugify, NATO, binary, Unicode |
| Image | 7 | Crop, filter, watermark, Base64, sprite sheet |
| DevOps | 6 | Docker, K8s, Terraform, Grafana |
| Writing | 9 | Markdown, word count, reading time, title score |
| AI | 5 | LLM pricing, prompt cost, model picker |
| Math | 4 | Evaluator, benchmark, geo distance, ETA |
| More... | 14 | Color, API, device, media, SEO, perf, reference |

[→ Browse all 500 tools](https://gokuscraper.github.io/dev-vault/)

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/gokuscraper/dev-vault.git

# Open the portal (or open any tool file directly)
open index.html

# Run tests (requires Node.js + Playwright)
npm install
node tests/run.mjs
```

## 💡 Philosophy

- **Single HTML file** — view source, inspect, learn
- **Fully offline** — after first load, everything is local
- **Zero telemetry** — no analytics, no tracking, no ads
- **Dark theme** — defaults to dark mode

---

## 🙏 Acknowledgments

Some content is sourced from [yurukusa/dev-toolkit](https://github.com/yurukusa/dev-toolkit). Design references [CorentinTh/it-tools](https://github.com/CorentinTh/it-tools).

---

<p align="center">MIT License · Built with ❤️</p>
