import { AppSettings, useAppStore } from '../store/useAppStore'
import { defaultTemplate } from '../lib/templates/default'

export class SettingsService {
  /**
   * 验证设置是否合法
   */
  validate(settings: Partial<AppSettings>): { valid: boolean; error?: string } {
    if (settings.ai) {
      if (settings.ai.baseUrl && !settings.ai.baseUrl.startsWith('http')) {
        return { valid: false, error: 'BaseURL 必须以 http 或 https 开头' }
      }
    }
    
    if (settings.timeout !== undefined) {
      if (settings.timeout < 1000 || settings.timeout > 600000) {
        return { valid: false, error: '超时时间必须在 1s 到 600s 之间' }
      }
    }

    return { valid: true }
  }

  /**
   * 恢复出厂设置
   */
  resetToDefaults() {
    const store = useAppStore.getState()

    // 1. 重置设置
    store.updateAi({ baseUrl: 'https://api.openai.com', apiKey: '', model: 'gpt-4o-mini' })
    store.updateTypography({
      fontFamily: defaultTemplate.style.fontFamily,
      fontSizePt: defaultTemplate.style.fontSizePt
    })
    store.setTemplateId('default')

    // 2. 重置 OCR 设置
    store.updateSettings({ ocrMode: 'vlm' })
    store.updateVlmOcr({ baseUrl: '', apiKey: '', model: '', systemPrompt: '' })
  }

  /**
   * 导出配置 (脱敏)
   */
  exportSettings(): string {
    const settings = useAppStore.getState().settings
    const safeSettings = {
      ...settings,
      ai: {
        ...settings.ai,
        apiKey: settings.ai.apiKey ? '******' : '',
      },
      vlmOcr: {
        ...settings.vlmOcr,
        apiKey: settings.vlmOcr.apiKey ? '******' : '',
      },
    }
    return JSON.stringify(safeSettings, null, 2)
  }
}

export const settingsService = new SettingsService()
