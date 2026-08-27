import { useEffect, useState } from 'react'
import { savePreset, listPresets, deletePreset, type Preset } from '../engine/preset-store'
import type { WatermarkConfig } from '../engine/types'

interface Props {
  layers: WatermarkConfig[]
  onLoad: (layers: WatermarkConfig[]) => void
}

export function PresetBar({ layers, onLoad }: Props) {
  const [presets, setPresets] = useState<Preset[]>([])
  const [name, setName] = useState('')

  async function refresh() {
    try { setPresets(await listPresets()) } catch { /* no IndexedDB (e.g. tests) */ }
  }
  useEffect(() => { refresh() }, [])

  async function handleSave() {
    const n = name.trim()
    if (!n) return
    await savePreset(n, layers)
    setName('')
    await refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid #eee', paddingTop: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input placeholder="模板名称" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
        <button onClick={handleSave} disabled={!name.trim()}>保存模板</button>
      </div>
      {presets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {presets.map((p) => (
            <div key={p.name} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button style={{ flex: 1, textAlign: 'left' }} onClick={() => onLoad(p.layers)}>{p.name}</button>
              <button onClick={async () => { await deletePreset(p.name); await refresh() }}>删除</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
