// 版本更新检测服务
// 访问远端 API 对比版本号，提示用户前往 GitHub Release 下载

declare const __APP_VERSION__: string

export interface UpdateInfo {
  version: string
  update_url: string
  changelog: string
  date: string
  ocrchange: string // "0" = OCR 无变化, "1" = 需重新导入 OCR 引擎
}

const UPDATE_API = 'https://wdaiupdate.zky-dw.top/'
const TIMEOUT_MS = 5000

/**
 * 检测是否有新版本可用
 * 返回 UpdateInfo 表示有更新，null 表示无更新或检测失败
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const res = await fetch(UPDATE_API, { signal: controller.signal })
    clearTimeout(timer)

    if (!res.ok) return null

    const data: UpdateInfo = await res.json()

    // 提取主版本号进行对比（去掉 pre-release 后缀如 -context.1）
    const localVersion = __APP_VERSION__.split('-')[0]
    const remoteVersion = data.version.split('-')[0]

    if (remoteVersion !== localVersion) {
      return data
    }

    return null
  } catch {
    // 网络错误、超时、解析失败等，静默处理不影响启动
    return null
  }
}
