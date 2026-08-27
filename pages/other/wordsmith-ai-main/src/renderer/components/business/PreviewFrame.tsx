import { CardHeader, CardTitle } from '../ui/card'
import { useI18n } from '../../store/useI18nStore'

export interface PreviewFrameProps {
  html: string
}

export function PreviewFrame({ html }: PreviewFrameProps) {
  const t = useI18n()
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 pb-3">
        <CardHeader className="p-0">
          <CardTitle>{t.preview.title}</CardTitle>
        </CardHeader>
      </div>
      <div className="min-h-0 flex-1">
        <iframe
          title="preview"
          className="h-full w-full rounded-xl border border-zinc-200 bg-white"
          sandbox="allow-same-origin"
          srcDoc={html}
        />
      </div>
    </div>
  )
}

