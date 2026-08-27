import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { HelpSection, HelpStep } from './HelpComponents'

export function VbaGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Word VBA 宏安装指南</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 rounded-xl bg-zinc-100 p-3 text-sm text-zinc-700">
          VBA 宏是连接 WordSmith AI 与 Microsoft Word 的桥梁，用于将生成的 LaTeX 公式转换为原生 Word 公式对象。
        </div>

        <HelpSection title="安装步骤">
          <HelpStep index={1} title="打开开发工具">
            打开 Word，点击顶部菜单栏的【开发工具】选项卡。
            <div className="mt-1 text-xs text-zinc-500">
              如果没看到该选项卡：文件 &gt; 选项 &gt; 自定义功能区 &gt; 勾选右侧的"开发工具"。
            </div>
          </HelpStep>
          <HelpStep index={2} title="进入 Visual Basic 编辑器">
            点击【Visual Basic】按钮（或快捷键 Alt + F11），打开 VBA 编辑器窗口。
          </HelpStep>
          <HelpStep index={3} title="插入模块">
            在左侧工程资源管理器中，右键点击 <code>Normal</code> &gt; 插入 &gt; 模块。
            这样宏将对所有文档生效。
          </HelpStep>
          <HelpStep index={4} title="粘贴代码">
            将 WordSmith AI 右下角【VBA 助手】中的代码完整复制，粘贴到新建的模块窗口中。
          </HelpStep>
        </HelpSection>

        <div className="my-6 border-t border-zinc-200" />

        <HelpSection title="如何使用">
          <HelpStep index={1} title="复制内容">
            在 WordSmith AI 中点击【复制到 Word】，将排版好的内容粘贴到 Word 文档中。
          </HelpStep>
          <HelpStep index={2} title="运行宏">
            在 Word 中按 Alt + F8，选择 <code>LatexToWordMath_Robust_Final</code>，点击运行。
            文档中的 <code>$$...$$</code> 将瞬间转换为漂亮的数学公式。
          </HelpStep>
        </HelpSection>
      </CardContent>
    </Card>
  )
}
