import { Bot, ExternalLink, MessageCircle, PenTool } from 'lucide-react'
import { Highlight } from '../Highlight'
import { useIsInterrupted } from '../interruptedChats'
import { useIsUnread } from '../sessionsStore'
import { StatusDot } from '../StatusBadge'
import type { ConversationSummary } from '../types'
import { tr } from '../../i18n'

// Começo de toda linha de conversa (card solto, painel de todas e lista da pasta): o ícone
// (balão de conversa ou pincel do modo design), o título com a bolinha de status logo depois e os selos de agente e de
// "aberta em janela separada". Fica dentro do flex de quem usa, que decide o espaçamento.
// query: termo da busca, marcado no título.
export function ConversationLabel({ conversation: c, poppedOut, query }: { conversation: ConversationSummary; poppedOut: boolean; query?: string }) {
  // Resposta que você ainda não viu: bolinha verde, para não se confundir com as paradas.
  const unread = useIsUnread(c.id)
  // O Argus fechou com ela trabalhando: bolinha vermelha até continuar.
  const interrupted = useIsInterrupted(c.sessionId)
  const status = c.status !== 'idle' ? c.status : interrupted ? 'interrupted' : unread ? 'done' : 'idle'
  return (
    <>
      {c.design || c.kind === 'design' ? (
        <PenTool size={13} className="shrink-0 text-muted" aria-label={tr('Modo design', 'Design mode')} />
      ) : (
        <MessageCircle size={13} className="shrink-0 text-muted" aria-hidden="true" />
      )}
      <span className="min-w-0 truncate">
        <Highlight text={c.title} query={query} />
      </span>
      <StatusDot status={status} />
      {c.kind === 'agente' && <Bot size={11} className="shrink-0 text-faint" aria-label={tr('Agente', 'Agent')} />}
      {poppedOut && (
        <ExternalLink size={11} className="shrink-0 text-faint" aria-label={tr('Aberta em janela separada', 'Open in separate window')} />
      )}
    </>
  )
}
