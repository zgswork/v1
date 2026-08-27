export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export type PromptMode = 'generate' | 'fix'

export interface AIDefaultTypography {
  fontFamily: string
  fontSizePt: number
}

export interface AIModelConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface ReferenceFileInput {
  id: string
  name: string
  content: string
  uploadedAt: number
}

export interface VlmOcrConfig {
  baseUrl: string
  apiKey: string
  model: string
  systemPrompt: string
}

export interface RecentModels {
  ai: Record<string, string[]>
  vlm: Record<string, string[]>
}

/** 跨对话固定的轮次（内容快照） */
export interface PinnedRound {
  id: string
  sourceId: string        // 来源 history item ID
  sourceTitle: string     // 来源对话标题快照
  userContent: string     // user 消息快照
  assistantContent: string // assistant 消息快照
  pinnedAt: number
}

export interface StreamChatRequest {
  mode: PromptMode
  model: AIModelConfig
  defaults: AIDefaultTypography
  messages: ChatMessage[]
  signal?: AbortSignal
  customInstruction?: string
  referenceFiles?: ReferenceFileInput[]
  /** 提供时直接作为请求消息，跳过 buildInjectedMessages 注入 */
  rawMessages?: ChatMessage[]
}
