import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react'
import { useToastStore, type Toast } from '../../store/useToastStore'
import { cn } from '../../lib/cn'

const ICONS = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: AlertCircle,
}

const VARIANTS = {
  default: 'bg-white text-zinc-900',
  info: 'bg-blue-50 text-blue-900',
  success: 'bg-emerald-50 text-emerald-900',
  warning: 'bg-amber-50 text-amber-900',
  destructive: 'bg-red-50 text-red-900',
}

const ICON_COLORS = {
  default: 'text-zinc-500',
  info: 'text-blue-500',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  destructive: 'text-red-500',
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [progress, setProgress] = useState(100)
  const [paused, setPaused] = useState(false)
  const Icon = ICONS[toast.variant || 'default']

  useEffect(() => {
    if (toast.duration === Infinity) return

    const duration = toast.duration || 5000
    const interval = 50
    const step = (interval / duration) * 100

    const timer = setInterval(() => {
      if (!paused) {
        setProgress((p) => Math.max(0, p - step))
      }
    }, interval)

    return () => clearInterval(timer)
  }, [toast.duration, paused])

  return (
    <div
      className={cn(
        'relative flex w-[380px] items-start gap-3 rounded-2xl p-4 shadow-2xl ring-1 ring-zinc-200/50 backdrop-blur-sm',
        'animate-fade-in-up',
        VARIANTS[toast.variant || 'default'],
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={cn('mt-0.5 shrink-0', ICON_COLORS[toast.variant || 'default'])}>
        <Icon size={20} />
      </div>

      <div className="flex-1 space-y-1">
        {toast.title && (
          <div className="text-sm font-semibold leading-tight">{toast.title}</div>
        )}
        {toast.description && (
          <div className="text-xs leading-relaxed opacity-80">{toast.description}</div>
        )}
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
      >
        <X size={14} />
      </button>

      {/* Progress Bar */}
      {toast.duration !== Infinity && (
        <div className="absolute bottom-0 left-0 h-0.5 w-full overflow-hidden rounded-b-2xl bg-zinc-200/50">
          <div
            className={cn(
              'h-full transition-all duration-75 ease-linear',
              ICON_COLORS[toast.variant || 'default'].replace('text-', 'bg-'),
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  )
}
