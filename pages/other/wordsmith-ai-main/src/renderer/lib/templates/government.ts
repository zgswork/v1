import type { Template } from './types'

export const governmentTemplate: Template = {
  id: 'government',
  nameKey: 'templates.government',
  descriptionKey: 'templates.government',
  style: {
    fontFamily: 'FangSong', // 仿宋_GB2312
    fontSizePt: 16, // 三号字
    lineHeight: 1.5, // 28磅行距近似
    paragraphSpacing: 0,
    css: `
      body { font-family: 'FangSong', 'SimSun', serif; font-size: 16pt; line-height: 1.8; color: #000; }
      
      /* Red Header */
      .red-header { color: #ff0000; border-bottom: 3px solid #ff0000; padding-bottom: 10pt; margin-bottom: 30pt; text-align: center; font-size: 26pt; font-family: 'SimSun'; font-weight: bold; letter-spacing: 2pt; }
      .doc-number { text-align: right; font-size: 12pt; font-family: 'HeiTi'; margin-top: 4pt; color: #000; }
      
      /* Titles */
      h1 { font-family: 'SimHei', serif; font-size: 22pt; text-align: center; color: #000; margin-bottom: 24pt; font-weight: normal; }
      h2 { font-family: 'KaiTi', serif; font-size: 16pt; font-weight: bold; margin: 12pt 0; }
      h3 { font-family: 'FangSong', serif; font-size: 16pt; font-weight: bold; margin: 8pt 0; }
      
      /* Content */
      p { text-indent: 2em; margin-bottom: 0; text-align: justify; }
      
      /* Signature */
      .signature-box { margin-top: 40pt; text-align: right; padding-right: 2em; }
      .signature-date { margin-top: 8pt; }
      
      /* Table */
      table { border: 1px solid #ff0000; width: 100%; border-collapse: collapse; margin: 12pt 0; }
      td, th { border: 1px solid #ff0000; padding: 8pt; text-align: center; font-size: 14pt; }
    `,
  },
  systemPrompt: '请严格按照党政机关公文格式（GB/T 9704-2012）输出。包含红头文件样式（模拟）、发文字号。正文使用仿宋字体，一级标题使用黑体，二级标题使用楷体，三级标题使用仿宋加粗。行距固定为 28 磅（约 1.5 倍）。',
}
