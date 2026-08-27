/**
 * 隐藏式底座提示词 - 核心排版协议
 * 这些规则对用户不可见，但会自动注入到每次 AI 请求中
 */

export interface TypographyDefaults {
  fontFamily: string
  fontSizePt: number
}

/**
 * 6 条核心排版协议规则
 * 这些规则确保 AI 输出的 HTML 能够正确粘贴到 Word 中
 */
export const CORE_PROTOCOL_RULES = [
  '只允许使用 style="..." 行内样式，严禁 <style> 标签与外链样式表',
  '所有长度单位必须使用 pt，严禁 px/rem/em/%/vw/vh 等其他单位',
  '表格必须设置：<table align="center" style="width:440pt; border-collapse:collapse; border:1pt solid #000;">',
  '数学公式保持 $...$ 或 $$...$$ LaTeX 原样输出，严禁使用 MathML 或其他数学标记',
  '段落使用 <p> 标签，段间距通过 margin-bottom 控制（如 margin-bottom:12pt）',
  '禁止使用 JavaScript、iframe、object、embed 等可能导致 Word 报错的标签',
] as const

/**
 * 构建隐藏的系统提示词
 * @param mode - 生成模式或纠错模式
 * @param defaults - 排版默认参数
 * @param customInstruction - 用户自定义长效指令（可选）
 * @param referenceContext - 参考文档内容（可选）
 */
export function buildHiddenSystemPrompt(
  mode: 'generate' | 'fix',
  defaults: TypographyDefaults,
  customInstruction?: string,
  referenceContext?: string
): string {
  const parts: string[] = []

  // 1. 角色定义
  if (mode === 'generate') {
    parts.push('你是一个专业的 Word 排版专家。')
    parts.push('无论用户要求写什么内容，你必须直接输出纯 HTML 代码。')
    parts.push('严禁输出 Markdown 格式、代码块标记（```）或任何解释性文字。')
  } else {
    parts.push('你是一个专业的 Word 排版专家与 HTML 清洗器。')
    parts.push('用户输入的 HTML 可能包含无效样式、错误单位或不兼容标签。')
    parts.push('你必须修正这些问题，输出符合排版协议的纯 HTML 代码。')
    parts.push('严禁输出 Markdown 格式、代码块标记（```）或任何解释性文字。')
  }

  parts.push('')

  // 2. 核心排版协议（隐藏规则）
  parts.push('【排版协议 - 必须严格遵守】')
  parts.push(`Body 样式固定为：<body style="margin:0; padding:0; font-family:'${defaults.fontFamily}'; font-size:${defaults.fontSizePt}pt;">`)
  CORE_PROTOCOL_RULES.forEach((rule, index) => {
    parts.push(`${index + 1}. ${rule}`)
  })

  // 3. 用户自定义长效指令
  if (customInstruction && customInstruction.trim()) {
    parts.push('')
    parts.push('【用户自定义要求】')
    parts.push(customInstruction.trim())
  }

  // 4. 参考文档上下文
  if (referenceContext && referenceContext.trim()) {
    parts.push('')
    parts.push('【参考文档内容】')
    parts.push('以下是用户上传的参考文档，请在生成内容时参考其格式和风格：')
    parts.push(referenceContext.trim())
  }

  return parts.join('\n')
}

/**
 * VLM OCR 默认系统提示词
 * 用于指导视觉语言模型从图片中提取结构化文本
 */
export const DEFAULT_VLM_OCR_SYSTEM_PROMPT = [
  '你是一个专业的 OCR 文字识别助手。请从图片中提取所有文字内容，遵守以下规则：',
  '1. 输出格式为 Markdown，保持原文的层级结构（标题、段落、列表等）',
  '2. 表格使用 Markdown 表格语法（| 列1 | 列2 | 形式）',
  '3. 数学公式使用 LaTeX 格式，行内公式用 $...$，行间公式用 $$...$$',
  '4. 保持原文的标题层级关系（#、##、### 等）',
  '5. 图表、流程图等非文字内容用简短文字描述，格式为 [图表: 描述内容]',
  '6. 只输出识别到的文字内容，不要添加任何解释、总结或评论',
  '7. 如果图片中没有可识别的文字，输出"[空白图片，未识别到文字内容]"',
].join('\n')

/**
 * 参考文件类型定义
 */
export interface ReferenceFile {
  id: string
  name: string
  content: string
  uploadedAt: number
}

/**
 * 从参考文件数组构建上下文字符串
 */
export function buildReferenceContext(files: ReferenceFile[]): string {
  if (!files.length) return ''

  return files
    .map((file, index) => `--- 文档 ${index + 1}: ${file.name} ---\n${file.content}`)
    .join('\n\n')
}
