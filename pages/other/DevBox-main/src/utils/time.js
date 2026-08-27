import dayjs from 'dayjs'

export function tsToDate(ts) {
  const num = Number(ts)
  if (ts.length === 10) return dayjs(num * 1000).format('YYYY-MM-DD HH:mm:ss')
  return dayjs(num).format('YYYY-MM-DD HH:mm:ss')
}

export function getNowTs10() {
  return Math.floor(Date.now() / 1000)
}

export function getNowTs13() {
  return Date.now()
}
