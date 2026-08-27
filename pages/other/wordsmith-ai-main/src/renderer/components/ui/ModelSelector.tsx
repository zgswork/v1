import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Search, Loader2, RefreshCw, Keyboard, Check, Clock, Star, List, X } from 'lucide-react'
import { useModelList } from '../../hooks/useModelList'
import { useI18n } from '../../store/useI18nStore'
import { cn } from '../../lib/cn'

export interface ModelSelectorProps {
  value: string
  onChange: (model: string) => void
  baseUrl: string
  apiKey: string
  /** 提供商预设的推荐模型（兜底 / 无 key 时显示） */
  staticModels?: string[]
  /** 最近使用的模型列表 */
  recentModels?: string[]
  /** 选择模型后的回调（用于记录最近使用） */
  onModelUsed?: (model: string) => void
  /** 删除最近使用中的某个模型 */
  onRemoveRecent?: (model: string) => void
  placeholder?: string
}

export function ModelSelector({
  value,
  onChange,
  baseUrl,
  apiKey,
  staticModels = [],
  recentModels = [],
  onModelUsed,
  onRemoveRecent,
  placeholder = 'deepseek-chat',
}: ModelSelectorProps) {
  const t = useI18n()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [manualMode, setManualMode] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const manualInputRef = useRef<HTMLInputElement>(null)

  const { models: apiModels, loading, error, refresh } = useModelList(baseUrl, apiKey)

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setManualMode(false)
        setSearch('')
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // 打开时聚焦搜索框
  useEffect(() => {
    if (open && !manualMode) {
      setTimeout(() => searchInputRef.current?.focus(), 0)
    }
  }, [open, manualMode])

  // 手动模式聚焦输入框
  useEffect(() => {
    if (manualMode) {
      setTimeout(() => manualInputRef.current?.focus(), 0)
    }
  }, [manualMode])

  const handleSelect = (model: string) => {
    onChange(model)
    onModelUsed?.(model)
    setOpen(false)
    setManualMode(false)
    setSearch('')
  }

  const handleManualConfirm = () => {
    const trimmed = manualInput.trim()
    if (trimmed) {
      handleSelect(trimmed)
      setManualInput('')
    }
  }

  // 搜索过滤
  const query = search.toLowerCase()
  const recentSet = new Set(recentModels)
  const staticSet = new Set(staticModels)

  const filteredRecent = useMemo(
    () => recentModels.filter((m) => m.toLowerCase().includes(query)),
    [recentModels, query]
  )
  const filteredStatic = useMemo(
    () => staticModels.filter((m) => m.toLowerCase().includes(query) && !recentSet.has(m)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staticModels, recentModels, query]
  )
  const filteredApi = useMemo(
    () => apiModels.filter(
      (m) => m.toLowerCase().includes(query) && !recentSet.has(m) && !staticSet.has(m)
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiModels, recentModels, staticModels, query]
  )

  const hasAnyResult = filteredRecent.length > 0 || filteredStatic.length > 0 || filteredApi.length > 0

  return (
    <div ref={containerRef} className="relative">
      {/* 触发按钮 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border-0 bg-zinc-100 px-3 py-2 text-left text-sm transition-all hover:bg-zinc-200"
      >
        <span className={value ? 'text-zinc-900' : 'text-zinc-400'}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {loading && <Loader2 size={14} className="animate-spin text-zinc-400" />}
          <ChevronDown size={16} className={cn('text-zinc-400 transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {/* 下拉面板 */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
          {!manualMode ? (
            <>
              {/* 搜索栏 */}
              <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2">
                <Search size={14} className="shrink-0 text-zinc-400" />
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.modelSelector.searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
                />
                {loading && <Loader2 size={14} className="shrink-0 animate-spin text-zinc-400" />}
                {!loading && (
                  <button
                    onClick={(e) => { e.stopPropagation(); refresh() }}
                    className="shrink-0 text-zinc-400 hover:text-zinc-600"
                    title={t.modelSelector.retry}
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
              </div>

              {/* 列表区域 */}
              <div className="max-h-64 overflow-y-auto">
                {/* 最近使用 */}
                {filteredRecent.length > 0 && (
                  <ModelGroup
                    icon={<Clock size={12} />}
                    label={t.modelSelector.recentGroup}
                    models={filteredRecent}
                    value={value}
                    onSelect={handleSelect}
                    onRemove={onRemoveRecent}
                  />
                )}

                {/* 推荐模型（静态兜底） */}
                {filteredStatic.length > 0 && (
                  <ModelGroup
                    icon={<Star size={12} />}
                    label={t.modelSelector.recommendedGroup}
                    models={filteredStatic}
                    value={value}
                    onSelect={handleSelect}
                  />
                )}

                {/* API 获取的全部模型 */}
                {filteredApi.length > 0 && (
                  <ModelGroup
                    icon={<List size={12} />}
                    label={`${t.modelSelector.allModelsGroup} (${filteredApi.length})`}
                    models={filteredApi}
                    value={value}
                    onSelect={handleSelect}
                  />
                )}

                {/* 加载中 */}
                {loading && apiModels.length === 0 && (
                  <div className="flex items-center gap-2 px-3 py-3 text-xs text-zinc-400">
                    <Loader2 size={14} className="animate-spin" />
                    {t.modelSelector.loading}
                  </div>
                )}

                {/* 加载失败 — 直接显示服务端返回的错误 */}
                {error && !loading && (
                  <div className="px-3 py-2.5">
                    <div className="text-xs text-red-400">{t.modelSelector.loadError}</div>
                    <div className="mt-0.5 text-[11px] text-zinc-400">{error}</div>
                  </div>
                )}

                {/* 搜索无结果 */}
                {!loading && !hasAnyResult && search && (
                  <div className="px-3 py-3 text-xs text-zinc-400">
                    {t.modelSelector.noResults}
                  </div>
                )}
              </div>

              {/* 手动输入入口 */}
              <div className="border-t border-zinc-100">
                <button
                  onClick={() => setManualMode(true)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-zinc-500 transition-colors hover:bg-zinc-50"
                >
                  <Keyboard size={12} />
                  {t.modelSelector.manualInput}
                </button>
              </div>
            </>
          ) : (
            /* 手动输入模式 */
            <div className="p-3">
              <div className="flex items-center gap-2">
                <input
                  ref={manualInputRef}
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleManualConfirm()
                    if (e.key === 'Escape') { setManualMode(false); setManualInput('') }
                  }}
                  placeholder={t.modelSelector.manualInputPlaceholder}
                  className="min-w-0 flex-1 rounded-lg bg-zinc-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300"
                />
                <button
                  onClick={handleManualConfirm}
                  disabled={!manualInput.trim()}
                  className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-xs text-white transition-colors hover:bg-zinc-800 disabled:opacity-40"
                >
                  {t.common.confirm}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** 分组子组件 */
function ModelGroup({
  icon,
  label,
  models,
  value,
  onSelect,
  onRemove,
}: {
  icon: React.ReactNode
  label: string
  models: string[]
  value: string
  onSelect: (model: string) => void
  onRemove?: (model: string) => void
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        {icon}
        {label}
      </div>
      {models.map((m) => (
        <div
          key={m}
          className={cn(
            'group flex w-full items-center justify-between px-3 py-1.5 text-sm transition-colors',
            value === m ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-700 hover:bg-zinc-50'
          )}
        >
          <button
            className="min-w-0 flex-1 truncate text-left"
            onClick={() => onSelect(m)}
          >
            {m}
          </button>
          <div className="flex shrink-0 items-center gap-1">
            {value === m && <Check size={14} className="text-zinc-500" />}
            {onRemove && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(m) }}
                className="ml-1 rounded p-0.5 text-zinc-300 opacity-0 transition-all hover:bg-zinc-200 hover:text-zinc-600 group-hover:opacity-100"
                title="删除"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
