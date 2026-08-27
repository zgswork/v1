import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { applyWatermark } from './watermark-engine'
import type { WatermarkConfig } from './types'

// 1x1 transparent PNG (base64-encoded)
const PNG_1x1 = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
)

async function makePdf(pages = 2): Promise<Uint8Array> {
  const d = await PDFDocument.create()
  for (let i = 0; i < pages; i++) d.addPage([200, 200])
  return d.save()
}

const textLayer: WatermarkConfig = {
  id: 'a', type: 'text', text: 'CONFIDENTIAL', tile: false, position: 'center',
  tileGap: 40, rotation: -30, color: '#ff0000', size: 18, opacity: 0.3,
  font: 'heiti', offsetX: 0, offsetY: 0, pageRange: { from: 1, to: 2 },
}

describe('applyWatermark', () => {
  it('keeps page count and grows the file', async () => {
    const src = await makePdf(2)
    const out = await applyWatermark(src, [textLayer], [{}])
    const reload = await PDFDocument.load(out)
    expect(reload.getPageCount()).toBe(2)
    expect(out.length).toBeGreaterThan(src.length)
  })

  it('produces a valid PDF when tiling', async () => {
    const src = await makePdf(1)
    const out = await applyWatermark(src, [{ ...textLayer, tile: true, pageRange: { from: 1, to: 1 } }], [{}])
    const reload = await PDFDocument.load(out)
    expect(reload.getPageCount()).toBe(1)
  })

  it('skips (does not throw) an image layer with no image bytes', async () => {
    const src = await makePdf(1)
    const out = await applyWatermark(src, [{ ...textLayer, type: 'image', pageRange: { from: 1, to: 1 } }], [{}])
    const reload = await PDFDocument.load(out)
    expect(reload.getPageCount()).toBe(1)
  })

  it('skips (does not throw) a layer whose page range is inverted', async () => {
    const src = await makePdf(3)
    const out = await applyWatermark(src, [{ ...textLayer, pageRange: { from: 3, to: 1 } }], [{}])
    const reload = await PDFDocument.load(out)
    expect(reload.getPageCount()).toBe(3)
  })

  it('applies an image watermark and keeps page count', async () => {
    const src = await makePdf(1)
    const imageLayer: WatermarkConfig = {
      id: 'b', type: 'image', tile: false, position: 'center', tileGap: 40, rotation: 0,
      color: '#000000', size: 50, opacity: 0.5, font: 'heiti', offsetX: 0, offsetY: 0,
      pageRange: { from: 1, to: 1 },
    }
    const out = await applyWatermark(src, [imageLayer], [{ imageBytes: PNG_1x1 }])
    const reload = await PDFDocument.load(out)
    expect(reload.getPageCount()).toBe(1)
    expect(out.length).toBeGreaterThan(0)
  })

  it('stamps multiple layers in one pass', async () => {
    const src = await makePdf(1)
    const layers: WatermarkConfig[] = [
      { ...textLayer, id: 'l1', text: 'AAA', pageRange: { from: 1, to: 1 } },
      { ...textLayer, id: 'l2', text: 'BBB', offsetX: 30, pageRange: { from: 1, to: 1 } },
    ]
    const out = await applyWatermark(src, layers, [{}, {}])
    const reload = await PDFDocument.load(out)
    expect(reload.getPageCount()).toBe(1)
    expect(out.length).toBeGreaterThan(src.length)
  })
})
