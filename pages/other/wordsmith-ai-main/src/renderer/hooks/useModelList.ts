import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchModels, clearModelsCache } from '../lib/model-fetcher'

export interface UseModelListResult {
  models: string[]
  loading: boolean
  error: string | undefined
  fromCache: boolean
  refresh: () => void
}

/**
 * React Hook：根据 baseUrl + apiKey 自动获取模型列表
 * 只要有 baseUrl 就尝试请求，服务端返回什么就是什么
 */
export function useModelList(baseUrl: string, apiKey: string): UseModelListResult {
  const [models, setModels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [fromCache, setFromCache] = useState(false)
  const seqRef = useRef(0)

  const doFetch = useCallback(() => {
    if (!baseUrl) {
      setModels([])
      setLoading(false)
      setError(undefined)
      return
    }

    const seq = ++seqRef.current
    setLoading(true)
    setError(undefined)

    fetchModels(baseUrl, apiKey).then((result) => {
      if (seq !== seqRef.current) return
      setModels(result.models)
      setFromCache(result.fromCache)
      setError(result.error)
      setLoading(false)
    })
  }, [baseUrl, apiKey])

  useEffect(() => {
    doFetch()
  }, [doFetch])

  const refresh = useCallback(() => {
    clearModelsCache(baseUrl)
    doFetch()
  }, [baseUrl, doFetch])

  return { models, loading, error, fromCache, refresh }
}
