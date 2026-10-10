import { memo, type MouseEvent as ReactMouseEvent } from 'react'
import { ConversationLabel } from '../blocks/ConversationLabel'
import { TimeAgo } from '../blocks/TimeAgo'
import type { ConversationSummary } from '../types'
import { useIsPoppedOut } from '../useCanvasView'

// Conversa como linha dentro da caixa da pasta: ícone (conversa ou design), título com a bolinha
// de status logo depois e, à direita, "esperando você" quando ela pede atenção ou há quanto
// tempo mexeu (rodando, a bolinha já diz). Altura fixa de 32px (ROW_HEIGHT, em geometry.ts).
export const ConversationRow = memo(function ConversationRow({
  conversation: c,
  active,
  onOpen,
  onContextMenu
}: {
  conversation: ConversationSummary
  active: boolean
  // Recebem a conversa: a lista passa a mesma função para todas as linhas (o memo vale).
  onOpen: (conversation: ConversationSummary) => void
  onContextMenu: (e: ReactMouseEvent, conversation: ConversationSummary) => void
}) {
  // Cada linha acompanha só se a sua conversa está em janela separada.
  const poppedOut = useIsPoppedOut(c.id)
  return (
    <li
      role="button"
      onClick={() => onOpen(c)}
      onContextMenu={(e) => onContextMenu(e, c)}
      className={`nodrag flex h-8 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px] ${
        active ? 'bg-accent/15' : 'bg-fill hover:bg-text/10'
      }`}
    >
      <ConversationLabel conversation={c} poppedOut={poppedOut} />
      {c.status === 'needs-you' ? (
        <span className="ml-auto shrink-0 pl-2 text-[11px] font-semibold text-needs-you">esperando você</span>
      ) : (
        c.status !== 'running' && <TimeAgo iso={c.updatedAt} className="pl-2" />
      )}
    </li>
  )
})
