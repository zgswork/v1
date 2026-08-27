export interface TemplateStyle {
  fontFamily: string
  fontSizePt: number
  lineHeight: number
  paragraphSpacing: number
  headingFont?: string
  css: string
}

export interface Template {
  id: string
  nameKey: string // i18n key
  descriptionKey: string
  style: TemplateStyle
  systemPrompt?: string // Optional specific prompt for AI
}
