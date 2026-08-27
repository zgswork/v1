<p align="center">
  <a href="README_zh.md">🇨🇳 简体中文</a> · <strong>🇬🇧 English</strong>
</p>

# Tool Box 🐧

A browser-side toolset, pure frontend implementation, no backend required, ready to use out of the box.

## Features

- Pure frontend, all tools run locally in the browser
- No server needed, open directly with a browser
- Dark theme, responsive design
- Most tools have zero external dependencies

## Tools

| Tool | Description | Dependencies |
|------|-------------|--------------|
| QR Code Generator | Text / URL to QR code, supports color, gradient, style customization | qr-code-styling |
| Text Statistics | Word / character / line / paragraph / reading time real-time stats | None |
| Barcode Generator | Code128 / EAN-13 / EAN-8 / UPC-A, supports PNG download | None |
| DOF Calculator | Depth of field / hyperfocal distance / circle of confusion, supports multiple sensor formats | None |
| Photo Metadata Viewer | EXIF / IPTC / XMP metadata parsing, GPS location, JSON export | exifr |
| Chinese Converter | Simplified ↔ Traditional Chinese real-time conversion, supports light/dark theme toggle | OpenCC |
| Watermark Tool | Text/image watermark, batch processing, template presets, ZIP download | JSZip |
| Fancy Text Converter | Plain text → mathematical bold/italic/script/fraktur/double-struck/circled etc. 9 styles | None |
| Markdown Preview | Live rendering, syntax highlighting, GFM tables/task lists/code blocks | marked + highlight.js |

## Usage

Open `index.html` directly in a browser, or deploy to any static server:

- **GitHub Pages**: Settings → Pages → select branch
- **Vercel**: Import repository, auto-detection
- **Netlify**: Drag and drop folder upload

## Project Structure

```
Tool_Box/
├── index.html          # Home page
├── QRCode/             # QR Code Generator
├── text-stats/         # Text Statistics
├── barcode/            # Barcode Generator
├── dof-calculator/     # DOF Calculator
├── exif-viewer/        # Photo Metadata Viewer
├── zh-convert/         # Chinese Converter
├── markdown-preview/   # Markdown Preview
├── watermark/          # Watermark Tool
└── fancy-text/         # Fancy Text Converter
```

### Development Notes
Part of the code organization, copywriting, and structural optimization of this project were AI-assisted. The overall functional design, logic debugging, and iterative improvements were independently completed by the author.

### Support
If this toolbox is useful to you, please consider starring the repository. Your support is my greatest motivation for continuous updates and new tools!

## License

MIT
