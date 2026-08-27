import { useState } from 'react'
import { Book, Code, HelpCircle, Settings } from 'lucide-react'
import { cn } from '../lib/cn'
import { ApiGuide } from '../components/help/ApiGuide'
import { VbaGuide } from '../components/help/VbaGuide'
import { TheoryGuide } from '../components/help/TheoryGuide'
import { FaqList } from '../components/help/FaqList'

const TABS = [
  { id: 'api', label: 'API 配置', icon: Settings, component: ApiGuide },
  { id: 'vba', label: 'VBA 宏指南', icon: Code, component: VbaGuide },
  { id: 'theory', label: '排版原理', icon: Book, component: TheoryGuide },
  { id: 'faq', label: '常见问题', icon: HelpCircle, component: FaqList },
]

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState('api')
  const ActiveComponent = TABS.find((t) => t.id === activeTab)?.component || ApiGuide

  return (
    <div className="mx-auto flex w-full max-w-[1024px] gap-6">
      {/* Side Menu */}
      <div className="w-64 shrink-0 space-y-1">
        <div className="mb-4 px-3 text-lg font-semibold">帮助中心</div>
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-zinc-200 text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-100',
              )}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content Area */}
      <div className="min-w-0 flex-1">
        <ActiveComponent />
      </div>
    </div>
  )
}
