# PDF 加水印工具（PWA）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个纯客户端、可安装为 PWA 的「PDF 加水印」工具，支持文字/图片水印、平铺/单点定位、样式调节、页码范围、实时预览。

**Architecture:** React + TypeScript（Vite 构建）。所有 PDF 处理在浏览器端完成、不上传服务器：`pdf-lib` + `@pdf-lib/fontkit` 写水印并嵌入中文字体，`pdfjs-dist` 渲染预览。水印引擎为纯 TS、与 UI 解耦，预览与导出共用同一套布局算法。`vite-plugin-pwa` 提供 manifest + Service Worker（离线 + 可安装）。

**Tech Stack:** Vite 8、React 19、TypeScript、pdf-lib 1.17、@pdf-lib/fontkit 1.1、pdfjs-dist 6、idb 8、vite-plugin-pwa 1.3、Vitest 6 + jsdom + @testing-library/react、fake-indexeddb 8。

设计文档：`docs/superpowers/specs/2026-06-03-pdf-watermarker-pwa-design.md`

---

## 文件结构

```
src/
  engine/
    types.ts              # WatermarkConfig / GridPos / 共享类型
    color.ts              # hex 颜色 → {r,g,b} 0–1
    layout-calculator.ts  # 平铺/单点 → 水印实例坐标(纯函数)
    watermark-engine.ts   # pdf-lib 写水印 + fontkit 嵌字体
    preset-store.ts       # IndexedDB 存取水印模板(idb)
    file-io.ts            # 保存到指定位置 / 下载(适配)
  preview/
    pdf-preview.ts        # pdfjs 渲染页 + overlay 画水印
  assets/fonts/           # 黑体/宋体字体文件(.ttf/.otf)
  ui/
    App.tsx               # 顶层状态 + 布局
    FileDropZone.tsx      # 拖入/选择 PDF
    SettingsPanel.tsx     # 水印设置面板
    PreviewPane.tsx       # 预览画布
    ExportButton.tsx      # 导出
  main.tsx                # React 入口
  pwa.ts                  # SW 注册
index.html
vite.config.ts
vitest.setup.ts
public/
  manifest 由 vite-plugin-pwa 生成
  icons/                  # PWA 图标
```

每个 `engine/` 模块职责单一、可独立测试。UI 组件按职责拆分，状态集中在 `App.tsx`。

---

## Task 1: 项目脚手架与测试工具链

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/ui/App.tsx`, `vitest.setup.ts`
- Create test: `src/engine/smoke.test.ts`

- [ ] **Step 1: 用 Vite 初始化 React+TS 项目**

Run:
```bash
cd "/Users/wxq/Source/Source/PDF Watermarker"
npm create vite@latest . -- --template react-ts
```
若提示目录非空，选择 "Ignore files and continue"。

- [ ] **Step 2: 安装依赖**

Run:
```bash
npm install pdf-lib@1.17.1 @pdf-lib/fontkit@1.1.1 pdfjs-dist@6 idb@8
npm install -D vitest@6 jsdom @testing-library/react @testing-library/jest-dom @vitejs/plugin-react vite-plugin-pwa@1 fake-indexeddb@8
```

- [ ] **Step 3: 配置 Vitest（jsdom）**

写 `vite.config.ts`：
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
})
```

写 `vitest.setup.ts`：
```ts
import '@testing-library/jest-dom'
```

在 `package.json` 的 `scripts` 增加：
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: 写一个冒烟测试**

Create `src/engine/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('toolchain', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: 运行测试 + 构建，确认工具链通**

Run: `npm test`
Expected: 1 passed。

Run: `npm run build`
Expected: 构建成功，生成 `dist/`。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS + Vitest"
```

---

## Task 2: 共享类型 `types.ts`

**Files:**
- Create: `src/engine/types.ts`

- [ ] **Step 1: 定义类型（无逻辑，无需测试）**

Create `src/engine/types.ts`:
```ts
export type GridPos =
  | 'top-left' | 'top-center' | 'top-right'
  | 'mid-left' | 'center' | 'mid-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export type FontKind = 'heiti' | 'songti'

export interface WatermarkConfig {
  type: 'text' | 'image'
  text?: string
  image?: Blob
  tile: boolean
  position: GridPos
  tileGap: number      // 平铺间距(pt)
  rotation: number     // 旋转角度(度)
  color: string        // #rrggbb
  size: number         // 字号 / 图片宽(pt)
  opacity: number      // 0–1
  font: FontKind
  pageRange: { from: number; to: number }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat: add shared watermark types"
```

---

## Task 3: 颜色工具 `color.ts`（纯函数 TDD）

**Files:**
- Create: `src/engine/color.ts`
- Test: `src/engine/color.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/engine/color.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { hexToRgb01 } from './color'

describe('hexToRgb01', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb01('#ff0000')).toEqual({ r: 1, g: 0, b: 0 })
  })
  it('parses 3-digit hex', () => {
    expect(hexToRgb01('#000')).toEqual({ r: 0, g: 0, b: 0 })
  })
  it('handles missing #', () => {
    expect(hexToRgb01('00ff00')).toEqual({ r: 0, g: 1, b: 0 })
  })
})
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run src/engine/color.test.ts`
Expected: FAIL（`hexToRgb01` 未定义）。

- [ ] **Step 3: 实现**

Create `src/engine/color.ts`:
```ts
export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  }
}
```

- [ ] **Step 4: 运行，确认通过**

Run: `npx vitest run src/engine/color.test.ts`
Expected: 3 passed。

- [ ] **Step 5: Commit**

```bash
git add src/engine/color.ts src/engine/color.test.ts
git commit -m "feat: add hex color parser"
```

---

## Task 4: 布局计算 `layout-calculator.ts`（纯函数 TDD）

坐标使用 PDF 用户空间（原点在左下角，与 pdf-lib 一致）。每个实例的 `(x,y)` 表示水印的**中心点**。

**Files:**
- Create: `src/engine/layout-calculator.ts`
- Test: `src/engine/layout-calculator.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/engine/layout-calculator.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { calculateLayout } from './layout-calculator'

const base = {
  pageWidth: 100,
  pageHeight: 100,
  tileGap: 10,
  size: 10,
  rotation: -30,
}

describe('calculateLayout - single', () => {
  it('center anchor returns one instance at page center', () => {
    const out = calculateLayout({ ...base, tile: false, position: 'center' })
    expect(out).toHaveLength(1)
    expect(out[0].x).toBeCloseTo(50)
    expect(out[0].y).toBeCloseTo(50)
    expect(out[0].rotation).toBe(-30)
  })

  it('top-left anchor sits near top-left with margin', () => {
    const out = calculateLayout({ ...base, tile: false, position: 'top-left' })
    expect(out).toHaveLength(1)
    // margin(24) + size/2(5) = 29 from left; from top => height - 29 = 71
    expect(out[0].x).toBeCloseTo(29)
    expect(out[0].y).toBeCloseTo(71)
  })

  it('bottom-right anchor mirrors to bottom-right', () => {
    const out = calculateLayout({ ...base, tile: false, position: 'bottom-right' })
    expect(out[0].x).toBeCloseTo(71)
    expect(out[0].y).toBeCloseTo(29)
  })
})

describe('calculateLayout - tile', () => {
  it('covers the page on a grid with step = size + gap', () => {
    const out = calculateLayout({ ...base, tile: true, position: 'center' })
    // step = 20; cols = ceil(100/20)+1 = 6; rows = 6 => 36
    expect(out).toHaveLength(36)
    expect(out[0]).toEqual({ x: 0, y: 0, rotation: -30 })
    expect(out.every((i) => i.rotation === -30)).toBe(true)
  })
})
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run src/engine/layout-calculator.test.ts`
Expected: FAIL（`calculateLayout` 未定义）。

- [ ] **Step 3: 实现**

Create `src/engine/layout-calculator.ts`:
```ts
import type { GridPos } from './types'

const MARGIN = 24

export interface LayoutInput {
  pageWidth: number
  pageHeight: number
  tile: boolean
  position: GridPos
  tileGap: number
  size: number
  rotation: number
}

export interface WatermarkInstance {
  x: number
  y: number
  rotation: number
}

function anchor(pos: GridPos, w: number, h: number, size: number) {
  const half = size / 2
  const left = MARGIN + half
  const right = w - MARGIN - half
  const cx = w / 2
  const top = h - MARGIN - half
  const bottom = MARGIN + half
  const cy = h / 2
  const xMap = { left, center: cx, right }
  const yMap = { top, mid: cy, bottom }
  const [row, col] = {
    'top-left': ['top', 'left'], 'top-center': ['top', 'center'], 'top-right': ['top', 'right'],
    'mid-left': ['mid', 'left'], 'center': ['mid', 'center'], 'mid-right': ['mid', 'right'],
    'bottom-left': ['bottom', 'left'], 'bottom-center': ['bottom', 'center'], 'bottom-right': ['bottom', 'right'],
  }[pos] as [keyof typeof yMap, keyof typeof xMap]
  return { x: xMap[col], y: yMap[row] }
}

export function calculateLayout(input: LayoutInput): WatermarkInstance[] {
  const { pageWidth, pageHeight, tile, position, tileGap, size, rotation } = input
  if (!tile) {
    const { x, y } = anchor(position, pageWidth, pageHeight, size)
    return [{ x, y, rotation }]
  }
  const step = size + tileGap
  const cols = Math.ceil(pageWidth / step) + 1
  const rows = Math.ceil(pageHeight / step) + 1
  const out: WatermarkInstance[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({ x: c * step, y: r * step, rotation })
    }
  }
  return out
}
```

- [ ] **Step 4: 运行，确认通过**

Run: `npx vitest run src/engine/layout-calculator.test.ts`
Expected: 全部 passed。

- [ ] **Step 5: Commit**

```bash
git add src/engine/layout-calculator.ts src/engine/layout-calculator.test.ts
git commit -m "feat: add watermark layout calculator"
```

---

## Task 5: 水印引擎 `watermark-engine.ts`（pdf-lib，TDD）

文字水印：有 `fontBytes` 时用 fontkit 嵌入（中文，子集化）；无 `fontBytes` 时回退 `StandardFonts.Helvetica`（用于 ASCII 与单元测试）。

**Files:**
- Create: `src/engine/watermark-engine.ts`
- Test: `src/engine/watermark-engine.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/engine/watermark-engine.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { applyWatermark } from './watermark-engine'
import type { WatermarkConfig } from './types'

async function makePdf(pages = 2): Promise<Uint8Array> {
  const d = await PDFDocument.create()
  for (let i = 0; i < pages; i++) d.addPage([200, 200])
  return d.save()
}

const textCfg: WatermarkConfig = {
  type: 'text', text: 'CONFIDENTIAL', tile: false, position: 'center',
  tileGap: 40, rotation: -30, color: '#ff0000', size: 18, opacity: 0.3,
  font: 'heiti', pageRange: { from: 1, to: 2 },
}

describe('applyWatermark', () => {
  it('keeps page count and grows the file', async () => {
    const src = await makePdf(2)
    const out = await applyWatermark(src, textCfg)
    const reload = await PDFDocument.load(out)
    expect(reload.getPageCount()).toBe(2)
    expect(out.length).toBeGreaterThan(src.length)
  })

  it('produces a valid PDF when tiling', async () => {
    const src = await makePdf(1)
    const out = await applyWatermark(src, { ...textCfg, tile: true, pageRange: { from: 1, to: 1 } })
    const reload = await PDFDocument.load(out)
    expect(reload.getPageCount()).toBe(1)
  })

  it('throws if image watermark has no image bytes', async () => {
    const src = await makePdf(1)
    await expect(
      applyWatermark(src, { ...textCfg, type: 'image', pageRange: { from: 1, to: 1 } })
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run src/engine/watermark-engine.test.ts`
Expected: FAIL（`applyWatermark` 未定义）。

- [ ] **Step 3: 实现**

Create `src/engine/watermark-engine.ts`:
```ts
import { PDFDocument, degrees, rgb, StandardFonts, type PDFImage, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { calculateLayout } from './layout-calculator'
import { hexToRgb01 } from './color'
import type { WatermarkConfig } from './types'

export interface WatermarkAssets {
  fontBytes?: Uint8Array
  imageBytes?: Uint8Array
}

async function embedImage(doc: PDFDocument, bytes: Uint8Array): Promise<PDFImage> {
  try {
    return await doc.embedPng(bytes)
  } catch {
    return await doc.embedJpg(bytes)
  }
}

export async function applyWatermark(
  pdfBytes: Uint8Array,
  config: WatermarkConfig,
  assets: WatermarkAssets = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes)

  let font: PDFFont | undefined
  let image: PDFImage | undefined
  if (config.type === 'text') {
    if (assets.fontBytes) {
      doc.registerFontkit(fontkit)
      font = await doc.embedFont(assets.fontBytes, { subset: true })
    } else {
      font = await doc.embedFont(StandardFonts.Helvetica)
    }
  } else {
    if (!assets.imageBytes) throw new Error('image watermark requires imageBytes')
    image = await embedImage(doc, assets.imageBytes)
  }

  const pages = doc.getPages()
  const from = Math.max(1, config.pageRange.from)
  const to = Math.min(pages.length, config.pageRange.to)
  const { r, g, b } = hexToRgb01(config.color)

  for (let i = from - 1; i <= to - 1; i++) {
    const page = pages[i]
    const { width, height } = page.getSize()
    const footprint =
      config.type === 'text'
        ? font!.widthOfTextAtSize(config.text ?? '', config.size)
        : config.size
    const instances = calculateLayout({
      pageWidth: width, pageHeight: height, tile: config.tile,
      position: config.position, tileGap: config.tileGap,
      size: footprint, rotation: config.rotation,
    })
    for (const inst of instances) {
      if (config.type === 'text') {
        const tw = font!.widthOfTextAtSize(config.text ?? '', config.size)
        page.drawText(config.text ?? '', {
          x: inst.x - tw / 2,
          y: inst.y - config.size / 2,
          size: config.size,
          font: font!,
          color: rgb(r, g, b),
          opacity: config.opacity,
          rotate: degrees(config.rotation),
        })
      } else {
        const w = config.size
        const h = config.size * (image!.height / image!.width)
        page.drawImage(image!, {
          x: inst.x - w / 2,
          y: inst.y - h / 2,
          width: w,
          height: h,
          opacity: config.opacity,
          rotate: degrees(config.rotation),
        })
      }
    }
  }

  return await doc.save()
}
```

> 备注：pdf-lib 的 `rotate` 以锚点为旋转中心，因此旋转后的"居中"是近似的，对水印视觉效果可接受。

- [ ] **Step 4: 运行，确认通过**

Run: `npx vitest run src/engine/watermark-engine.test.ts`
Expected: 3 passed。

- [ ] **Step 5: Commit**

```bash
git add src/engine/watermark-engine.ts src/engine/watermark-engine.test.ts
git commit -m "feat: add pdf-lib watermark engine (text + image)"
```

---

## Task 6: 文件输出 `file-io.ts`（适配 File System Access / 下载，TDD）

**Files:**
- Create: `src/engine/file-io.ts`
- Test: `src/engine/file-io.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/engine/file-io.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { saveOrDownload } from './file-io'

afterEach(() => {
  vi.restoreAllMocks()
  // @ts-expect-error cleanup
  delete window.showSaveFilePicker
})

describe('saveOrDownload', () => {
  it('uses File System Access API when available', async () => {
    const write = vi.fn()
    const close = vi.fn()
    const createWritable = vi.fn().mockResolvedValue({ write, close })
    const picker = vi.fn().mockResolvedValue({ createWritable })
    // @ts-expect-error inject
    window.showSaveFilePicker = picker

    await saveOrDownload('out.pdf', new Uint8Array([1, 2, 3]))

    expect(picker).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })

  it('falls back to anchor download', async () => {
    const click = vi.fn()
    const anchor = { href: '', download: '', click } as unknown as HTMLAnchorElement
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    await saveOrDownload('out.pdf', new Uint8Array([1, 2, 3]))

    expect(click).toHaveBeenCalledOnce()
    expect(anchor.download).toBe('out.pdf')
  })
})
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run src/engine/file-io.test.ts`
Expected: FAIL（`saveOrDownload` 未定义）。

- [ ] **Step 3: 实现**

Create `src/engine/file-io.ts`:
```ts
export async function saveOrDownload(filename: string, bytes: Uint8Array): Promise<void> {
  const blob = new Blob([bytes], { type: 'application/pdf' })

  if ('showSaveFilePicker' in window) {
    // @ts-expect-error experimental API
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
    })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: 运行，确认通过**

Run: `npx vitest run src/engine/file-io.test.ts`
Expected: 2 passed。

- [ ] **Step 5: Commit**

```bash
git add src/engine/file-io.ts src/engine/file-io.test.ts
git commit -m "feat: add file-io save/download adapter"
```

---

## Task 7: 模板存储 `preset-store.ts`（IndexedDB，TDD）

**Files:**
- Create: `src/engine/preset-store.ts`
- Test: `src/engine/preset-store.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/engine/preset-store.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { savePreset, listPresets, deletePreset } from './preset-store'
import type { WatermarkConfig } from './types'

const cfg: WatermarkConfig = {
  type: 'text', text: 'A', tile: true, position: 'center', tileGap: 40,
  rotation: -30, color: '#000000', size: 18, opacity: 0.3, font: 'heiti',
  pageRange: { from: 1, to: 1 },
}

describe('preset-store', () => {
  beforeEach(async () => {
    for (const p of await listPresets()) await deletePreset(p.name)
  })

  it('saves and lists a preset', async () => {
    await savePreset('default', cfg)
    const all = await listPresets()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('default')
    expect(all[0].config.text).toBe('A')
  })

  it('deletes a preset', async () => {
    await savePreset('x', cfg)
    await deletePreset('x')
    expect(await listPresets()).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run src/engine/preset-store.test.ts`
Expected: FAIL（函数未定义）。

- [ ] **Step 3: 实现**

Create `src/engine/preset-store.ts`:
```ts
import { openDB, type IDBPDatabase } from 'idb'
import type { WatermarkConfig } from './types'

const DB_NAME = 'pdf-watermarker'
const STORE = 'presets'

export interface Preset {
  name: string
  config: WatermarkConfig
}

function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE, { keyPath: 'name' })
      }
    },
  })
}

export async function savePreset(name: string, config: WatermarkConfig): Promise<void> {
  await (await db()).put(STORE, { name, config })
}

export async function listPresets(): Promise<Preset[]> {
  return (await db()).getAll(STORE)
}

export async function deletePreset(name: string): Promise<void> {
  await (await db()).delete(STORE, name)
}
```

> 备注：`config.image`（Blob）可直接结构化克隆存入 IndexedDB，无需序列化。

- [ ] **Step 4: 运行，确认通过**

Run: `npx vitest run src/engine/preset-store.test.ts`
Expected: 2 passed。

- [ ] **Step 5: Commit**

```bash
git add src/engine/preset-store.ts src/engine/preset-store.test.ts
git commit -m "feat: add IndexedDB preset store"
```

---

## Task 8: 中文字体资源与加载

完整 CJK 字体较大，pdf-lib 子集化后输出不大；字体源文件随应用打包（可懒加载）。

**Files:**
- Create: `src/assets/fonts/heiti.ttf`（黑体，建议 Noto Sans SC Regular）
- Create: `src/assets/fonts/songti.ttf`（宋体，建议 Noto Serif SC Regular）
- Create: `src/engine/fonts.ts`

- [ ] **Step 1: 放入字体文件**

下载思源黑体 / 思源宋体（SIL OFL 授权，可商用）的 Regular 字重，放到：
- `src/assets/fonts/heiti.ttf`
- `src/assets/fonts/songti.ttf`

来源参考：https://github.com/notofonts/noto-cjk（Sans=黑体、Serif=宋体）

- [ ] **Step 2: 实现字体加载（按需 fetch 字体字节）**

Create `src/engine/fonts.ts`:
```ts
import heitiUrl from '../assets/fonts/heiti.ttf?url'
import songtiUrl from '../assets/fonts/songti.ttf?url'
import type { FontKind } from './types'

const cache = new Map<FontKind, Uint8Array>()

export async function loadFont(kind: FontKind): Promise<Uint8Array> {
  const cached = cache.get(kind)
  if (cached) return cached
  const url = kind === 'heiti' ? heitiUrl : songtiUrl
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer())
  cache.set(kind, bytes)
  return bytes
}
```

- [ ] **Step 3: 构建确认无报错**

Run: `npm run build`
Expected: 构建成功（字体被打包为资源）。

- [ ] **Step 4: Commit**

```bash
git add src/assets/fonts src/engine/fonts.ts
git commit -m "feat: bundle CJK fonts and add font loader"
```

---

## Task 9: 预览模块 `pdf-preview.ts`（pdfjs 渲染 + overlay）

预览为视觉近似（导出以引擎为准）。overlay 复用布局算法，PDF 坐标（左下原点）转 canvas 坐标（左上原点）。

**Files:**
- Create: `src/preview/pdf-preview.ts`

- [ ] **Step 1: 实现（集成层，手动验收为主，无单测）**

Create `src/preview/pdf-preview.ts`:
```ts
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { calculateLayout } from '../engine/layout-calculator'
import type { WatermarkConfig } from '../engine/types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const SCALE = 1.5

export async function loadPdf(bytes: Uint8Array) {
  return pdfjs.getDocument({ data: bytes }).promise
}

export async function renderPage(
  pdf: Awaited<ReturnType<typeof loadPdf>>,
  pageNum: number,
  canvas: HTMLCanvasElement,
): Promise<{ width: number; height: number }> {
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale: SCALE })
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport }).promise
  return { width: page.view[2] - page.view[0], height: page.view[3] - page.view[1] }
}

export function drawOverlay(
  canvas: HTMLCanvasElement,
  config: WatermarkConfig,
  pageWidth: number,
  pageHeight: number,
  imageBitmap?: HTMLImageElement,
) {
  const ctx = canvas.getContext('2d')!
  const footprint = config.type === 'text'
    ? Math.max(config.size * (config.text?.length ?? 1) * 0.6, config.size)
    : config.size
  const instances = calculateLayout({
    pageWidth, pageHeight, tile: config.tile, position: config.position,
    tileGap: config.tileGap, size: footprint, rotation: config.rotation,
  })
  ctx.save()
  ctx.globalAlpha = config.opacity
  for (const inst of instances) {
    const cx = inst.x * SCALE
    const cy = canvas.height - inst.y * SCALE // 翻转 Y
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((-config.rotation * Math.PI) / 180)
    if (config.type === 'text') {
      ctx.fillStyle = config.color
      ctx.font = `${config.size * SCALE}px ${config.font === 'heiti' ? 'sans-serif' : 'serif'}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(config.text ?? '', 0, 0)
    } else if (imageBitmap) {
      const w = config.size * SCALE
      const h = w * (imageBitmap.height / imageBitmap.width)
      ctx.drawImage(imageBitmap, -w / 2, -h / 2, w, h)
    }
    ctx.restore()
  }
  ctx.restore()
}
```

- [ ] **Step 2: 构建确认**

Run: `npm run build`
Expected: 成功（pdfjs worker 以 `?url` 形式打包）。

- [ ] **Step 3: Commit**

```bash
git add src/preview/pdf-preview.ts
git commit -m "feat: add pdfjs preview + watermark overlay"
```

---

## Task 10: UI 组件与状态接线

状态集中在 `App.tsx`。组件：拖放区、设置面板、预览、导出按钮。

**Files:**
- Create: `src/ui/FileDropZone.tsx`, `src/ui/SettingsPanel.tsx`, `src/ui/PreviewPane.tsx`, `src/ui/ExportButton.tsx`
- Modify: `src/ui/App.tsx`
- Test: `src/ui/App.test.tsx`

- [ ] **Step 1: 写默认配置 + 拖放区**

Create `src/ui/FileDropZone.tsx`:
```tsx
interface Props {
  onFile: (bytes: Uint8Array, name: string) => void
}

export function FileDropZone({ onFile }: Props) {
  async function handle(file: File) {
    if (file.type !== 'application/pdf') {
      alert('请选择 PDF 文件')
      return
    }
    onFile(new Uint8Array(await file.arrayBuffer()), file.name)
  }
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const f = e.dataTransfer.files[0]
        if (f) handle(f)
      }}
      style={{ border: '2px dashed #ccc', padding: 32, textAlign: 'center', borderRadius: 8 }}
    >
      <p>拖入 PDF，或</p>
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handle(f)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: 设置面板**

Create `src/ui/SettingsPanel.tsx`:
```tsx
import type { WatermarkConfig, GridPos } from '../engine/types'

interface Props {
  config: WatermarkConfig
  totalPages: number
  onChange: (patch: Partial<WatermarkConfig>) => void
}

const GRID: GridPos[] = [
  'top-left', 'top-center', 'top-right',
  'mid-left', 'center', 'mid-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

export function SettingsPanel({ config, totalPages, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
      <div>
        <label><input type="radio" checked={config.type === 'text'} onChange={() => onChange({ type: 'text' })} /> 文字</label>
        <label><input type="radio" checked={config.type === 'image'} onChange={() => onChange({ type: 'image' })} /> 图片</label>
      </div>

      {config.type === 'text' ? (
        <input value={config.text ?? ''} placeholder="水印文字" onChange={(e) => onChange({ text: e.target.value })} />
      ) : (
        <input type="file" accept="image/png,image/jpeg" onChange={(e) => onChange({ image: e.target.files?.[0] ?? undefined })} />
      )}

      <label><input type="checkbox" checked={config.tile} onChange={(e) => onChange({ tile: e.target.checked })} /> 平铺水印</label>

      {!config.tile && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {GRID.map((g) => (
            <button key={g} onClick={() => onChange({ position: g })}
              style={{ padding: 8, background: config.position === g ? '#ffc107' : '#eee' }}>•</button>
          ))}
        </div>
      )}

      <label>颜色 <input type="color" value={config.color} onChange={(e) => onChange({ color: e.target.value })} /></label>
      <label>大小 <input type="range" min={8} max={96} value={config.size} onChange={(e) => onChange({ size: +e.target.value })} /></label>
      <label>透明度 <input type="range" min={0} max={100} value={config.opacity * 100} onChange={(e) => onChange({ opacity: +e.target.value / 100 })} /></label>
      <label>旋转 <input type="range" min={-90} max={90} value={config.rotation} onChange={(e) => onChange({ rotation: +e.target.value })} /></label>

      <div>
        <label><input type="radio" checked={config.font === 'heiti'} onChange={() => onChange({ font: 'heiti' })} /> 黑体</label>
        <label><input type="radio" checked={config.font === 'songti'} onChange={() => onChange({ font: 'songti' })} /> 宋体</label>
      </div>

      <div>
        页码 <input type="number" min={1} max={totalPages} value={config.pageRange.from}
          onChange={(e) => onChange({ pageRange: { ...config.pageRange, from: +e.target.value } })} />
        至 <input type="number" min={1} max={totalPages} value={config.pageRange.to}
          onChange={(e) => onChange({ pageRange: { ...config.pageRange, to: +e.target.value } })} />
        共 {totalPages} 页
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 预览面板**

Create `src/ui/PreviewPane.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import { loadPdf, renderPage, drawOverlay } from '../preview/pdf-preview'
import type { WatermarkConfig } from '../engine/types'

interface Props {
  pdfBytes: Uint8Array | null
  config: WatermarkConfig
}

export function PreviewPane({ pdfBytes, config }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!pdfBytes || !canvasRef.current) return
      const pdf = await loadPdf(pdfBytes)
      const page = Math.min(config.pageRange.from, pdf.numPages)
      const size = await renderPage(pdf, page, canvasRef.current)
      if (cancelled) return
      sizeRef.current = size
      drawOverlay(canvasRef.current, config, size.width, size.height)
    }
    run()
    return () => { cancelled = true }
  }, [pdfBytes, config])

  if (!pdfBytes) return <div style={{ flex: 1, color: '#999' }}>预览区</div>
  return <canvas ref={canvasRef} style={{ maxWidth: '100%', boxShadow: '0 0 8px #0002' }} />
}
```

- [ ] **Step 4: 导出按钮**

Create `src/ui/ExportButton.tsx`:
```tsx
import { useState } from 'react'
import { applyWatermark } from '../engine/watermark-engine'
import { loadFont } from '../engine/fonts'
import { saveOrDownload } from '../engine/file-io'
import type { WatermarkConfig } from '../engine/types'

interface Props {
  pdfBytes: Uint8Array | null
  fileName: string
  config: WatermarkConfig
}

export function ExportButton({ pdfBytes, fileName, config }: Props) {
  const [busy, setBusy] = useState(false)
  async function run() {
    if (!pdfBytes) return
    setBusy(true)
    try {
      const assets: { fontBytes?: Uint8Array; imageBytes?: Uint8Array } = {}
      if (config.type === 'text') assets.fontBytes = await loadFont(config.font)
      else if (config.image) assets.imageBytes = new Uint8Array(await config.image.arrayBuffer())
      const out = await applyWatermark(pdfBytes, config, assets)
      await saveOrDownload(fileName.replace(/\.pdf$/i, '') + '-watermarked.pdf', out)
    } catch (e) {
      alert('处理失败：' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <button disabled={!pdfBytes || busy} onClick={run}
      style={{ padding: '12px 24px', background: '#ffc107', border: 0, borderRadius: 8, fontSize: 16 }}>
      {busy ? '处理中…' : '立即添加'}
    </button>
  )
}
```

- [ ] **Step 5: App 接线**

Replace `src/ui/App.tsx`:
```tsx
import { useState } from 'react'
import { FileDropZone } from './FileDropZone'
import { SettingsPanel } from './SettingsPanel'
import { PreviewPane } from './PreviewPane'
import { ExportButton } from './ExportButton'
import { loadPdf } from '../preview/pdf-preview'
import type { WatermarkConfig } from '../engine/types'

const DEFAULT: WatermarkConfig = {
  type: 'text', text: '版权所有', tile: true, position: 'center', tileGap: 60,
  rotation: -30, color: '#888888', size: 24, opacity: 0.3, font: 'heiti',
  pageRange: { from: 1, to: 1 },
}

export default function App() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [fileName, setFileName] = useState('document.pdf')
  const [totalPages, setTotalPages] = useState(1)
  const [config, setConfig] = useState<WatermarkConfig>(DEFAULT)

  async function onFile(bytes: Uint8Array, name: string) {
    try {
      const pdf = await loadPdf(bytes)
      setPdfBytes(bytes)
      setFileName(name)
      setTotalPages(pdf.numPages)
      setConfig((c) => ({ ...c, pageRange: { from: 1, to: pdf.numPages } }))
    } catch {
      alert('无法读取该 PDF（可能已加密或损坏）')
    }
  }

  const patch = (p: Partial<WatermarkConfig>) => setConfig((c) => ({ ...c, ...p }))

  return (
    <div style={{ display: 'flex', gap: 24, padding: 24, fontFamily: 'sans-serif' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!pdfBytes ? <FileDropZone onFile={onFile} /> : <PreviewPane pdfBytes={pdfBytes} config={config} />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2>PDF 加水印</h2>
        <SettingsPanel config={config} totalPages={totalPages} onChange={patch} />
        <ExportButton pdfBytes={pdfBytes} fileName={fileName} config={config} />
      </div>
    </div>
  )
}
```

确认 `src/main.tsx` 引入的是 `./ui/App`（如脚手架生成的是 `./App`，把 `App.tsx` 移到 `src/ui/` 并更新 import）。

- [ ] **Step 6: 写 App 冒烟测试**

Create `src/ui/App.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders title and drop zone before a file is chosen', () => {
    render(<App />)
    expect(screen.getByText('PDF 加水印')).toBeInTheDocument()
    expect(screen.getByText(/拖入 PDF/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: 运行测试 + 构建**

Run: `npm test`
Expected: 全部 passed（含 App 冒烟）。

Run: `npm run build`
Expected: 成功。

- [ ] **Step 8: Commit**

```bash
git add src/ui src/main.tsx
git commit -m "feat: wire up UI (drop, settings, preview, export)"
```

---

## Task 11: PWA（manifest + Service Worker + 图标）

**Files:**
- Modify: `vite.config.ts`
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`
- Modify: `src/main.tsx`

- [ ] **Step 1: 配置 vite-plugin-pwa**

Modify `vite.config.ts`，在 plugins 中加入 `VitePWA`：
```ts
import { VitePWA } from 'vite-plugin-pwa'

// plugins: [react(), VitePWA({...})]
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
  manifest: {
    name: 'PDF 加水印',
    short_name: 'PDF水印',
    description: '本地为 PDF 添加文字/图片水印，文件不上传',
    theme_color: '#ffc107',
    background_color: '#ffffff',
    display: 'standalone',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  workbox: {
    maximumFileSizeToCacheInBytes: 30 * 1024 * 1024, // 字体较大，放宽缓存上限
  },
})
```

- [ ] **Step 2: 放入图标**

生成 192×192 与 512×512 的 PNG 图标，放到 `public/icons/`。

- [ ] **Step 3: 注册 Service Worker**

在 `src/main.tsx` 顶部加：
```ts
import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })
```

- [ ] **Step 4: 构建并预览，确认 SW 与 manifest 生成**

Run:
```bash
npm run build
npm run preview
```
Expected: `dist/` 下生成 `sw.js`、`manifest.webmanifest`；浏览器打开 preview 地址后，DevTools → Application 能看到 manifest 与已注册的 Service Worker，地址栏出现"安装"图标。

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts public/icons src/main.tsx
git commit -m "feat: add PWA manifest and service worker"
```

---

## Task 12: 端到端手动验收

**Files:** 无（验收清单）

- [ ] **Step 1: Chrome 全流程**

Run: `npm run dev`
逐项确认：
- 拖入一个多页 PDF → 显示预览与总页数
- 切换文字/图片、平铺/单点、改颜色/大小/透明度/旋转 → 预览实时更新
- 改页码范围 → 导出仅对应页加水印
- 点"立即添加" → 弹出保存对话框，导出的 PDF 用系统阅读器打开，中文水印正确显示
- 加密 PDF → 给出友好提示，不崩溃

- [ ] **Step 2: Safari 回退**

在 Safari 打开同一地址，导出应触发**下载**（非保存对话框），文件正确。

- [ ] **Step 3: PWA 安装**

`npm run build && npm run preview`，在 Chrome 安装为应用，断网后仍可打开并完成一次加水印。

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "docs: mark MVP acceptance complete"
```

---

## Self-Review 结果

- **Spec 覆盖**：文字+图片水印(Task 5)、平铺/单点/旋转/间距(Task 4)、颜色/大小/透明度/字体(Task 5+10)、页码范围(Task 5+10)、实时预览(Task 9+10)、PWA 可安装离线(Task 11)、模板保存(Task 7)、错误处理(Task 10 onFile / ExportButton try-catch + Task 12)。变量/批量已在 spec 中排除，计划亦未含。✅
- **占位符**：无 TBD/TODO；每个代码步骤均给出完整代码。✅
- **类型一致性**：`WatermarkConfig`/`GridPos`/`FontKind` 定义于 Task 2，后续 Task 全部引用同一签名；`applyWatermark`、`saveOrDownload`、`loadFont`、`calculateLayout` 在定义处与调用处签名一致。✅
- **已知近似**：旋转居中为视觉近似（Task 5 备注）；预览为近似、导出以引擎为准（Task 9 说明）。属可接受的 MVP 取舍。
