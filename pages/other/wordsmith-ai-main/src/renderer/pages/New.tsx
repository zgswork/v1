import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText, Upload, X, Copy, Code, RefreshCw,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  Sparkles, ArrowRight, Maximize2, ExternalLink, AlertCircle, FileCode2,
  Loader2, Pencil, BookmarkPlus
} from 'lucide-react'
import { guardHtml } from '../lib/protocol-guard'
import { getTemplateById } from '../lib/templates'
import { ChatPanel } from '../components/business/ChatPanel'
import { PinnedRoundsDialog } from '../components/business/PinnedRoundsDialog'
import { useAppStore } from '../store/useAppStore'
import { useI18n } from '../store/useI18nStore'
import { Button } from '../components/ui/button'
import { Dialog, DialogHeader, DialogTitle, DialogClose, DialogContent, DialogFooter } from '../components/ui/Dialog'
import { toast } from '../store/useToastStore'

export default function NewPage() {
  const t = useI18n()
  const settings = useAppStore((s) => s.settings)
  const addHistoryItem = useAppStore((s) => s.addHistoryItem)
  const updateHistoryItem = useAppStore((s) => s.updateHistoryItem)
  const customInstruction = useAppStore((s) => s.customInstruction)
  const setCustomInstruction = useAppStore((s) => s.setCustomInstruction)
  const referenceFiles = useAppStore((s) => s.referenceFiles)
  const addReferenceFile = useAppStore((s) => s.addReferenceFile)
  const updateReferenceFile = useAppStore((s) => s.updateReferenceFile)
  const removeReferenceFile = useAppStore((s) => s.removeReferenceFile)
  const pinnedRounds = useAppStore((s) => s.pinnedRounds)
  const removePinnedRound = useAppStore((s) => s.removePinnedRound)
  const toggleRoundOverride = useAppStore((s) => s.toggleRoundOverride)
  const updateSettings = useAppStore((s) => s.updateSettings)

  // 使用全局工作区状态
  const workspace = useAppStore((s) => s.workspace)
  const updateWorkspace = useAppStore((s) => s.updateWorkspace)

  const { htmlDraft, finalHtml, guardReport } = workspace

  const template = useMemo(() => getTemplateById(settings.templateId), [settings.templateId])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [showSource, setShowSource] = useState(false)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [showVbaMacro, setShowVbaMacro] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [editingFile, setEditingFile] = useState<{ id: string; name: string; content: string } | null>(null)
  const [showPinnedDialog, setShowPinnedDialog] = useState(false)
  const [viewingPinned, setViewingPinned] = useState<typeof pinnedRounds[number] | null>(null)

  // Panel collapse states
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  const activeTypography = useMemo(
    () => ({
      fontFamily: settings.typography.fontFamily || template.style.fontFamily,
      fontSizePt: settings.typography.fontSizePt || template.style.fontSizePt,
    }),
    [settings.typography, template]
  )

  // 当 htmlDraft 变化时重新计算 guarded
  useEffect(() => {
    const guarded = guardHtml(htmlDraft, activeTypography)
    updateWorkspace({ finalHtml: guarded.html, guardReport: guarded.report })
  }, [htmlDraft, activeTypography, updateWorkspace])

  const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.webp']
  const isImageFile = (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    return IMAGE_EXTENSIONS.includes(ext)
  }
  const isPdfFile = (file: File) => {
    return file.name.toLowerCase().endsWith('.pdf')
  }

  const processPdf = async (file: File) => {
    const filePath = (file as File & { path?: string }).path
    if (!filePath) {
      toast({ title: 'PDF 处理失败', description: '无法获取文件路径，请确认在 Electron 环境中运行。', variant: 'destructive' })
      return
    }
    if (!window.wordsmith?.pdf?.toImages) {
      toast({ title: 'PDF 功能不可用', description: 'PDF 转换功能未就绪。', variant: 'destructive' })
      return
    }
    if (!window.wordsmith?.ocr?.recognize) {
      toast({ title: 'OCR 不可用', description: 'OCR 功能未就绪，请检查嵌入式 Python 环境。', variant: 'destructive' })
      return
    }

    setOcrLoading(true)
    try {
      // 1. PDF → 图片
      toast({ title: '正在转换 PDF...', variant: 'default', duration: 60000 })
      const pdfResult = await window.wordsmith.pdf.toImages(filePath)
      if (!pdfResult.success || !pdfResult.pages) {
        toast({ title: 'PDF 转换失败', description: pdfResult.error || '未知错误', variant: 'destructive' })
        return
      }

      const totalPages = pdfResult.pageCount ?? pdfResult.pages.length
      const vlmConfig = settings.ocrMode === 'vlm' ? settings.vlmOcr : null

      // 2. 逐页 OCR
      const allMarkdown: string[] = []
      for (let i = 0; i < pdfResult.pages.length; i++) {
        toast({
          title: `正在处理第 ${i + 1}/${totalPages} 页`,
          variant: 'default',
          duration: 60000,
        })
        const ocrResult = await window.wordsmith.ocr.recognize(pdfResult.pages[i], vlmConfig)
        if (ocrResult.success && ocrResult.markdown) {
          allMarkdown.push(`<!-- 第 ${i + 1} 页 -->\n${ocrResult.markdown}`)
        }
      }

      // 3. 合并结果
      if (allMarkdown.length > 0) {
        addReferenceFile({
          name: `[PDF] ${file.name}`,
          content: allMarkdown.join('\n\n---\n\n'),
        })
        toast({
          title: 'PDF 识别完成',
          description: `共 ${totalPages} 页，识别结果已添加到参考文件`,
          variant: 'success',
          duration: 5000,
        })
      } else {
        toast({ title: 'PDF OCR 识别失败', description: '未能从 PDF 中识别出文字。', variant: 'destructive' })
      }

      // 4. 清理临时文件
      await window.wordsmith.pdf.cleanup().catch(() => {})
    } catch {
      toast({ title: 'PDF 处理失败', description: '处理 PDF 时发生异常。', variant: 'destructive' })
    } finally {
      setOcrLoading(false)
    }
  }

  const processFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        const content = await file.text()
        addReferenceFile({ name: file.name, content })
      } else if (isPdfFile(file)) {
        await processPdf(file)
      } else if (isImageFile(file)) {
        const filePath = (file as File & { path?: string }).path
        if (!filePath) {
          toast({ title: 'OCR 识别失败', description: '无法获取文件路径，请确认在 Electron 环境中运行。', variant: 'destructive' })
          continue
        }
        if (!window.wordsmith?.ocr?.recognize) {
          toast({ title: 'OCR 不可用', description: 'OCR 功能未就绪，请检查嵌入式 Python 环境。', variant: 'destructive' })
          continue
        }
        // VLM 模式下，前端先校验配置是否完整，避免无意义请求
        const vlmConfig = settings.ocrMode === 'vlm' ? settings.vlmOcr : null
        if (settings.ocrMode === 'vlm' && (!vlmConfig?.baseUrl || !vlmConfig?.apiKey || !vlmConfig?.model)) {
          toast({
            title: 'VLM 未配置',
            description: '请前往「设置 → 高级」配置 VLM 视觉模型的 API 地址、模型名和 API Key 后再试。',
            variant: 'warning',
            duration: 8000,
          })
          continue
        }
        setOcrLoading(true)
        try {
          const result = await window.wordsmith.ocr.recognize(filePath, vlmConfig)
          if (result.success) {
            addReferenceFile({ name: `[OCR] ${file.name}`, content: result.markdown })
          } else if (result.error === 'VLM_NOT_CONFIGURED') {
            toast({
              title: 'VLM 未配置',
              description: '请前往「设置 → 高级」配置 VLM 视觉模型的 API 信息后再试。',
              variant: 'warning',
              duration: 8000,
            })
          } else if (result.error === 'OCR_ENGINE_NOT_INSTALLED') {
            toast({
              title: 'OCR 引擎未安装',
              description: '请前往「设置 → 高级」导入 OCR 引擎压缩包后再试。',
              variant: 'warning',
              duration: 8000,
            })
          } else {
            toast({ title: 'OCR 识别失败', description: result.error || '未知错误', variant: 'destructive' })
          }
        } catch {
          toast({ title: 'OCR 识别失败', description: '调用 OCR 进程时发生异常。', variant: 'destructive' })
        } finally {
          setOcrLoading(false)
        }
      }
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    await processFiles(files)
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.files?.length) {
      processFiles(e.dataTransfer.files)
    }
  }

  const copyToClipboard = async () => {
    try {
      const text = finalHtml.replace(/<[^>]+>/g, '')
      if (window.wordsmith?.clipboard?.write) {
        await window.wordsmith.clipboard.write({ html: finalHtml, text })
      } else if (navigator.clipboard?.write) {
        const item = new ClipboardItem({
          'text/html': new Blob([finalHtml], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        })
        await navigator.clipboard.write([item])
      } else {
        await navigator.clipboard.writeText(text)
      }
      toast({
        title: '已复制到剪贴板',
        description: '请在 Word 中选择【保留原格式】粘贴',
        variant: 'success',
        duration: 5000
      })
    } catch {
      toast({ title: '复制失败', variant: 'destructive' })
    }
  }

  const openPreviewWindow = () => {
    const previewWindow = window.open('', '_blank', 'width=800,height=600,menubar=no,toolbar=no')
    if (previewWindow) {
      previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>WordSmith 预览</title>
          <style>
            body { margin: 0; padding: 24px; background: #fff; }
          </style>
        </head>
        <body>
          ${finalHtml}
        </body>
        </html>
      `)
      previewWindow.document.close()
    }
  }

  const refreshPreview = () => {
    const guarded = guardHtml(htmlDraft, activeTypography)
    updateWorkspace({ finalHtml: guarded.html, guardReport: guarded.report })
  }

  return (
    <div className="relative flex h-full w-full bg-zinc-50">
      {/* Left Column: Context Sidebar */}
      <aside
        className={`flex h-full shrink-0 flex-col border-r border-zinc-200/50 bg-white/80 backdrop-blur-sm transition-all duration-300 ${
          leftCollapsed ? 'w-0 overflow-hidden border-r-0' : 'w-64'
        }`}
      >
        <div className="flex h-full flex-col overflow-hidden">
          {/* Safe zone for Windows title bar - drag region */}
          <div className="h-9 w-full shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/50 px-4 pb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">智囊配置</span>
            <Button variant="ghost" size="icon" onClick={() => setLeftCollapsed(true)} className="h-7 w-7">
              <PanelLeftClose size={14} />
            </Button>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            {/* 上下文轮次 + 引用历史对话 */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-600">{t.context.maxRounds}</label>
                <span className="text-xs text-zinc-500">
                  {settings.contextMaxRounds === 0 ? t.context.unlimited : `${settings.contextMaxRounds} ${t.context.rounds}`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                value={settings.contextMaxRounds}
                onChange={(e) => updateSettings({ contextMaxRounds: Number(e.target.value) })}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-violet-500"
              />
              <div className="mt-0.5 flex justify-between text-[10px] text-zinc-400">
                <span>{t.context.unlimited}</span>
                <span>20</span>
              </div>

              {/* 引用历史对话按钮 */}
              <button
                onClick={() => setShowPinnedDialog(true)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-200 py-1.5 text-[11px] text-zinc-500 transition-colors hover:border-violet-300 hover:bg-violet-50/50 hover:text-violet-600"
              >
                <BookmarkPlus size={12} />
                {t.context.pinnedTitle}
                {pinnedRounds.length > 0 && (
                  <span className="rounded-full bg-violet-100 px-1.5 text-[10px] font-medium text-violet-600">{pinnedRounds.length}</span>
                )}
              </button>

              {pinnedRounds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {pinnedRounds.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] text-violet-700"
                    >
                      <button
                        onClick={() => setViewingPinned(p)}
                        className="flex max-w-[140px] items-center gap-1 truncate hover:underline"
                        title="点击查看内容"
                      >
                        <span className="max-w-[70px] truncate">{p.sourceTitle}</span>
                        <span className="text-violet-400">·</span>
                        <span className="max-w-[60px] truncate">{p.userContent.slice(0, 20)}</span>
                      </button>
                      <button
                        onClick={() => removePinnedRound(p.id)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-violet-200"
                      >
                        <X size={8} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Instruction */}
            <div>
              <label className="mb-2 block text-xs font-medium text-zinc-600">
                自定义指令
              </label>
              <textarea
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                placeholder="输入长效指令..."
                className="min-h-[80px] w-full resize-none rounded-xl border-0 bg-zinc-100/80 px-3 py-2.5 text-sm text-zinc-700 placeholder:text-zinc-400 focus:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-300/50"
              />
            </div>

            {/* Reference Files */}
            <div onDragOver={handleDragOver} onDrop={handleDrop}>
              <label className="mb-2 block text-xs font-medium text-zinc-600">
                参考文档
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.png,.jpg,.jpeg,.bmp,.tiff,.tif,.webp,.pdf"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={ocrLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 px-3 py-3 text-xs text-zinc-500 transition-all hover:border-zinc-300 hover:bg-zinc-100/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ocrLoading ? <><Loader2 size={14} className="animate-spin" /> OCR 识别中...</> : <><Upload size={14} /> 上传文档</>}
              </button>

              {/* PDF/Word 提示 */}
              <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-700">
                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                <span>支持 .txt/.md 文本及 .png/.jpg 图片（OCR 识别）。PDF/Word 请先提取文字后上传。</span>
              </div>

              {referenceFiles.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {referenceFiles.map((file) => (
                    <div
                      key={file.id}
                      className="group flex items-center gap-2 rounded-lg bg-zinc-100/80 px-2.5 py-2"
                    >
                      <FileText size={12} className="shrink-0 text-zinc-400" />
                      <button
                        onClick={() => setEditingFile({ id: file.id, name: file.name, content: file.content })}
                        className="flex-1 truncate text-left text-xs text-zinc-600 hover:text-zinc-900 hover:underline"
                        title="点击编辑内容"
                      >
                        {file.name}
                      </button>
                      <button
                        onClick={() => setEditingFile({ id: file.id, name: file.name, content: file.content })}
                        className="shrink-0 rounded p-0.5 text-zinc-400 opacity-0 transition-all hover:bg-zinc-200 hover:text-zinc-600 group-hover:opacity-100"
                        title="编辑"
                      >
                        <Pencil size={10} />
                      </button>
                      <button
                        onClick={() => removeReferenceFile(file.id)}
                        className="shrink-0 rounded p-0.5 text-zinc-400 opacity-0 transition-all hover:bg-zinc-200 hover:text-zinc-600 group-hover:opacity-100"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Left Collapse Toggle (when collapsed) - positioned below safe zone */}
      {leftCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLeftCollapsed(false)}
          className="absolute left-2 top-12 z-10 h-8 w-8 rounded-lg bg-white shadow-md"
        >
          <PanelLeftOpen size={14} />
        </Button>
      )}

      {/* Middle Column: Chat Workspace */}
      <main className="flex h-full min-w-0 flex-1 flex-col bg-white">
        {/* Safe zone for Windows title bar - drag region */}
        <div className="h-9 w-full shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
        <ChatPanel
          baseUrl={settings.ai.baseUrl}
          apiKey={settings.ai.apiKey}
          model={settings.ai.model}
          defaults={activeTypography}
          customInstruction={customInstruction}
          referenceFiles={referenceFiles}
          htmlDraft={htmlDraft}
          contextMaxRounds={settings.contextMaxRounds}
          roundOverrides={workspace.roundOverrides}
          pinnedRounds={pinnedRounds}
          onToggleRound={(idx) => toggleRoundOverride(idx)}
          onHtmlFinalized={(html, report, payload) => {
            updateWorkspace({ htmlDraft: html, finalHtml: html, guardReport: report })
            const title = payload.messages.find((m) => m.role === 'user')?.content?.slice(0, 24) || '新文档'
            if (workspace.id) {
              // 已有对话 → 更新
              updateHistoryItem(workspace.id, {
                messages: payload.messages,
                finalHtml: html,
              })
            } else {
              // 新对话 → 创建
              addHistoryItem({
                title,
                mode: payload.mode,
                messages: payload.messages,
                finalHtml: html,
              })
            }
          }}
          emptyState={
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-200">
                <Sparkles className="h-8 w-8 text-zinc-400" />
              </div>
              <h2 className="mb-2 text-xl font-semibold text-zinc-800">
                开始智能排版
              </h2>
              <p className="mb-6 max-w-md text-sm leading-relaxed text-zinc-500">
                输入您的内容需求，AI 将自动生成符合 Word 排版规范的专业文档。
                支持表格、公式、多级标题等复杂格式。
              </p>
              <div className="flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-xs text-zinc-500">
                <span>在下方输入框开始</span>
                <ArrowRight size={12} />
              </div>
            </div>
          }
        />
      </main>

      {/* Right Collapse Toggle (when collapsed) - positioned below safe zone */}
      {rightCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setRightCollapsed(false)}
          className="absolute right-3 top-12 z-10 h-8 w-8 rounded-lg bg-white shadow-md"
        >
          <PanelRightOpen size={14} />
        </Button>
      )}

      {/* Right Column: Word Preview */}
      <aside
        className={`flex h-full shrink-0 flex-col bg-zinc-100 transition-all duration-300 ${
          rightCollapsed ? 'w-0 overflow-hidden' : 'w-80 lg:w-96'
        }`}
      >
        <div className="flex h-full flex-col overflow-hidden">
          {/* Safe zone for Windows title bar buttons */}
          <div className="h-9 w-full shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

          {/* Toolbar - below safe zone */}
          <div className="flex shrink-0 flex-col gap-2 px-4 pb-3">
            <div className="flex items-center">
              <span className="text-xs font-medium text-zinc-500">预览</span>
              <div className="ml-4 flex items-center gap-1">
                <Button
                  variant={showSource ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setShowSource(!showSource)}
                  className="h-7 w-7"
                  title="源码"
                >
                  <Code size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={refreshPreview}
                  className="h-7 w-7"
                  title="刷新"
                >
                  <RefreshCw size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowFullscreen(true)}
                  className="h-7 w-7"
                  title="全屏预览"
                >
                  <Maximize2 size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={openPreviewWindow}
                  className="h-7 w-7"
                  title="新窗口打开"
                >
                  <ExternalLink size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowVbaMacro(true)}
                  className="h-7 w-7"
                  title="VBA 宏助手"
                >
                  <FileCode2 size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRightCollapsed(true)}
                  className="h-7 w-7"
                >
                  <PanelRightClose size={14} />
                </Button>
              </div>
            </div>
            {/* Copy button - always visible */}
            <Button
              onClick={copyToClipboard}
              className="w-full gap-2"
              disabled={!finalHtml}
            >
              <Copy size={14} />
              复制到剪贴板
            </Button>
          </div>

          {/* Preview Area */}
          <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4 pt-0">
            {showSource ? (
              <div className="min-h-0 flex-1 overflow-auto rounded-xl bg-zinc-900 p-4">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-300">
                  {finalHtml}
                </pre>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto rounded-xl bg-white p-6 shadow-lg">
                <iframe
                  title="word-preview"
                  className="h-full min-h-[400px] w-full border-0"
                  sandbox="allow-same-origin"
                  srcDoc={finalHtml}
                />
              </div>
            )}
          </div>

          {/* Stats */}
          {guardReport && (
            <div className="shrink-0 border-t border-zinc-200/50 px-4 py-2">
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                <span>单位: {guardReport.convertedUnits}</span>
                <span>表格: {guardReport.tablesProcessed}</span>
                <span>清理: {guardReport.removedStyleTags}</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Fullscreen Preview Modal */}
      {showFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-zinc-100">
          {/* Header with safe zone for Windows title bar */}
          <div
            className="flex shrink-0 items-center border-b border-zinc-200 bg-white px-6"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          >
            <h2
              className="py-4 text-lg font-semibold text-zinc-900"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              全屏预览
            </h2>
            <div
              className="ml-6 flex items-center gap-2"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <Button variant="outline" onClick={openPreviewWindow} className="gap-2">
                <ExternalLink size={14} />
                新窗口
              </Button>
              <Button onClick={copyToClipboard} className="gap-2">
                <Copy size={14} />
                复制到剪贴板
              </Button>
            </div>
            {/* Safe zone spacer for Windows caption buttons */}
            <div className="flex-1" />
            <div
              className="flex items-center"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <Button variant="ghost" size="icon" onClick={() => setShowFullscreen(false)} className="mr-[150px]">
                <X size={18} />
              </Button>
            </div>
          </div>
          {/* Content area - single scroll container */}
          <div className="flex-1 overflow-auto p-8">
            <div className="mx-auto max-w-5xl rounded-xl bg-white p-8 shadow-xl">
              <div
                className="prose prose-zinc max-w-none"
                dangerouslySetInnerHTML={{ __html: finalHtml }}
              />
            </div>
          </div>
        </div>
      )}

      {/* VBA Macro Helper Dialog */}
      <VbaMacroDialog open={showVbaMacro} onClose={() => setShowVbaMacro(false)} />

      {/* 引用历史对话弹窗 */}
      <PinnedRoundsDialog open={showPinnedDialog} onClose={() => setShowPinnedDialog(false)} />

      {/* 查看固定轮次内容 */}
      {viewingPinned && (
        <Dialog open onClose={() => setViewingPinned(null)} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">{viewingPinned.sourceTitle}</DialogTitle>
            <DialogClose onClose={() => setViewingPinned(null)} />
          </DialogHeader>
          <DialogContent className="max-h-[60vh] space-y-4 overflow-y-auto">
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-500">User</div>
              <div className="whitespace-pre-wrap rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
                {viewingPinned.userContent}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-500">Assistant</div>
              <div className="whitespace-pre-wrap rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
                {viewingPinned.assistantContent}
              </div>
            </div>
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setViewingPinned(null)}>关闭</Button>
            <Button
              variant="destructive"
              onClick={() => { removePinnedRound(viewingPinned.id); setViewingPinned(null) }}
            >
              移除引用
            </Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* 参考文件编辑弹窗 */}
      {editingFile && (
        <Dialog open onClose={() => setEditingFile(null)} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate text-sm">{editingFile.name}</DialogTitle>
            <DialogClose onClose={() => setEditingFile(null)} />
          </DialogHeader>
          <DialogContent className="flex max-h-[60vh] flex-col">
            <textarea
              value={editingFile.content}
              onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
              className="min-h-[300px] flex-1 resize-none rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-sm leading-relaxed text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              spellCheck={false}
            />
          </DialogContent>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingFile(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                updateReferenceFile(editingFile.id, editingFile.content)
                setEditingFile(null)
                toast({ title: '已保存修改', variant: 'success' })
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  )
}

const VBA_CODE = `Sub LatexToWordMath_Robust_Final()
    Dim rng As Range
    Dim mathRng As Range
    Dim rawContent As String

    Application.ScreenUpdating = False

    ' --- 第一阶段：处理行间公式 $$...$$ ---
    Set rng = ActiveDocument.Content
    With rng.Find
        .ClearFormatting
        .Text = "\\$\\$*\\$\\$"
        .MatchWildcards = True
        Do While .Execute
            ' 创建副本区域进行精准切割，保留论坛原始的稳健逻辑
            Set mathRng = rng.Duplicate
            mathRng.MoveEnd Unit:=wdCharacter, Count:=-2
            mathRng.Start = mathRng.Start + 2

            rawContent = mathRng.Text
            rng.Text = rawContent ' 将 $$ 内容替换为纯文本

            ' 关键动作：添加公式对象并强制"由线性转为专业格式"
            ActiveDocument.OMaths.Add rng
            rng.OMaths(1).BuildUp ' 强制渲染成分数线、根号等专业样式

            rng.Collapse wdCollapseEnd
        Loop
    End With

    ' --- 第二阶段：处理行内公式 $...$ ---
    Set rng = ActiveDocument.Content
    With rng.Find
        .ClearFormatting
        .Text = "\\$*\\$"
        .MatchWildcards = True
        Do While .Execute
            ' 安全检查：确保不是刚刚处理过的公式
            If rng.OMaths.Count = 0 Then
                Set mathRng = rng.Duplicate
                mathRng.MoveEnd Unit:=wdCharacter, Count:=-1
                mathRng.Start = mathRng.Start + 1

                rawContent = mathRng.Text
                rng.Text = rawContent

                ActiveDocument.OMaths.Add rng
                ' 再次强制触发专业排版渲染
                rng.OMaths(1).BuildUp
            End If
            rng.Collapse wdCollapseEnd
        Loop
    End With

    Application.ScreenUpdating = True
    MsgBox "全文档公式及排版已深度转换完成！"
End Sub`

function VbaMacroDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(VBA_CODE)
      toast({ title: '已复制 VBA 代码', variant: 'success' })
    } catch {
      toast({ title: '复制失败', variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-3xl">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <FileCode2 size={20} />
          </div>
          <div>
            <DialogTitle>VBA 宏助手</DialogTitle>
            <p className="mt-0.5 text-xs text-zinc-500">将 LaTeX 公式转换为 Word 原生公式</p>
          </div>
        </div>
        <DialogClose onClose={onClose} />
      </DialogHeader>
      <DialogContent className="space-y-4">
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>使用场景：</strong>当文档中包含 <code className="rounded bg-amber-100 px-1">$...$</code> 或 <code className="rounded bg-amber-100 px-1">$$...$$</code> 格式的 LaTeX 公式时，运行此宏可将其转换为 Word 原生公式。
        </div>
        <div className="max-h-[280px] overflow-auto rounded-xl bg-zinc-900 p-4">
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-300">
            {VBA_CODE}
          </pre>
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-zinc-700">使用步骤</h4>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-zinc-600">
            <li>在 Word 中按 <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-xs font-medium">Alt + F11</kbd> 打开 VBA 编辑器</li>
            <li>在左侧项目窗口中，双击 <strong>ThisDocument</strong></li>
            <li>将上方代码粘贴到右侧代码区域</li>
            <li>按 <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-xs font-medium">F5</kbd> 运行宏，或关闭编辑器后通过「视图 → 宏」运行</li>
          </ol>
        </div>
      </DialogContent>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>关闭</Button>
        <Button onClick={copyCode} className="gap-2">
          <Copy size={14} />
          复制代码
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
