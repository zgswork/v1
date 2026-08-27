import { describe, it, expect } from 'vitest'
import { calculateLayout } from './layout-calculator'

const base = {
  pageWidth: 100,
  pageHeight: 100,
  tileGap: 10,
  size: 10,
  rotation: -30,
}

describe('calculateLayout - single', () => {
  it('center anchor returns one instance at page center', () => {
    const out = calculateLayout({ ...base, tile: false, position: 'center' })
    expect(out).toHaveLength(1)
    expect(out[0].x).toBeCloseTo(50)
    expect(out[0].y).toBeCloseTo(50)
    expect(out[0].rotation).toBe(-30)
  })

  it('top-left anchor sits near top-left with margin', () => {
    const out = calculateLayout({ ...base, tile: false, position: 'top-left' })
    expect(out).toHaveLength(1)
    expect(out[0].x).toBeCloseTo(29)
    expect(out[0].y).toBeCloseTo(71)
  })

  it('bottom-right anchor mirrors to bottom-right', () => {
    const out = calculateLayout({ ...base, tile: false, position: 'bottom-right' })
    expect(out[0].x).toBeCloseTo(71)
    expect(out[0].y).toBeCloseTo(29)
  })
})

describe('calculateLayout - tile', () => {
  it('covers the page on a grid with step = size + gap', () => {
    const out = calculateLayout({ ...base, tile: true, position: 'center' })
    expect(out).toHaveLength(36)
    expect(out[0]).toEqual({ x: 0, y: 0, rotation: -30 })
    expect(out.every((i) => i.rotation === -30)).toBe(true)
  })

  it('does not hang when size and gap are both zero (step guarded)', () => {
    const out = calculateLayout({ pageWidth: 10, pageHeight: 10, tile: true, position: 'center', tileGap: 0, size: 0, rotation: 0 })
    expect(out.length).toBeGreaterThan(0)
    expect(Number.isFinite(out.length)).toBe(true)
  })
})

describe('calculateLayout - offset', () => {
  it('shifts the single anchor by offsetX/offsetY', () => {
    const out = calculateLayout({ ...base, tile: false, position: 'center', offsetX: 10, offsetY: -5 })
    expect(out[0].x).toBeCloseTo(60)
    expect(out[0].y).toBeCloseTo(45)
  })

  it('shifts every tiled instance by the offset', () => {
    const out = calculateLayout({ ...base, tile: true, position: 'center', offsetX: 3, offsetY: 7 })
    expect(out[0]).toEqual({ x: 3, y: 7, rotation: -30 })
  })
})
