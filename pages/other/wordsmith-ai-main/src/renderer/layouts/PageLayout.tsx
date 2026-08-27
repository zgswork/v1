import type { ReactNode } from 'react'

export function PageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      {/* Safe zone for Windows title bar - drag region */}
      <div className="h-9 w-full shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
      <div className="min-h-0 flex-1 overflow-auto p-6 pt-0">
        {children}
      </div>
    </div>
  )
}
