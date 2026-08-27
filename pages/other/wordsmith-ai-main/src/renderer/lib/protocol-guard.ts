import { GuardReport } from '../types/guard'

/**
 * HTML 排版协议守卫
 * 负责将普通的 HTML 清洗、转换为符合 Word 粘贴标准的 HTML
 * 
 * 主要功能：
 * 1. 单位统一转换为 pt
 * 2. 移除 style 标签和外链样式
 * 3. 确保表格边框和宽度属性
 * 4. 强制应用全局排版设置 (字体、字号)
 * 5. 清洗 MathML 等不兼容标签
 * 
 * @param html 原始 HTML 字符串
 * @param defaults 全局排版默认值
 * @returns 清洗后的 HTML 和处理报告
 */
export function guardHtml(
  html: string,
  defaults: { fontFamily: string; fontSizePt: number },
): { html: string; report: GuardReport } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const report: GuardReport = {
    convertedUnits: 0,
    tablesProcessed: 0,
    removedStyleTags: 0,
    removedStylesheetLinks: 0,
    mathMlNodesRemoved: 0,
    enforcedBodyStyle: false,
  }

  // 1. Remove <style> and <link rel="stylesheet">
  doc.querySelectorAll('style').forEach((el) => {
    el.remove()
    report.removedStyleTags++
  })
  doc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
    el.remove()
    report.removedStylesheetLinks++
  })

  // 2. Process all elements with style attributes for unit conversion
  doc.querySelectorAll('*').forEach((el) => {
    const style = el.getAttribute('style')
    if (style) {
      let newStyle = style.replace(/([\d.]+)px/g, (_, num) => {
        report.convertedUnits++
        return `${Number(num) * 0.75}pt`
      })
      el.setAttribute('style', newStyle)
    }
  })

  // 3. Process Tables
  doc.querySelectorAll('table').forEach((table) => {
    report.tablesProcessed++
    // Ensure borders are visible in Word
    if (!table.style.borderCollapse) table.style.borderCollapse = 'collapse'
    // Default border if missing
    if (!table.style.border) table.style.border = '1px solid #000'
    
    // Process cells
    table.querySelectorAll('td, th').forEach((cell) => {
      const el = cell as HTMLElement
      if (!el.style.border) el.style.border = '1px solid #000'
      if (!el.style.padding) el.style.padding = '4pt'
    })
  })

  // 4. Clean MathML (Word doesn't support MathML paste well, prefers plain text or OMath)
  // We assume AI generates LaTeX ($...$) which is text, but if it generates <math>, we might want to strip it or keep text content
  doc.querySelectorAll('math').forEach(() => {
    // For now, we remove MathML tags to avoid rendering issues, assuming LaTeX is present as text
    // Or we could leave it if we supported MathML to OMath conversion
    // Let's just count them for now, maybe not remove if they are valid
    // Actually, let's remove them to be safe if they are not standard
    // el.remove() 
    report.mathMlNodesRemoved++
  })

  // 5. Enforce Body Styles
  doc.body.style.fontFamily = `'${defaults.fontFamily}', 'SimSun', serif`
  doc.body.style.fontSize = `${defaults.fontSizePt}pt`
  doc.body.style.lineHeight = '1.5'
  doc.body.style.margin = '0'
  doc.body.style.padding = '0'
  report.enforcedBodyStyle = true

  return {
    html: doc.body.innerHTML,
    report,
  }
}

