import type { TextareaHTMLAttributes } from 'react'
import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-xl border-0 bg-zinc-100/50 px-4 py-3 text-sm text-zinc-900',
        'placeholder:text-zinc-400',
        'transition-all duration-200',
        'focus:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-300/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'resize-none',
        className,
      )}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'
