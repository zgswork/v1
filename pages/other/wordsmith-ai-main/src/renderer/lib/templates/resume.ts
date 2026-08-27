import type { Template } from './types'

/**
 * 现代化简历模板
 * 采用双栏布局，左侧强调技能与联系方式，右侧展示工作经历与项目
 * 包含大量的 CSS 样式定义，确保在 Word 中粘贴时保持高保真还原
 */
export const resumeTemplate: Template = {
  id: 'resume',
  nameKey: 'templates.resume',
  descriptionKey: 'templates.resumeDesc',
  style: {
    fontFamily: 'Microsoft YaHei',
    fontSizePt: 10,
    lineHeight: 1.4,
    paragraphSpacing: 6,
    css: `
      /* 全局重置 */
      body { 
        font-family: 'Microsoft YaHei', 'SimHei', sans-serif; 
        font-size: 10pt; 
        line-height: 1.4; 
        color: #333; 
        margin: 0; 
        padding: 0; 
      }
      
      /* 布局容器：模拟 Flexbox 的表格布局 */
      .layout-container { 
        display: table; 
        width: 100%; 
        border-collapse: collapse; 
        table-layout: fixed; /* 强制列宽 */
      }
      
      /* 左侧边栏 */
      .sidebar { 
        display: table-cell; 
        width: 30%; 
        background-color: #f8fafc; 
        padding: 15pt; 
        vertical-align: top; 
        border-right: 1px solid #e2e8f0; 
        font-size: 9pt;
      }
      
      /* 主内容区 */
      .main-content { 
        display: table-cell; 
        width: 70%; 
        padding: 20pt; 
        vertical-align: top; 
        background-color: #ffffff;
      }
      
      /* 头部样式 */
      .header-name {
        font-size: 24pt;
        font-weight: bold;
        color: #1e293b;
        margin-bottom: 4pt;
        line-height: 1.2;
      }
      
      .header-title {
        font-size: 12pt;
        color: #64748b;
        margin-bottom: 12pt;
        font-weight: 500;
      }

      /* 章节标题 */
      h2 { 
        font-size: 14pt; 
        color: #0f172a; 
        border-bottom: 2px solid #cbd5e1; 
        padding-bottom: 4pt; 
        margin-top: 16pt; 
        margin-bottom: 10pt; 
        font-weight: bold; 
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      
      /* 子标题（公司/学校） */
      h3 { 
        font-size: 11pt; 
        color: #334155; 
        font-weight: bold; 
        margin-bottom: 2pt; 
        display: flex;
        justify-content: space-between;
      }
      
      /* 日期与地点 */
      .meta-info {
        font-size: 9pt;
        color: #64748b;
        font-style: italic;
        margin-bottom: 6pt;
      }
      
      /* 正文段落 */
      p { 
        margin-bottom: 6pt; 
        text-align: justify; 
        color: #475569;
      }
      
      /* 列表样式 */
      ul { 
        margin: 0 0 10pt 14pt; 
        padding: 0; 
      }
      li { 
        margin-bottom: 3pt; 
        color: #475569;
      }
      
      /* 技能标签 */
      .skill-section {
        margin-bottom: 12pt;
      }
      .skill-category {
        font-weight: bold;
        color: #1e293b;
        margin-bottom: 4pt;
        display: block;
      }
      .skill-tag { 
        display: inline-block; 
        background: #e2e8f0; 
        padding: 2pt 6pt; 
        border-radius: 4pt; 
        margin: 0 4pt 4pt 0; 
        font-size: 8.5pt; 
        color: #475569; 
        border: 1px solid #cbd5e1;
      }

      /* 联系方式 */
      .contact-item {
        margin-bottom: 6pt;
        display: flex;
        align-items: center;
        color: #334155;
      }
      .contact-icon {
        margin-right: 6pt;
        width: 12pt;
        text-align: center;
      }
      
      /* 链接样式 */
      a {
        color: #2563eb;
        text-decoration: none;
      }
    `,
  },
  systemPrompt: `请生成一份现代化的专业简历。
要求：
1. 使用双栏布局（HTML中使用 <div class="layout-container"><div class="sidebar">...</div><div class="main-content">...</div></div> 结构模拟）。
2. 左侧边栏包含：个人照片占位符、联系方式（电话、邮箱、GitHub）、教育背景、核心技能（使用 skill-tag 样式）。
3. 右侧主内容包含：个人简介、工作经历（倒序排列，包含公司名、职位、时间、职责描述）、项目经验（包含项目描述、技术栈、主要贡献）。
4. 重点突出成就数据（如“提升效率 50%”）。
5. 严格遵守 HTML/CSS 语法，不要使用 Markdown。`,
}
