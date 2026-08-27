import CryptoJS from 'crypto-js'

export function urlEncode(s) {
  return encodeURIComponent(s)
}
export function urlDecode(s) {
  return decodeURIComponent(s)
}
export function md5(s) {
  return CryptoJS.MD5(s).toString()
}
export function sha256(s) {
  return CryptoJS.SHA256(s).toString()
}
