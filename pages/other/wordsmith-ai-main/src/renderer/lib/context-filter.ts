import type { ChatMessage, PinnedRound } from '../types/ai'

/** 一轮对话（user + assistant 配对） */
export interface Round {
  user: string
  assistant: string
}

/**
 * 将扁平消息数组分割为轮次
 * 末尾单独的 user 消息不计入轮次（为当前输入）
 */
export function getRoundsFromMessages(messages: ChatMessage[]): Round[] {
  const visible = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
  const rounds: Round[] = []
  for (let i = 0; i < visible.length - 1; i += 2) {
    if (visible[i].role === 'user' && visible[i + 1]?.role === 'assistant') {
      rounds.push({ user: visible[i].content, assistant: visible[i + 1].content })
    }
  }
  return rounds
}

/** 计算每一轮的状态（用于 UI 渲染复选框） */
export function computeRoundStates(
  totalRounds: number,
  contextMaxRounds: number,
  roundOverrides: Record<number, boolean>
): { index: number; included: boolean; inWindow: boolean }[] {
  const result: { index: number; included: boolean; inWindow: boolean }[] = []
  // contextMaxRounds === 0 表示不限，所有轮次都在窗口内
  const windowStart = contextMaxRounds === 0
    ? 0
    : Math.max(0, totalRounds - contextMaxRounds)

  for (let i = 0; i < totalRounds; i++) {
    const inWindow = i >= windowStart
    let included: boolean
    if (i in roundOverrides) {
      included = roundOverrides[i]
    } else {
      included = inWindow
    }
    result.push({ index: i, included, inWindow })
  }
  return result
}

/**
 * 构建过滤后的消息列表（用于发送给 AI）
 *
 * @param allMessages 所有消息（不含末尾空 assistant）
 * @param contextMaxRounds 上下文窗口大小，0=不限
 * @param roundOverrides 用户覆盖
 * @param pinnedRounds 跨对话固定轮次
 * @returns 过滤后的 ChatMessage 数组
 */
export function buildFilteredMessages(
  allMessages: ChatMessage[],
  contextMaxRounds: number,
  roundOverrides: Record<number, boolean>,
  pinnedRounds: PinnedRound[]
): ChatMessage[] {
  const visible = allMessages.filter((m) => m.role === 'user' || m.role === 'assistant')

  // 分离出轮次和末尾的当前 user 输入
  const rounds: { user: ChatMessage; assistant: ChatMessage }[] = []
  let currentUserInput: ChatMessage | null = null

  let i = 0
  while (i < visible.length) {
    if (visible[i].role === 'user' && visible[i + 1]?.role === 'assistant') {
      rounds.push({ user: visible[i], assistant: visible[i + 1] })
      i += 2
    } else if (visible[i].role === 'user' && i === visible.length - 1) {
      // 末尾单独的 user 消息 = 当前输入
      currentUserInput = visible[i]
      i++
    } else {
      i++
    }
  }

  const totalRounds = rounds.length
  const states = computeRoundStates(totalRounds, contextMaxRounds, roundOverrides)

  // 组装固定轮次消息
  const pinnedMessages: ChatMessage[] = []
  for (const p of pinnedRounds) {
    pinnedMessages.push({ role: 'user', content: p.userContent })
    pinnedMessages.push({ role: 'assistant', content: p.assistantContent })
  }

  // 组装选中的当前对话轮次消息
  const selectedMessages: ChatMessage[] = []
  for (const state of states) {
    if (state.included) {
      const r = rounds[state.index]
      selectedMessages.push({ role: 'user', content: r.user.content })
      selectedMessages.push({ role: 'assistant', content: r.assistant.content })
    }
  }

  const result: ChatMessage[] = [...pinnedMessages, ...selectedMessages]
  if (currentUserInput) {
    result.push(currentUserInput)
  }

  return result
}
