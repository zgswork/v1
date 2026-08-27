import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { OcrResult } from './ocr-provider'

// VLM 配置（从渲染进程传入，preload 编译为 CJS 不能引用 renderer 类型）
export interface VlmOcrConfig {
  baseUrl: string
  apiKey: string
  model: string
  systemPrompt: string
}

// 按扩展名推断 MIME 类型
const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.webp': 'image/webp',
}

/**
 * 规范化 baseUrl，拼接出完整的 chat/completions 端点。
 * 兼容用户填写的各种格式：
 *   https://api.openai.com           → .../v1/chat/completions
 *   https://api.openai.com/          → .../v1/chat/completions
 *   https://api.openai.com/v1        → .../v1/chat/completions
 *   https://api.openai.com/v1/       → .../v1/chat/completions
 *   https://xxx.com/api/paas/v4      → .../api/paas/v4/chat/completions
 */
function buildCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  // 如果已经以 /chat/completions 结尾，直接用
  if (trimmed.endsWith('/chat/completions')) return trimmed
  // 如果路径已经含版本号（/v1、/v4 等），直接追加
  if (/\/v\d+$/.test(trimmed)) return `${trimmed}/chat/completions`
  // 否则追加完整 /v1/chat/completions
  return `${trimmed}/v1/chat/completions`
}

/**
 * VLM Provider — 通过 OpenAI 兼容的视觉模型 API 进行图片识别
 */
export class VlmProvider {
  /**
   * 使用 VLM API 识别图片中的文字
   */
  async recognize(
    imagePath: string,
    config: VlmOcrConfig,
    signal?: AbortSignal,
  ): Promise<OcrResult> {
    // 校验配置
    if (!config.baseUrl || !config.apiKey || !config.model) {
      return { success: false, markdown: '', error: 'VLM_NOT_CONFIGURED' }
    }

    if (signal?.aborted) {
      return { success: false, markdown: '', error: 'Cancelled.' }
    }

    try {
      // 读取图片并编码为 Base64
      const imageBuffer = await readFile(imagePath)
      const base64 = imageBuffer.toString('base64')
      const ext = path.extname(imagePath).toLowerCase()
      const mime = MIME_MAP[ext] || 'image/png'
      const dataUri = `data:${mime};base64,${base64}`

      // 构造 OpenAI 多模态请求体
      const systemPrompt = config.systemPrompt || '请从图片中提取所有文字内容，以 Markdown 格式输出。'
      const body = {
        model: config.model,
        stream: false,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: '请识别这张图片中的所有文字内容。' },
              { type: 'image_url', image_url: { url: dataUri } },
            ],
          },
        ],
      }

      const url = buildCompletionsUrl(config.baseUrl)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      })

      // 先读取响应文本，再尝试解析 JSON（避免 HTML 页面直接爆 JSON.parse 错误）
      const responseText = await response.text()

      if (!response.ok) {
        return {
          success: false,
          markdown: '',
          error: `VLM API 请求失败 (HTTP ${response.status}): ${responseText.slice(0, 200)}`,
        }
      }

      // 安全解析 JSON
      let data: Record<string, unknown>
      try {
        data = JSON.parse(responseText)
      } catch {
        return {
          success: false,
          markdown: '',
          error: `VLM API 返回了非 JSON 内容，请检查 API 地址是否正确。响应开头: ${responseText.slice(0, 100)}`,
        }
      }

      const choices = data?.choices as Array<{ message?: { content?: string } }> | undefined
      const content = choices?.[0]?.message?.content
      if (!content) {
        return { success: false, markdown: '', error: 'VLM API 返回内容为空' }
      }

      return { success: true, markdown: content }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { success: false, markdown: '', error: 'Cancelled.' }
      }
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return {
        success: false,
        markdown: '',
        error: `VLM 识别失败: ${msg}`,
      }
    }
  }
}
