<p align="center">
  <img src="https://img.shields.io/badge/工具-500-blue?style=flat-square" alt="500 个工具">
  <img src="https://img.shields.io/badge/测试-500%2F500-green?style=flat-square" alt="全部测试通过">
  <img src="https://img.shields.io/badge/许可证-MIT-white?style=flat-square" alt="MIT">
  <img src="https://img.shields.io/badge/依赖-0-orange?style=flat-square" alt="零依赖">
</p>

<h1 align="center">🧰 Dev Vault</h1>

<p align="center">500 个浏览器端开发工具 · 全离线 · 零依赖 · 每个工具一个 HTML 文件</p>

<p align="center"><a href="README.md">🌐 English</a></p>

---

## 📖 简介

**Dev Vault** 是一个包含 **500 个独立 HTML 工具**的开发工具合集，涵盖 CSS、JavaScript、安全、网络、设计、数据处理、DevOps 等领域。

每个工具都是一个独立的 HTML 文件——在浏览器打开就能用。不需要构建步骤、不需要 npm 安装、无需注册、无任何追踪。

- 🌐 **浏览门户** — 打开 `index.html` 按分类浏览所有工具
- 📁 **直接打开** — `tools/<分类>/<工具名>.html`
- 🧪 **运行测试** — `node tests/run.mjs`

## 📂 分类概览

| 分类 | 数量 | 示例 |
|------|------|------|
| JavaScript | 132 | Web API、设计模式、可视化工具、引擎内部 |
| 编码 | 109 | JSON、正则、JWT、哈希、Cron、Docker、Git |
| CSS | 63 | 布局、动画、绘制、响应式、容器查询、滚动 |
| 设计 | 52 | 颜色、字体、SVG、图标、图片、CSS 生成器 |
| 数据 | 26 | npm、GitHub、PyPI、crate、证书、SSL |
| 转换工具 | 20 | JSON↔TOML↔YAML↔XML、温度、IBAN、日期 |
| 网络 | 18 | DNS、IPv4/6、HTTP、TLS、WebSocket、MAC |
| 安全 | 17 | CSP、CORS、JWT、SRI、Cookie 检查 |
| 加密 | 10 | 哈希、HMAC、RSA、Bcrypt、BIP39、OTP |
| 文本 | 8 | 大小写转换、slugify、NATO、二进制、Unicode |
| 图片 | 7 | 裁剪、滤镜、水印、Base64、雪碧图 |
| DevOps | 6 | Docker、K8s、Terraform、Grafana |
| 写作 | 9 | Markdown、字数统计、阅读时间、标题评分 |
| AI | 5 | LLM 价格、提示词成本、模型选择 |
| 数学 | 4 | 计算器、基准测试、地理距离、ETA |
| 更多... | 14 | 颜色、API、设备、媒体、SEO、性能、参考 |

[→ 浏览全部 500 个工具](https://gokuscraper.github.io/dev-vault/)

## 🚀 快速开始

```bash
# 克隆仓库
git clone https://github.com/gokuscraper/dev-vault.git

# 打开门户（或直接打开任意工具文件）
open index.html

# 运行测试（需 Node.js + Playwright）
npm install
node tests/run.mjs
```

## 💡 设计理念

- **单个 HTML 文件** — 查看源码，学习原理
- **完全离线** — 首次加载后，一切都在本地
- **零追踪** — 无分析、无追踪、无广告
- **深色主题** — 默认深色模式

---

## 🙏 致谢

部分内容来源于 [yurukusa/dev-toolkit](https://github.com/yurukusa/dev-toolkit)。设计参考了 [CorentinTh/it-tools](https://github.com/CorentinTh/it-tools)。

---

<p align="center">MIT 许可证 · 用 ❤️ 打造</p>
