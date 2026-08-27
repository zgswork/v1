/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument } from 'pdf-lib'
import { applyWatermark } from './watermark-engine'
import type { WatermarkConfig } from './types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const heiti = new Uint8Array(
  readFileSync(resolve(__dirname, '../assets/fonts/heiti.ttf'))
)

async function makePdf(): Promise<Uint8Array> {
  const d = await PDFDocument.create()
  d.addPage([300, 300])
  return d.save()
}

describe('applyWatermark with embedded CJK font', () => {
  it('embeds Chinese text with a valid, bounded-size CJK font', async () => {
    const cfg: WatermarkConfig = {
      id: 'a', type: 'text', text: '版权所有 苏州优必思教育科技有限公司', tile: true,
      position: 'center', tileGap: 60, rotation: -30, color: '#888888',
      size: 20, opacity: 0.3, font: 'heiti', offsetX: 0, offsetY: 0,
      pageRange: { from: 1, to: 1 },
    }
    const src = await makePdf()
    const out = await applyWatermark(src, [cfg], [{ fontBytes: heiti }])
    const reload = await PDFDocument.load(out)
    expect(reload.getPageCount()).toBe(1)
    // The bundled font is pre-subset to GB2312+ASCII and embedded whole
    // (pdf-lib's own subsetter corrupts CJK glyphs). Output stays ~1.5MB.
    expect(out.length).toBeLessThan(2_500_000)
  })
})
