import type { Template } from './types'

export const financialTemplate: Template = {
  id: 'financial',
  nameKey: 'templates.financial',
  descriptionKey: 'templates.financial',
  style: {
    fontFamily: 'Microsoft YaHei',
    fontSizePt: 10,
    lineHeight: 1.5,
    paragraphSpacing: 8,
    css: `
      body { font-family: 'Microsoft YaHei', sans-serif; font-size: 10pt; line-height: 1.5; color: #333; }
      h1 { font-size: 18pt; color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 4pt; margin-bottom: 12pt; }
      h2 { font-size: 14pt; color: #2c5282; margin-top: 12pt; margin-bottom: 8pt; }
      p { margin-bottom: 8pt; }
      .highlight { color: #c53030; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin: 12pt 0; font-size: 9pt; }
      th { background-color: #ebf8ff; color: #2a4365; padding: 6pt; border: 1px solid #bee3f8; }
      td { padding: 6pt; border: 1px solid #bee3f8; }
      .chart-placeholder { background: #f7fafc; border: 1px dashed #cbd5e0; padding: 20pt; text-align: center; color: #718096; margin: 12pt 0; }
    `,
  },
  systemPrompt: '请生成专业的金融研报摘要，重点数据高亮显示，包含图表占位符，表格风格简洁现代。',
}
