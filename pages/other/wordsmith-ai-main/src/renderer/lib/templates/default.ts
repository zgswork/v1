import type { Template } from './types'

export const defaultTemplate: Template = {
  id: 'default',
  nameKey: 'templates.default',
  descriptionKey: 'templates.desc',
  style: {
    fontFamily: 'SimSun',
    fontSizePt: 12,
    lineHeight: 1.5,
    paragraphSpacing: 12,
    css: `
      body { font-family: 'SimSun', serif; font-size: 12pt; line-height: 1.5; }
      p { margin-bottom: 12pt; text-align: justify; }
      h1 { font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 12pt; }
      h2 { font-size: 14pt; font-weight: bold; margin-bottom: 12pt; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 12pt; }
      td, th { border: 1px solid #000; padding: 4pt; }
    `,
  },
}
