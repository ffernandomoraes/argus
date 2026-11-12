import { Bot, ExternalLink, MessageCircle } from 'lucide-react'
import { TitleField } from '../../conversation/header/TitleField'
import { finishConversationRename, useConversationTitle, useIsRenamingConversation, type RenamePlace } from '../conversationRename'
import { Highlight } from '../Highlight'
import { useIsInterrupted } from '../interruptedChats'
import { useIsUnread } from '../sessionsStore'
import { StatusDot } from '../StatusBadge'
import type { ConversationSummary } from '../types'
import { tr } from '../../i18n'

// Começo de toda linha de conversa (card solto, painel de todas e lista da pasta): o ícone
// (balão de conversa), o título com a bolinha de status logo depois e os selos de agente e de
// "aberta em janela separada". Fica dentro do flex de quem usa, que decide o espaçamento.
// query: termo da busca, marcado no título. place: a lista onde a linha está (ver RenamePlace).
export function ConversationLabel({
  conversation: c,
  poppedOut,
  query,
  place
}: {
  conversation: ConversationSummary
  poppedOut: boolean
  query?: string
  place: RenamePlace
}) {
  // Resposta que você ainda não viu: bolinha verde, para não se confundir com as paradas.
  const unread = useIsUnread(c.id)
  // O Argus fechou com ela trabalhando: bolinha vermelha até continuar.
  const interrupted = useIsInterrupted(c.sessionId)
  const status = c.status !== 'idle' ? c.status : interrupted ? 'interrupted' : unread ? 'done' : 'idle'
  // Renomear pelo botão direito da lista: o título vira campo (ver conversationRename).
  const renaming = useIsRenamingConversation(c.id, place)
  const title = useConversationTitle(c)
  return (
    <>
      <MessageCircle size={13} className="shrink-0 text-muted" aria-hidden="true" />
      {renaming ? (
        // Clicar ou dar botão direito no campo não abre a conversa nem o menu da linha.
        <span className="flex min-w-0 flex-1" onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
          <TitleField value={title} onDone={(typed) => finishConversationRename(c.id, place, typed)} />
        </span>
      ) : (
        <span className="min-w-0 truncate">
          <Highlight text={title} query={query} />
        </span>
      )}
      <StatusDot status={status} />
      {c.kind === 'agente' && <Bot size={11} className="shrink-0 text-faint" aria-label={tr('Agente', 'Agent')} />}
      {poppedOut && (
        <ExternalLink size={11} className="shrink-0 text-faint" aria-label={tr('Aberta em janela separada', 'Open in separate window')} />
      )}
    </>
  )
}
