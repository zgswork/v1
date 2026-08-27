import { useState, useEffect } from 'react'
import {
  Globe, Palette, Bot, Wrench, Check, Loader2, X, ChevronDown, AlertTriangle,
  CheckCircle, XCircle, FolderOpen, Cloud, HardDrive, Cpu, Download, ExternalLink
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useI18n, useLocale, useSetLocale } from '../store/useI18nStore'
import { settingsService } from '../services/SettingsService'
import { DEFAULT_VLM_OCR_SYSTEM_PROMPT } from '../lib/hidden-protocol'
import { AI_PROVIDERS, VLM_PROVIDERS } from '../lib/providers'
import { AI_RECOMMENDED_MODELS, VLM_RECOMMENDED_MODELS } from '../lib/recommended-models'
import { toast } from '../store/useToastStore'
import { Button } from '../components/ui/button'
import { ModelSelector } from '../components/ui/ModelSelector'
import { ConfirmDialog } from '../components/ui/Dialog'
import { cn } from '../lib/cn'
import { useUpdateStore } from '../store/useUpdateStore'
import { checkForUpdate } from '../services/UpdateService'

declare const __APP_VERSION__: string

const TABS = [
  { id: 'general', label: '常规', icon: Globe },
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'ai', label: 'AI 模型', icon: Bot },
  { id: 'advanced', label: '高级', icon: Wrench },
]

export default function SettingsPage() {
  const t = useI18n()
  const locale = useLocale()
  const setLocale = useSetLocale()

  const settings = useAppStore((s) => s.settings)
  const updateAi = useAppStore((s) => s.updateAi)
  const updateTypography = useAppStore((s) => s.updateTypography)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const updateVlmOcr = useAppStore((s) => s.updateVlmOcr)
  const addRecentModel = useAppStore((s) => s.addRecentModel)
  const removeRecentModel = useAppStore((s) => s.removeRecentModel)

  const [activeTab, setActiveTab] = useState('general')
  const [showProviderDropdown, setShowProviderDropdown] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [resetConfirm, setResetConfirm] = useState(false)
  const [ocrStatus, setOcrStatus] = useState<OcrEngineStatus | null>(null)
  const [ocrImporting, setOcrImporting] = useState(false)
  const [vlmTesting, setVlmTesting] = useState(false)
  const [showVlmProviderDropdown, setShowVlmProviderDropdown] = useState(false)
  const [gpuStatus, setGpuStatus] = useState<GpuPackStatus | null>(null)
  const [gpuImporting, setGpuImporting] = useState(false)
  const updateInfo = useUpdateStore((s) => s.updateInfo)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  const currentProvider = AI_PROVIDERS.find(p => p.url === settings.ai.baseUrl)
  const currentVlmProvider = VLM_PROVIDERS.find(p => p.url === settings.vlmOcr.baseUrl)

  // Fetch OCR engine status and accelerator status when advanced tab is active
  useEffect(() => {
    if (activeTab === 'advanced') {
      if (window.wordsmith?.ocr?.getEngineStatus) {
        window.wordsmith.ocr.getEngineStatus().then(setOcrStatus)
      }
      if (window.wordsmith?.accel?.getGpuStatus) {
        window.wordsmith.accel.getGpuStatus().then(setGpuStatus)
      }
    }
  }, [activeTab])

  const testConnection = async () => {
    if (!settings.ai.apiKey || !settings.ai.baseUrl) {
      toast({ title: '请先填写 API Key 和 Base URL', variant: 'warning' })
      return
    }

    setTestingConnection(true)
    setConnectionStatus('idle')

    try {
      // 发送真实的 chat completions 请求验证 key 有效性
      const baseUrl = settings.ai.baseUrl.replace(/\/+$/, '')
      const url = /\/v\d+$/.test(baseUrl)
        ? `${baseUrl}/chat/completions`
        : `${baseUrl}/v1/chat/completions`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.ai.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.ai.model || 'deepseek-chat',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(15000),
      })

      if (response.ok) {
        setConnectionStatus('success')
        toast({ title: '连接成功', description: 'API 配置正确', variant: 'success' })
      } else {
        setConnectionStatus('error')
        toast({ title: '连接失败', description: `HTTP ${response.status}`, variant: 'destructive' })
      }
    } catch {
      setConnectionStatus('error')
      toast({ title: '连接失败', description: '请检查网络或 API 配置', variant: 'destructive' })
    } finally {
      setTestingConnection(false)
    }
  }

  const handleReset = () => {
    settingsService.resetToDefaults()
    toast({ title: '已恢复出厂设置', variant: 'success' })
  }

  const handleExport = () => {
    const json = settingsService.exportSettings()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wordsmith-settings-${Date.now()}.json`
    a.click()
    toast({ title: '配置已导出', variant: 'success' })
  }

  const handleImportOcrEngine = async () => {
    if (!window.wordsmith?.ocr) return
    try {
      const zipPath = await window.wordsmith.ocr.selectZipFile()
      if (!zipPath) return

      setOcrImporting(true)
      const result = await window.wordsmith.ocr.importEngineZip(zipPath)
      if (result.success && result.enginePath) {
        updateSettings({ ocrEnginePath: result.enginePath })
        toast({ title: 'OCR 引擎导入成功', description: '图片文字识别功能已就绪。', variant: 'success' })
        // Refresh status
        const status = await window.wordsmith.ocr.getEngineStatus()
        setOcrStatus(status)
        // 同步刷新 GPU 状态（accelManager 的 enginePath 已在 IPC 中更新）
        if (window.wordsmith?.accel?.getGpuStatus) {
          window.wordsmith.accel.getGpuStatus().then(setGpuStatus)
        }
      } else {
        toast({ title: 'OCR 引擎导入失败', description: result.error || '未知错误', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'OCR 引擎导入失败', description: '操作过程中发生异常。', variant: 'destructive' })
    } finally {
      setOcrImporting(false)
    }
  }

  const handleCheckDx12 = async () => {
    if (!window.wordsmith?.accel) return
    try {
      const result = await window.wordsmith.accel.checkDx12()
      if (result.supported) {
        toast({ title: 'DirectX 12 兼容', description: `检测到显卡：${result.adapter}`, variant: 'success' })
      } else {
        toast({ title: 'DirectX 12 不兼容', description: result.error || '未检测到支持 DX12 的显卡', variant: 'warning' })
      }
    } catch {
      toast({ title: '检测失败', description: '无法完成 DirectX 12 兼容性检查。', variant: 'destructive' })
    }
  }

  const handleImportGpuPack = async () => {
    if (!window.wordsmith?.accel) return
    try {
      const zipPath = await window.wordsmith.accel.selectGpuZipFile()
      if (!zipPath) return

      setGpuImporting(true)
      const result = await window.wordsmith.accel.importGpuPack(zipPath)
      if (result.success) {
        toast({ title: 'GPU 加速包导入成功', description: 'GPU 加速功能已就绪。', variant: 'success' })
        // 刷新状态
        const status = await window.wordsmith.accel.getGpuStatus()
        setGpuStatus(status)
      } else {
        toast({ title: 'GPU 加速包导入失败', description: result.error || '未知错误', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'GPU 加速包导入失败', description: '操作过程中发生异常。', variant: 'destructive' })
    } finally {
      setGpuImporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-900">
          {t.settings.title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {t.common.appDesc}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-zinc-100 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              )}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>

      <div className="space-y-4">
        {/* 常规设置 */}
        {activeTab === 'general' && (
          <>
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-medium text-zinc-900">
              {t.settings.language}
            </h3>
            <div className="flex gap-2">
              <Button
                variant={locale === 'zh-CN' ? 'default' : 'outline'}
                onClick={() => setLocale('zh-CN')}
                className="flex-1"
              >
                简体中文
              </Button>
              <Button
                variant={locale === 'en-US' ? 'default' : 'outline'}
                onClick={() => setLocale('en-US')}
                className="flex-1"
              >
                English
              </Button>
            </div>
          </div>

            {/* 版本与更新 */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-medium text-zinc-900">
                {t.update.aboutTitle}
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">{t.update.currentVersion}</span>
                  <span className="text-sm font-medium text-zinc-900">v{__APP_VERSION__}</span>
                </div>

                {updateInfo ? (
                  <div className="rounded-lg bg-violet-50 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Download size={14} className="text-violet-600" />
                      <span className="text-sm font-medium text-violet-700">
                        {t.update.title} v{updateInfo.version}
                      </span>
                    </div>
                    <p className="mb-2 whitespace-pre-wrap text-xs text-violet-600">{updateInfo.changelog}</p>
                    {updateInfo.ocrchange === '1' && (
                      <div className="mb-2 flex items-start gap-1.5 text-xs text-amber-600">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                        <span>{t.update.ocrWarning}</span>
                      </div>
                    )}
                    <Button
                      size="sm"
                      onClick={() => window.wordsmith?.window?.openExternal?.(updateInfo.update_url)}
                      className="gap-1.5"
                    >
                      <ExternalLink size={12} />
                      {t.update.download}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <CheckCircle size={14} className="text-emerald-500" />
                    <span>{t.update.upToDate}</span>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setCheckingUpdate(true)
                    try {
                      const info = await checkForUpdate()
                      if (info) {
                        useUpdateStore.getState().setUpdateInfo(info, true)
                      } else {
                        toast({ title: t.update.upToDate, variant: 'success' })
                      }
                    } finally {
                      setCheckingUpdate(false)
                    }
                  }}
                  disabled={checkingUpdate}
                  className="gap-2"
                >
                  {checkingUpdate && <Loader2 size={14} className="animate-spin" />}
                  {t.update.checkNow}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* 外观设置 */}
        {activeTab === 'appearance' && (
          <>
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-medium text-zinc-900">
                {t.settings.typography}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs text-zinc-500">{t.settings.fontFamily}</label>
                  <input
                    value={settings.typography.fontFamily}
                    onChange={(e) => updateTypography({ fontFamily: e.target.value })}
                    className="w-full rounded-lg border-0 bg-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-zinc-500">{t.settings.fontSize}</label>
                  <input
                    value={settings.typography.fontSizePt}
                    onChange={(e) => updateTypography({ fontSizePt: Number(e.target.value) || 12 })}
                    type="number"
                    className="w-full rounded-lg border-0 bg-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-zinc-900">护眼模式</h3>
                  <p className="mt-0.5 text-xs text-zinc-500">降低对比度，保护眼睛</p>
                </div>
                <button
                  onClick={() => updateSettings({ eyeCareMode: !settings.eyeCareMode })}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors',
                    settings.eyeCareMode ? 'bg-zinc-900' : 'bg-zinc-200'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                      settings.eyeCareMode ? 'left-[22px]' : 'left-0.5'
                    )}
                  />
                </button>
              </div>
            </div>
          </>
        )}

        {/* AI 模型设置 */}
        {activeTab === 'ai' && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-medium text-zinc-900">
              {t.settings.modelConfig}
            </h3>

            <div className="space-y-4">
              {/* Provider Selector */}
              <div>
                <label className="mb-1.5 block text-xs text-zinc-500">API 提供商</label>
                <div className="relative">
                  <button
                    onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                    className="flex w-full items-center justify-between rounded-lg border-0 bg-zinc-100 px-3 py-2.5 text-left text-sm transition-all hover:bg-zinc-200"
                  >
                    <span className="text-zinc-900">
                      {currentProvider?.name || '自定义'}
                    </span>
                    <ChevronDown size={16} className="text-zinc-400" />
                  </button>

                  {showProviderDropdown && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
                      {AI_PROVIDERS.map((provider) => (
                        <button
                          key={provider.url}
                          onClick={() => {
                            updateAi({ baseUrl: provider.url, model: AI_RECOMMENDED_MODELS[provider.url]?.[0] || '' })
                            setShowProviderDropdown(false)
                            setConnectionStatus('idle')
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
                        onClick={() => setShowProviderDropdown(false)}
                        className="flex w-full items-center px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-50"
                      >
                        自定义 URL
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Base URL */}
              <div>
                <label className="mb-1.5 block text-xs text-zinc-500">Base URL</label>
                <input
                  value={settings.ai.baseUrl}
                  onChange={(e) => {
                    updateAi({ baseUrl: e.target.value })
                    setConnectionStatus('idle')
                  }}
                  placeholder="https://api.example.com"
                  className="w-full rounded-lg border-0 bg-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                />
              </div>

              {/* Model */}
              <div>
                <label className="mb-1.5 block text-xs text-zinc-500">模型名称</label>
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
              <div>
                <label className="mb-1.5 block text-xs text-zinc-500">API Key</label>
                <input
                  value={settings.ai.apiKey}
                  onChange={(e) => {
                    updateAi({ apiKey: e.target.value })
                    setConnectionStatus('idle')
                  }}
                  type="password"
                  placeholder="sk-..."
                  className="w-full rounded-lg border-0 bg-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                />
              </div>

              {/* Connection Test */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={testConnection}
                  disabled={testingConnection || !settings.ai.apiKey}
                  variant="outline"
                  className="gap-2"
                >
                  {testingConnection ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : connectionStatus === 'success' ? (
                    <Check size={14} className="text-emerald-500" />
                  ) : connectionStatus === 'error' ? (
                    <X size={14} className="text-red-500" />
                  ) : null}
                  测试连接
                </Button>
                {connectionStatus === 'success' && (
                  <span className="text-xs text-emerald-600">连接正常</span>
                )}
                {connectionStatus === 'error' && (
                  <span className="text-xs text-red-500">连接失败</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 高级设置 */}
        {activeTab === 'advanced' && (
          <>
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-medium text-zinc-900">
                系统参数
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs text-zinc-500">API 请求超时 (毫秒)</label>
                  <input
                    value={settings.timeout}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      if (!isNaN(val)) updateSettings({ timeout: val })
                    }}
                    type="number"
                    className="w-full rounded-lg border-0 bg-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-zinc-500">默认保存路径</label>
                  <input
                    value={settings.savePath}
                    onChange={(e) => updateSettings({ savePath: e.target.value })}
                    className="w-full rounded-lg border-0 bg-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                  />
                </div>
              </div>
            </div>

            {/* OCR 模式选择 */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-medium text-zinc-900">
                {t.ocr.modeTitle}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {/* VLM 云端识别卡片 */}
                <button
                  onClick={() => updateSettings({ ocrMode: 'vlm' })}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all',
                    settings.ocrMode === 'vlm'
                      ? 'border-zinc-900 bg-zinc-50'
                      : 'border-zinc-200 hover:border-zinc-300'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Cloud size={18} className={settings.ocrMode === 'vlm' ? 'text-zinc-900' : 'text-zinc-400'} />
                    <span className={cn('text-sm font-medium', settings.ocrMode === 'vlm' ? 'text-zinc-900' : 'text-zinc-600')}>
                      {t.ocr.modeVlm}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">{t.ocr.modeVlmDesc}</p>
                </button>

                {/* 本地引擎卡片 */}
                <button
                  onClick={() => updateSettings({ ocrMode: 'local' })}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all',
                    settings.ocrMode === 'local'
                      ? 'border-zinc-900 bg-zinc-50'
                      : 'border-zinc-200 hover:border-zinc-300'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <HardDrive size={18} className={settings.ocrMode === 'local' ? 'text-zinc-900' : 'text-zinc-400'} />
                    <span className={cn('text-sm font-medium', settings.ocrMode === 'local' ? 'text-zinc-900' : 'text-zinc-600')}>
                      {t.ocr.modeLocal}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">{t.ocr.modeLocalDesc}</p>
                </button>
              </div>
            </div>

            {/* VLM 配置区 */}
            {settings.ocrMode === 'vlm' && (
              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <h3 className="mb-4 text-sm font-medium text-zinc-900">
                  {t.ocr.modeVlm} - {t.ocr.vlmConfig}
                </h3>
                <div className="space-y-4">
                  {/* VLM Provider Selector */}
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-500">{t.ocr.vlmProvider}</label>
                    <div className="relative">
                      <button
                        onClick={() => setShowVlmProviderDropdown(!showVlmProviderDropdown)}
                        className="flex w-full items-center justify-between rounded-lg border-0 bg-zinc-100 px-3 py-2.5 text-left text-sm transition-all hover:bg-zinc-200"
                      >
                        <span className="text-zinc-900">
                          {currentVlmProvider?.name || t.ocr.vlmProviderCustom}
                        </span>
                        <ChevronDown size={16} className="text-zinc-400" />
                      </button>

                      {showVlmProviderDropdown && (
                        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
                          {VLM_PROVIDERS.map((provider) => (
                            <button
                              key={provider.url}
                              onClick={() => {
                                updateVlmOcr({ baseUrl: provider.url, model: VLM_RECOMMENDED_MODELS[provider.url]?.[0] || '' })
                                setShowVlmProviderDropdown(false)
                              }}
                              className={cn(
                                'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors',
                                settings.vlmOcr.baseUrl === provider.url
                                  ? 'bg-zinc-100'
                                  : 'hover:bg-zinc-50'
                              )}
                            >
                              <span className="text-zinc-900">{provider.name}</span>
                              {settings.vlmOcr.baseUrl === provider.url && (
                                <Check size={14} className="text-zinc-500" />
                              )}
                            </button>
                          ))}
                          <div className="my-1 border-t border-zinc-200" />
                          <button
                            onClick={() => setShowVlmProviderDropdown(false)}
                            className="flex w-full items-center px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-50"
                          >
                            {t.ocr.vlmProviderCustom}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Base URL */}
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-500">{t.ocr.vlmBaseUrl}</label>
                    <input
                      value={settings.vlmOcr.baseUrl}
                      onChange={(e) => updateVlmOcr({ baseUrl: e.target.value })}
                      placeholder={t.ocr.vlmBaseUrlPlaceholder}
                      className="w-full rounded-lg border-0 bg-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    />
                  </div>

                  {/* Model */}
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-500">{t.ocr.vlmModel}</label>
                    <ModelSelector
                      value={settings.vlmOcr.model}
                      onChange={(model) => updateVlmOcr({ model })}
                      baseUrl={settings.vlmOcr.baseUrl}
                      apiKey={settings.vlmOcr.apiKey}
                      staticModels={VLM_RECOMMENDED_MODELS[settings.vlmOcr.baseUrl]}
                      recentModels={settings.recentModels.vlm[settings.vlmOcr.baseUrl] ?? []}
                      onModelUsed={(model) => addRecentModel('vlm', settings.vlmOcr.baseUrl, model)}
                      onRemoveRecent={(model) => removeRecentModel('vlm', settings.vlmOcr.baseUrl, model)}
                      placeholder={t.ocr.vlmModelPlaceholder}
                    />
                  </div>

                  {/* API Key */}
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-500">{t.ocr.vlmApiKey}</label>
                    <input
                      value={settings.vlmOcr.apiKey}
                      onChange={(e) => updateVlmOcr({ apiKey: e.target.value })}
                      type="password"
                      placeholder={t.ocr.vlmApiKeyPlaceholder}
                      className="w-full rounded-lg border-0 bg-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    />
                  </div>

                  {/* System Prompt */}
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-500">{t.ocr.vlmSystemPrompt}</label>
                    <textarea
                      value={settings.vlmOcr.systemPrompt}
                      onChange={(e) => updateVlmOcr({ systemPrompt: e.target.value })}
                      placeholder={DEFAULT_VLM_OCR_SYSTEM_PROMPT}
                      rows={4}
                      className="w-full resize-none rounded-lg border-0 bg-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    />
                  </div>

                  {/* Test Connection */}
                  <div className="flex items-center gap-3 pt-1">
                    <Button
                      variant="outline"
                      disabled={vlmTesting || !settings.vlmOcr.apiKey || !settings.vlmOcr.baseUrl || !settings.vlmOcr.model}
                      onClick={async () => {
                        setVlmTesting(true)
                        try {
                          // 发送真实的 chat completions 请求验证 key + model 有效性
                          const baseUrl = settings.vlmOcr.baseUrl.replace(/\/+$/, '')
                          const url = /\/v\d+$/.test(baseUrl)
                            ? `${baseUrl}/chat/completions`
                            : `${baseUrl}/v1/chat/completions`
                          const resp = await fetch(url, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${settings.vlmOcr.apiKey}`,
                            },
                            body: JSON.stringify({
                              model: settings.vlmOcr.model,
                              messages: [{ role: 'user', content: 'hi' }],
                              max_tokens: 1,
                            }),
                            signal: AbortSignal.timeout(15000),
                          })
                          if (resp.ok) {
                            toast({ title: t.ocr.vlmTestSuccess, variant: 'success' })
                          } else {
                            const text = await resp.text().catch(() => '')
                            let detail = `HTTP ${resp.status}`
                            try { detail = JSON.parse(text)?.error?.message || detail } catch { /* ignore */ }
                            toast({ title: t.ocr.vlmTestFail, description: detail, variant: 'destructive' })
                          }
                        } catch {
                          toast({ title: t.ocr.vlmTestFail, description: '请检查网络或 API 配置', variant: 'destructive' })
                        } finally {
                          setVlmTesting(false)
                        }
                      }}
                      className="gap-2"
                    >
                      {vlmTesting && <Loader2 size={14} className="animate-spin" />}
                      {t.ocr.vlmTestConnection}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 本地引擎区 */}
            {settings.ocrMode === 'local' && (
              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <h3 className="mb-4 text-sm font-medium text-zinc-900">
                  {t.ocr.modeLocal}
                </h3>
                <div className="space-y-3">
                  {/* Status */}
                  <div className="flex items-start gap-2">
                    {ocrStatus?.installed ? (
                      <>
                        <CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-emerald-700">{t.ocr.localEngineInstalled}</p>
                          <p className="truncate text-xs text-zinc-500">{ocrStatus.enginePath}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                        <div>
                          <p className="text-sm font-medium text-amber-700">{t.ocr.localEngineNotInstalled}</p>
                          <p className="text-xs text-zinc-500">{t.ocr.localEngineNotInstalledDesc}</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Import button */}
                  <Button
                    variant="outline"
                    onClick={handleImportOcrEngine}
                    disabled={ocrImporting}
                    className="w-full gap-2"
                  >
                    {ocrImporting ? (
                      <><Loader2 size={14} className="animate-spin" /> {t.ocr.localImporting}</>
                    ) : (
                      <><FolderOpen size={14} /> {t.ocr.localImportBtn}</>
                    )}
                  </Button>

                  {/* Instructions */}
                  <div className="rounded-lg bg-zinc-50 px-3 py-2.5 text-xs text-zinc-500">
                    <p className="mb-1 font-medium text-zinc-600">{t.ocr.localInstructions}</p>
                    <ol className="list-decimal space-y-0.5 pl-4">
                      <li>{t.ocr.localStep1}</li>
                      <li>{t.ocr.localStep2}</li>
                      <li>{t.ocr.localStep3}</li>
                      <li>{t.ocr.localStep4}</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {/* GPU 加速卡片 — 仅本地模式可见 */}
            {settings.ocrMode === 'local' && (
              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-900">
                  <Cpu size={16} />
                  GPU 加速 (实验性)
                </h3>
                <div className="space-y-4">
                  {/* 统一状态显示 */}
                  <div className="flex items-start gap-2">
                    {gpuStatus?.ready ? (
                      <>
                        <CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-emerald-700">
                            GPU 加速已就绪
                            {gpuStatus.adapterName && (
                              <span className="ml-1 font-normal text-zinc-500">— {gpuStatus.adapterName}</span>
                            )}
                          </p>
                          <p className="text-xs text-zinc-500">
                            当前推理后端：{gpuStatus.activeProvider === 'DML' ? 'DirectML (GPU)' : 'CPU'}
                          </p>
                        </div>
                      </>
                    ) : gpuStatus && (gpuStatus.acceleratorInstalled || gpuStatus.onnxModelInstalled) ? (
                      <>
                        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-amber-700">GPU 加速部分安装</p>
                          <p className="text-xs text-zinc-500">
                            {!gpuStatus.acceleratorInstalled && '缺少加速补丁 (DirectML DLL)。'}
                            {!gpuStatus.onnxModelInstalled && '缺少 OCR 流水线模型。'}
                            {gpuStatus.activeProvider !== 'DML' && gpuStatus.acceleratorInstalled && gpuStatus.onnxModelInstalled && '缺少 onnxruntime 运行时。'}
                            {gpuStatus.error && ` ${gpuStatus.error}`}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle size={16} className="mt-0.5 shrink-0 text-zinc-400" />
                        <div>
                          <p className="text-sm font-medium text-zinc-600">GPU 加速未安装</p>
                          <p className="text-xs text-zinc-500">
                            导入 GPU 加速包以启用 DirectML 加速推理，显著提升 OCR 识别速度
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleCheckDx12}
                      className="flex-1 gap-2"
                    >
                      检查 DirectX 12 兼容性
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleImportGpuPack}
                      disabled={gpuImporting}
                      className="flex-1 gap-2"
                    >
                      {gpuImporting ? (
                        <><Loader2 size={14} className="animate-spin" /> 导入中...</>
                      ) : (
                        <><FolderOpen size={14} /> 导入 GPU 加速包 (.zip)</>
                      )}
                    </Button>
                  </div>

                  {/* 使用说明 */}
                  <details className="rounded-lg bg-zinc-50 px-3 py-2.5 text-xs text-zinc-500">
                    <summary className="cursor-pointer font-medium text-zinc-600">使用说明</summary>
                    <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                      <li>确保已安装本地 OCR 引擎（上方"本地引擎"区域）</li>
                      <li>点击"检查 DirectX 12 兼容性"确认显卡支持</li>
                      <li>导入 GPU 加速包（包含 DirectML DLL + OCR 流水线模型，一个 zip 搞定）</li>
                      <li>导入完成后，OCR 将自动切换到 GPU 加速的模块化流水线推理</li>
                    </ol>
                  </details>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-medium text-zinc-900">
                数据管理
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExport} className="flex-1">
                  导出配置
                </Button>
                <Button variant="destructive" onClick={() => setResetConfirm(true)} className="flex-1">
                  恢复出厂设置
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Reset Confirm Dialog */}
      <ConfirmDialog
        open={resetConfirm}
        onClose={() => setResetConfirm(false)}
        onConfirm={handleReset}
        title="恢复出厂设置"
        description="此操作将清除所有自定义配置，包括 API 密钥、排版设置等。此操作无法撤销，确定要继续吗？"
        confirmText="确认恢复"
        cancelText="取消"
        variant="destructive"
        icon={<AlertTriangle size={20} />}
      />
    </div>
  )
}
