import { useEffect, useRef, useState } from 'react'
import { loadPdf, renderPage, drawOverlay, BASE_SCALE, type RenderTask } from '../preview/pdf-preview'
import type { WatermarkConfig } from '../engine/types'

interface Props {
  pdfBytes: Uint8Array | null
  layers: WatermarkConfig[]
  page: number
  zoom: number
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}

export function PreviewPane({ pdfBytes, layers, page, zoom }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfRef = useRef<Awaited<ReturnType<typeof loadPdf>> | null>(null)
  const imgCache = useRef(new Map<Blob, HTMLImageElement>())
  const taskRef = useRef<RenderTask | null>(null)
  const [pdfReady, setPdfReady] = useState(0)

  async function getImage(blob: Blob): Promise<HTMLImageElement> {
    const cached = imgCache.current.get(blob)
    if (cached) return cached
    const img = await loadImage(blob)
    imgCache.current.set(blob, img)
    return img
  }

  // Parse the PDF only when the bytes change.
  useEffect(() => {
    let cancelled = false
    pdfRef.current = null
    if (!pdfBytes) return
    loadPdf(pdfBytes).then((pdf) => {
      if (cancelled) return
      pdfRef.current = pdf
      setPdfReady((n) => n + 1)
    })
    return () => { cancelled = true }
  }, [pdfBytes])

  // Re-render the page and overlay every layer when anything changes.
  useEffect(() => {
    let cancelled = false
    // Cancel any in-flight render so two render() calls never share the canvas.
    taskRef.current?.cancel()
    async function run() {
      const pdf = pdfRef.current
      const canvas = canvasRef.current
      if (!pdf || !canvas) return
      const pageNum = Math.min(Math.max(1, page), pdf.numPages)
      const scale = BASE_SCALE * zoom
      const size = await renderPage(pdf, pageNum, canvas, scale, (t) => { taskRef.current = t })
      if (cancelled) return
      for (const layer of layers) {
        if (pageNum < layer.pageRange.from || pageNum > layer.pageRange.to) continue
        let bitmap: HTMLImageElement | undefined
        if (layer.type === 'image') {
          if (!layer.image) continue
          bitmap = await getImage(layer.image)
          if (cancelled) return
        }
        drawOverlay(canvas, layer, size.width, size.height, scale, bitmap)
      }
    }
    // Swallow the RenderingCancelledException thrown when a render is cancelled.
    run().catch(() => {})
    return () => { cancelled = true }
  }, [layers, pdfReady, page, zoom])

  if (!pdfBytes) return <div style={{ flex: 1, color: '#999' }}>预览区</div>
  return <canvas ref={canvasRef} style={{ display: 'block', boxShadow: '0 0 8px #0002' }} />
}
