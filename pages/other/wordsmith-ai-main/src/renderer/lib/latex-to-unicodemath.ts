/**
 * LaTeX → UnicodeMath (Linear Format) 转换器
 *
 * UnicodeMath 是 Word 公式编辑器的原生输入格式，
 * 用户在 Word 中按 Alt+= 打开公式编辑器后粘贴即可自动构建。
 *
 * 覆盖常用数学语法的 80/20：分数、上下标、根号、希腊字母、运算符、矩阵等。
 * 复杂表达式可回退图片复制。
 */

// ---------------------------------------------------------------------------
// 符号映射表: LaTeX 命令 → Unicode 字符
// ---------------------------------------------------------------------------

const SYMBOL_MAP: Record<string, string> = {
  // 希腊字母（小写）
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
  '\\epsilon': 'ϵ', '\\varepsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η',
  '\\theta': 'θ', '\\vartheta': 'ϑ', '\\iota': 'ι', '\\kappa': 'κ',
  '\\lambda': 'λ', '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ',
  '\\pi': 'π', '\\varpi': 'ϖ', '\\rho': 'ρ', '\\varrho': 'ϱ',
  '\\sigma': 'σ', '\\varsigma': 'ς', '\\tau': 'τ', '\\upsilon': 'υ',
  '\\phi': 'ϕ', '\\varphi': 'φ', '\\chi': 'χ', '\\psi': 'ψ',
  '\\omega': 'ω',
  // 希腊字母（大写）
  '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
  '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Upsilon': 'Υ',
  '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
  // 二元运算符
  '\\times': '×', '\\div': '÷', '\\cdot': '⋅', '\\pm': '±',
  '\\mp': '∓', '\\ast': '∗', '\\star': '⋆', '\\circ': '∘',
  '\\bullet': '∙', '\\oplus': '⊕', '\\otimes': '⊗',
  // 关系符
  '\\leq': '≤', '\\le': '≤', '\\geq': '≥', '\\ge': '≥',
  '\\neq': '≠', '\\ne': '≠', '\\approx': '≈', '\\equiv': '≡',
  '\\sim': '∼', '\\simeq': '≃', '\\cong': '≅', '\\propto': '∝',
  '\\ll': '≪', '\\gg': '≫', '\\subset': '⊂', '\\supset': '⊃',
  '\\subseteq': '⊆', '\\supseteq': '⊇', '\\in': '∈', '\\ni': '∋',
  '\\notin': '∉', '\\perp': '⊥', '\\parallel': '∥',
  // 箭头
  '\\to': '→', '\\rightarrow': '→', '\\leftarrow': '←',
  '\\Rightarrow': '⇒', '\\Leftarrow': '⇐', '\\Leftrightarrow': '⇔',
  '\\leftrightarrow': '↔', '\\uparrow': '↑', '\\downarrow': '↓',
  '\\mapsto': '↦',
  // 大型运算符
  '\\sum': '∑', '\\prod': '∏', '\\coprod': '∐',
  '\\int': '∫', '\\iint': '∬', '\\iiint': '∭',
  '\\oint': '∮', '\\bigcup': '⋃', '\\bigcap': '⋂',
  '\\bigoplus': '⨁', '\\bigotimes': '⨂',
  // 其他常用符号
  '\\infty': '∞', '\\partial': '∂', '\\nabla': '∇',
  '\\forall': '∀', '\\exists': '∃', '\\nexists': '∄',
  '\\emptyset': '∅', '\\varnothing': '∅',
  '\\angle': '∠', '\\triangle': '△',
  '\\hbar': 'ℏ', '\\ell': 'ℓ', '\\Re': 'ℜ', '\\Im': 'ℑ',
  '\\aleph': 'ℵ',
  // 点号
  '\\cdots': '⋯', '\\ldots': '…', '\\vdots': '⋮', '\\ddots': '⋱',
  '\\dots': '…',
  // 逻辑
  '\\neg': '¬', '\\lnot': '¬', '\\land': '∧', '\\lor': '∨',
  // 杂项
  '\\degree': '°', '\\%': '%',
  '\\langle': '⟨', '\\rangle': '⟩',
  '\\lceil': '⌈', '\\rceil': '⌉', '\\lfloor': '⌊', '\\rfloor': '⌋',
  // 数学字体（简化处理）
  '\\mathbb{R}': 'ℝ', '\\mathbb{N}': 'ℕ', '\\mathbb{Z}': 'ℤ',
  '\\mathbb{Q}': 'ℚ', '\\mathbb{C}': 'ℂ',
  // 函数名（Word UnicodeMath 直接识别）
  '\\sin': 'sin', '\\cos': 'cos', '\\tan': 'tan',
  '\\sec': 'sec', '\\csc': 'csc', '\\cot': 'cot',
  '\\arcsin': 'arcsin', '\\arccos': 'arccos', '\\arctan': 'arctan',
  '\\sinh': 'sinh', '\\cosh': 'cosh', '\\tanh': 'tanh',
  '\\ln': 'ln', '\\log': 'log', '\\exp': 'exp',
  '\\lim': 'lim', '\\max': 'max', '\\min': 'min',
  '\\sup': 'sup', '\\inf': 'inf', '\\det': 'det', '\\dim': 'dim',
  '\\ker': 'ker', '\\gcd': 'gcd', '\\mod': 'mod',
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/**
 * 从位置 start 开始提取一个花括号块 {content}，支持嵌套。
 * 返回 [content, endIndex]。找不到匹配返回 ['', start]。
 */
function extractBraceGroup(latex: string, start: number): [string, number] {
  if (start >= latex.length || latex[start] !== '{') return ['', start]
  let depth = 1
  let i = start + 1
  while (i < latex.length && depth > 0) {
    if (latex[i] === '{') depth++
    else if (latex[i] === '}') depth--
    i++
  }
  return [latex.slice(start + 1, i - 1), i]
}

/**
 * 提取下一个 "参数"（花括号组或单个字符）
 */
function extractArg(latex: string, pos: number): [string, number] {
  // 跳过空白
  while (pos < latex.length && latex[pos] === ' ') pos++
  if (pos >= latex.length) return ['', pos]
  if (latex[pos] === '{') return extractBraceGroup(latex, pos)
  // 单个字符
  return [latex[pos], pos + 1]
}

// ---------------------------------------------------------------------------
// 大型算子保护: 分式内的算子+下标/上标需额外括号
// ---------------------------------------------------------------------------

const LARGE_OP_CHARS = new Set('∑∏∐∫∬∭∮⋃⋂⨁⨂')
const LARGE_OP_CMDS = /\\(?:sum|prod|coprod|int|iint|iiint|oint|bigcup|bigcap|bigoplus|bigotimes)(?![a-zA-Z])/

/**
 * 检测文本是否含大型运算符，若有则包裹括号防止 Word 超宽分式线
 */
function protectLargeOps(text: string): string {
  if (text.startsWith('(') && text.endsWith(')')) return text
  let hasOp = false
  for (const ch of text) {
    if (LARGE_OP_CHARS.has(ch)) { hasOp = true; break }
  }
  if (!hasOp) hasOp = LARGE_OP_CMDS.test(text)
  return hasOp ? `(${text})` : text
}

// ---------------------------------------------------------------------------
// Word 保护命令集: cleanup 阶段不剥离这些反斜杠命令
// ---------------------------------------------------------------------------

const PROTECTED_CMDS = /^(?:matrix|dot|ddot|mathbf|mathrm|mathit|mathcal|mathfrak)$/

// ---------------------------------------------------------------------------
// 结构转换（递归处理）
// ---------------------------------------------------------------------------

function convertStructures(latex: string): string {
  let result = ''
  let i = 0

  while (i < latex.length) {
    // \frac{a}{b} → (a)/(b)  — UnicodeMath 分数
    if (latex.startsWith('\\frac', i)) {
      i += 5
      const [num, afterNum] = extractArg(latex, i)
      const [den, afterDen] = extractArg(latex, afterNum)
      const convNum = convertStructures(num)
      const convDen = convertStructures(den)
      // 算子保护: 大型运算符在分式中需额外括号
      const safeNum = protectLargeOps(convNum)
      const safeDen = protectLargeOps(convDen)
      result += `(${safeNum})/(${safeDen})`
      i = afterDen
      continue
    }

    // \sqrt[n]{x} → √(n&x)  或 \sqrt{x} → √(x)
    if (latex.startsWith('\\sqrt', i)) {
      i += 5
      let nthRoot = ''
      if (i < latex.length && latex[i] === '[') {
        const closeIdx = latex.indexOf(']', i)
        if (closeIdx !== -1) {
          nthRoot = latex.slice(i + 1, closeIdx)
          i = closeIdx + 1
        }
      }
      const [content, afterContent] = extractArg(latex, i)
      const convContent = convertStructures(content)
      if (nthRoot) {
        result += `√(${nthRoot}&${convContent})`
      } else {
        result += `√(${convContent})`
      }
      i = afterContent
      continue
    }

    // \binom{n}{k} → (n¦k)
    if (latex.startsWith('\\binom', i)) {
      i += 6
      const [top, afterTop] = extractArg(latex, i)
      const [bot, afterBot] = extractArg(latex, afterTop)
      result += `(${convertStructures(top)}¦${convertStructures(bot)})`
      i = afterBot
      continue
    }

    // \ddot{x} → x\ddot  （必须在 \dot 之前检查）
    if (latex.startsWith('\\ddot', i)) {
      i += 5
      const [content, after] = extractArg(latex, i)
      result += `${convertStructures(content)}\\ddot `
      i = after
      continue
    }

    // \dot{x} → x\dot  （排除 \dots）
    if (latex.startsWith('\\dot', i) && !latex.startsWith('\\dots', i)) {
      i += 4
      const [content, after] = extractArg(latex, i)
      result += `${convertStructures(content)}\\dot `
      i = after
      continue
    }

    // \overline{x} → x̅
    if (latex.startsWith('\\overline', i)) {
      i += 9
      const [content, after] = extractArg(latex, i)
      result += `${convertStructures(content)}\u0305`
      i = after
      continue
    }

    // \hat{x} → x̂
    if (latex.startsWith('\\hat', i)) {
      i += 4
      const [content, after] = extractArg(latex, i)
      result += `${convertStructures(content)}\u0302`
      i = after
      continue
    }

    // \vec{x} → x⃗
    if (latex.startsWith('\\vec', i)) {
      i += 4
      const [content, after] = extractArg(latex, i)
      result += `${convertStructures(content)}\u20D7`
      i = after
      continue
    }

    // 数学字体命令 — \mathbf{K} → \mathbf(K) — Word UnicodeMath 直接识别
    if (latex.startsWith('\\mathbf', i) || latex.startsWith('\\mathrm', i) ||
        latex.startsWith('\\mathit', i) || latex.startsWith('\\mathcal', i) ||
        latex.startsWith('\\mathfrak', i)) {
      // 提取命令名（到 { 之前）
      let j = i + 1
      while (j < latex.length && latex[j] !== '{' && latex[j] !== ' ') j++
      const cmd = latex.slice(i + 1, j) // e.g. 'mathbf'
      i = j
      const [content, after] = extractArg(latex, i)
      result += `\\${cmd}(${convertStructures(content)})`
      i = after
      continue
    }

    // \text{...} → 直接输出文本
    if (latex.startsWith('\\text', i)) {
      i += 5
      if (i < latex.length && latex[i] === '{') {
        const [content, after] = extractBraceGroup(latex, i)
        result += `"${content}"`
        i = after
        continue
      }
    }

    // \left 和 \right — 去掉，保留括号
    if (latex.startsWith('\\left', i)) {
      i += 5
      if (i < latex.length && latex[i] === '.') i++
      continue
    }
    if (latex.startsWith('\\right', i)) {
      i += 6
      if (i < latex.length && latex[i] === '.') i++
      continue
    }

    // \begin{matrix/pmatrix/bmatrix/cases/...}
    if (latex.startsWith('\\begin{', i)) {
      const envEnd = latex.indexOf('}', i + 7)
      if (envEnd !== -1) {
        const envName = latex.slice(i + 7, envEnd)
        const closeTag = `\\end{${envName}}`
        const closeIdx = latex.indexOf(closeTag, envEnd)
        if (closeIdx !== -1) {
          const body = latex.slice(envEnd + 1, closeIdx)

          // \begin{cases} → {█(行1@行2@...)┤
          if (envName === 'cases') {
            const casesContent = convertMatrix(body)
            result += `{█(${casesContent})┤`
            i = closeIdx + closeTag.length
            continue
          }

          // 矩阵环境 → [\matrix(...)]
          const matrixContent = convertMatrix(body)
          let open = '[', close = ']'
          if (envName === 'pmatrix') { open = '('; close = ')' }
          else if (envName === 'bmatrix') { open = '['; close = ']' }
          else if (envName === 'vmatrix') { open = '|'; close = '|' }
          else if (envName === 'Bmatrix') { open = '{'; close = '}' }
          result += `${open}\\matrix(${matrixContent})${close}`
          i = closeIdx + closeTag.length
          continue
        }
      }
    }

    // ^{...} 或 _{...} — UnicodeMath 用圆括号分组
    if ((latex[i] === '^' || latex[i] === '_') && i + 1 < latex.length && latex[i + 1] === '{') {
      const op = latex[i]
      const [content, after] = extractBraceGroup(latex, i + 1)
      const conv = convertStructures(content)
      if (conv.length <= 1) {
        result += `${op}${conv}`
      } else {
        result += `${op}(${conv})`
      }
      i = after
      continue
    }

    // 普通字符直接追加
    result += latex[i]
    i++
  }

  return result
}

/**
 * 转换矩阵内容: \\ 分行 → @，& 分列 → &
 */
function convertMatrix(body: string): string {
  const rows = body.split('\\\\').map(r => r.trim()).filter(Boolean)
  return rows.map(row => {
    const cells = row.split('&').map(c => convertStructures(c.trim()))
    return cells.join('&')
  }).join('@')
}

// ---------------------------------------------------------------------------
// 符号替换
// ---------------------------------------------------------------------------

function replaceSymbols(text: string): string {
  // 按命令长度降序排列，确保长命令优先匹配
  const sortedKeys = Object.keys(SYMBOL_MAP).sort((a, b) => b.length - a.length)

  for (const cmd of sortedKeys) {
    // 需要转义正则特殊字符
    const escaped = cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // 函数名后面需要词边界（避免 \sin 匹配 \sinh）
    const pattern = new RegExp(escaped + '(?![a-zA-Z])', 'g')
    text = text.replace(pattern, SYMBOL_MAP[cmd])
  }

  return text
}

// ---------------------------------------------------------------------------
// 清理
// ---------------------------------------------------------------------------

function cleanup(text: string): string {
  // 移除多余的花括号（单字符组）
  text = text.replace(/\{([^{}])\}/g, '$1')
  // 再来一次处理嵌套后暴露的单字符组
  text = text.replace(/\{([^{}])\}/g, '$1')
  // 移除 \, \; \! \quad 等间距命令
  text = text.replace(/\\[,;!]\s*/g, ' ')
  text = text.replace(/\\quad\s*/g, ' ')
  text = text.replace(/\\qquad\s*/g, '  ')
  // 移除未识别的反斜杠命令（保留内容），但保护 Word 需要的命令
  text = text.replace(/\\([a-zA-Z]+)/g, (match, cmd) => {
    return PROTECTED_CMDS.test(cmd) ? match : cmd
  })
  // 上标/下标结尾后紧跟 ( 时加空格（防止 Word 将上标与分式粘连）
  text = text.replace(/(\^(?:\([^)]*\)|\S))\(/g, '$1 (')
  // 压缩多余空格
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

// ---------------------------------------------------------------------------
// 主函数
// ---------------------------------------------------------------------------

export function latexToUnicodeMath(latex: string): string {
  if (!latex.trim()) return ''

  // 去掉外层 $ 或 $$
  let input = latex.trim()
  if (input.startsWith('$$') && input.endsWith('$$')) {
    input = input.slice(2, -2).trim()
  } else if (input.startsWith('$') && input.endsWith('$')) {
    input = input.slice(1, -1).trim()
  }

  // 1. 结构转换（分数、根号、矩阵、修饰符等）
  let result = convertStructures(input)

  // 2. 符号替换（希腊字母、运算符等）
  result = replaceSymbols(result)

  // 3. 清理
  result = cleanup(result)

  return result
}
