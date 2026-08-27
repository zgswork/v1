import { useState } from 'react'
import { applyWatermark, type WatermarkAssets } from '../engine/watermark-engine'
import { loadFont } from '../engine/fonts'
import { saveOrDownload } from '../engine/file-io'
import type { WatermarkConfig } from '../engine/types'

interface Props {
  pdfBytes: Uint8Array | null
  fileName: string
  layers: WatermarkConfig[]
}

export function ExportButton({ pdfBytes, fileName, layers }: Props) {
  const [busy, setBusy] = useState(false)
  const canExport = !!pdfBytes && layers.length > 0

  async function run() {
    if (!pdfBytes) return
    setBusy(true)
    try {
      const assets: WatermarkAssets[] = []
      for (const layer of layers) {
        const a: WatermarkAssets = {}
        if (layer.type === 'text') a.fontBytes = await loadFont(layer.font)
        else if (layer.image) a.imageBytes = new Uint8Array(await layer.image.arrayBuffer())
        assets.push(a)
      }
      const out = await applyWatermark(pdfBytes.slice(), layers, assets)
      await saveOrDownload(fileName.replace(/\.pdf$/i, '') + '-watermarked.pdf', out)
    } catch (e) {
      alert('处理失败：' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button disabled={!canExport || busy} onClick={run}
      style={{ padding: '12px 24px', background: '#ffc107', border: 0, borderRadius: 8, fontSize: 16 }}>
      {busy ? '处理中…' : '立即添加'}
    </button>
  )
}
