import { defaultTemplate } from './default'
import { academicTemplate } from './academic'
import { financialTemplate } from './financial'
import { governmentTemplate } from './government'
import { resumeTemplate } from './resume'
import { whitepaperTemplate } from './whitepaper'
import type { Template } from './types'

export const templates: Template[] = [
  defaultTemplate,
  academicTemplate,
  financialTemplate,
  governmentTemplate,
  resumeTemplate,
  whitepaperTemplate,
]

export const getTemplateById = (id: string): Template => {
  return templates.find((t) => t.id === id) || defaultTemplate
}

export * from './types'
