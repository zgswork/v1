import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FilePlus2, Clock, Settings, HelpCircle, Sparkles, Plus, Sigma } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useAppStore } from '../../store/useAppStore'
import { useUpdateStore } from '../../store/useUpdateStore'

const NAV_ITEMS = [
  { to: '/', icon: FilePlus2, label: '主页' },
  { to: '/latex', icon: Sigma, label: '公式' },
  { to: '/history', icon: Clock, label: '历史' },
  { to: '/settings', icon: Settings, label: '设置' },
  { to: '/help', icon: HelpCircle, label: '帮助' },
]

export function GlobalSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const createNewChat = useAppStore((s) => s.createNewChat)
  const hasMessages = useAppStore((s) => s.workspace.messages.length > 0)
  const hasUpdate = useUpdateStore((s) => s.showDot)

  const handleNewChat = () => {
    createNewChat()
    navigate('/')
  }

  return (
    <aside className="relative z-50 flex h-full w-16 shrink-0 flex-col items-center border-r border-zinc-200/50 bg-zinc-100/50">
      {/* Drag Region - Top area for window dragging, with extra padding for Windows caption */}
      <div
        className="flex w-full shrink-0 flex-col items-center pb-2 pt-8"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Brand Logo */}
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <Sparkles size={18} className="text-white" />
        </div>
      </div>

      {/* New Chat Button */}
      <button
        onClick={handleNewChat}
        disabled={!hasMessages}
        className={cn(
          'group relative mb-4 flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200',
          hasMessages
            ? 'bg-zinc-900 text-white hover:bg-zinc-800'
            : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
        )}
      >
        <Plus size={20} strokeWidth={2} />
        <span className="pointer-events-none absolute left-full top-1/2 z-[100] ml-3 -translate-y-1/2 whitespace-nowrap rounded-xl bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          新建对话
        </span>
      </button>

      <div className="mb-2 h-px w-8 bg-zinc-200" />

      {/* Navigation */}
      <nav className="flex flex-1 flex-col items-center gap-2">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.to
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200',
                'text-zinc-500 hover:bg-zinc-200/80 hover:text-zinc-900',
                active && 'bg-zinc-200 text-zinc-900'
              )}
            >
              <Icon size={20} strokeWidth={active ? 2 : 1.5} />
              {/* 设置图标上的更新红点 */}
              {item.to === '/settings' && hasUpdate && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
              )}
              {/* Tooltip - positioned to the right, outside the sidebar */}
              <span className="pointer-events-none absolute left-full top-1/2 z-[100] ml-3 -translate-y-1/2 whitespace-nowrap rounded-xl bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
