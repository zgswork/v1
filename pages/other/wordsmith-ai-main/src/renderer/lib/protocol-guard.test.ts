import { describe, expect, it } from 'vitest'
import { guardHtml } from './protocol-guard'

describe('protocol-guard', () => {
  it('removes <style> and stylesheet links', () => {
    const input = `<html><head><style>p{color:red}</style><link rel="stylesheet" href="x.css"></head><body><p>hi</p></body></html>`
    const out = guardHtml(input, { fontFamily: 'SimSun', fontSizePt: 12 })
    expect(out.report.removedStyleTags).toBe(1)
    expect(out.report.removedStylesheetLinks).toBe(1)
    expect(out.html).not.toContain('<style')
    expect(out.html).not.toContain('rel="stylesheet"')
  })

  it('enforces body style and converts px to pt', () => {
    const input = `<body style="margin:8px; padding:4px; font-family:Arial; font-size:16px;"><p style="margin-top:8px;">x</p></body>`
    const out = guardHtml(input, { fontFamily: 'SimSun', fontSizePt: 12 })
    expect(out.html).toContain("font-family:'SimSun'")
    expect(out.html).toContain('font-size:12pt')
    expect(out.html).toContain('margin:0')
    expect(out.html).toContain('padding:0')
    expect(out.report.convertedUnits).toBeGreaterThan(0)
    expect(out.html).toContain('margin-top:6pt')
  })

  it('enforces table protocol', () => {
    const input = `<body><table style="width:600px;"><tr><td>1</td></tr></table></body>`
    const out = guardHtml(input, { fontFamily: 'SimSun', fontSizePt: 12 })
    expect(out.report.tablesProcessed).toBe(1)
    expect(out.html).toContain('align="center"')
    expect(out.html).toContain('width:440pt')
    expect(out.html).toContain('border-collapse:collapse')
  })

  it('strips MathML tags but keeps text content', () => {
    const input = `<body><p>before</p><math><mrow><mi>x</mi><mo>+</mo><mi>y</mi></mrow></math><p>after</p></body>`
    const out = guardHtml(input, { fontFamily: 'SimSun', fontSizePt: 12 })
    expect(out.report.mathMlNodesRemoved).toBeGreaterThan(0)
    expect(out.html).not.toContain('<math')
    expect(out.html).toContain('x+y')
  })
})

