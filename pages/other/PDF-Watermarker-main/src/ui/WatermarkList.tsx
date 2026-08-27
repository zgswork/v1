import { LayerEditor } from './LayerEditor'
import type { WatermarkConfig } from '../engine/types'

interface Props {
  layers: WatermarkConfig[]
  totalPages: number
  onAddText: () => void
  onAddImage: () => void
  onChange: (id: string, patch: Partial<WatermarkConfig>) => void
  onRemove: (id: string) => void
}

const addBtn: React.CSSProperties = {
  flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 6,
  background: '#fff', cursor: 'pointer',
}

export function WatermarkList({ layers, totalPages, onAddText, onAddImage, onChange, onRemove }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {layers.length === 0 && (
        <div style={{ color: '#999', fontSize: 13 }}>还没有水印，点下方按钮添加。</div>
      )}
      {layers.map((layer, i) => (
        <LayerEditor
          key={layer.id}
          layer={layer}
          index={i}
          totalPages={totalPages}
          onChange={(patch) => onChange(layer.id, patch)}
          onRemove={() => onRemove(layer.id)}
        />
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={addBtn} onClick={onAddText}>＋ 添加文字</button>
        <button style={addBtn} onClick={onAddImage}>＋ 添加图片</button>
      </div>
    </div>
  )
}
