import { describe, it, expect } from 'vitest'
import { hexToRgb01 } from './color'

describe('hexToRgb01', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb01('#ff0000')).toEqual({ r: 1, g: 0, b: 0 })
  })
  it('parses 3-digit hex', () => {
    expect(hexToRgb01('#000')).toEqual({ r: 0, g: 0, b: 0 })
  })
  it('handles missing #', () => {
    expect(hexToRgb01('00ff00')).toEqual({ r: 0, g: 1, b: 0 })
  })
})
