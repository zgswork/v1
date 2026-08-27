import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface LatexHistoryItem {
  id: string
  latex: string
  createdAt: number
}

interface LatexHistoryState {
  items: LatexHistoryItem[]
  addItem: (latex: string) => void
  removeItem: (id: string) => void
  clearAll: () => void
}

function uid(): string {
  return `latex_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

const MAX_ITEMS = 100

export const useLatexHistoryStore = create<LatexHistoryState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem(latex: string) {
        const trimmed = latex.trim()
        if (!trimmed) return
        // 去重：与最近 5 条比对
        const recent = get().items.slice(0, 5)
        if (recent.some(item => item.latex === trimmed)) return
        set(state => ({
          items: [
            { id: uid(), latex: trimmed, createdAt: Date.now() },
            ...state.items,
          ].slice(0, MAX_ITEMS),
        }))
      },
      removeItem(id: string) {
        set(state => ({ items: state.items.filter(item => item.id !== id) }))
      },
      clearAll() {
        set({ items: [] })
      },
    }),
    { name: 'wordsmith-latex-history' },
  ),
)
