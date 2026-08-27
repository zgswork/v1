import tinycolor from 'tinycolor2'

export function hexToAll(hex) {
  const c = tinycolor(hex)
  return {
    hex: c.toHexString(),
    rgb: c.toRgbString(),
    hsl: c.toHslString()
  }
}
