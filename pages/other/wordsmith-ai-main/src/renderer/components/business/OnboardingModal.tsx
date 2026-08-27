import { useState, useEffect } from 'react'
import { Rocket, AlertTriangle, CheckCircle2, ChevronDown, Check } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { AI_PROVIDERS } from '../../lib/providers'
import { AI_RECOMMENDED_MODELS } from '../../lib/recommended-models'
import { Button } from '../ui/button'
import { ModelSelector } from '../ui/ModelSelector'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { cn } from '../../lib/cn'

export function OnboardingModal() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [showDropdown, setShowDropdown] = useState(false)
  const settings = useAppStore((s) => s.settings)
  const updateAi = useAppStore((s) => s.updateAi)
  const addRecentModel = useAppStore((s) => s.addRecentModel)
  const removeRecentModel = useAppStore((s) => s.removeRecentModel)

  const currentProvider = AI_PROVIDERS.find(p => p.url === settings.ai.baseUrl)

  useEffect(() => {
    const hasOnboarded = localStorage.getItem('wordsmith-onboarded')
    if (!hasOnboarded) {
      setOpen(true)
    }
  }, [])

  const handleComplete = () => {
    localStorage.setItem('wordsmith-onboarded', 'true')
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        <CardHeader>
          <div className="flex items-center gap-2 text-blue-600">
            <Rocket className="h-6 w-6" />
            <span className="text-sm font-bold uppercase tracking-wider">欢迎使用 WordSmith AI</span>
          </div>
          <CardTitle className="text-2xl">
            {step === 1 && '开启智能排版之旅'}
            {step === 2 && '连接 AI 大脑'}
            {step === 3 && '核心操作要领'}
            {step === 4 && '准备就绪！'}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-zinc-600">
                WordSmith AI 是一款专为专业文档设计的排版工具。它能将 AI 生成的内容转换为符合 <strong>Word 排版协议</strong> 的格式，完美保留公式、表格和样式。
              </p>
              <div className="rounded-xl bg-zinc-50 p-4">
                <ul className="list-disc pl-4 space-y-2 text-sm text-zinc-700">
                  <li>支持所有 OpenAI 兼容接口 (DeepSeek, Kimi, etc.)</li>
                  <li>独家 Inline CSS 守卫技术</li>
                  <li>完美渲染 LaTeX 数学公式</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Configuration */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600">
                请先配置您的 AI 服务商。不用担心，稍后可以在【设置】中随时修改。
              </p>
              <div className="space-y-3">
                {/* Provider Dropdown — 和设置页一致的自定义下拉 */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-500">API 提供商</label>
                  <div className="relative">
                    <button
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="flex w-full items-center justify-between rounded-lg bg-zinc-100 px-3 py-2.5 text-left text-sm transition-all hover:bg-zinc-200"
                    >
                      <span className="text-zinc-900">
                        {currentProvider?.name || '自定义'}
                      </span>
                      <ChevronDown size={16} className="text-zinc-400" />
                    </button>

                    {showDropdown && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
                        {AI_PROVIDERS.map((provider) => (
                          <button
                            key={provider.url}
                            onClick={() => {
                              updateAi({ baseUrl: provider.url, model: AI_RECOMMENDED_MODELS[provider.url]?.[0] || '' })
                              setShowDropdown(false)
                            }}
                            className={cn(
                              'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors',
                              settings.ai.baseUrl === provider.url
                                ? 'bg-zinc-100'
                                : 'hover:bg-zinc-50'
                            )}
                          >
                            <span className="text-zinc-900">{provider.name}</span>
                            {settings.ai.baseUrl === provider.url && (
                              <Check size={14} className="text-zinc-500" />
                            )}
                          </button>
                        ))}
                        <div className="my-1 border-t border-zinc-200" />
                        <button
                          onClick={() => setShowDropdown(false)}
                          className="flex w-full items-center px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-50"
                        >
                          自定义 URL
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Model */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-500">模型名称</label>
                  <ModelSelector
                    value={settings.ai.model}
                    onChange={(model) => updateAi({ model })}
                    baseUrl={settings.ai.baseUrl}
                    apiKey={settings.ai.apiKey}
                    staticModels={AI_RECOMMENDED_MODELS[settings.ai.baseUrl]}
                    recentModels={settings.recentModels.ai[settings.ai.baseUrl] ?? []}
                    onModelUsed={(model) => addRecentModel('ai', settings.ai.baseUrl, model)}
                    onRemoveRecent={(model) => removeRecentModel('ai', settings.ai.baseUrl, model)}
                    placeholder="deepseek-chat"
                  />
                </div>

                {/* API Key */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-500">API Key</label>
                  <input
                    value={settings.ai.apiKey}
                    onChange={(e) => updateAi({ apiKey: e.target.value })}
                    placeholder="sk-..."
                    type="password"
                    className="w-full rounded-lg border-0 bg-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Paste Warning */}
          {step === 3 && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <AlertTriangle size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-amber-700">至关重要的一步</h3>
                <p className="text-sm text-zinc-600">
                  为了确保样式不丢失，在 Word 中粘贴内容时，<br />
                  <span className="font-bold text-zinc-900 underline decoration-amber-500 decoration-2 underline-offset-2">
                    必须选择"保留原格式 (Keep Source Formatting)"
                  </span>
                </p>
              </div>
              <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-500">
                (通常是粘贴选项中的第一个图标 📋)
              </div>
            </div>
          )}

          {/* Step 4: Ready */}
          {step === 4 && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-zinc-900">配置完成！</h3>
                <p className="text-zinc-600">
                  您现在可以开始创建第一个排版任务了。<br />
                  记得查看左侧的【帮助中心】获取更多技巧。
                </p>
              </div>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="flex items-center justify-between pt-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={cn(
                    'h-2 w-2 rounded-full transition-colors',
                    step === i ? 'bg-zinc-900' : 'bg-zinc-200'
                  )}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {step > 1 && (
                <Button variant="ghost" onClick={() => setStep(step - 1)}>
                  上一步
                </Button>
              )}
              {step < 4 ? (
                <Button onClick={() => setStep(step + 1)}>下一步</Button>
              ) : (
                <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700 text-white">
                  开始使用
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
