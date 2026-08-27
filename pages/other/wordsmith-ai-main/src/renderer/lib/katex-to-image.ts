/**
 * KaTeX → 高清 PNG DataURL（零闪烁）
 *
 * 方案：隐藏 DOM 渲染 KaTeX → 提取 HTML → 主进程离屏 BrowserWindow 截图 → 白转透明 → 智能裁剪 → DPI 注入
 * 全程不在可见区域渲染，彻底消除导出闪烁。
 */

import katex from 'katex'

/* ---------- 配置 ---------- */

export interface KatexImageOptions {
  /** 超采样倍数，默认 4 */
  scale?: number
  /** Word 目标字号（pt），默认 11 */
  targetPtSize?: number
  /** 裁剪后额外内边距（CSS 像素），默认 2 */
  cropPadding?: number
  /** 渲染基准字号（CSS px），默认 20 */
  baseFontSizePx?: number
}

/* ---------- 智能裁剪 ---------- */

/**
 * 扫描 canvas ImageData alpha 通道，裁剪到非透明像素的最小包围盒。
 */
function smartCrop(source: HTMLCanvasElement, padding: number): HTMLCanvasElement {
  const ctx = source.getContext('2d')!
  const { width, height } = source
  const data = ctx.getImageData(0, 0, width, height).data

  let minX = width, minY = height, maxX = 0, maxY = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < minX) {
    const empty = document.createElement('canvas')
    empty.width = 1; empty.height = 1
    return empty
  }

  const bx = Math.max(0, minX - padding)
  const by = Math.max(0, minY - padding)
  const bw = Math.min(width - bx, maxX - minX + 1 + padding * 2)
  const bh = Math.min(height - by, maxY - minY + 1 + padding * 2)

  const cropped = document.createElement('canvas')
  cropped.width = bw; cropped.height = bh
  cropped.getContext('2d')!.drawImage(source, bx, by, bw, bh, 0, 0, bw, bh)
  return cropped
}

/* ---------- PNG pHYs DPI 注入 ---------- */

const _crc32Table = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) crc = _crc32Table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** 在 PNG IHDR 后注入 pHYs chunk */
function injectPngDpi(dataUrl: string, dpi: number): string {
  const bin = atob(dataUrl.split(',')[1])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)

  const ihdrEnd = 33 // 8 签名 + 25 IHDR
  const ppm = Math.round(dpi / 0.0254)
  const phys = new Uint8Array(21)
  const v = new DataView(phys.buffer)
  v.setUint32(0, 9, false) // length
  phys[4] = 0x70; phys[5] = 0x48; phys[6] = 0x59; phys[7] = 0x73 // "pHYs"
  v.setUint32(8, ppm, false)  // X ppm
  v.setUint32(12, ppm, false) // Y ppm
  phys[16] = 1 // meter
  v.setUint32(17, crc32(phys.subarray(4, 17)), false)

  const result = new Uint8Array(bytes.length + 21)
  result.set(bytes.subarray(0, ihdrEnd), 0)
  result.set(phys, ihdrEnd)
  result.set(bytes.subarray(ihdrEnd), ihdrEnd + 21)

  let b64 = ''
  for (let i = 0; i < result.length; i += 8192) {
    b64 += String.fromCharCode(...result.subarray(i, i + 8192))
  }
  return 'data:image/png;base64,' + btoa(b64)
}

/* ---------- 工具 ---------- */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** 白色/近白色像素 → 透明 */
function whiteToTransparent(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const imageData = ctx.getImageData(0, 0, w, h)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) d[i + 3] = 0
  }
  ctx.putImageData(imageData, 0, 0)
}

/* ---------- KaTeX CSS 提取（含绝对字体 URL） ---------- */

let _cachedKatexCss: string | null = null

/**
 * 从 document.styleSheets 提取 KaTeX 相关 CSS 规则。
 * 浏览器已将字体 URL 解析为绝对路径，离屏窗口可直接加载。
 */
function extractKatexCss(): string {
  if (_cachedKatexCss) return _cachedKatexCss

  let rules = ''
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        const text = rule.cssText
        if (text.includes('KaTeX') || text.includes('katex')) {
          rules += text + '\n'
        }
      }
    } catch {
      // 跨域样式表无法访问，跳过
    }
  }

  _cachedKatexCss = rules
  return rules
}

/* ---------- 主函数 ---------- */

export async function katexToDataUrl(
  latex: string,
  options: KatexImageOptions = {},
): Promise<string> {
  const {
    scale = 4,
    targetPtSize = 11,
    cropPadding = 2,
    baseFontSizePx = 20,
  } = options

  // 优先使用离屏窗口方案（零闪烁），回退到旧方案
  if (window.wordsmith?.clipboard?.renderKatexOffscreen) {
    return offscreenApproach(latex, scale, targetPtSize, cropPadding, baseFontSizePx)
  }
  if (window.wordsmith?.clipboard?.captureAreaAsDataUrl) {
    return captureApproach(latex, scale, targetPtSize, cropPadding, baseFontSizePx)
  }
  return svgFallback(latex, scale, targetPtSize, cropPadding, baseFontSizePx)
}

/**
 * 离屏窗口方案（零闪烁）：
 * 1. 在隐藏 DOM 中渲染 KaTeX 获取 innerHTML
 * 2. 提取页面中 KaTeX CSS（含绝对字体 URL）
 * 3. 发送到主进程离屏 BrowserWindow 渲染 + capturePage
 * 4. 返回后做白转透明 + 智能裁剪 + DPI 注入
 */
async function offscreenApproach(
  latex: string,
  scale: number,
  targetPtSize: number,
  cropPadding: number,
  baseFontSizePx: number,
): Promise<string> {
  const renderFontSize = baseFontSizePx * scale
  const dpr = window.devicePixelRatio || 1
  const padding = Math.round(renderFontSize * 0.3)

  // 在隐藏容器中渲染 KaTeX，获取 HTML
  const container = document.createElement('div')
  container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;'
  document.body.appendChild(container)

  try {
    katex.render(latex, container, { displayMode: true, throwOnError: false, output: 'html' })
    const katexHtml = container.innerHTML

    // 提取 KaTeX CSS（含绝对字体 URL）
    const katexCss = extractKatexCss()

    // 发送到主进程离屏窗口渲染
    const dataUrl = await window.wordsmith!.clipboard.renderKatexOffscreen({
      katexHtml,
      katexCss,
      fontSize: renderFontSize,
      padding,
    })

    // 在 canvas 上后处理
    const img = await loadImage(dataUrl)
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)

    // 白 → 透明
    whiteToTransparent(ctx, canvas.width, canvas.height)

    // 智能裁剪（padding 需乘 dpr，因为 capturePage 返回设备像素）
    const cropped = smartCrop(canvas, Math.round(cropPadding * dpr))

    // DPI 注入
    const dpi = Math.round(scale * baseFontSizePx * dpr * 72 / targetPtSize)
    return injectPngDpi(cropped.toDataURL('image/png'), dpi)
  } finally {
    document.body.removeChild(container)
  }
}

/**
 * 旧方案（回退）：在可见 DOM 渲染 → capturePage 截取
 */
async function captureApproach(
  latex: string,
  scale: number,
  targetPtSize: number,
  cropPadding: number,
  baseFontSizePx: number,
): Promise<string> {
  const renderFontSize = baseFontSizePx * scale
  const dpr = window.devicePixelRatio || 1

  const wrapper = document.createElement('div')
  wrapper.style.cssText = [
    'position:fixed', 'left:0', 'top:0', 'z-index:99999',
    'background:white', 'overflow:visible',
    `padding:${Math.round(renderFontSize * 0.3)}px`,
    `font-size:${renderFontSize}px`, 'line-height:1.2',
  ].join(';')
  document.body.appendChild(wrapper)

  try {
    katex.render(latex, wrapper, {
      displayMode: true,
      throwOnError: false,
      output: 'html',
    })

    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))

    const katexEl = (wrapper.querySelector('.katex-display') ||
                     wrapper.querySelector('.katex') ||
                     wrapper) as HTMLElement
    const rect = katexEl.getBoundingClientRect()
    const pad = Math.round(scale)

    const captureRect = {
      x: Math.max(0, Math.round(rect.x) - pad),
      y: Math.max(0, Math.round(rect.y) - pad),
      width: Math.round(rect.width) + pad * 2,
      height: Math.round(rect.height) + pad * 2,
    }

    const dataUrl = await window.wordsmith!.clipboard.captureAreaAsDataUrl(captureRect)

    const img = await loadImage(dataUrl)
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)

    whiteToTransparent(ctx, canvas.width, canvas.height)
    const cropped = smartCrop(canvas, Math.round(cropPadding * dpr))
    const dpi = Math.round(scale * baseFontSizePx * dpr * 72 / targetPtSize)
    return injectPngDpi(cropped.toDataURL('image/png'), dpi)
  } finally {
    document.body.removeChild(wrapper)
  }
}

/** SVG foreignObject 回退（Web 环境） */
async function svgFallback(
  latex: string,
  scale: number,
  targetPtSize: number,
  cropPadding: number,
  baseFontSizePx: number,
): Promise<string> {
  // @ts-ignore Vite raw import
  const katexCss = (await import('katex/dist/katex.min.css?raw')).default
  const renderFontSize = baseFontSizePx * scale

  const container = document.createElement('div')
  container.style.cssText =
    `position:absolute;left:-9999px;top:-9999px;visibility:hidden;` +
    `font-size:${renderFontSize}px;line-height:1.2;`
  document.body.appendChild(container)

  try {
    katex.render(latex, container, { displayMode: true, throwOnError: false, output: 'html' })

    const html = container.innerHTML
    const rect = container.getBoundingClientRect()
    const pad = renderFontSize
    const svgW = Math.ceil(rect.width) + pad * 2
    const svgH = Math.ceil(rect.height) + pad * 2

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">
      <style>/* <![CDATA[ */ ${katexCss} /* ]]> */</style>
      <div style="font-size:${renderFontSize}px;line-height:1.2;padding:${Math.round(pad)}px;">${html}</div>
    </div>
  </foreignObject>
</svg>`

    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    const canvas = await new Promise<HTMLCanvasElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = svgW; c.height = svgH
        c.getContext('2d')!.drawImage(img, 0, 0)
        URL.revokeObjectURL(url)
        resolve(c)
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG 渲染失败')) }
      img.src = url
    })

    const cropped = smartCrop(canvas, cropPadding * scale)
    const dpi = Math.round(scale * baseFontSizePx * 72 / targetPtSize)
    return injectPngDpi(cropped.toDataURL('image/png'), dpi)
  } finally {
    document.body.removeChild(container)
  }
}
