import { ReactNode } from 'react'

export function HelpSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

export function HelpStep({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 font-bold text-zinc-700">
        {index}
      </div>
      <div className="space-y-2 pt-1">
        <div className="font-medium text-zinc-900">{title}</div>
        <div className="text-sm text-zinc-600">{children}</div>
      </div>
    </div>
  )
}
