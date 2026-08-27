import type { ButtonHTMLAttributes } from 'react'
import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'destructive' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', type = 'button', ...props }, ref) => {
    const base = cn(
      'inline-flex items-center justify-center gap-2 rounded-xl font-medium',
      'transition-all duration-200 ease-out',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'active:scale-[0.98] hover:scale-[1.02]'
    )

    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      default: cn(
        'bg-zinc-900 text-white shadow-sm',
        'hover:bg-zinc-800'
      ),
      secondary: cn(
        'bg-zinc-100 text-zinc-700',
        'hover:bg-zinc-200'
      ),
      ghost: cn(
        'bg-transparent text-zinc-600',
        'hover:bg-zinc-100 hover:text-zinc-900'
      ),
      outline: cn(
        'border border-zinc-200/50 bg-transparent text-zinc-700',
        'hover:bg-zinc-50 hover:border-zinc-300'
      ),
      destructive: cn(
        'bg-red-500 text-white shadow-sm',
        'hover:bg-red-600'
      ),
    }

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-9 px-4 text-sm',
      lg: 'h-11 px-6 text-sm',
      icon: 'h-9 w-9 p-0',
    }

    return (
      <button
        ref={ref}
        type={type}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
