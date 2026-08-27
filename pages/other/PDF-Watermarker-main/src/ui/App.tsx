import { useState } from 'react'
import { FileDropZone } from './FileDropZone'
import { WatermarkList } from './WatermarkList'
import { PreviewPane } from './PreviewPane'
import { PreviewToolbar } from './PreviewToolbar'
import { ExportButton } from './ExportButton'
import { PresetBar } from './PresetBar'
import { loadPdf } from '../preview/pdf-preview'
import type { WatermarkConfig } from '../engine/types'

function newId(): string {
  return 'wm-' + Math.random().toString(36).slice(2, 9)
}

function makeTextLayer(pages: number): WatermarkConfig {
  return {
    id: newId(), type: 'text', text: '版权所有', tile: true, position: 'center',
    tileGap: 60, rotation: -30, color: '#888888', size: 24, opacity: 0.3,
    font: 'heiti', offsetX: 0, offsetY: 0, pageRange: { from: 1, to: pages },
  }
}

function makeImageLayer(pages: number): WatermarkConfig {
  return {
    id: newId(), type: 'image', tile: false, position: 'center',
    tileGap: 60, rotation: 0, color: '#888888', size: 120, opacity: 0.5,
    font: 'heiti', offsetX: 0, offsetY: 0, pageRange: { from: 1, to: pages },
  }
}

export default function App() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [fileName, setFileName] = useState('document.pdf')
  const [totalPages, setTotalPages] = useState(1)
  const [layers, setLayers] = useState<WatermarkConfig[]>(() => [makeTextLayer(1)])
  const [previewPage, setPreviewPage] = useState(1)
  const [zoom, setZoom] = useState(1)

  async function onFile(bytes: Uint8Array, name: string) {
    try {
      const pdf = await loadPdf(bytes)
      setPdfBytes(bytes)
      setFileName(name)
      setTotalPages(pdf.numPages)
      setPreviewPage(1)
      setZoom(1)
      // Fit existing layers' page ranges to the new document.
      setLayers((ls) => ls.map((l) => ({ ...l, pageRange: { from: 1, to: pdf.numPages } })))
    } catch (e) {
      const err = e as { name?: string; message?: string }
      if (err?.name === 'PasswordException') {
        alert('该 PDF 设置了打开密码，暂不支持加密文档。')
      } else {
        alert('无法读取该 PDF（可能已损坏或格式不受支持）。\n详情：' + (err?.message ?? String(e)))
      }
      console.error('PDF 读取失败:', e)
    }
  }

  function reselect() {
    setPdfBytes(null)
    setTotalPages(1)
    setPreviewPage(1)
    setZoom(1)
    setLayers((ls) => ls.map((l) => ({ ...l, pageRange: { from: 1, to: 1 } })))
  }

  const addText = () => setLayers((ls) => [...ls, makeTextLayer(totalPages)])
  const addImage = () => setLayers((ls) => [...ls, makeImageLayer(totalPages)])
  const changeLayer = (id: string, patch: Partial<WatermarkConfig>) =>
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const removeLayer = (id: string) => setLayers((ls) => ls.filter((l) => l.id !== id))

  return (
    <div style={{
      display: 'flex', gap: 24, padding: 24, fontFamily: 'sans-serif',
      height: '100vh', boxSizing: 'border-box',
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        {!pdfBytes ? (
          <FileDropZone onFile={onFile} />
        ) : (
          <>
            <div style={{
              flex: 1, minHeight: 0, overflow: 'auto', display: 'flex',
              border: '1px solid #eee', borderRadius: 8, background: '#f3f3f3',
            }}>
              <div style={{ margin: 'auto', padding: 12 }}>
                <PreviewPane pdfBytes={pdfBytes} layers={layers} page={previewPage} zoom={zoom} />
              </div>
            </div>
            <PreviewToolbar
              page={previewPage}
              totalPages={totalPages}
              zoom={zoom}
              onPage={setPreviewPage}
              onZoom={setZoom}
              onReselect={reselect}
            />
          </>
        )}
      </div>
      <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
        <h2 style={{ margin: 0 }}>PDF 加水印</h2>
        <WatermarkList
          layers={layers}
          totalPages={totalPages}
          onAddText={addText}
          onAddImage={addImage}
          onChange={changeLayer}
          onRemove={removeLayer}
        />
        <PresetBar layers={layers} onLoad={(ls) => setLayers(ls)} />
        <ExportButton pdfBytes={pdfBytes} fileName={fileName} layers={layers} />
      </div>
    </div>
  )
}
