import { memo } from 'react'
import { Markdown } from '../../Markdown'

// Resposta de um comando de barra (/context, /usage...), escrita pelo próprio Claude Code: numa
// caixa discreta, para não se passar por resposta do modelo.
export const OutputRow = memo(function OutputRow({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-line bg-surface-2/60 px-3 py-2 text-[13px] leading-relaxed text-muted">
      <Markdown text={text} />
    </div>
  )
})
