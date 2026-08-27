import QRCode from 'qrcode'

export function generateQrCanvas(text, canvasDom, opts = {}) {
  return QRCode.toCanvas(canvasDom, text, {
    width: 240,
    margin: 2,
    color: { dark: '#000', light: '#fff' },
    ...opts
  })
}
