import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '../ui/button'
import { useI18n } from '../../store/useI18nStore'
import { errorHandler } from '../../services/ErrorHandler'
import { logger } from '../../services/LoggerService'
import { toast } from '../../store/useToastStore'

export interface CopyToWordButtonProps {
  html: string
}

export function CopyToWordButton({ html }: CopyToWordButtonProps) {
  const t = useI18n()
  const [busy, setBusy] = useState(false)

  const copy = async () => {
    setBusy(true)
    try {
      const text = html.replace(/<[^>]+>/g, '')
      logger.action('CopyToWord', 'Write to clipboard', { length: html.length })
      
      if (window.wordsmith?.clipboard?.write) {
        await window.wordsmith.clipboard.write({ html, text })
      } else if (navigator.clipboard?.write) {
        const item = new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        })
        await navigator.clipboard.write([item])
      } else {
        await navigator.clipboard.writeText(text)
      }
      logger.info('CopyToWord', 'Success')
      toast({ 
        title: '已复制到剪贴板', 
        description: '⚠️ 重要：请在 Word 中选择【保留原格式】粘贴！',
        variant: 'success',
        duration: 8000
      })
    } catch (e) {
      errorHandler.handle(e, 'system', t.errors.clipboard)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button size="lg" className="w-full" onClick={copy} disabled={busy}>
        {t.preview.copyToWord}
      </Button>
      <div className="flex items-center justify-center gap-1.5 rounded bg-amber-50 p-2 text-xs font-medium text-amber-700">
        <AlertTriangle size={14} />
        <span>粘贴时务必选择『保留原格式』</span>
      </div>
    </div>
  )
}
