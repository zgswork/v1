import { useEffect, useState } from 'react'
import { Minus, Square, X, Copy } from 'lucide-react'

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    // Get initial state
    window.wordsmith?.window?.isMaximized().then(setIsMaximized)

    // Listen for changes
    const unsubscribe = window.wordsmith?.window?.onMaximizedChange(setIsMaximized)
    return () => unsubscribe?.()
  }, [])

  const handleMinimize = () => window.wordsmith?.window?.minimize()
  const handleMaximize = () => window.wordsmith?.window?.maximize()
  const handleClose = () => window.wordsmith?.window?.close()

  return (
    <div className="flex h-9 shrink-0 select-none items-center justify-between bg-zinc-100/80 backdrop-blur-sm">
      {/* Drag Region + Brand */}
      <div
        className="flex h-full flex-1 items-center gap-2 px-4"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="font-serif text-sm font-light tracking-wide text-zinc-600">
          WordSmith AI
        </span>
        <span className="text-[10px] text-zinc-400">智排精灵</span>
      </div>

      {/* Window Controls */}
      <div
        className="flex h-full items-center"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          className="flex h-full w-12 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-200"
          title="最小化"
        >
          <Minus size={14} strokeWidth={1.5} />
        </button>
        <button
          onClick={handleMaximize}
          className="flex h-full w-12 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-200"
          title={isMaximized ? '还原' : '最大化'}
        >
          {isMaximized ? (
            <Copy size={12} strokeWidth={1.5} className="rotate-180" />
          ) : (
            <Square size={12} strokeWidth={1.5} />
          )}
        </button>
        <button
          onClick={handleClose}
          className="flex h-full w-12 items-center justify-center text-zinc-500 transition-colors hover:bg-red-500 hover:text-white"
          title="关闭"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
