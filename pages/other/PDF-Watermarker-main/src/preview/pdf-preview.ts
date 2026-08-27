import * as pdfjs from 'pdfjs-dist'
// Custom worker entry inlined (base64) instead of a separate file, so the build
// also runs from file:// (browsers block fetching worker modules over file://).
// The wrapper polyfills Uint8Array hex/base64 for older Chromium before pdf.js.
import PdfWorker from './pdf-worker?worker&inline'
import { calculateLayout } from '../engine/layout-calculator'
import type { WatermarkConfig } from '../engine/types'

pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker()

// Render scale at 100% zoom. Effective scale = BASE_SCALE * zoom.
export const BASE_SCALE = 1.5

export async function loadPdf(bytes: Uint8Array) {
  // pdf.js transfers (detaches) the ArrayBuffer passed as `data`. Pass a copy so
  // the caller's bytes stay usable for later loads (preview re-renders) and export.
  return pdfjs.getDocument({ data: bytes.slice() }).promise
}

export interface RenderTask { cancel: () => void }

export async function renderPage(
  pdf: Awaited<ReturnType<typeof loadPdf>>,
  pageNum: number,
  canvas: HTMLCanvasElement,
  scale: number = BASE_SCALE,
  onTask?: (task: RenderTask) => void,
): Promise<{ width: number; height: number }> {
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale })
  canvas.width = viewport.width
  canvas.height = viewport.height
  // Expose the render task so the caller can cancel an in-flight render before
  // starting a new one — pdf.js throws if two render() run on the same canvas.
  const task = page.render({ canvas, viewport })
  onTask?.(task)
  await task.promise
  return { width: page.view[2] - page.view[0], height: page.view[3] - page.view[1] }
}

export function drawOverlay(
  canvas: HTMLCanvasElement,
  config: WatermarkConfig,
  pageWidth: number,
  pageHeight: number,
  scale: number = BASE_SCALE,
  imageBitmap?: HTMLImageElement,
) {
  const ctx = canvas.getContext('2d')!
  const footprint = config.type === 'text'
    ? Math.max(config.size * (config.text?.length ?? 1) * 0.6, config.size)
    : config.size
  const instances = calculateLayout({
    pageWidth, pageHeight, tile: config.tile, position: config.position,
    tileGap: config.tileGap, size: footprint, rotation: config.rotation,
    offsetX: config.offsetX, offsetY: config.offsetY,
  })
  ctx.save()
  ctx.globalAlpha = config.opacity
  for (const inst of instances) {
    const cx = inst.x * scale
    const cy = canvas.height - inst.y * scale // flip Y: PDF origin bottom-left → canvas origin top-left
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((-config.rotation * Math.PI) / 180)
    if (config.type === 'text') {
      ctx.fillStyle = config.color
      ctx.font = `${config.size * scale}px ${config.font === 'heiti' ? 'sans-serif' : 'serif'}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(config.text ?? '', 0, 0)
    } else if (imageBitmap) {
      const w = config.size * scale
      const h = w * (imageBitmap.height / imageBitmap.width)
      ctx.drawImage(imageBitmap, -w / 2, -h / 2, w, h)
    }
    ctx.restore()
  }
  ctx.restore()
}
