export type GridPos =
  | 'top-left' | 'top-center' | 'top-right'
  | 'mid-left' | 'center' | 'mid-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export type FontKind = 'heiti' | 'songti'

// One watermark layer. A document carries a list of these, drawn in order.
export interface WatermarkConfig {
  id: string
  type: 'text' | 'image'
  text?: string
  image?: Blob
  tile: boolean
  position: GridPos
  tileGap: number      // 平铺间距(pt)
  rotation: number     // 旋转角度(度)
  color: string        // #rrggbb
  size: number         // 字号 / 图片宽(pt)
  opacity: number      // 0–1
  font: FontKind
  offsetX: number      // 整体水平偏移(pt)，用于错开多个水印
  offsetY: number      // 整体垂直偏移(pt)
  pageRange: { from: number; to: number }
}
