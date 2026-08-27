export function textToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)))
}
export function base64ToText(b64) {
  return decodeURIComponent(escape(atob(b64)))
}
