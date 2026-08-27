import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, Image, AlertCircle, Clock, X, Trash2, Sparkles, Send, Square, ArrowDownToLine } from 'lucide-react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { latexToUnicodeMath } from '../lib/latex-to-unicodemath'
import { streamChat } from '../services/ai-service'
import { useI18nStore } from '../store/useI18nStore'
import { useAppStore } from '../store/useAppStore'
import { useLatexHistoryStore } from '../store/useLatexHistoryStore'
import { toast } from '../store/useToastStore'
import { cn } from '../lib/cn'
import type { ChatMessage } from '../types/ai'

// 相对时间格式化
function formatRelativeTime(ts: number, t: { timeJustNow: string; timeMinAgo: string; timeHrAgo: string; timeDayAgo: string }): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return t.timeJustNow
  if (diff < 3600) return t.timeMinAgo.replace('{n}', String(Math.floor(diff / 60)))
  if (diff < 86400) return t.timeHrAgo.replace('{n}', String(Math.floor(diff / 3600)))
  return t.timeDayAgo.replace('{n}', String(Math.floor(diff / 86400)))
}

// 拆分 aligned/cases 等多行环境为独立公式（超过 10 行保留原块）
function splitAlignedBlock(block: string): string[] {
  const envMatch = block.match(/\\begin\{(aligned|align\*?|cases|gathered)\}([\s\S]*?)\\end\{\1\}/)
  if (!envMatch) return [block]

  const envBody = envMatch[2]
  const lines = envBody.split(/\\\\\s*/).map(l => l.replace(/^\s*&\s*/, '').replace(/&/g, '').trim()).filter(Boolean)
  // 行数 ≤1 或 >10 时不拆分，保留整块
  if (lines.length <= 1 || lines.length > 10) return [block]

  const formulas: string[] = []
  for (const line of lines) {
    const cleaned = line.replace(/^\\text\{[^}]*\}\s*\\quad\s*/, '').trim()
    if (cleaned) formulas.push(cleaned)
  }
  return formulas.length > 0 ? formulas : [block]
}

// LaTeX 公式提取
function extractLatex(text: string): string[] {
  const results: string[] = []
  const seen = new Set<string>()

  const addUnique = (v: string) => {
    const trimmed = v.trim()
    if (trimmed && !seen.has(trimmed)) { seen.add(trimmed); results.push(trimmed) }
  }

  // $$...$$ 独立公式 — 拆分 aligned 环境
  for (const m of text.matchAll(/\$\$([\s\S]+?)\$\$/g)) {
    const inner = m[1].trim()
    if (!inner) continue
    const parts = splitAlignedBlock(inner)
    for (const p of parts) addUnique(p)
  }
  // $...$ 行内公式（排除已匹配的 $$）
  for (const m of text.matchAll(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g)) {
    addUnique(m[1])
  }
  // ```latex...``` 或 ```...``` — 也拆分 aligned
  for (const m of text.matchAll(/```(?:latex)?\n?([\s\S]*?)```/g)) {
    const inner = m[1].trim()
    if (!inner) continue
    const parts = splitAlignedBlock(inner)
    for (const p of parts) addUnique(p)
  }
  // 兜底：如果没提取到任何公式，整段文字当公式（去掉常见前缀）
  if (results.length === 0) {
    const cleaned = text.replace(/^(这是|以下是|公式[是为]?[：:]?)\s*/i, '').trim()
    if (cleaned) results.push(cleaned)
  }
  return results
}

/** 在消息文本中高亮指定公式（用于悬停插入按钮时） */
function highlightFormula(text: string, formula: string): React.ReactNode[] {
  const idx = text.indexOf(formula)
  if (idx === -1) return [text]

  // 查找包含该公式的完整 $$...$$ 或 ```...``` 块
  let start = idx, end = idx + formula.length
  // 向前找 $$ 或 ```
  const before = text.lastIndexOf('$$', idx)
  if (before !== -1 && before >= idx - 10) start = before
  const codeBefore = text.lastIndexOf('```', idx)
  if (codeBefore !== -1 && codeBefore >= idx - 20) start = Math.min(start, codeBefore)
  // 向后找 $$ 或 ```
  const after = text.indexOf('$$', idx + formula.length)
  if (after !== -1 && after <= idx + formula.length + 10) end = after + 2
  const codeAfter = text.indexOf('```', idx + formula.length)
  if (codeAfter !== -1 && codeAfter <= idx + formula.length + 20) end = Math.max(end, codeAfter + 3)

  return [
    text.slice(0, start),
    <span key="hl" className="rounded bg-violet-100 text-violet-900">{text.slice(start, end)}</span>,
    text.slice(end),
  ]
}

// AI 系统提示词
const LATEX_SYSTEM_PROMPT = `你是一个 LaTeX 公式助手。用户会用自然语言描述他们需要的数学公式，你需要：

1. 只返回 LaTeX 公式代码，使用 $$...$$ 包裹
2. 不要包含任何解释文字、注释或多余内容
3. 如果用户的描述有多种理解，返回最常见的那种
4. 如果用户要求修改公式，基于上下文直接返回修改后的完整公式
5. 支持的语法：分数、根号、上下标、希腊字母、矩阵、积分、求和、极限、分段函数等`

// 示例公式
const EXAMPLES = [
  { label: 'E=mc²', latex: 'E = mc^2' },
  { label: '二次公式', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { label: '欧拉公式', latex: 'e^{i\\pi} + 1 = 0' },
  { label: '求和', latex: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}' },
  { label: '积分', latex: '\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}' },
  { label: '矩阵', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
  { label: '极限', latex: '\\lim_{n \\to \\infty} \\left(1 + \\frac{1}{n}\\right)^n = e' },
  { label: '分段', latex: '|x| = \\begin{cases} x & x \\geq 0 \\\\ -x & x < 0 \\end{cases}' },
]

export default function LatexPage() {
  const t = useI18nStore((s) => s.t)
  const settings = useAppStore((s) => s.settings)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [copying, setCopying] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // AI 对话状态
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiStreaming, setAiStreaming] = useState(false)
  const [aiAutoInsert, setAiAutoInsert] = useState(false)
  const [aiContextCount, setAiContextCount] = useState(10) // 上下文消息对数
  const [hoveredFormula, setHoveredFormula] = useState<string | null>(null)
  const aiAbortRef = useRef<AbortController | null>(null)
  const aiMessagesEndRef = useRef<HTMLDivElement>(null)

  const historyItems = useLatexHistoryStore((s) => s.items)
  const addHistoryItem = useLatexHistoryStore((s) => s.addItem)
  const removeHistoryItem = useLatexHistoryStore((s) => s.removeItem)
  const clearHistory = useLatexHistoryStore((s) => s.clearAll)

  const hasAiConfig = !!(settings.ai.baseUrl && settings.ai.apiKey && settings.ai.model)

  // 面板可同时打开（阶梯式布局）
  const toggleAiPanel = () => setAiPanelOpen(prev => !prev)
  const toggleHistory = () => setHistoryOpen(prev => !prev)
  // 两个面板都打开时使用较窄宽度，只开一个时用正常宽度
  const bothOpen = aiPanelOpen && historyOpen

  // AI 消息滚动到底部
  useEffect(() => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages])

  // 150ms 防抖渲染 KaTeX — 渲染成功即记录历史
  const renderPreview = useCallback((latex: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (!previewRef.current) return
      if (!latex.trim()) {
        previewRef.current.innerHTML = ''
        setError('')
        return
      }
      try {
        katex.render(latex, previewRef.current, {
          displayMode: true,
          throwOnError: true,
          output: 'html',
        })
        setError('')
        addHistoryItem(latex)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : t.latex.parseError)
      }
    }, 150)
  }, [t, addHistoryItem])

  useEffect(() => {
    renderPreview(input)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [input, renderPreview])

  // 复制 UnicodeMath 文本
  const handleCopyUnicodeMath = async () => {
    if (!input.trim()) return
    try {
      const um = latexToUnicodeMath(input)
      await navigator.clipboard.writeText(um)
      toast({ title: t.latex.copySuccess })
    } catch {
      toast({ title: t.latex.copyFailed, variant: 'destructive' })
    }
  }

  // 复制为图片 — 高 DPI 超采样 + 智能裁剪 + 物理尺寸适配
  const handleCopyImage = async () => {
    if (!input.trim() || copying) return
    setCopying(true)
    try {
      const { katexToDataUrl } = await import('../lib/katex-to-image')
      const dataUrl = await katexToDataUrl(input, { scale: 4, targetPtSize: 11 })
      if (window.wordsmith?.clipboard?.writeImage) {
        await window.wordsmith.clipboard.writeImage(dataUrl)
      } else {
        const res = await fetch(dataUrl)
        const blob = await res.blob()
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ])
      }
      toast({ title: t.latex.copySuccess })
    } catch {
      toast({ title: t.latex.copyFailed, variant: 'destructive' })
    } finally {
      setCopying(false)
    }
  }

  const loadFromHistory = (latex: string) => {
    setInput(latex)
  }

  // AI 发送消息
  const sendAiMessage = async () => {
    if (!aiInput.trim() || aiStreaming || !hasAiConfig) return

    const controller = new AbortController()
    aiAbortRef.current = controller
    setAiStreaming(true)

    const userMsg = { role: 'user' as const, content: aiInput }
    const prevMessages = [...aiMessages, userMsg]
    setAiMessages([...prevMessages, { role: 'assistant', content: '' }])
    setAiInput('')

    let accumulated = ''
    try {
      // 按上下文数截取历史消息（每对 = 1 user + 1 assistant）
      const contextMessages = aiContextCount === 0
        ? [userMsg]
        : prevMessages.slice(-(aiContextCount * 2))

      // 构造 rawMessages 跳过排版系统提示词
      const rawMessages: ChatMessage[] = [
        { role: 'system', content: LATEX_SYSTEM_PROMPT },
        ...contextMessages.map(m => ({ role: m.role as ChatMessage['role'], content: m.content })),
      ]

      for await (const delta of streamChat({
        mode: 'generate',
        model: settings.ai,
        defaults: settings.typography,
        messages: [],
        rawMessages,
        signal: controller.signal,
      })) {
        accumulated += delta
        setAiMessages([...prevMessages, { role: 'assistant', content: accumulated }])
      }

      // 自动填入模式：流结束后把第一个公式插入输入框
      if (aiAutoInsert && accumulated) {
        const formulas = extractLatex(accumulated)
        if (formulas.length > 0) setInput(formulas[0])
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        toast({ title: t.latex.aiError, variant: 'destructive' })
      }
    } finally {
      setAiStreaming(false)
      aiAbortRef.current = null
    }
  }

  const stopAiStream = () => {
    aiAbortRef.current?.abort()
    aiAbortRef.current = null
  }

  const clearAiChat = () => {
    if (aiStreaming) stopAiStream()
    setAiMessages([])
  }

  // AI 输入框回车发送
  const handleAiKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendAiMessage()
    }
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* 拖拽区域 */}
      <div
        className="h-9 w-full shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      {/* 主体内容 */}
      <div className="flex min-h-0 flex-1 gap-4 px-6 pb-6">
        {/* 左栏：输入 */}
        <div className="flex w-1/2 flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-700">{t.latex.title}</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleAiPanel}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors',
                  aiPanelOpen
                    ? 'bg-violet-100 text-violet-700'
                    : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
                )}
              >
                <Sparkles size={14} />
                <span>{t.latex.aiChat}</span>
              </button>
              <button
                onClick={toggleHistory}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors',
                  historyOpen
                    ? 'bg-zinc-200 text-zinc-900'
                    : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
                )}
              >
                <Clock size={14} />
                <span>{t.latex.history}</span>
                {historyItems.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-zinc-300 px-1.5 text-[10px] font-medium text-zinc-700">
                    {historyItems.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          <textarea
            className="min-h-0 flex-1 resize-none rounded-xl border border-zinc-200 bg-white p-4 font-mono text-sm leading-relaxed text-zinc-800 outline-none transition-colors focus:border-zinc-400"
            placeholder={t.latex.inputPlaceholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
          />

          {/* 示例公式 */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-zinc-500">{t.latex.examples}</span>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => setInput(ex.latex)}
                  className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 右栏：预览 + 操作 */}
        <div className="flex w-1/2 flex-col gap-3">
          <div className="flex items-center">
            <h2 className="text-sm font-medium text-zinc-700">{t.latex.preview}</h2>
          </div>

          {/* KaTeX 渲染区 */}
          <div className="relative min-h-0 flex-1 overflow-auto rounded-xl border border-zinc-200 bg-white p-6">
            <div
              ref={previewRef}
              className="flex min-h-full items-center justify-center text-xl"
            />
            {error && (
              <div className="absolute inset-x-0 bottom-0 flex items-start gap-2 border-t border-red-100 bg-red-50/90 p-3 text-xs text-red-600">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span className="break-all">{error}</span>
              </div>
            )}
            {!input.trim() && !error && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
                {t.latex.inputPlaceholder}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <button
              onClick={handleCopyUnicodeMath}
              disabled={!input.trim()}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
                input.trim()
                  ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                  : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
              )}
            >
              <Copy size={16} />
              <div className="flex flex-col items-start">
                <span>{t.latex.copyUnicodeMath}</span>
                <span className="text-[10px] font-normal opacity-70">{t.latex.copyUnicodeMathDesc}</span>
              </div>
            </button>

            <button
              onClick={handleCopyImage}
              disabled={!input.trim() || copying}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
                input.trim() && !copying
                  ? 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
                  : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
              )}
            >
              <Image size={16} />
              <div className="flex flex-col items-start">
                <span>{t.latex.copyImage}</span>
                <span className="text-[10px] font-normal opacity-70">{t.latex.copyImageDesc}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 左侧阶梯式面板容器 */}
      <div
        className={cn(
          'absolute left-0 top-9 bottom-0 z-10 flex transition-all duration-200',
          !aiPanelOpen && !historyOpen && 'pointer-events-none'
        )}
        style={{ maxWidth: '50%' }}
      >
        {/* AI 对话面板 */}
        <div
          className={cn(
            'flex flex-col border-r border-zinc-200 bg-white shadow-lg transition-all duration-200 overflow-hidden',
            aiPanelOpen ? (bothOpen ? 'w-72' : 'w-96') : 'w-0'
          )}
        >
          {/* 面板头部 */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 shrink-0">
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-zinc-800 whitespace-nowrap">
              <Sparkles size={14} className="text-violet-500" />
              {t.latex.aiChat}
            </h3>
            <div className="flex items-center gap-1">
              {/* 自动填入开关 */}
              <button
                onClick={() => setAiAutoInsert(!aiAutoInsert)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors whitespace-nowrap',
                  aiAutoInsert
                    ? 'bg-violet-100 text-violet-700'
                    : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'
                )}
                title={t.latex.aiAutoInsert}
              >
                <ArrowDownToLine size={12} />
                <span>{t.latex.aiAutoInsert}</span>
              </button>
              {aiMessages.length > 0 && (
                <button
                  onClick={clearAiChat}
                  className="rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 whitespace-nowrap"
                >
                  {t.latex.aiClearChat}
                </button>
              )}
              <button
                onClick={() => setAiPanelOpen(false)}
                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* 上下文数滑条 */}
          <div className="flex items-center gap-2 border-b border-zinc-50 px-4 py-2 shrink-0">
            <span className="text-[10px] text-zinc-400 whitespace-nowrap">{t.latex.aiContextCount}</span>
            <input
              type="range"
              min={0}
              max={20}
              value={aiContextCount}
              onChange={(e) => setAiContextCount(Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer accent-violet-500"
            />
            <span className="min-w-[2ch] text-right text-[10px] font-medium text-zinc-600">
              {aiContextCount}
            </span>
          </div>

          {/* 消息区 */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {aiMessages.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-xs text-zinc-400">
                {hasAiConfig ? t.latex.aiEmpty : t.latex.aiNoConfig}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {aiMessages.map((msg, i) => (
                  <div key={i} className={cn('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}>
                    {/* 消息气泡 */}
                    <div
                      className={cn(
                        'max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-zinc-100 text-zinc-800'
                          : 'border border-zinc-200 bg-white text-zinc-700'
                      )}
                    >
                      {msg.role === 'assistant' && msg.content === '' && aiStreaming ? (
                        <span className="inline-block animate-pulse text-zinc-400">...</span>
                      ) : (
                        <pre className="whitespace-pre-wrap break-all font-mono">
                          {msg.role === 'assistant' && hoveredFormula && msg.content.includes(hoveredFormula)
                            ? highlightFormula(msg.content, hoveredFormula)
                            : msg.content}
                        </pre>
                      )}
                    </div>

                    {/* AI 消息：提取公式 + 插入按钮 */}
                    {msg.role === 'assistant' && msg.content && !(aiStreaming && i === aiMessages.length - 1) && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {extractLatex(msg.content).map((formula, fi) => (
                          <button
                            key={fi}
                            onClick={() => setInput(formula)}
                            onMouseEnter={() => setHoveredFormula(formula)}
                            onMouseLeave={() => setHoveredFormula(null)}
                            className="flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] text-violet-700 transition-colors hover:bg-violet-100"
                          >
                            <ArrowDownToLine size={10} />
                            {t.latex.aiInsert}
                            {extractLatex(msg.content).length > 1 && ` #${fi + 1}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={aiMessagesEndRef} />
              </div>
            )}
          </div>

          {/* 输入区 */}
          <div className="border-t border-zinc-100 px-4 py-3 shrink-0">
            <div className="flex gap-2">
              <textarea
                className="min-h-[36px] max-h-24 flex-1 resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white"
                placeholder={hasAiConfig ? t.latex.aiPlaceholder : t.latex.aiNoConfig}
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={handleAiKeyDown}
                disabled={!hasAiConfig || aiStreaming}
                rows={1}
              />
              {aiStreaming ? (
                <button
                  onClick={stopAiStream}
                  className="shrink-0 rounded-lg bg-red-500 p-2 text-white transition-colors hover:bg-red-600"
                >
                  <Square size={14} />
                </button>
              ) : (
                <button
                  onClick={sendAiMessage}
                  disabled={!aiInput.trim() || !hasAiConfig}
                  className={cn(
                    'shrink-0 rounded-lg p-2 transition-colors',
                    aiInput.trim() && hasAiConfig
                      ? 'bg-violet-600 text-white hover:bg-violet-700'
                      : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                  )}
                >
                  <Send size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 历史记录面板 */}
        <div
          className={cn(
            'flex flex-col border-r border-zinc-200 bg-white shadow-lg transition-all duration-200 overflow-hidden',
            historyOpen ? (bothOpen ? 'w-64' : 'w-80') : 'w-0'
          )}
        >
          {/* 面板头部 */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 shrink-0">
            <h3 className="text-sm font-medium text-zinc-800 whitespace-nowrap">{t.latex.history}</h3>
            <div className="flex items-center gap-1">
              {historyItems.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 whitespace-nowrap"
                >
                  {t.latex.clearHistory}
                </button>
              )}
              <button
                onClick={() => setHistoryOpen(false)}
                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* 面板列表 */}
          <div className="flex-1 overflow-y-auto">
            {historyItems.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-xs text-zinc-400 whitespace-nowrap">
                {t.latex.historyEmpty}
              </div>
            ) : (
              <div className="flex flex-col">
                {historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="group flex cursor-pointer items-start gap-2 border-b border-zinc-50 px-4 py-3 transition-colors hover:bg-zinc-50"
                    onClick={() => loadFromHistory(item.latex)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs text-zinc-700">
                        {item.latex.length > 80 ? item.latex.slice(0, 80) + '...' : item.latex}
                      </p>
                      <p className="mt-0.5 text-[10px] text-zinc-400">
                        {formatRelativeTime(item.createdAt, t.latex)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeHistoryItem(item.id)
                      }}
                      className="mt-0.5 shrink-0 rounded p-0.5 text-zinc-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
