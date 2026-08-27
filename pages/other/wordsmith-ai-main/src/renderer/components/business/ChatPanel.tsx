import { useMemo, useRef, useEffect, useState, type ReactNode } from 'react'
import { Send, Square, Sparkles, Wrench, Bug, X, Pin, RefreshCw, Play } from 'lucide-react'
import type { PromptMode, ReferenceFileInput, PinnedRound } from '../../types/ai'
import type { GuardReport } from '../../types/guard'
import { guardHtml } from '../../lib/protocol-guard'
import { streamChat, getFullPromptForDebug } from '../../services/ai-service'
import { buildFilteredMessages, computeRoundStates } from '../../lib/context-filter'
import { errorHandler } from '../../services/ErrorHandler'
import { logger } from '../../services/LoggerService'
import { useI18n } from '../../store/useI18nStore'
import { useAppStore, type EnhancedChatMessage } from '../../store/useAppStore'
import { Button } from '../ui/button'

export interface ChatPanelProps {
  baseUrl: string
  apiKey: string
  model: string
  defaults: { fontFamily: string; fontSizePt: number }
  customInstruction?: string
  referenceFiles?: ReferenceFileInput[]
  htmlDraft: string
  onHtmlFinalized: (html: string, report: GuardReport, payload: { mode: PromptMode; messages: EnhancedChatMessage[] }) => void
  emptyState?: ReactNode
  contextMaxRounds: number
  roundOverrides: Record<number, boolean>
  pinnedRounds: PinnedRound[]
  onToggleRound: (roundIndex: number) => void
}

export function ChatPanel({ baseUrl, apiKey, model, defaults, customInstruction, referenceFiles, htmlDraft, onHtmlFinalized, emptyState, contextMaxRounds, roundOverrides, pinnedRounds, onToggleRound }: ChatPanelProps) {
  const t = useI18n()

  // 使用全局状态
  const workspace = useAppStore((s) => s.workspace)
  const updateWorkspace = useAppStore((s) => s.updateWorkspace)
  const setWorkspaceMessages = useAppStore((s) => s.setWorkspaceMessages)

  const { mode, input, messages, streaming } = workspace
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Debug Modal 状态
  const [debugModal, setDebugModal] = useState<{ open: boolean; content: string }>({ open: false, content: '' })

  // 流式 token 速率在缓存命中/推理输出爆发期可达 200+/s，远超浏览器帧率。
  // 若每个 token 都直接 setWorkspaceMessages：
  //   1) 触发 React 重渲染 + ChatPanel 的 rounds useMemo 重算
  //   2) 触发 zustand persist 同步 stringify + setItem 整份持久化状态（1+ MB）
  //   3) 单次 setItem 在 Chromium LevelDB 同步写盘，主线程被锁
  // 实测爆发场景下主线程被占用 47%+，必然卡死。raf 节流把触发频率压到帧率 (≤60Hz)，
  // 配合 useAppStore 里的 persist throttle (≤10Hz)，把主线程占用降到 30% 左右。
  const rafIdRef = useRef<number | null>(null)
  const pendingMessagesRef = useRef<EnhancedChatMessage[] | null>(null)

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      pendingMessagesRef.current = null
    }
  }, [])

  const scheduleSetMessages = (next: EnhancedChatMessage[]) => {
    pendingMessagesRef.current = next
    if (rafIdRef.current !== null) return
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      const pending = pendingMessagesRef.current
      pendingMessagesRef.current = null
      if (pending) setWorkspaceMessages(pending)
    })
  }

  // 立即把挂起的消息同步 flush 到 store，并取消已 schedule 的 raf。
  // 用于 abort/error 路径，确保 store 与已接收到的 token 完全一致（不丢最后一帧）。
  const flushScheduledMessages = () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    const pending = pendingMessagesRef.current
    pendingMessagesRef.current = null
    if (pending) setWorkspaceMessages(pending)
  }

  // 取消挂起的 raf 但不 flush。
  // 用于正常完成路径：紧接着会用 finishedMessages 覆盖，pending 中间快照应该被丢弃。
  const cancelScheduledMessages = () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    pendingMessagesRef.current = null
  }

  const canSend = useMemo(() => {
    if (streaming) return false
    if (!baseUrl || !model) return false
    if (mode === 'generate') return input.trim().length > 0
    return htmlDraft.trim().length > 0
  }, [baseUrl, model, mode, input, htmlDraft, streaming])

  // Auto scroll to bottom — 用容器 scrollTop 避免影响父级布局
  useEffect(() => {
    const el = scrollContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const setMode = (newMode: PromptMode) => updateWorkspace({ mode: newMode })
  const setInput = (newInput: string) => updateWorkspace({ input: newInput })
  const setStreaming = (value: boolean) => updateWorkspace({ streaming: value })

  const stop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
  }

  const showDebug = (msg: EnhancedChatMessage) => {
    const content = msg.rawRequest || '无 Debug 信息'
    setDebugModal({ open: true, content })
  }

  // 将消息按轮次分组
  const rounds = useMemo(() => {
    const visible = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
    const result: { user: EnhancedChatMessage; assistant: EnhancedChatMessage | null; isCurrentStreaming: boolean }[] = []
    let i = 0
    while (i < visible.length) {
      if (visible[i].role === 'user') {
        const assistant = visible[i + 1]?.role === 'assistant' ? visible[i + 1] as EnhancedChatMessage : null
        const isCurrentStreaming = streaming && assistant !== null && i + 1 === visible.length - 1
        result.push({ user: visible[i] as EnhancedChatMessage, assistant, isCurrentStreaming })
        i += assistant ? 2 : 1
      } else {
        i++
      }
    }
    return result
  }, [messages, streaming])

  // 计算轮次状态（完成的轮次才有复选框）
  const completedRoundCount = rounds.filter((r) => r.assistant && !r.isCurrentStreaming).length
  const roundStates = useMemo(
    () => computeRoundStates(completedRoundCount, contextMaxRounds, roundOverrides),
    [completedRoundCount, contextMaxRounds, roundOverrides]
  )

  const send = async (overrideUserText?: string, baseMessages?: EnhancedChatMessage[]) => {
    const controller = new AbortController()
    abortRef.current = controller
    setStreaming(true)

    const base = baseMessages || messages
    const userText = overrideUserText ?? (mode === 'generate' ? input.trim() : htmlDraft.trim())
    const nextMessages: EnhancedChatMessage[] = [
      ...base,
      { role: 'user', content: userText },
      { role: 'assistant', content: '' },
    ]
    setWorkspaceMessages(nextMessages)
    if (!overrideUserText) setInput('')

    logger.action('ChatPanel', 'Start generation', { mode, model })

    // 构建过滤后的消息用于发送
    const filtered = buildFilteredMessages(
      nextMessages.slice(0, -1),
      contextMaxRounds,
      roundOverrides,
      pinnedRounds
    )

    // 获取完整的请求 Prompt 用于 Debug
    const rawRequest = getFullPromptForDebug(
      {
        mode,
        model: { baseUrl, apiKey, model },
        defaults,
        messages: filtered,
      },
      customInstruction,
      referenceFiles
    )

    try {
      let assistantText = ''
      const stream = streamChat({
        mode,
        model: { baseUrl, apiKey, model },
        defaults,
        messages: filtered,
        signal: controller.signal,
        customInstruction,
        referenceFiles,
      })

      for await (const delta of stream) {
        assistantText += delta
        scheduleSetMessages([
          ...nextMessages.slice(0, -1),
          { role: 'assistant', content: assistantText },
        ])
      }

      // 正常完成：取消挂起的节流，避免延迟的旧 raf 在 setWorkspaceMessages(finishedMessages) 之后覆盖
      cancelScheduledMessages()
      const guarded = guardHtml(assistantText, defaults)
      const finishedMessages: EnhancedChatMessage[] = [
        ...nextMessages.slice(0, -1),
        { role: 'assistant', content: assistantText, rawRequest, rawResponse: assistantText },
      ]
      setWorkspaceMessages(finishedMessages)
      onHtmlFinalized(guarded.html, guarded.report, { mode, messages: finishedMessages })
      logger.info('ChatPanel', 'Generation success', { length: assistantText.length })
    } catch (e) {
      // abort 或异常：flush 挂起的内容，让 UI/store 与已收到的 token 一致（保留中断处便于"继续生成"）
      flushScheduledMessages()
      if (e instanceof Error && e.name === 'AbortError') {
        logger.info('ChatPanel', 'Generation aborted')
      } else {
        errorHandler.handle(e, 'api')
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && canSend && apiKey) {
      e.preventDefault()
      send()
    }
  }

  // 重新生成：移除最后一轮，用相同的 user 消息重新发送
  const regenerate = (roundIdx: number) => {
    if (streaming) return
    const visible = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
    // 找到该轮次对应的 user 消息
    const pairStart = roundIdx * 2
    const userContent = visible[pairStart]?.content
    if (!userContent) return
    // 截断消息到该轮之前
    const base = messages.slice(0, messages.indexOf(visible[pairStart]))
    send(userContent, base)
  }

  // 继续生成：将 AI 续写内容拼接到被中断的 assistant 消息后面
  const continueGeneration = async () => {
    if (streaming) return
    const controller = new AbortController()
    abortRef.current = controller
    setStreaming(true)

    logger.action('ChatPanel', 'Continue generation', { mode, model })

    // 构建请求消息：所有当前消息 + 一条隐式"请继续"指令
    const continueMessages = buildFilteredMessages(
      [...messages, { role: 'user', content: '请继续上面未完成的内容，从上次中断处继续输出，不要重复已有内容。' }],
      contextMaxRounds,
      roundOverrides,
      pinnedRounds
    )

    // 找到最后一条 assistant 消息的已有内容
    const lastAssistantIdx = messages.length - 1
    const existingContent = messages[lastAssistantIdx]?.content || ''

    try {
      let newText = ''
      const stream = streamChat({
        mode,
        model: { baseUrl, apiKey, model },
        defaults,
        messages: continueMessages,
        signal: controller.signal,
        customInstruction,
        referenceFiles,
      })

      for await (const delta of stream) {
        newText += delta
        // 拼接到已有内容后面，更新最后一条 assistant 消息
        const updated = [...messages]
        updated[lastAssistantIdx] = {
          ...updated[lastAssistantIdx],
          content: existingContent + newText,
        }
        scheduleSetMessages(updated)
      }

      cancelScheduledMessages()
      const fullContent = existingContent + newText
      const guarded = guardHtml(fullContent, defaults)

      const rawRequest = getFullPromptForDebug(
        { mode, model: { baseUrl, apiKey, model }, defaults, messages: continueMessages },
        customInstruction,
        referenceFiles
      )

      const finishedMessages = [...messages]
      finishedMessages[lastAssistantIdx] = {
        ...finishedMessages[lastAssistantIdx],
        content: fullContent,
        rawRequest,
        rawResponse: fullContent,
      }
      setWorkspaceMessages(finishedMessages)
      onHtmlFinalized(guarded.html, guarded.report, { mode, messages: finishedMessages })
      logger.info('ChatPanel', 'Continue generation success', { length: fullContent.length })
    } catch (e) {
      flushScheduledMessages()
      if (e instanceof Error && e.name === 'AbortError') {
        logger.info('ChatPanel', 'Continue generation aborted')
      } else {
        errorHandler.handle(e, 'api')
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  // 判断最后一轮是否被中断（有内容但没有 rawResponse）
  const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null
  const isLastRoundInterrupted = lastRound
    && lastRound.assistant
    && lastRound.assistant.content
    && !lastRound.assistant.rawResponse
    && !streaming

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Messages Area */}
      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          emptyState || (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 rounded-2xl bg-zinc-100 p-4">
                <Sparkles className="h-8 w-8 text-zinc-400" />
              </div>
              <h3 className="mb-2 text-lg font-medium text-zinc-700">
                开始创作
              </h3>
              <p className="max-w-sm text-sm text-zinc-500">
                {t.chat.emptyTip}
              </p>
            </div>
          )
        ) : (
          <div className="space-y-4">
            {/* 固定轮次提示 */}
            {pinnedRounds.length > 0 && (
              <div className="flex items-center justify-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs text-violet-600">
                <Pin size={12} />
                <span>{t.context.pinnedIndicator.replace('{n}', String(pinnedRounds.length))}</span>
              </div>
            )}

            {rounds.map((round, roundIdx) => {
              // 找到对应的轮次状态（仅完成的轮次有）
              const isCompleted = round.assistant && !round.isCurrentStreaming
              const roundState = isCompleted ? roundStates[roundIdx] : null

              return (
                <div key={roundIdx} className="group/round relative">
                  {/* 轮次复选框 */}
                  {roundState && (
                    <button
                      onClick={() => onToggleRound(roundIdx)}
                      className="absolute -left-1 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all hover:scale-110"
                      style={{
                        borderColor: roundState.included
                          ? (roundState.inWindow ? '#3f3f46' : '#8b5cf6')
                          : '#d4d4d8',
                        backgroundColor: roundState.included
                          ? (roundState.inWindow ? '#3f3f46' : '#8b5cf6')
                          : 'transparent',
                      }}
                      title={roundState.included ? '点击排除此轮' : '点击包含此轮'}
                    >
                      {roundState.included && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  )}

                  <div className="ml-5 space-y-2">
                    {/* User message */}
                    <div className="flex animate-fade-in-up justify-end">
                      <div className="max-w-[85%] rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 px-4 py-3 text-white">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {round.user.content}
                        </div>
                      </div>
                    </div>

                    {/* Assistant message */}
                    {round.assistant && (
                      <div className="flex animate-fade-in-up justify-start">
                        <div className="flex items-start gap-2">
                          {round.assistant.rawRequest && (
                            <button
                              onClick={() => showDebug(round.assistant!)}
                              className="mt-2 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                              title="查看 Debug 信息"
                            >
                              <Bug size={14} />
                            </button>
                          )}
                          <div className="max-w-[85%] rounded-2xl bg-zinc-100/80 px-4 py-3 text-zinc-800">
                            <div className="whitespace-pre-wrap text-sm leading-relaxed">
                              {round.assistant.content || (streaming && round.isCurrentStreaming ? (
                                <span className="inline-flex items-center gap-1 text-zinc-400">
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" style={{ animationDelay: '0.2s' }} />
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" style={{ animationDelay: '0.4s' }} />
                                </span>
                              ) : null)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 操作按钮：重新生成 / 继续生成 */}
                    {!streaming && round.assistant && round.assistant.content && roundIdx === rounds.length - 1 && (
                      <div className="flex items-center gap-2 pl-1">
                        <button
                          onClick={() => regenerate(roundIdx)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                        >
                          <RefreshCw size={12} />
                          {t.chat.regenerate}
                        </button>
                        {isLastRoundInterrupted && (
                          <button
                            onClick={continueGeneration}
                            className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
                          >
                            <Play size={12} />
                            {t.chat.continue}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Floating Input Area */}
      <div className="shrink-0 p-4">
        <div className="mx-auto max-w-3xl">
          {/* Mode Toggle */}
          <div className="mb-3 flex items-center justify-center gap-2">
            <Button
              size="sm"
              variant={mode === 'generate' ? 'default' : 'ghost'}
              onClick={() => setMode('generate')}
              disabled={streaming}
              className="gap-1.5"
            >
              <Sparkles size={14} />
              {t.chat.generate}
            </Button>
            <Button
              size="sm"
              variant={mode === 'fix' ? 'default' : 'ghost'}
              onClick={() => setMode('fix')}
              disabled={streaming}
              className="gap-1.5"
            >
              <Wrench size={14} />
              {t.chat.fix}
            </Button>
          </div>

          {/* Input Container */}
          <div className="relative rounded-2xl bg-zinc-100/80 p-1.5 shadow-lg ring-1 ring-zinc-200/50 backdrop-blur-sm">
            <div className="flex items-end gap-2">
              <textarea
                value={mode === 'generate' ? input : (mode === 'fix' ? t.chat.placeholderFix : '')}
                onChange={(e) => mode === 'generate' && setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={mode === 'generate' ? t.chat.placeholder : ''}
                disabled={streaming || mode === 'fix'}
                rows={1}
                className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                style={{ height: 'auto' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px'
                }}
              />
              {streaming ? (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={stop}
                  className="mb-1.5 mr-1.5 shrink-0"
                >
                  <Square size={16} />
                </Button>
              ) : (
                <Button
                  size="icon"
                  onClick={() => send()}
                  disabled={!canSend || !apiKey}
                  className="mb-1.5 mr-1.5 shrink-0"
                >
                  <Send size={16} />
                </Button>
              )}
            </div>
          </div>

          {/* Status */}
          {!apiKey && (
            <p className="mt-2 text-center text-xs text-zinc-500">
              {t.chat.noApiKey}
            </p>
          )}
          {streaming && (
            <p className="mt-2 text-center text-xs text-zinc-500">
              正在生成中...
            </p>
          )}
        </div>
      </div>

      {/* Debug Modal */}
      {debugModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[80vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <Bug size={18} className="text-zinc-500" />
                <h2 className="text-lg font-semibold text-zinc-900">Debug: 完整请求内容</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDebugModal({ open: false, content: '' })}>
                <X size={18} />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-6">
              <pre className="whitespace-pre-wrap rounded-xl bg-zinc-900 p-4 font-mono text-xs leading-relaxed text-zinc-300">
                {debugModal.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
