/**
 * 从 /v1/models API 获取模型列表
 * - 通过主进程 IPC 发起请求，绕过渲染进程 CORS 限制
 * - 不管有没有 API Key 都尝试请求，服务端返回什么就显示什么
 * - URL 智能拼接 + 5 分钟内存缓存
 */

export interface FetchModelsResult {
  models: string[]
  fromCache: boolean
  error?: string
}

interface CacheEntry {
  models: string[]
  timestamp: number
}

const CACHE_TTL = 5 * 60 * 1000 // 5 分钟
const cache = new Map<string, CacheEntry>()

/**
 * 智能拼接 /v1/models URL
 */
export function buildModelsUrl(baseUrl: string): string {
  const url = baseUrl.replace(/\/+$/, '')
  if (/\/models$/i.test(url)) return url
  if (/\/v\d+$/i.test(url)) return `${url}/models`
  return `${url}/v1/models`
}

/**
 * 从提供商 API 获取可用模型列表
 * 不管有没有 key 都发请求，服务端报错直接透传
 */
export async function fetchModels(
  baseUrl: string,
  apiKey: string,
): Promise<FetchModelsResult> {
  if (!baseUrl) {
    return { models: [], fromCache: false }
  }

  const cacheKey = `${baseUrl.replace(/\/+$/, '')}::${apiKey}`

  // 检查缓存
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { models: cached.models, fromCache: true }
  }

  const url = buildModelsUrl(baseUrl)

  try {
    let ok: boolean
    let status: number | undefined
    let body: string

    if (window.wordsmith?.models?.fetch) {
      const result = await window.wordsmith.models.fetch(url, apiKey)
      ok = result.ok
      status = result.status
      body = result.body ?? ''
      if (!ok && result.error && !result.status) {
        return { models: [], fromCache: false, error: result.error }
      }
    } else {
      const headers: Record<string, string> = {}
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15000),
      })
      ok = response.ok
      status = response.status
      body = await response.text()
    }

    if (!ok) {
      // 直接透传服务端错误
      let detail = `HTTP ${status}`
      try {
        const errJson = JSON.parse(body)
        if (errJson?.error?.message) detail = `${status}: ${errJson.error.message}`
        else if (errJson?.message) detail = `${status}: ${errJson.message}`
      } catch { /* 忽略 */ }
      // 对常见错误码追加友好提示
      if (status === 401) {
        detail += ' — 请填写正确的 API Key'
      } else if (status === 403) {
        detail += ' — API Key 权限不足'
      }
      return { models: [], fromCache: false, error: detail }
    }

    const json = JSON.parse(body)
    const models = parseModelsResponse(json)

    if (models.length > 0) {
      cache.set(cacheKey, { models, timestamp: Date.now() })
    }

    return { models, fromCache: false }
  } catch (err) {
    return { models: [], fromCache: false, error: (err as Error).message || '网络请求失败' }
  }
}

/**
 * 解析多种响应格式
 */
function parseModelsResponse(json: unknown): string[] {
  if (!json || typeof json !== 'object') return []

  if ('data' in json && Array.isArray((json as { data: unknown }).data)) {
    return extractModelIds((json as { data: unknown[] }).data)
  }

  if ('models' in json && Array.isArray((json as { models: unknown }).models)) {
    return extractModelIds((json as { models: unknown[] }).models)
  }

  if (Array.isArray(json)) {
    return extractModelIds(json)
  }

  return []
}

function extractModelIds(items: unknown[]): string[] {
  return items
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && 'id' in item) return String((item as { id: unknown }).id)
      if (item && typeof item === 'object' && 'name' in item) return String((item as { name: unknown }).name)
      return ''
    })
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

export function clearModelsCache(baseUrl?: string): void {
  if (baseUrl) {
    for (const key of cache.keys()) {
      if (key.startsWith(baseUrl.replace(/\/+$/, '') + '::')) {
        cache.delete(key)
      }
    }
  } else {
    cache.clear()
  }
}
