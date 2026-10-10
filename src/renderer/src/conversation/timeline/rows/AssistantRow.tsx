import { memo } from 'react'
import { CopyButton } from '../../CopyButton'
import { formatClock, formatDuration, formatTokens } from '../../format'
import { Markdown } from '../../Markdown'

// Resposta do Claude. A última de cada pedido ganha o rodapé: quando terminou, quanto levou,
// quantos tokens gerou e o copiar. Tudo em valores simples, para o memo valer entre leituras.
export const AssistantRow = memo(function AssistantRow({
  text,
  footerAt,
  duration,
  tokens = 0
}: {
  // Já sem o que é recado para o app (ver cleanText no ChatView).
  text: string
  footerAt?: string
  duration?: number
  tokens?: number
}) {
  return (
    <div className="text-[15px] leading-relaxed text-text">
      <Markdown text={text} />
      {footerAt !== undefined && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-faint">
          <span>
            {formatClock(footerAt)}
            {duration !== undefined && ` - levou ${formatDuration(duration)}`}
            {tokens > 0 && ` - ${formatTokens(tokens)}`}
          </span>
          <CopyButton text={text} label="Copiar resposta" />
        </div>
      )}
    </div>
  )
})
