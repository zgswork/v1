// 更新状态 store（非持久化，仅当前会话有效）
// dismiss/skip 记录通过 localStorage 跨会话持久化
import { create } from 'zustand'
import type { UpdateInfo } from '../services/UpdateService'

const DISMISS_KEY = 'wordsmith-update-dismissed'
const SKIP_KEY = 'wordsmith-update-skipped'
const DISMISS_EXPIRY_MS = 3 * 24 * 60 * 60 * 1000 // 3 天后重新提醒

interface DismissRecord {
  version: string
  at: number
}

/** 检查某版本是否在 3 天内被用户「稍后提醒」 */
function isRemindLater(version: string): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const record: DismissRecord = JSON.parse(raw)
    return record.version === version && (Date.now() - record.at) < DISMISS_EXPIRY_MS
  } catch {
    return false
  }
}

/** 检查某版本是否被用户「跳过此版本」 */
function isSkipped(version: string): boolean {
  try {
    const skipped = localStorage.getItem(SKIP_KEY)
    return skipped === version
  } catch {
    return false
  }
}

interface UpdateState {
  updateInfo: UpdateInfo | null
  /** 弹窗是否应该显示 */
  showModal: boolean
  /** 红点是否应该显示（用户未做任何决定时才亮） */
  showDot: boolean
  /** 设置更新信息，自动判断弹窗和红点状态 */
  setUpdateInfo: (info: UpdateInfo | null, fromManualCheck?: boolean) => void
  /** 用户点击「稍后提醒」— 3 天内不弹窗不亮红点，3 天后恢复 */
  dismiss: () => void
  /** 用户点击「跳过此版本」— 同版本永不弹窗不亮红点 */
  skipVersion: () => void
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  updateInfo: null,
  showModal: false,
  showDot: false,

  setUpdateInfo: (info, fromManualCheck = false) => {
    if (!info) {
      set({ updateInfo: null, showModal: false, showDot: false })
      return
    }

    // 手动检查（设置页按钮）：清除旧记录，弹窗提示，不亮红点（设置页已展示）
    if (fromManualCheck) {
      localStorage.removeItem(DISMISS_KEY)
      localStorage.removeItem(SKIP_KEY)
      set({ updateInfo: info, showModal: true, showDot: false })
      return
    }

    // 自动检查（启动时）
    if (isSkipped(info.version)) {
      // 用户跳过了这个版本 — 记录信息但不弹窗不亮红点
      set({ updateInfo: info, showModal: false, showDot: false })
    } else if (isRemindLater(info.version)) {
      // 用户 3 天内选了稍后提醒 — 不弹窗不亮红点
      set({ updateInfo: info, showModal: false, showDot: false })
    } else {
      // 用户还没做过任何决定 — 弹窗 + 亮红点
      set({ updateInfo: info, showModal: true, showDot: true })
    }
  },

  dismiss: () => {
    const { updateInfo } = get()
    if (updateInfo) {
      localStorage.setItem(DISMISS_KEY, JSON.stringify({ version: updateInfo.version, at: Date.now() }))
    }
    set({ showModal: false, showDot: false })
  },

  skipVersion: () => {
    const { updateInfo } = get()
    if (updateInfo) {
      localStorage.setItem(SKIP_KEY, updateInfo.version)
    }
    set({ showModal: false, showDot: false })
  },
}))
