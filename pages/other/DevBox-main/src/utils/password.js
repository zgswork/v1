export function generatePwd(len = 16, opts) {
  const { upper, lower, num, symbol } = opts
  let chars = ''
  if (lower) chars += 'abcdefghijklmnopqrstuvwxyz'
  if (upper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (num) chars += '0123456789'
  if (symbol) chars += '!@#$%^&*()_+-=[]{}'
  let pwd = ''
  for (let i = 0; i < len; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)]
  }
  return pwd
}
