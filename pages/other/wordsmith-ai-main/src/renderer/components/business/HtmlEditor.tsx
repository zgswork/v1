import Editor from '@monaco-editor/react'
import { CardHeader, CardTitle } from '../ui/card'
import { useI18n } from '../../store/useI18nStore'

export interface HtmlEditorProps {
  value: string
  onChange: (next: string) => void
}

export function HtmlEditor({ value, onChange }: HtmlEditorProps) {
  const t = useI18n()
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 pb-3">
        <CardHeader className="p-0">
          <CardTitle>{t.editor.title}</CardTitle>
        </CardHeader>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-zinc-200">
        <Editor
          height="100%"
          defaultLanguage="html"
          value={value}
          onChange={(v) => onChange(v ?? '')}
          options={{
            minimap: { enabled: false },
            wordWrap: 'on',
            fontSize: 12,
            tabSize: 2,
            automaticLayout: true,
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  )
}

