import { type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './button'
import { cn } from '../../lib/cn'

export interface DialogProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}

export function Dialog({ open, onClose, children, className }: DialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Content */}
      <div
        className={cn(
          'relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl',
          'animate-in fade-in zoom-in-95 duration-200',
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between border-b border-zinc-200 px-6 py-4', className)}>
      {children}
    </div>
  )
}

export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn('text-lg font-semibold text-zinc-900', className)}>
      {children}
    </h2>
  )
}

export function DialogContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-6 py-4', className)}>
      {children}
    </div>
  )
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-end gap-2 border-t border-zinc-200 px-6 py-4', className)}>
      {children}
    </div>
  )
}

export function DialogClose({ onClose }: { onClose: () => void }) {
  return (
    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
      <X size={18} />
    </Button>
  )
}

// 确认对话框
export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  icon?: ReactNode
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = '确定',
  cancelText = '取消',
  variant = 'default',
  icon,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <DialogHeader>
        <div className="flex items-center gap-3">
          {icon && (
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              variant === 'destructive' ? 'bg-red-100 text-red-600' : 'bg-zinc-100 text-zinc-600'
            )}>
              {icon}
            </div>
          )}
          <DialogTitle>{title}</DialogTitle>
        </div>
        <DialogClose onClose={onClose} />
      </DialogHeader>
      <DialogContent>
        <p className={cn('text-sm text-zinc-600', icon ? 'pl-[52px]' : '')}>{description}</p>
      </DialogContent>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          {cancelText}
        </Button>
        <Button
          variant={variant === 'destructive' ? 'destructive' : 'default'}
          onClick={handleConfirm}
        >
          {confirmText}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
