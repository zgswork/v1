import { describe, it, expect } from 'vitest'
import { latexToUnicodeMath } from './latex-to-unicodemath'

describe('latexToUnicodeMath', () => {
  it('converts simple fraction', () => {
    expect(latexToUnicodeMath('\\frac{1}{2}')).toBe('(1)/(2)')
  })

  it('converts nested fraction', () => {
    expect(latexToUnicodeMath('\\frac{a+b}{c+d}')).toBe('(a+b)/(c+d)')
  })

  it('converts superscript and subscript', () => {
    expect(latexToUnicodeMath('x^2')).toContain('x^2')
    expect(latexToUnicodeMath('x_{i}')).toContain('x_i')
  })

  it('converts Greek letters', () => {
    expect(latexToUnicodeMath('\\alpha + \\beta')).toBe('α + β')
  })

  it('converts sqrt', () => {
    expect(latexToUnicodeMath('\\sqrt{x}')).toBe('√(x)')
  })

  it('converts nth root', () => {
    expect(latexToUnicodeMath('\\sqrt[3]{x}')).toBe('√(3&x)')
  })

  it('converts operators', () => {
    expect(latexToUnicodeMath('a \\times b')).toBe('a × b')
    expect(latexToUnicodeMath('a \\pm b')).toBe('a ± b')
  })

  it('converts sum with limits', () => {
    const result = latexToUnicodeMath('\\sum_{i=1}^{n} x_i')
    expect(result).toContain('∑')
    expect(result).toContain('i=1')
    expect(result).toContain('n')
  })

  it('converts integral', () => {
    const result = latexToUnicodeMath('\\int_{0}^{\\infty} f(x) dx')
    expect(result).toContain('∫')
    expect(result).toContain('∞')
  })

  it('converts quadratic formula', () => {
    const result = latexToUnicodeMath('x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}')
    expect(result).toContain('±')
    expect(result).toContain('√')
    expect(result).toContain('/(2a)')
  })

  it('converts Euler formula', () => {
    const result = latexToUnicodeMath('e^{i\\pi} + 1 = 0')
    expect(result).toContain('π')
  })

  it('converts matrix with \\matrix keyword (no ■)', () => {
    const result = latexToUnicodeMath('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}')
    expect(result).toContain('\\matrix(')
    expect(result).toContain('(')
    expect(result).toContain('@')
    expect(result).not.toContain('■')
  })

  it('wraps plain matrix with square brackets', () => {
    const result = latexToUnicodeMath('\\begin{matrix} 1 & 2 \\\\ 3 & 4 \\end{matrix}')
    expect(result).toContain('[\\matrix(')
    expect(result).toContain(')]')
  })

  it('converts cases (piecewise function)', () => {
    const result = latexToUnicodeMath('\\begin{cases} x & x \\geq 0 \\\\ -x & x < 0 \\end{cases}')
    expect(result).toContain('{')
    expect(result).toContain('█(')
    expect(result).toContain('┤')
    expect(result).toContain('@')
  })

  it('protects large operators in fractions', () => {
    const result = latexToUnicodeMath('\\frac{\\sum_{i=1}^{n} x_i}{n}')
    expect(result).toContain('∑')
    // 分子含大型算子应被额外括号保护
    expect(result).toMatch(/\(\(.*∑.*\)\)\//)
  })

  it('converts \\dot and \\ddot modifiers', () => {
    const dotResult = latexToUnicodeMath('\\dot{x}')
    expect(dotResult).toContain('x\\dot')
    const ddotResult = latexToUnicodeMath('\\ddot{x}')
    expect(ddotResult).toContain('x\\ddot')
  })

  it('does not confuse \\dot with \\dots', () => {
    const result = latexToUnicodeMath('a \\dots b')
    expect(result).toBe('a … b')
  })

  it('converts \\mathbf to Word format', () => {
    const result = latexToUnicodeMath('\\mathbf{K}')
    expect(result).toContain('\\mathbf')
    expect(result).toContain('K')
  })

  it('Newton second law with dot modifiers', () => {
    const result = latexToUnicodeMath('m\\ddot{x} + c\\dot{x} + kx = F_0 \\cos(\\omega t)')
    expect(result).toContain('x\\ddot')
    expect(result).toContain('x\\dot')
    expect(result).toContain('ω')
    expect(result).toContain('cos')
  })

  it('integral with fraction adds space after limits', () => {
    const result = latexToUnicodeMath('\\int_{0}^{L} \\frac{P^2}{2EA} dx')
    expect(result).toContain('∫')
    // 上标后面和分式之间应有空格
    expect(result).toMatch(/\^L\s+\(/)
  })

  it('bmatrix stiffness matrix', () => {
    const result = latexToUnicodeMath('\\mathbf{K} = \\begin{bmatrix} k_1+k_2 & -k_2 \\\\ -k_2 & k_2 \\end{bmatrix}')
    expect(result).toContain('\\mathbf')
    expect(result).toContain('[\\matrix(')
    expect(result).not.toContain('■')
  })

  it('strips dollar signs', () => {
    expect(latexToUnicodeMath('$\\alpha$')).toBe('α')
    expect(latexToUnicodeMath('$$\\beta$$')).toBe('β')
  })

  it('handles empty input', () => {
    expect(latexToUnicodeMath('')).toBe('')
    expect(latexToUnicodeMath('  ')).toBe('')
  })

  it('converts relations', () => {
    expect(latexToUnicodeMath('a \\leq b')).toBe('a ≤ b')
    expect(latexToUnicodeMath('x \\in A')).toBe('x ∈ A')
  })

  it('converts binomial', () => {
    expect(latexToUnicodeMath('\\binom{n}{k}')).toBe('(n¦k)')
  })
})
