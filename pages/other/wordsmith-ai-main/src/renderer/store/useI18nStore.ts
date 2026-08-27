import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { zhCN, type LocaleResource } from '../locales/zh-CN'
import { enUS } from '../locales/en-US'

export type LocaleType = 'zh-CN' | 'en-US'

interface I18nState {
  locale: LocaleType
  t: LocaleResource
  setLocale: (locale: LocaleType) => void
}

const resources: Record<LocaleType, LocaleResource> = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      locale: 'zh-CN',
      t: zhCN,
      setLocale: (locale) => set({ locale, t: resources[locale] }),
    }),
    {
      name: 'wordsmith-i18n',
      partialize: (state) => ({ locale: state.locale }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.t = resources[state.locale]
        }
      },
    },
  ),
)

// Hook helper for cleaner usage
export const useI18n = () => useI18nStore((s) => s.t)
export const useLocale = () => useI18nStore((s) => s.locale)
export const useSetLocale = () => useI18nStore((s) => s.setLocale)
