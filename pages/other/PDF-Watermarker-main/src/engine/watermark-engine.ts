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
    try {
      return await doc.embedJpg(bytes)
    } catch {
      throw new Error('图片水印仅支持 PNG 或 JPG 格式')
    }
  }
}

/**
 * Stamp a list of watermark layers onto a PDF. `assets[i]` provides the
 * resolved font/image bytes for `layers[i]`. Layers are drawn in order;
 * a layer is silently skipped if it has nothing to draw (empty text, or an
 * image layer without image bytes) or an out-of-range page span.
 */
export async function applyWatermark(
  pdfBytes: Uint8Array,
  layers: WatermarkConfig[],
  assets: WatermarkAssets[] = [],
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes)
  const pages = doc.getPages()

  // Embed each unique font / image only once, keyed by the byte array identity.
  let fontkitRegistered = false
  let helvetica: PDFFont | undefined
  const fontCache = new Map<Uint8Array, PDFFont>()
  const imageCache = new Map<Uint8Array, PDFImage>()

  async function getFont(bytes?: Uint8Array): Promise<PDFFont> {
    if (!bytes) {
      helvetica ??= await doc.embedFont(StandardFonts.Helvetica)
      return helvetica
    }
    let f = fontCache.get(bytes)
    if (!f) {
      if (!fontkitRegistered) {
        doc.registerFontkit(fontkit)
        fontkitRegistered = true
      }
      // Embed whole — pdf-lib's subsetter corrupts CJK glyphs (see fonts/README).
      f = await doc.embedFont(bytes, { subset: false })
      fontCache.set(bytes, f)
    }
    return f
  }

  async function getImage(bytes: Uint8Array): Promise<PDFImage> {
    let img = imageCache.get(bytes)
    if (!img) {
      img = await embedImage(doc, bytes)
      imageCache.set(bytes, img)
    }
    return img
  }

  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li]
    const a = assets[li] ?? {}

    let font: PDFFont | undefined
    let image: PDFImage | undefined
    if (layer.type === 'text') {
      if (!layer.text) continue
      font = await getFont(a.fontBytes)
    } else {
      if (!a.imageBytes) continue
      image = await getImage(a.imageBytes)
    }

    const from = Math.max(1, layer.pageRange.from)
    const to = Math.min(pages.length, layer.pageRange.to)
    if (from > to) continue
    const { r, g, b } = hexToRgb01(layer.color)

    for (let i = from - 1; i <= to - 1; i++) {
      const page = pages[i]
      const { width, height } = page.getSize()
      const footprint = layer.type === 'text'
        ? font!.widthOfTextAtSize(layer.text!, layer.size)
        : layer.size
      const instances = calculateLayout({
        pageWidth: width, pageHeight: height, tile: layer.tile,
        position: layer.position, tileGap: layer.tileGap,
        size: footprint, rotation: layer.rotation,
        offsetX: layer.offsetX, offsetY: layer.offsetY,
      })
      for (const inst of instances) {
        if (layer.type === 'text') {
          page.drawText(layer.text!, {
            x: inst.x - footprint / 2,
            y: inst.y - layer.size / 2,
            size: layer.size,
            font: font!,
            color: rgb(r, g, b),
            opacity: layer.opacity,
            rotate: degrees(layer.rotation),
          })
        } else {
          const w = layer.size
          const h = layer.size * (image!.height / image!.width)
          page.drawImage(image!, {
            x: inst.x - w / 2,
            y: inst.y - h / 2,
            width: w,
            height: h,
            opacity: layer.opacity,
            rotate: degrees(layer.rotation),
          })
        }
      }
    }
  }

  return await doc.save()
}
