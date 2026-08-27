// Polyfills for the TC39 "Uint8Array to/from base64 and hex" methods.
// pdf.js v6 relies on these (toHex / toBase64 / fromBase64), but they are very
// new and missing in older Chromium-based browsers (e.g. 360 极速浏览器),
// where loading a PDF would throw "r.toHex is not a function".
//
// Imported both on the main thread (main.tsx) and inside the pdf.js worker
// (preview/pdf-worker.ts) — the two run in separate global scopes.

/* eslint-disable @typescript-eslint/no-explicit-any */
const U8 = Uint8Array as any
const proto = Uint8Array.prototype as any

if (typeof proto.toHex !== 'function') {
  proto.toHex = function (): string {
    let out = ''
    for (let i = 0; i < this.length; i++) out += this[i].toString(16).padStart(2, '0')
    return out
  }
}

if (typeof U8.fromHex !== 'function') {
  U8.fromHex = function (hex: string): Uint8Array {
    const n = hex.length >> 1
    const out = new Uint8Array(n)
    for (let i = 0; i < n; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16)
    return out
  }
}

if (typeof proto.setFromHex !== 'function') {
  proto.setFromHex = function (hex: string) {
    const n = Math.min(this.length, hex.length >> 1)
    for (let i = 0; i < n; i++) this[i] = parseInt(hex.substr(i * 2, 2), 16)
    return { read: n * 2, written: n }
  }
}

function toBase64Str(bytes: Uint8Array, urlSafe: boolean): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  let b64 = btoa(bin)
  if (urlSafe) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_')
  return b64
}

function fromBase64Str(str: string): Uint8Array {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

if (typeof proto.toBase64 !== 'function') {
  proto.toBase64 = function (opts?: { alphabet?: string; omitPadding?: boolean }): string {
    let s = toBase64Str(this, opts?.alphabet === 'base64url')
    if (opts?.omitPadding) s = s.replace(/=+$/, '')
    return s
  }
}

if (typeof U8.fromBase64 !== 'function') {
  U8.fromBase64 = function (str: string): Uint8Array {
    return fromBase64Str(str)
  }
}

if (typeof proto.setFromBase64 !== 'function') {
  proto.setFromBase64 = function (str: string) {
    const decoded = fromBase64Str(str)
    const n = Math.min(this.length, decoded.length)
    this.set(decoded.subarray(0, n))
    return { read: str.length, written: n }
  }
}
