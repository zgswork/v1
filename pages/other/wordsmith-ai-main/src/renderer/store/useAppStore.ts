import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AIModelConfig, ChatMessage, PinnedRound, PromptMode, RecentModels, VlmOcrConfig } from '../types/ai'
import type { ReferenceFile } from '../lib/hidden-protocol'
import type { GuardReport } from '../types/guard'

/**
 * 节流版 localStorage。
 *
 * 问题：每次 zustand set 都会让 persist 中间件同步调用 localStorage.setItem，
 * Chromium 渲染进程的 localStorage 底层是 LevelDB，写大块数据会同步阻塞主线程。
 * 流式响应每 token 一次 setItem，主线程持续被锁定，UI 卡顿。
 *
 * 策略：leading + trailing throttle
 *   - 距离上次写已超过 throttleMs：立即同步写（首次写不延迟）
 *   - 节流窗口内：把新值放进 pending，启动一个 timer 在窗口结束时统一写
 *   - 同一 key 的多次写在窗口内合并（只保留最后一次的值）
 *   - beforeunload / pagehide / visibilitychange(hidden) 时强制 flush，防止应用关闭丢数据
 *
 * 副作用：内存里的 zustand state 永远是最新（同步），只是 localStorage 落盘最多延迟 throttleMs。
 * 因为 React UI 订阅的是内存 state，对用户完全无感。
 */
function createThrottledLocalStorage(throttleMs: number) {
  let pendingWrites: Record<string, string> = {}
  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  let lastWriteAt = 0

  const flush = () => {
    if (pendingTimer) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
    for (const [name, value] of Object.entries(pendingWrites)) {
      try { localStorage.setItem(name, value) } catch { /* quota or disabled */ }
    }
    pendingWrites = {}
    lastWriteAt = Date.now()
  }

  // 应用关闭/隐藏时兜底落盘，避免丢失最后 throttleMs 内的状态。
  // Electron 关闭窗口会触发 beforeunload；pagehide 是更可靠的替代；
  // visibilitychange(hidden) 处理切到后台的情况。
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flush)
    window.addEventListener('pagehide', flush)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush()
      })
    }
  }

  return {
    getItem: (name: string): string | null => {
      // 优先返回挂起的写，保证 zustand 读到的是最新值（hydrate 等场景）
      if (name in pendingWrites) return pendingWrites[name]
      try { return localStorage.getItem(name) } catch { return null }
    },
    setItem: (name: string, value: string): void => {
      const now = Date.now()
      const elapsed = now - lastWriteAt

      // Leading 路径：上次写已超过窗口期且当前没挂起的 timer → 直接同步写一次
      if (elapsed >= throttleMs && !pendingTimer) {
        delete pendingWrites[name]
        try { localStorage.setItem(name, value) } catch { /* quota or disabled */ }
        lastWriteAt = now
        return
      }

      // Trailing 路径：窗口内，合并到 pending，最坏延迟 throttleMs 必落盘
      pendingWrites[name] = value
      if (!pendingTimer) {
        const delay = Math.max(0, throttleMs - elapsed)
        pendingTimer = setTimeout(flush, delay)
      }
    },
    removeItem: (name: string): void => {
      // remove 不节流：成本极低，且语义上应该立即生效
      delete pendingWrites[name]
      try { localStorage.removeItem(name) } catch { /* ignore */ }
    },
  }
}

// 100ms 是经验值：UI 反馈不会被察觉延迟，同时把"每 token"频率封顶到 10Hz。
// 与 ChatPanel 的 raf 节流（≈60Hz）叠加后，实际 setItem 频率最多 10Hz。
const throttledStorage = createThrottledLocalStorage(100)

/**
 * 默认排版配置
 */
export interface AIDefaultTypography {
  fontFamily: string
  fontSizePt: number
}

/**
 * 增强的聊天消息，包含 Debug 信息
 */
export interface EnhancedChatMessage extends ChatMessage {
  rawRequest?: string  // 发给 AI 的完整 Prompt
  rawResponse?: string // AI 返回的完整原始文本
}

/**
 * 历史记录项
 */
export interface HistoryItem {
  id: string
  title: string
  createdAt: number
  mode: PromptMode
  messages: EnhancedChatMessage[]
  finalHtml: string
}

export { type ReferenceFile } from '../lib/hidden-protocol'

/**
 * 工作区状态（当前编辑会话）
 */
export interface WorkspaceState {
  id: string | null  // 当前对话 ID，null 表示新对话
  htmlDraft: string
  finalHtml: string
  messages: EnhancedChatMessage[]
  guardReport: GuardReport | null
  mode: PromptMode
  input: string
  streaming: boolean
  // key=轮次索引, true=强制包含(窗口外), false=强制排除(窗口内)
  roundOverrides: Record<number, boolean>
}

/**
 * 应用全局设置
 */
export interface AppSettings {
  ai: AIModelConfig
  typography: AIDefaultTypography
  templateId: string
  timeout: number
  eyeCareMode: boolean
  savePath: string
  ocrEnginePath: string | null
  ocrMode: 'vlm' | 'local'
  vlmOcr: VlmOcrConfig
  recentModels: RecentModels
  providerApiKeys: Record<string, string>
  acceleratorPath: string | null
  contextMaxRounds: number
}

/**
 * 应用状态接口
 */
export interface AppState {
  settings: AppSettings
  history: HistoryItem[]
  customInstruction: string
  referenceFiles: ReferenceFile[]
  workspace: WorkspaceState
  pinnedRounds: PinnedRound[]

  updateAi: (partial: Partial<AIModelConfig>) => void
  updateTypography: (partial: Partial<AIDefaultTypography>) => void
  updateVlmOcr: (partial: Partial<VlmOcrConfig>) => void
  setTemplateId: (id: string) => void
  updateSettings: (partial: Partial<AppSettings>) => void
  addRecentModel: (context: 'ai' | 'vlm', baseUrl: string, model: string) => void
  removeRecentModel: (context: 'ai' | 'vlm', baseUrl: string, model: string) => void

  addHistoryItem: (item: Omit<HistoryItem, 'id' | 'createdAt'>) => string
  updateHistoryItem: (id: string, partial: Partial<Omit<HistoryItem, 'id' | 'createdAt'>>) => void
  deleteHistoryItem: (id: string) => void
  clearHistory: () => void

  setCustomInstruction: (instruction: string) => void
  addReferenceFile: (file: Omit<ReferenceFile, 'id' | 'uploadedAt'>) => void
  updateReferenceFile: (id: string, content: string) => void
  removeReferenceFile: (id: string) => void
  clearReferenceFiles: () => void

  // 工作区操作
  updateWorkspace: (partial: Partial<WorkspaceState>) => void
  setWorkspaceMessages: (messages: EnhancedChatMessage[]) => void
  clearWorkspace: () => void

  // 多对话管理
  createNewChat: () => void
  loadChat: (historyId: string) => boolean

  // 上下文控制
  toggleRoundOverride: (roundIndex: number) => void
  addPinnedRound: (round: Omit<PinnedRound, 'id' | 'pinnedAt'>) => boolean
  removePinnedRound: (id: string) => void
  clearPinnedRounds: () => void
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

const DEFAULT_HTML = `<body style="margin:0; padding:0; font-family:'SimSun'; font-size:12pt;">
  <p style="margin:0 0 12pt 0;">在中间输入您的需求，AI 将生成符合 Word 排版规范的 HTML 内容。</p>
</body>`

const defaultWorkspace: WorkspaceState = {
  id: null,
  htmlDraft: DEFAULT_HTML,
  finalHtml: DEFAULT_HTML,
  messages: [],
  guardReport: null,
  mode: 'generate',
  input: '',
  streaming: false,
  roundOverrides: {},
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: {
        ai: { baseUrl: 'https://api.deepseek.com', apiKey: '', model: 'deepseek-chat' },
        typography: { fontFamily: 'SimSun', fontSizePt: 12 },
        templateId: 'default',
        timeout: 60000,
        eyeCareMode: false,
        savePath: 'My Documents/WordSmith',
        ocrEnginePath: null,
        ocrMode: 'vlm',
        vlmOcr: { baseUrl: '', apiKey: '', model: '', systemPrompt: '' },
        recentModels: { ai: {}, vlm: {} },
        providerApiKeys: {},
        acceleratorPath: null,
        contextMaxRounds: 10,
      },
      history: [],
      customInstruction: '',
      referenceFiles: [],
      workspace: defaultWorkspace,
      pinnedRounds: [],

      updateAi: (partial) =>
        set((s) => {
          const current = s.settings.ai
          const newKeys = { ...s.settings.providerApiKeys }
          const merged = { ...partial }

          // 切换提供商时：保存当前 key，恢复目标提供商的 key
          if (merged.baseUrl && merged.baseUrl !== current.baseUrl) {
            newKeys[current.baseUrl] = current.apiKey
            if (!('apiKey' in merged)) {
              merged.apiKey = newKeys[merged.baseUrl] || ''
            }
          }

          // apiKey 变化时，存入 providerApiKeys
          if ('apiKey' in merged) {
            const targetUrl = merged.baseUrl || current.baseUrl
            newKeys[targetUrl] = merged.apiKey || ''
          }

          return {
            settings: {
              ...s.settings,
              ai: { ...current, ...merged },
              providerApiKeys: newKeys,
            },
          }
        }),
      updateTypography: (partial) =>
        set((s) => ({ settings: { ...s.settings, typography: { ...s.settings.typography, ...partial } } })),
      updateVlmOcr: (partial) =>
        set((s) => {
          const current = s.settings.vlmOcr
          const newKeys = { ...s.settings.providerApiKeys }
          const merged = { ...partial }

          // 切换 VLM 提供商时：保存当前 key，恢复目标提供商的 key
          if (merged.baseUrl && merged.baseUrl !== current.baseUrl) {
            newKeys[current.baseUrl] = current.apiKey
            if (!('apiKey' in merged)) {
              merged.apiKey = newKeys[merged.baseUrl] || ''
            }
          }

          if ('apiKey' in merged) {
            const targetUrl = merged.baseUrl || current.baseUrl
            newKeys[targetUrl] = merged.apiKey || ''
          }

          return {
            settings: {
              ...s.settings,
              vlmOcr: { ...current, ...merged },
              providerApiKeys: newKeys,
            },
          }
        }),
      setTemplateId: (id) => set((s) => ({ settings: { ...s.settings, templateId: id } })),
      updateSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
      addRecentModel: (context, baseUrl, model) =>
        set((s) => {
          const bucket = s.settings.recentModels[context]
          const list = bucket[baseUrl] || []
          const updated = [model, ...list.filter((m) => m !== model)].slice(0, 5)
          return {
            settings: {
              ...s.settings,
              recentModels: {
                ...s.settings.recentModels,
                [context]: { ...bucket, [baseUrl]: updated },
              },
            },
          }
        }),
      removeRecentModel: (context, baseUrl, model) =>
        set((s) => {
          const bucket = s.settings.recentModels[context]
          const list = bucket[baseUrl] || []
          const updated = list.filter((m) => m !== model)
          return {
            settings: {
              ...s.settings,
              recentModels: {
                ...s.settings.recentModels,
                [context]: { ...bucket, [baseUrl]: updated },
              },
            },
          }
        }),

      addHistoryItem: (item) => {
        const id = uid('history')
        set((s) => ({
          history: [
            { ...item, id, createdAt: Date.now() },
            ...s.history,
          ].slice(0, 50),
          workspace: { ...s.workspace, id },
        }))
        return id
      },
      updateHistoryItem: (id, partial) =>
        set((s) => ({
          history: s.history.map((item) =>
            item.id === id ? { ...item, ...partial } : item
          ),
        })),
      deleteHistoryItem: (id) => set((s) => ({ history: s.history.filter((item) => item.id !== id) })),
      clearHistory: () => set({ history: [] }),

      setCustomInstruction: (instruction) => set({ customInstruction: instruction }),
      addReferenceFile: (file) =>
        set((s) => ({
          referenceFiles: [
            ...s.referenceFiles,
            { ...file, id: uid('ref'), uploadedAt: Date.now() },
          ].slice(0, 10),
        })),
      updateReferenceFile: (id, content) =>
        set((s) => ({
          referenceFiles: s.referenceFiles.map((f) =>
            f.id === id ? { ...f, content } : f
          ),
        })),
      removeReferenceFile: (id) => set((s) => ({ referenceFiles: s.referenceFiles.filter((f) => f.id !== id) })),
      clearReferenceFiles: () => set({ referenceFiles: [] }),

      // 工作区操作
      updateWorkspace: (partial) => set((s) => ({ workspace: { ...s.workspace, ...partial } })),
      setWorkspaceMessages: (messages) => set((s) => ({ workspace: { ...s.workspace, messages } })),
      clearWorkspace: () => set({ workspace: defaultWorkspace }),

      // 多对话管理
      createNewChat: () => set({ workspace: defaultWorkspace }),
      loadChat: (historyId: string) => {
        const state = get()
        const historyItem = state.history.find((item) => item.id === historyId)
        if (!historyItem) return false

        set({
          workspace: {
            id: historyItem.id,
            htmlDraft: historyItem.finalHtml,
            finalHtml: historyItem.finalHtml,
            messages: historyItem.messages,
            guardReport: null,
            mode: historyItem.mode,
            input: '',
            streaming: false,
            roundOverrides: {},
          },
        })
        return true
      },

      // 上下文控制
      toggleRoundOverride: (roundIndex: number) =>
        set((s) => {
          const overrides = { ...s.workspace.roundOverrides }
          if (roundIndex in overrides) {
            delete overrides[roundIndex]
          } else {
            // 计算当前轮次总数
            const totalRounds = Math.floor(
              s.workspace.messages.filter((m) => m.role === 'user' || m.role === 'assistant').length / 2
            )
            const windowStart = Math.max(0, totalRounds - s.settings.contextMaxRounds)
            const inWindow = s.settings.contextMaxRounds === 0 || roundIndex >= windowStart
            // 窗口内默认包含 → 设为 false 排除；窗口外默认排除 → 设为 true 包含
            overrides[roundIndex] = !inWindow
          }
          return { workspace: { ...s.workspace, roundOverrides: overrides } }
        }),

      addPinnedRound: (round) => {
        const state = get()
        if (state.pinnedRounds.length >= 10) return false
        set({
          pinnedRounds: [
            ...state.pinnedRounds,
            { ...round, id: uid('pin'), pinnedAt: Date.now() },
          ],
        })
        return true
      },

      removePinnedRound: (id) =>
        set((s) => ({
          pinnedRounds: s.pinnedRounds.filter((p) => p.id !== id),
        })),

      clearPinnedRounds: () => set({ pinnedRounds: [] }),
    }),
    {
      name: 'wordsmith-storage',
      storage: createJSONStorage(() => throttledStorage),
      partialize: (state) => {
        // 流式期间不持久化 workspace.messages：messages 本身在持久化体积里占比不大
        // （history 才是大头），但跳过仍能让每次 partialize 返回的对象稍小一点，
        // 序列化更快，是一个低成本的优化。更关键的是把 streaming 字段强制持久化为 false，
        // 避免崩溃后启动时挂在"流式中"的死状态。
        const ws = state.workspace
        const persistedWorkspace: WorkspaceState = ws.streaming
          ? { ...ws, messages: [], streaming: false }
          : { ...ws, streaming: false }
        return {
          settings: state.settings,
          history: state.history,
          customInstruction: state.customInstruction,
          referenceFiles: state.referenceFiles,
          workspace: persistedWorkspace,
          pinnedRounds: state.pinnedRounds,
        }
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState>
        const merged = { ...current, ...p }
        // 深合并 settings，确保老用户升级后新增字段有默认值
        if (p.settings) {
          merged.settings = {
            ...(current as AppState).settings,
            ...p.settings,
            vlmOcr: {
              ...(current as AppState).settings.vlmOcr,
              ...(p.settings.vlmOcr || {}),
            },
            recentModels: {
              ...(current as AppState).settings.recentModels,
              ...( // 兼容老格式：如果 persisted 是数组就丢弃，只接受对象
                p.settings.recentModels &&
                typeof p.settings.recentModels.ai === 'object' &&
                !Array.isArray(p.settings.recentModels.ai)
                  ? p.settings.recentModels
                  : {}
              ),
            },
            providerApiKeys: {
              ...(current as AppState).settings.providerApiKeys,
              ...(p.settings.providerApiKeys || {}),
            },
          }
        }
        // 兼容老用户 workspace 中没有 roundOverrides 的情况
        if (p.workspace && !('roundOverrides' in p.workspace)) {
          (merged as AppState).workspace.roundOverrides = {}
        }
        return merged as AppState
      },
    },
  ),
)
