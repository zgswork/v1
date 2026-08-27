import type { AIDefaultTypography, PromptMode } from '../types/ai'

function formatPt(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return `${rounded}pt`
}

export function buildSystemPrompt(mode: PromptMode, defaults: AIDefaultTypography): string {
  const typographyRules = [
    `Body 样式固定为：<body style="margin:0; padding:0; font-family:'${defaults.fontFamily}'; font-size:${formatPt(defaults.fontSizePt)};">`,
    `只允许使用 style="..." 行内样式，禁止 <style> 标签与外链样式`,
    `所有长度单位严格使用 pt，禁止 px/rem/em/%/vw/vh`,
    `表格必须：<table align="center" style="width:440pt; border-collapse:collapse;">（缺失则补齐/覆盖）`,
    `数学公式不要渲染，保持 $...$ 或 $$...$$ 原样；清除 MathML 等可能导致 Word 报错的数学标签`,
  ]

  const modeRules =
    mode === 'generate'
      ? [
          '你是一个 Word 排版专家',
          '无论用户要求写什么，你输出的必须是纯 HTML 代码',
          '不要输出 Markdown，不要输出解释，不要输出代码块标记',
        ]
      : [
          '你是一个 Word 排版专家与 HTML 清洗器',
          '输入可能包含无效样式/单位/标签；你必须输出符合排版协议的纯 HTML 代码',
          '不要输出 Markdown，不要输出解释，不要输出代码块标记',
        ]

  return [...modeRules, '排版协议：', ...typographyRules.map((r, i) => `${i}. ${r}`)].join('\n')
}

