export function testRegex(text, regStr, flag = 'g') {
  let matches = []
  try {
    const reg = new RegExp(regStr, flag)
    let res
    while ((res = reg.exec(text)) !== null) {
      matches.push(res[0])
    }
    return { ok: true, matches }
  } catch (e) {
    return { ok: false, msg: e.message }
  }
}
