/**
 * AI 和 VLM 提供商预设常量
 * 供 Settings / OnboardingModal 共享
 * 推荐模型配置见 recommended-models.ts
 */

export interface ProviderPreset {
  url: string
  name: string
}

export const AI_PROVIDERS: ProviderPreset[] = [
  { url: 'https://api.deepseek.com', name: 'DeepSeek' },
  { url: 'https://api-inference.modelscope.cn/v1', name: 'ModelScope 魔搭' },
  { url: 'https://api.siliconflow.cn', name: 'SiliconFlow 硅基流动' },
  { url: 'https://open.bigmodel.cn/api/paas/v4', name: 'Zhipu 智谱清言' },
  { url: 'https://api.moonshot.cn', name: 'Moonshot 月之暗面' },
  { url: 'https://ark.cn-beijing.volces.com/api/v3', name: 'ByteDance 火山引擎' },
  { url: 'https://api.minimax.chat/v1', name: 'Minimax' },
]

export const VLM_PROVIDERS: ProviderPreset[] = [
  { url: 'https://api.siliconflow.cn/v1', name: 'SiliconFlow 硅基流动' },
  { url: 'https://api-inference.modelscope.cn/v1', name: 'ModelScope 魔搭' },
  { url: 'https://open.bigmodel.cn/api/paas/v4', name: 'Zhipu 智谱清言' },
  { url: 'https://api.openai.com/v1', name: 'OpenAI' },
  { url: 'https://api.deepseek.com/v1', name: 'DeepSeek' },
]
