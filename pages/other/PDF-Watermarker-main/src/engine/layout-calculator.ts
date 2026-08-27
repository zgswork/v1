import type { GridPos } from './types'

const MARGIN = 24

export interface LayoutInput {
  pageWidth: number
  pageHeight: number
  tile: boolean
  position: GridPos
  tileGap: number
  size: number
  rotation: number
  offsetX?: number
  offsetY?: number
}

export interface WatermarkInstance {
  x: number
  y: number
  rotation: number
}

function anchor(pos: GridPos, w: number, h: number, size: number) {
  const half = size / 2
  const left = MARGIN + half
  const right = w - MARGIN - half
  const cx = w / 2
  const top = h - MARGIN - half
  const bottom = MARGIN + half
  const cy = h / 2
  const xMap = { left, center: cx, right }
  const yMap = { top, mid: cy, bottom }
  const [row, col] = {
    'top-left': ['top', 'left'], 'top-center': ['top', 'center'], 'top-right': ['top', 'right'],
    'mid-left': ['mid', 'left'], 'center': ['mid', 'center'], 'mid-right': ['mid', 'right'],
    'bottom-left': ['bottom', 'left'], 'bottom-center': ['bottom', 'center'], 'bottom-right': ['bottom', 'right'],
  }[pos] as [keyof typeof yMap, keyof typeof xMap]
  return { x: xMap[col], y: yMap[row] }
}

export function calculateLayout(input: LayoutInput): WatermarkInstance[] {
  const { pageWidth, pageHeight, tile, position, tileGap, size, rotation } = input
  const dx = input.offsetX ?? 0
  const dy = input.offsetY ?? 0
  if (!tile) {
    const { x, y } = anchor(position, pageWidth, pageHeight, size)
    return [{ x: x + dx, y: y + dy, rotation }]
  }
  const step = Math.max(1, size + tileGap)
  const cols = Math.ceil(pageWidth / step) + 1
  const rows = Math.ceil(pageHeight / step) + 1
  const out: WatermarkInstance[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({ x: c * step + dx, y: r * step + dy, rotation })
    }
  }
  return out
}
