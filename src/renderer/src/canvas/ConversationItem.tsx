import { memo, type MouseEvent as ReactMouseEvent } from 'react'
import { ConversationLabel } from './blocks/ConversationLabel'
import { Highlight } from './Highlight'
import { TimeAgo } from './blocks/TimeAgo'
import type { ConversationSummary } from './types'

// Conversa: bloco solto no canvas (card) ou linha no painel "todas as conversas".
export const ConversationItem = memo(function ConversationItem({
  conversation: c,
  active,
  poppedOut,
  snippet,
  query,
  card = false,
  draggable = false,
  onOpen,
  onContextMenu
}: {
  conversation: ConversationSummary
  // Busca: o trecho da conversa onde o termo apareceu, numa linha embaixo do título.
  snippet?: string
  // Termo da busca: marcado no título e no trecho.
  query?: string
  // Aberta no painel lateral agora.
  active: boolean
  poppedOut: boolean
  // Bloco com borda, solto no canvas.
  card?: boolean
  // O próprio card é o bloco no canvas (conversa solta): arrastar move o bloco.
  draggable?: boolean
  // Recebem a conversa: quem usa pode passar a mesma função para todas as linhas (o memo vale).
  onOpen: (conversation: ConversationSummary) => void
  onContextMenu?: (e: ReactMouseEvent, conversation: ConversationSummary) => void
}) {
  const row = (
    <>
      <ConversationLabel conversation={c} poppedOut={poppedOut} query={query} />
      <TimeAgo iso={c.repliedAt} className="pl-1" />
    </>
  )
  return (
    <li
      role="button"
      onClick={() => onOpen(c)}
      onContextMenu={onContextMenu && ((e) => onContextMenu(e, c))}
      className={
        card
          ? `${draggable ? '' : 'nodrag '}flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs shadow-lg shadow-black/30 hover:bg-card-hover ${
              active ? 'border-accent bg-card-hover ring-1 ring-accent' : 'border-line bg-card'
            }`
          : `flex ${snippet ? 'flex-col items-stretch gap-1' : 'items-center gap-2'} rounded-md px-2 py-1.5 text-xs ${active ? 'bg-selection text-white [&_svg]:text-white/80 [&_.text-faint]:text-white/70' : 'hover:bg-fill'}`
      }
    >
      {snippet ? (
        // Resultado da busca: título e hora numa linha (o título é cortado, não quebra) e o trecho embaixo.
        <div className="flex min-w-0 items-center gap-2">{row}</div>
      ) : (
        row
      )}
      {snippet && (
        <span className="line-clamp-2 pl-[21px] text-[11px] leading-snug text-muted">
          <Highlight text={snippet} query={query} />
        </span>
      )}
    </li>
  )
})
