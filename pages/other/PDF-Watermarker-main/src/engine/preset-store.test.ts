import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { savePreset, listPresets, deletePreset } from './preset-store'
import type { WatermarkConfig } from './types'

const layers: WatermarkConfig[] = [{
  id: 'a', type: 'text', text: 'A', tile: true, position: 'center', tileGap: 40,
  rotation: -30, color: '#000000', size: 18, opacity: 0.3, font: 'heiti',
  offsetX: 0, offsetY: 0, pageRange: { from: 1, to: 1 },
}]

describe('preset-store', () => {
  beforeEach(async () => {
    for (const p of await listPresets()) await deletePreset(p.name)
  })

  it('saves and lists a preset', async () => {
    await savePreset('default', layers)
    const all = await listPresets()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('default')
    expect(all[0].layers[0].text).toBe('A')
  })

  it('deletes a preset', async () => {
    await savePreset('x', layers)
    await deletePreset('x')
    expect(await listPresets()).toHaveLength(0)
  })
})
