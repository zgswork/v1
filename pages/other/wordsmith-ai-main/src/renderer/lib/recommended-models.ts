/**
 * 用户自定义推荐模型配置
 * 按提供商 Base URL 分组，可自行添加/修改/删除
 *
 * 格式: { [baseUrl]: ['模型名1', '模型名2', ...] }
 */

// ============ AI 对话模型推荐 ============
export const AI_RECOMMENDED_MODELS: Record<string, string[]> = {
  'https://api.deepseek.com': [
    'deepseek-chat',
    'deepseek-coder',
  ],
  'https://api-inference.modelscope.cn/v1': [
    'Qwen/Qwen3.5-397B-A17B-FP8',
    'ZhipuAI/GLM-5',
  ],
  'https://api.siliconflow.cn': [
    'Qwen/Qwen2.5-72B-Instruct',
  ],
  'https://open.bigmodel.cn/api/paas/v4': [
    'glm-4.6v',
  ],
  'https://api.moonshot.cn': [
    'moonshot-v1-8k',
    'moonshot-v1-32k',
  ],
  'https://ark.cn-beijing.volces.com/api/v3': [
    'doubao-pro-4k',
  ],
  'https://api.minimax.chat/v1': [
    'abab6.5-chat',
  ],
}

// ============ VLM 视觉模型推荐 ============
export const VLM_RECOMMENDED_MODELS: Record<string, string[]> = {
  'https://api.siliconflow.cn/v1': [
    'Qwen/Qwen2.5-VL-72B-Instruct',
    'Pro/Qwen/Qwen2.5-VL-7B-Instruct',
  ],
  'https://api-inference.modelscope.cn/v1': [
    'Qwen/Qwen2.5-VL-72B-Instruct',
  ],
  'https://open.bigmodel.cn/api/paas/v4': [
    'glm-4v-flash',
    'glm-4v-plus',
  ],
  'https://api.openai.com/v1': [
    'gpt-4o',
    'gpt-4o-mini',
  ],
  'https://api.deepseek.com/v1': [
    'deepseek-chat',
  ],
}
