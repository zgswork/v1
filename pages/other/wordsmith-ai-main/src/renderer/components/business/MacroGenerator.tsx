import { useEffect, useMemo, useState } from 'react'
import Prism from 'prismjs'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { useI18n } from '../../store/useI18nStore'
import { errorHandler } from '../../services/ErrorHandler'

const VBA_CODE = `Sub LatexToWordMath_Robust_Final()
    Dim rng As Range
    Dim mathRng As Range
    Dim rawContent As String
    
    Application.ScreenUpdating = False
    
    ' --- 第一阶段：处理行间公式 $$...$$ ---
    Set rng = ActiveDocument.Content
    With rng.Find
        .ClearFormatting
        .Text = "\\$\\$*\\$\\$"
        .MatchWildcards = True
        Do While .Execute
            ' 创建副本区域进行精准切割，保留论坛原始的稳健逻辑
            Set mathRng = rng.Duplicate
            mathRng.MoveEnd Unit:=wdCharacter, Count:=-2
            mathRng.Start = mathRng.Start + 2
            
            rawContent = mathRng.Text
            rng.Text = rawContent ' 将 $$ 内容替换为纯文本
            
            ' 关键动作：添加公式对象并强制“由线性转为专业格式”
            ActiveDocument.OMaths.Add rng
            rng.OMaths(1).BuildUp ' 强制渲染成分数线、根号等专业样式
            
            rng.Collapse wdCollapseEnd
        Loop
    End With
    
    ' --- 第二阶段：处理行内公式 $...$ ---
    Set rng = ActiveDocument.Content
    With rng.Find
        .ClearFormatting
        .Text = "\\$*\\$"
        .MatchWildcards = True
        Do While .Execute
            ' 安全检查：确保不是刚刚处理过的公式
            If rng.OMaths.Count = 0 Then
                Set mathRng = rng.Duplicate
                mathRng.MoveEnd Unit:=wdCharacter, Count:=-1
                mathRng.Start = mathRng.Start + 1
                
                rawContent = mathRng.Text
                rng.Text = rawContent
                
                ActiveDocument.OMaths.Add rng
                ' 再次强制触发专业排版渲染
                rng.OMaths(1).BuildUp
            End If
            rng.Collapse wdCollapseEnd
        Loop
    End With
    
    Application.ScreenUpdating = True
    MsgBox "全文档公式及排版已深度转换完成！"
End Sub`

export function MacroGenerator() {
  const t = useI18n()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ;(globalThis as any).Prism = Prism
    import('prismjs/components/prism-vbnet')
      .catch(() => undefined)
      .finally(() => setReady(true))
  }, [])

  const highlighted = useMemo(() => {
    const language = Prism.languages.vbnet ?? Prism.languages.plain
    return Prism.highlight(VBA_CODE, language, language === Prism.languages.vbnet ? 'vbnet' : 'plain')
  }, [ready])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(VBA_CODE)
    } catch (e) {
      errorHandler.handle(e, 'system', t.errors.clipboard)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.macro.title}</CardTitle>
        <Button variant="secondary" size="sm" onClick={copy}>
          {t.macro.copy}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-xs text-zinc-600">
            {t.macro.desc}
          </p>
          <pre className="max-h-[240px] overflow-auto rounded-xl bg-zinc-900 p-3 text-xs text-zinc-100">
            <code dangerouslySetInnerHTML={{ __html: highlighted }} />
          </pre>
          <ol className="list-decimal space-y-1 pl-4 text-xs text-zinc-600">
            <li>{t.macro.step1}</li>
            <li>{t.macro.step2}</li>
            <li>{t.macro.step3}</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
