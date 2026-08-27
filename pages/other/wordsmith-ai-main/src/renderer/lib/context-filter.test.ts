import { describe, it, expect } from 'vitest'
import { getRoundsFromMessages, computeRoundStates, buildFilteredMessages } from './context-filter'
import type { ChatMessage, PinnedRound } from '../types/ai'

describe('getRoundsFromMessages', () => {
  it('应将 user+assistant 配对分割为轮次', () => {
    const msgs: ChatMessage[] = [
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
      { role: 'user', content: 'Q2' },
      { role: 'assistant', content: 'A2' },
    ]
    const rounds = getRoundsFromMessages(msgs)
    expect(rounds).toEqual([
      { user: 'Q1', assistant: 'A1' },
      { user: 'Q2', assistant: 'A2' },
    ])
  })

  it('末尾单独的 user 消息不计入轮次', () => {
    const msgs: ChatMessage[] = [
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
      { role: 'user', content: 'Q2' },
    ]
    const rounds = getRoundsFromMessages(msgs)
    expect(rounds).toHaveLength(1)
  })

  it('空消息数组返回空', () => {
    expect(getRoundsFromMessages([])).toEqual([])
  })

  it('过滤 system 消息', () => {
    const msgs: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
    ]
    const rounds = getRoundsFromMessages(msgs)
    expect(rounds).toHaveLength(1)
    expect(rounds[0].user).toBe('Q1')
  })
})

describe('computeRoundStates', () => {
  it('窗口内轮次默认包含', () => {
    const states = computeRoundStates(5, 3, {})
    // 窗口 = 最后 3 轮: index 2,3,4
    expect(states[0]).toEqual({ index: 0, included: false, inWindow: false })
    expect(states[1]).toEqual({ index: 1, included: false, inWindow: false })
    expect(states[2]).toEqual({ index: 2, included: true, inWindow: true })
    expect(states[3]).toEqual({ index: 3, included: true, inWindow: true })
    expect(states[4]).toEqual({ index: 4, included: true, inWindow: true })
  })

  it('contextMaxRounds=0 表示不限', () => {
    const states = computeRoundStates(5, 0, {})
    expect(states.every((s) => s.included && s.inWindow)).toBe(true)
  })

  it('手动排除窗口内轮次', () => {
    const states = computeRoundStates(3, 3, { 1: false })
    expect(states[1]).toEqual({ index: 1, included: false, inWindow: true })
  })

  it('手动包含窗口外轮次', () => {
    const states = computeRoundStates(5, 2, { 0: true })
    expect(states[0]).toEqual({ index: 0, included: true, inWindow: false })
  })
})

describe('buildFilteredMessages', () => {
  const msgs: ChatMessage[] = [
    { role: 'user', content: 'Q1' },
    { role: 'assistant', content: 'A1' },
    { role: 'user', content: 'Q2' },
    { role: 'assistant', content: 'A2' },
    { role: 'user', content: 'Q3' },
    { role: 'assistant', content: 'A3' },
    { role: 'user', content: 'Q4' }, // 当前输入
  ]

  it('应过滤窗口外轮次', () => {
    const result = buildFilteredMessages(msgs, 2, {}, [])
    // 窗口 = 最后 2 轮(index 1,2)，加当前输入
    expect(result).toEqual([
      { role: 'user', content: 'Q2' },
      { role: 'assistant', content: 'A2' },
      { role: 'user', content: 'Q3' },
      { role: 'assistant', content: 'A3' },
      { role: 'user', content: 'Q4' },
    ])
  })

  it('contextMaxRounds=0 不限制', () => {
    const result = buildFilteredMessages(msgs, 0, {}, [])
    expect(result).toHaveLength(7) // 3 轮 * 2 + 当前输入
  })

  it('手动包含窗口外轮次', () => {
    const result = buildFilteredMessages(msgs, 1, { 0: true }, [])
    // 包含: 第0轮(手动) + 第2轮(窗口内) + 当前输入
    expect(result).toEqual([
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
      { role: 'user', content: 'Q3' },
      { role: 'assistant', content: 'A3' },
      { role: 'user', content: 'Q4' },
    ])
  })

  it('手动排除窗口内轮次', () => {
    const result = buildFilteredMessages(msgs, 3, { 1: false }, [])
    // 排除第1轮，包含第0轮和第2轮
    expect(result).toEqual([
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
      { role: 'user', content: 'Q3' },
      { role: 'assistant', content: 'A3' },
      { role: 'user', content: 'Q4' },
    ])
  })

  it('固定轮次排在最前面', () => {
    const pinned: PinnedRound[] = [{
      id: 'p1',
      sourceId: 'h1',
      sourceTitle: '旧对话',
      userContent: 'PQ1',
      assistantContent: 'PA1',
      pinnedAt: Date.now(),
    }]
    const result = buildFilteredMessages(msgs, 1, {}, pinned)
    expect(result[0]).toEqual({ role: 'user', content: 'PQ1' })
    expect(result[1]).toEqual({ role: 'assistant', content: 'PA1' })
  })

  it('没有当前输入时不附加', () => {
    const noInput: ChatMessage[] = [
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
    ]
    const result = buildFilteredMessages(noInput, 10, {}, [])
    expect(result).toHaveLength(2)
  })
})
