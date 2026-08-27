import type { Template } from './types'

export const academicTemplate: Template = {
  id: 'academic',
  nameKey: 'templates.academic',
  descriptionKey: 'templates.academic',
  style: {
    fontFamily: 'Times New Roman', // 英文 Times, 中文宋体 (通常由 Word 自动 fallback)
    fontSizePt: 10.5, // 五号字
    lineHeight: 1.25, // 单倍行距
    paragraphSpacing: 0,
    css: `
      body { font-family: 'Times New Roman', 'SimSun', serif; font-size: 10.5pt; line-height: 1.25; color: #000; }
      
      /* Layout */
      .paper-title { font-size: 16pt; font-weight: bold; text-align: center; margin-top: 12pt; margin-bottom: 12pt; }
      .author-info { text-align: center; font-size: 10pt; margin-bottom: 12pt; }
      
      /* Abstract */
      .abstract-box { margin: 12pt 2em; padding: 0; font-size: 9pt; }
      .abstract-title { font-weight: bold; }
      
      /* Columns Simulation (Visual only, Word needs section breaks for real columns) */
      .two-column { column-count: 2; column-gap: 2em; text-align: justify; }
      
      /* Headings */
      h1 { font-size: 14pt; font-weight: bold; text-align: center; margin-top: 12pt; margin-bottom: 12pt; }
      h2 { font-size: 12pt; font-weight: bold; margin-top: 10pt; margin-bottom: 6pt; border-bottom: 1px solid #ddd; }
      h3 { font-size: 10.5pt; font-weight: bold; margin-top: 8pt; margin-bottom: 4pt; }
      
      p { text-indent: 2em; margin-bottom: 0; text-align: justify; }
      
      /* Figures & Tables */
      figure { text-align: center; margin: 12pt 0; }
      figcaption { font-size: 9pt; font-weight: bold; margin-top: 4pt; }
      
      table { border-top: 2px solid #000; border-bottom: 2px solid #000; width: 100%; border-collapse: collapse; margin: 12pt auto; font-size: 9pt; }
      th { border-bottom: 1px solid #000; padding: 4pt; text-align: center; font-weight: bold; }
      td { padding: 4pt; border: none; text-align: center; }
      
      /* References */
      .references { font-size: 9pt; margin-top: 24pt; }
      .ref-item { padding-left: 1.5em; text-indent: -1.5em; margin-bottom: 2pt; }
    `,
  },
  systemPrompt: '请按照标准学术论文格式输出。包含：中英文标题、作者、摘要、关键词。正文采用双栏排版逻辑（HTML中可使用CSS column-count模拟）。图表要有编号和标题。参考文献使用 APA 格式。',
}
