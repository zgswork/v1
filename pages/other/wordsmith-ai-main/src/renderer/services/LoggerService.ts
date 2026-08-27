import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type LogLevel = 'info' | 'warn' | 'error' | 'action'

export interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  module: string
  message: string
  meta?: any
}

interface LoggerState {
  logs: LogEntry[]
  addLog: (level: LogLevel, module: string, message: string, meta?: any) => void
  clearLogs: () => void
  exportLogs: () => string
}

export const useLoggerStore = create<LoggerState>()(
  persist(
    (set, get) => ({
      logs: [],
      addLog: (level, module, message, meta) => {
        const entry: LogEntry = {
          id: Math.random().toString(36).slice(2, 11),
          timestamp: Date.now(),
          level,
          module,
          message,
          meta,
        }
        // Keep logs in memory (max 1000)
        set((state) => ({
          logs: [entry, ...state.logs].slice(0, 1000),
        }))
        
        // Also print to console for dev
        const style = level === 'error' ? 'color: red' : level === 'warn' ? 'color: orange' : 'color: blue'
        console.log(`%c[${module}] ${message}`, style, meta || '')
      },
      clearLogs: () => set({ logs: [] }),
      exportLogs: () => {
        const { logs } = get()
        return JSON.stringify(logs, null, 2)
      },
    }),
    {
      name: 'wordsmith-logs',
    },
  ),
)

class LoggerService {
  info(module: string, message: string, meta?: any) {
    useLoggerStore.getState().addLog('info', module, message, meta)
  }

  warn(module: string, message: string, meta?: any) {
    useLoggerStore.getState().addLog('warn', module, message, meta)
  }

  error(module: string, message: string, meta?: any) {
    useLoggerStore.getState().addLog('error', module, message, meta)
  }

  action(module: string, message: string, meta?: any) {
    useLoggerStore.getState().addLog('action', module, message, meta)
  }
}

export const logger = new LoggerService()
