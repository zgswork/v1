import JSON5 from 'json5'
// 格式化
export function formatJson(str, space = 2) {
  return JSON.stringify(JSON5.parse(str), null, space)
}
// 压缩
export function compressJson(str) {
  return JSON.stringify(JSON5.parse(str))
}
// 校验
export function validateJson(str) {
  try {
    JSON5.parse(str)
    return { valid: true, msg: '' }
  } catch (e) {
    return { valid: false, msg: e.message }
  }
}
