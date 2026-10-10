import { Bot, ExternalLink, MessageCircle, PenTool } from 'lucide-react'
import { StatusDot } from '../StatusBadge'
import type { ConversationSummary } from '../types'

// Começo de toda linha de conversa (card solto, painel de todas e lista da pasta): o ícone
// (conversa ou design), o título com a bolinha de status logo depois e os selos de agente e de
// "aberta em janela separada". Fica dentro do flex de quem usa, que decide o espaçamento.
export function ConversationLabel({ conversation: c, poppedOut }: { conversation: ConversationSummary; poppedOut: boolean }) {
  return (
    <>
      {c.design || c.kind === 'design' ? (
        <PenTool size={13} className="shrink-0 text-muted" aria-label="Modo design" />
      ) : (
        <MessageCircle size={13} className="shrink-0 text-muted" aria-hidden="true" />
      )}
      <span className="min-w-0 truncate">{c.title}</span>
      <StatusDot status={c.status} />
      {c.kind === 'agente' && <Bot size={11} className="shrink-0 text-faint" aria-label="Agente" />}
      {poppedOut && (
        <ExternalLink size={11} className="shrink-0 text-faint" aria-label="Aberta em janela separada" />
      )}
    </>
  )
}
