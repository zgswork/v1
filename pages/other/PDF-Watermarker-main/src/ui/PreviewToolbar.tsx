interface Props {
  page: number
  totalPages: number
  zoom: number
  onPage: (p: number) => void
  onZoom: (z: number) => void
  onReselect: () => void
}

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25

const btn: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid #ddd',
  borderRadius: 6,
  background: '#fff',
  cursor: 'pointer',
}

export function PreviewToolbar({ page, totalPages, zoom, onPage, onZoom, onReselect }: Props) {
  const setZoom = (z: number) => onZoom(+z.toFixed(2))
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap',
      padding: '8px 4px', borderTop: '1px solid #eee', marginTop: 8,
    }}>
      <button style={btn} onClick={onReselect}>重新选择文件</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button style={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>上一页</button>
        <span style={{ minWidth: 56, textAlign: 'center' }}>{page} / {totalPages}</span>
        <button style={btn} disabled={page >= totalPages} onClick={() => onPage(page + 1)}>下一页</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button style={btn} disabled={zoom <= ZOOM_MIN} onClick={() => setZoom(Math.max(ZOOM_MIN, zoom - ZOOM_STEP))}>－</button>
        <span style={{ minWidth: 48, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button style={btn} disabled={zoom >= ZOOM_MAX} onClick={() => setZoom(Math.min(ZOOM_MAX, zoom + ZOOM_STEP))}>＋</button>
      </div>
    </div>
  )
}
