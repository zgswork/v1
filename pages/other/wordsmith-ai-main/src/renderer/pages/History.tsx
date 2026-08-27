import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, Search, FileX2, Clock, MessageSquare, Bug, X, Sparkles, Wrench, AlertTriangle } from 'lucide-react'
import { CopyToWordButton } from '../components/business/CopyToWordButton'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { ConfirmDialog } from '../components/ui/Dialog'
import { useAppStore, type EnhancedChatMessage } from '../store/useAppStore'
import { useI18n } from '../store/useI18nStore'

export default function HistoryPage() {
  const t = useI18n()
  const navigate = useNavigate()
  const history = useAppStore((s) => s.history)
  const clearHistory = useAppStore((s) => s.clearHistory)
  const deleteHistoryItem = useAppStore((s) => s.deleteHistoryItem)
  const loadChat = useAppStore((s) => s.loadChat)
  const [search, setSearch] = useState('')
  const [debugModal, setDebugModal] = useState<{ open: boolean; content: string }>({ open: false, content: '' })
  const [clearConfirm, setClearConfirm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: '' })

  const filtered = history.filter((item) => {
    if (!search) return true
    return item.title.toLowerCase().includes(search.toLowerCase()) || item.finalHtml.includes(search)
  })

  const hasNoHistory = history.length === 0
  const hasNoResults = !hasNoHistory && filtered.length === 0

  const handleContinueChat = (historyId: string) => {
    if (loadChat(historyId)) {
      navigate('/')
    }
  }

  const showDebug = (messages: EnhancedChatMessage[]) => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && m.rawRequest)
    if (lastAssistant?.rawRequest) {
      setDebugModal({ open: true, content: lastAssistant.rawRequest })
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">{t.history.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            共 {history.length} 条记录
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setClearConfirm(true)}
          disabled={hasNoHistory}
          className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 size={14} />
          {t.history.clear}
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.common.searchPlaceholder}
          className="w-full rounded-xl border-0 bg-zinc-100 py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
        />
      </div>

      {/* Empty State - No History */}
      {hasNoHistory && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 py-16">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100">
            <Clock size={28} className="text-zinc-400" />
          </div>
          <h3 className="mb-2 text-base font-medium text-zinc-700">暂无历史记录</h3>
          <p className="max-w-sm text-center text-sm text-zinc-500">
            您生成的文档将自动保存在这里，方便随时查看和复用。
          </p>
        </div>
      )}

      {/* Empty State - No Search Results */}
      {hasNoResults && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 py-16">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100">
            <FileX2 size={28} className="text-zinc-400" />
          </div>
          <h3 className="mb-2 text-base font-medium text-zinc-700">未找到匹配结果</h3>
          <p className="max-w-sm text-center text-sm text-zinc-500">
            尝试使用其他关键词搜索，或清空搜索框查看全部记录。
          </p>
          <Button
            variant="ghost"
            onClick={() => setSearch('')}
            className="mt-4"
          >
            清空搜索
          </Button>
        </div>
      )}

      {/* History List */}
      {filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((item) => {
            const hasDebugInfo = item.messages.some((m) => m.role === 'assistant' && m.rawRequest)
            return (
              <Card key={item.id} className="overflow-hidden transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="truncate text-base">{item.title}</CardTitle>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                          item.mode === 'generate'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}>
                          {item.mode === 'generate' ? <Sparkles size={10} /> : <Wrench size={10} />}
                          {item.mode === 'generate' ? '生成' : '纠错'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {hasDebugInfo && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                          onClick={() => showDebug(item.messages)}
                          title="查看 Debug 信息"
                        >
                          <Bug size={16} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                        onClick={() => setDeleteConfirm({ open: true, id: item.id })}
                        title="删除此记录"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <CopyToWordButton html={item.finalHtml} />
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => handleContinueChat(item.id)}
                      className="gap-2"
                    >
                      <MessageSquare size={14} />
                      继续对话
                    </Button>
                  </div>
                  <details className="group rounded-xl border border-zinc-200 bg-zinc-50 text-sm">
                    <summary className="cursor-pointer select-none px-4 py-3 font-medium text-zinc-600 transition-colors hover:text-zinc-900">
                      {t.history.viewSource}
                    </summary>
                    <div className="border-t border-zinc-200 p-4">
                      <pre className="max-h-[240px] overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-900 p-3 font-mono text-xs text-zinc-300">
                        {item.finalHtml}
                      </pre>
                    </div>
                  </details>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

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

      {/* Clear History Confirm Dialog */}
      <ConfirmDialog
        open={clearConfirm}
        onClose={() => setClearConfirm(false)}
        onConfirm={clearHistory}
        title="清空所有历史记录"
        description="此操作将永久删除所有历史记录，且无法恢复。确定要继续吗？"
        confirmText="确认清空"
        cancelText="取消"
        variant="destructive"
        icon={<AlertTriangle size={20} />}
      />

      {/* Delete Single Item Confirm Dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: '' })}
        onConfirm={() => deleteHistoryItem(deleteConfirm.id)}
        title="删除此记录"
        description="确定要删除这条历史记录吗？此操作无法撤销。"
        confirmText="确认删除"
        cancelText="取消"
        variant="destructive"
        icon={<AlertTriangle size={20} />}
      />
    </div>
  )
}
