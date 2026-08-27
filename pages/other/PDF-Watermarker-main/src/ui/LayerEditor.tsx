import type { WatermarkConfig, GridPos } from '../engine/types'

interface Props {
  layer: WatermarkConfig
  index: number
  totalPages: number
  onChange: (patch: Partial<WatermarkConfig>) => void
  onRemove: () => void
}

const GRID: GridPos[] = [
  'top-left', 'top-center', 'top-right',
  'mid-left', 'center', 'mid-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 }
const labelStyle: React.CSSProperties = { width: 64, flexShrink: 0, whiteSpace: 'nowrap' }
const sliderStyle: React.CSSProperties = { flex: 1, minWidth: 0 }
const valueStyle: React.CSSProperties = { width: 40, textAlign: 'right', flexShrink: 0, color: '#666', fontVariantNumeric: 'tabular-nums' }

function SliderRow({ label, value, display, min, max, onChange }: {
  label: string
  value: number
  display?: string | number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <label style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <input type="range" style={sliderStyle} min={min} max={max} value={value}
        onChange={(e) => onChange(+e.target.value)} />
      <span style={valueStyle}>{display ?? value}</span>
    </label>
  )
}

export function LayerEditor({ layer, index, totalPages, onChange, onRemove }: Props) {
  return (
    <div style={{ border: '1px solid #e3e3e3', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong>{layer.type === 'text' ? '文字水印' : '图片水印'} {index + 1}</strong>
        <button onClick={onRemove} style={{ border: '1px solid #ddd', borderRadius: 6, background: '#fff', cursor: 'pointer', padding: '2px 10px' }}>删除</button>
      </div>

      {layer.type === 'text' ? (
        <input value={layer.text ?? ''} placeholder="水印文字" onChange={(e) => onChange({ text: e.target.value })} />
      ) : (
        <input type="file" accept="image/png,image/jpeg" onChange={(e) => onChange({ image: e.target.files?.[0] ?? undefined })} />
      )}

      <label style={rowStyle}>
        <input type="checkbox" checked={layer.tile} onChange={(e) => onChange({ tile: e.target.checked })} /> 平铺水印
      </label>

      {layer.tile ? (
        <SliderRow label="平铺间距" value={layer.tileGap} min={0} max={200}
          onChange={(v) => onChange({ tileGap: v })} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {GRID.map((g) => (
            <button key={g} onClick={() => onChange({ position: g })}
              style={{ padding: 8, background: layer.position === g ? '#ffc107' : '#eee', border: 0, borderRadius: 4, cursor: 'pointer' }}>•</button>
          ))}
        </div>
      )}

      {layer.type === 'text' && (
        <label style={rowStyle}>
          <span style={labelStyle}>颜色</span>
          <input type="color" value={layer.color} onChange={(e) => onChange({ color: e.target.value })} />
        </label>
      )}

      <SliderRow label="大小" value={layer.size} min={8} max={200}
        onChange={(v) => onChange({ size: v })} />
      <SliderRow label="透明度" value={Math.round(layer.opacity * 100)} display={`${Math.round(layer.opacity * 100)}%`}
        min={0} max={100} onChange={(v) => onChange({ opacity: v / 100 })} />
      <SliderRow label="旋转" value={layer.rotation} display={`${layer.rotation}°`}
        min={-90} max={90} onChange={(v) => onChange({ rotation: v })} />
      <SliderRow label="X 偏移" value={layer.offsetX} min={-200} max={200}
        onChange={(v) => onChange({ offsetX: v })} />
      <SliderRow label="Y 偏移" value={layer.offsetY} min={-200} max={200}
        onChange={(v) => onChange({ offsetY: v })} />

      {layer.type === 'text' && (
        <div style={rowStyle}>
          <label><input type="radio" checked={layer.font === 'heiti'} onChange={() => onChange({ font: 'heiti' })} /> 黑体</label>
          <label><input type="radio" checked={layer.font === 'songti'} onChange={() => onChange({ font: 'songti' })} /> 宋体</label>
        </div>
      )}

      <div>
        页码 <input type="number" min={1} max={totalPages} value={layer.pageRange.from}
          onChange={(e) => onChange({ pageRange: { ...layer.pageRange, from: +e.target.value } })} style={{ width: 56 }} />
        至 <input type="number" min={1} max={totalPages} value={layer.pageRange.to}
          onChange={(e) => onChange({ pageRange: { ...layer.pageRange, to: +e.target.value } })} style={{ width: 56 }} />
        共 {totalPages} 页
      </div>
    </div>
  )
}
