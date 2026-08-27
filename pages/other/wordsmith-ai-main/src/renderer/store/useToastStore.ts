import { create } from 'zustand'

export type ToastVariant = 'default' | 'destructive' | 'success' | 'warning' | 'info'

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
  createdAt: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => void
  dismissToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast = { ...toast, id, createdAt: Date.now() }
    
    set((state) => ({ 
      // Limit to max 5 toasts to avoid clutter
      toasts: [...state.toasts, newToast].slice(-5) 
    }))

    if (toast.duration !== Infinity) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, toast.duration || 5000)
    }
  },
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))

export const toast = (props: Omit<Toast, 'id' | 'createdAt'>) => {
  useToastStore.getState().addToast(props)
}
