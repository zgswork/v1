import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { HelpSection } from './HelpComponents'

export function TheoryGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>排版协议原理</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="prose prose-sm">
          <p>
            WordSmith AI 的核心思想是：<strong>将 Word 的排版规则映射为标准的 HTML/CSS 协议。</strong>
          </p>
        </div>

        <HelpSection title="核心机制">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 p-4">
              <div className="font-semibold text-zinc-900">1. Inline CSS 守卫</div>
              <div className="mt-2 text-sm text-zinc-600">
                Word 剪贴板只接受内联样式 (Inline Styles)。WordSmith 会自动将 AI 生成的 class 样式
                转换为 <code>style="..."</code> 属性，确保粘贴时不丢失格式。
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4">
              <div className="font-semibold text-zinc-900">2. 单位自动换算</div>
              <div className="mt-2 text-sm text-zinc-600">
                Word 中的 1 磅 (pt) 等于 1.33 像素 (px)。系统会自动将所有尺寸转换为 Word 首选的 pt 单位，
                保证 <code>font-size: 12pt</code> 在 Word 中也是精准的小四号字。
              </div>
            </div>
          </div>
        </HelpSection>

        <HelpSection title="支持的标签与属性">
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="p-2 text-left">HTML 标签</th>
                  <th className="p-2 text-left">Word 对应元素</th>
                  <th className="p-2 text-left">关键样式</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                <tr>
                  <td className="p-2 font-mono">p</td>
                  <td className="p-2">正文段落</td>
                  <td className="p-2 font-mono">text-indent, margin-bottom, line-height</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">h1, h2, h3</td>
                  <td className="p-2">标题样式</td>
                  <td className="p-2 font-mono">font-weight, page-break-after</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">table</td>
                  <td className="p-2">表格对象</td>
                  <td className="p-2 font-mono">border-collapse, border</td>
                </tr>
              </tbody>
            </table>
          </div>
        </HelpSection>
      </CardContent>
    </Card>
  )
}
