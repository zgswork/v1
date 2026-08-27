import { logger } from './LoggerService'
import { toast } from '../store/useToastStore'

export type ErrorType = 'network' | 'api' | 'parse' | 'system' | 'validation'

class ErrorHandler {
  handle(error: unknown, type: ErrorType = 'system', userMessage?: string) {
    const message = error instanceof Error ? error.message : String(error)
    
    // Log internal error details
    logger.error('ErrorHandler', `[${type}] ${message}`, { error })

    // Determine user-facing message
    let title = '发生错误'
    let description = userMessage || message

    switch (type) {
      case 'network':
        title = '网络连接失败'
        if (!userMessage) description = '请检查您的网络设置或代理配置。'
        break
      case 'api':
        title = 'AI 服务请求失败'
        if (message.includes('401')) description = 'API Key 无效或已过期，请在设置中检查。'
        else if (message.includes('429')) description = 'API 调用次数超限，请检查额度。'
        break
      case 'parse':
        title = '内容解析异常'
        description = '无法解析 AI 返回的内容，建议重试或切换模型。'
        break
      case 'validation':
        title = '参数校验失败'
        break
    }

    // Show UI notification
    toast({
      title,
      description,
      variant: 'destructive',
      duration: 5000,
    })
  }

  // Helper for async functions
  async wrap<T>(promise: Promise<T>, type: ErrorType = 'system', userMessage?: string): Promise<T | null> {
    try {
      return await promise
    } catch (error) {
      this.handle(error, type, userMessage)
      return null
    }
  }
}

export const errorHandler = new ErrorHandler()
