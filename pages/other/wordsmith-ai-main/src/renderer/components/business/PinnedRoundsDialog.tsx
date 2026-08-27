import { useState, useMemo } from 'react'
import { Pin, PinOff, Search, MessageSquare } from 'lucide-react'
import { Dialog, DialogHeader, DialogTitle, DialogClose, DialogContent } from '../ui/Dialog'
import { Button } from '../ui/button'
import { useAppStore, type HistoryItem } from '../../store/useAppStore'
import { useI18n } from '../../store/useI18nStore'
import { getRoundsFromMessages } from '../../lib/context-filter'
import { toast } from '../../store/useToastStore'

interface PinnedRoundsDialogProps {
  open: boolean
  onClose: () => void
}

export function PinnedRoundsDialog({ open, onClose }: PinnedRoundsDialogProps) {
  const t = useI18n()
  const history = useAppStore((s) => s.history)
  const pinnedRounds = useAppStore((s) => s.pinnedRounds)
  const addPinnedRound = useAppStore((s) => s.addPinnedRound)
  const removePinnedRound = useAppStore((s) => s.removePinnedRound)

  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filteredHistory = useMemo(() => {
    if (!search.trim()) return history
    const q = search.toLowerCase()
    return history.filter((h) => h.title.toLowerCase().includes(q))
  }, [history, search])

  const selectedItem = useMemo(
    () => history.find((h) => h.id === selectedId) || null,
    [history, selectedId]
  )

  const selectedRounds = useMemo(() => {
    if (!selectedItem) return []
    return getRoundsFromMessages(selectedItem.messages)
  }, [selectedItem])

  // 检查某轮是否已固定
  const isPinned = (historyId: string, roundIndex: number) => {
    return pinnedRounds.some(
      (p) => p.sourceId === historyId && p.userContent === selectedRounds[roundIndex]?.user
        && p.assistantContent === selectedRounds[roundIndex]?.assistant
    )
  }

  const findPinnedId = (historyId: string, roundIndex: number) => {
    return pinnedRounds.find(
      (p) => p.sourceId === historyId && p.userContent === selectedRounds[roundIndex]?.user
        && p.assistantContent === selectedRounds[roundIndex]?.assistant
    )?.id
  }

  const handlePin = (item: HistoryItem, roundIndex: number) => {
    const round = selectedRounds[roundIndex]
    if (!round) return

    const pinned = isPinned(item.id, roundIndex)
    if (pinned) {
      const id = findPinnedId(item.id, roundIndex)
      if (id) removePinnedRound(id)
    } else {
      const ok = addPinnedRound({
        sourceId: item.id,
        sourceTitle: item.title,
        userContent: round.user,
        assistantContent: round.assistant,
      })
      if (!ok) {
        toast({ title: t.context.pinnedLimitReached, variant: 'warning' })
      }
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>{t.context.pinnedTitle}</DialogTitle>
        <DialogClose onClose={onClose} />
      </DialogHeader>
      <DialogContent className="flex h-[60vh] gap-0 p-0">
        {/* 左侧：历史对话列表 */}
        <div className="flex w-56 shrink-0 flex-col border-r border-zinc-200">
          <div className="border-b border-zinc-100 p-3">
            <div className="flex items-center gap-2 rounded-lg bg-zinc-100 px-2.5 py-1.5">
              <Search size={14} className="shrink-0 text-zinc-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.context.searchHistory}
                className="w-full bg-transparent text-xs text-zinc-700 placeholder:text-zinc-400 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredHistory.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`flex w-full items-start gap-2 border-b border-zinc-50 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 ${
                  selectedId === item.id ? 'bg-zinc-100' : ''
                }`}
              >
                <MessageSquare size={14} className="mt-0.5 shrink-0 text-zinc-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-zinc-700">{item.title}</div>
                  <div className="mt-0.5 text-[10px] text-zinc-400">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </button>
            ))}
            {filteredHistory.length === 0 && (
              <div className="p-4 text-center text-xs text-zinc-400">{t.common.noData}</div>
            )}
          </div>
        </div>

        {/* 右侧：轮次列表 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedItem ? (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {selectedRounds.map((round, idx) => {
                  const pinned = isPinned(selectedItem.id, idx)
                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border p-3 transition-colors ${
                        pinned ? 'border-violet-200 bg-violet-50' : 'border-zinc-200 bg-white'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500">
                          {t.context.roundLabel.replace('{n}', String(idx + 1))}
                        </span>
                        <Button
                          variant={pinned ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => handlePin(selectedItem, idx)}
                          className={`h-7 gap-1 text-xs ${pinned ? 'text-violet-600' : ''}`}
                        >
                          {pinned ? <PinOff size={12} /> : <Pin size={12} />}
                          {pinned ? t.context.unpinRound : t.context.pinRound}
                        </Button>
                      </div>
                      <div className="line-clamp-2 text-xs text-zinc-600">
                        {round.user}
                      </div>
                    </div>
                  )
                })}
                {selectedRounds.length === 0 && (
                  <div className="py-8 text-center text-xs text-zinc-400">{t.common.noData}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-zinc-400">{t.context.selectConversation}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
