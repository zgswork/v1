import type { Template } from './types'

/**
 * 技术白皮书模板
 * 适用于产品说明书、技术方案、行业报告等正式文档
 * 包含封面、目录、章节编号、引用块、提示框等丰富样式
 */
export const whitepaperTemplate: Template = {
  id: 'whitepaper',
  nameKey: 'templates.whitepaper',
  descriptionKey: 'templates.whitepaperDesc',
  style: {
    fontFamily: 'Arial',
    fontSizePt: 11,
    lineHeight: 1.6,
    paragraphSpacing: 10,
    css: `
      /* 基础重置 */
      body { 
        font-family: 'Arial', 'Microsoft YaHei', sans-serif; 
        font-size: 11pt; 
        line-height: 1.6; 
        color: #1f2937; 
        margin: 0;
        padding: 0;
      }
      
      /* 封面页模拟 */
      .cover-page { 
        text-align: center; 
        padding-top: 100pt; 
        padding-bottom: 50pt;
        border-bottom: 1px solid #e5e7eb;
        margin-bottom: 40pt;
        page-break-after: always; 
        background-color: #f9fafb;
      }
      .cover-logo {
        font-size: 24pt;
        font-weight: bold;
        color: #2563eb;
        margin-bottom: 40pt;
        letter-spacing: 2px;
      }
      .cover-title { 
        font-size: 32pt; 
        font-weight: bold; 
        color: #111827; 
        margin-bottom: 20pt; 
        line-height: 1.2;
      }
      .cover-subtitle { 
        font-size: 18pt; 
        color: #4b5563; 
        margin-bottom: 60pt; 
        font-weight: normal;
      }
      .cover-meta { 
        font-size: 12pt; 
        color: #6b7280; 
        border-top: 1px solid #d1d5db;
        display: inline-block;
        padding-top: 20pt;
        min-width: 200pt;
      }
      
      /* 目录样式 */
      .toc-box {
        background-color: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8pt;
        padding: 20pt;
        margin-bottom: 40pt;
      }
      .toc-title {
        font-size: 16pt;
        font-weight: bold;
        margin-bottom: 12pt;
        text-align: center;
        color: #111827;
      }
      
      /* 章节排版 */
      h1 { 
        font-size: 20pt; 
        color: #2563eb; 
        margin-top: 24pt; 
        margin-bottom: 12pt; 
        font-weight: bold; 
        border-left: 5px solid #2563eb;
        padding-left: 10pt;
      }
      h2 { 
        font-size: 16pt; 
        color: #1d4ed8; 
        margin-top: 18pt; 
        margin-bottom: 10pt; 
        font-weight: bold; 
      }
      h3 { 
        font-size: 13pt; 
        color: #1e40af; 
        margin-top: 12pt; 
        margin-bottom: 8pt; 
        font-weight: bold; 
      }
      
      /* 正文与引用 */
      p { 
        margin-bottom: 10pt; 
        text-align: justify; 
      }
      
      blockquote { 
        border-left: 4px solid #2563eb; 
        padding: 10pt 15pt; 
        color: #4b5563; 
        font-style: italic; 
        margin: 15pt 0; 
        background: #f3f4f6; 
        border-radius: 0 4pt 4pt 0;
      }
      
      /* 提示框 (Callout) */
      .callout { 
        background-color: #eff6ff; 
        border: 1px solid #bfdbfe; 
        border-radius: 6pt; 
        padding: 12pt; 
        margin: 12pt 0; 
      }
      .callout-info { border-left: 4px solid #3b82f6; }
      .callout-warning { background-color: #fffbeb; border-color: #fcd34d; border-left: 4px solid #f59e0b; }
      
      .callout-title { 
        font-weight: bold; 
        color: #1e40af; 
        margin-bottom: 4pt; 
        display: block;
      }
      
      /* 表格样式 */
      table { 
        width: 100%; 
        border-collapse: collapse; 
        margin: 16pt 0; 
        box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
        font-size: 10pt;
      }
      th { 
        background-color: #f8fafc; 
        text-align: left; 
        padding: 10pt; 
        font-weight: bold; 
        border-bottom: 2px solid #e2e8f0; 
        color: #1f2937;
      }
      td { 
        padding: 10pt; 
        border-bottom: 1px solid #e2e8f0; 
        color: #4b5563;
      }
      tr:last-child td { border-bottom: none; }
      
      /* 代码块模拟 */
      .code-block {
        font-family: 'Consolas', 'Monaco', monospace;
        background-color: #1f2937;
        color: #f3f4f6;
        padding: 12pt;
        border-radius: 6pt;
        margin: 12pt 0;
        white-space: pre-wrap;
        font-size: 9pt;
      }
    `,
  },
  systemPrompt: `请撰写一份专业的技术白皮书。
要求：
1. 包含封面页（<div class="cover-page">...</div>），含标题、副标题、版本号、作者。
2. 包含目录占位符。
3. 正文包含至少3个主要章节（引言、技术架构、解决方案）。
4. 使用 <blockquote class="callout callout-info">...</blockquote> 制作信息提示框。
5. 使用表格展示技术参数对比。
6. 使用代码块样式展示配置示例。
7. 保持语气专业、客观。`,
}
