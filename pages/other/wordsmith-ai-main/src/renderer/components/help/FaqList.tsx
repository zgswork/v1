import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

export function FaqList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>常见问题 (FAQ)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <details className="group rounded-xl border border-zinc-200 open:bg-zinc-50">
          <summary className="cursor-pointer p-4 font-medium select-none group-open:text-zinc-900">
            Q: 为什么生成的公式在 Word 里是乱码？
          </summary>
          <div className="border-t border-zinc-200 p-4 pt-2 text-sm text-zinc-600">
            A: Word 原生不支持 LaTeX 语法。请务必安装并运行我们在【VBA 助手】中提供的宏代码，它会将 LaTeX 源码转换为 Word 的 OMath 对象。
          </div>
        </details>

        <details className="group rounded-xl border border-zinc-200 open:bg-zinc-50">
          <summary className="cursor-pointer p-4 font-medium select-none group-open:text-zinc-900">
            Q: 粘贴到 Word 后图片不显示？
          </summary>
          <div className="border-t border-zinc-200 p-4 pt-2 text-sm text-zinc-600">
            A: WordSmith 目前主要专注文本与表格排版。如果 AI 生成了图片链接，Word 可能无法直接下载。建议手动插入图片。
          </div>
        </details>

        <details className="group rounded-xl border border-zinc-200 open:bg-zinc-50">
          <summary className="cursor-pointer p-4 font-medium select-none group-open:text-zinc-900">
            Q: 如何自定义字体？
          </summary>
          <div className="border-t border-zinc-200 p-4 pt-2 text-sm text-zinc-600">
            A: 在【设置】页面的"排版默认值"中可以修改全局字体。您也可以在【模板管理】中创建专用模板，为不同文档设置特定字体。
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
