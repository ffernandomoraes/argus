import { useEffect, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { Bot, ExternalLink, MessageCircle } from 'lucide-react'
import { Elapsed } from '../conversation/turnInfo'
import { relativeTime } from './relativeTime'
import { agentActivity } from './runningAgents'
import { StatusDot } from './StatusBadge'
import type { RunningAgent } from '../../../shared/agents'
import type { ConversationSummary } from './types'

// Conversa: bloco na pilha da pasta, no canvas (card), ou linha no painel "todas as conversas".
export function ConversationItem({
  conversation: c,
  active,
  poppedOut,
  now,
  card = false,
  draggable = false,
  onOpen,
  onContextMenu
}: {
  conversation: ConversationSummary
  // Aberta no painel lateral agora.
  active: boolean
  poppedOut: boolean
  now: number
  // Bloco com borda, do tamanho da pasta, empilhado embaixo dela no canvas.
  card?: boolean
  // O próprio card é o bloco no canvas (conversa solta): arrastar move o bloco.
  draggable?: boolean
  onOpen: () => void
  onContextMenu?: (e: ReactMouseEvent) => void
}) {
  return (
    <li
      role="button"
      onClick={onOpen}
      onContextMenu={onContextMenu}
      className={
        card
          ? `${draggable ? '' : 'nodrag '}flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs shadow-lg shadow-black/30 hover:bg-card-hover ${
              active ? 'border-accent bg-card-hover ring-1 ring-accent' : 'border-line bg-card'
            }`
          : `flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${active ? 'bg-selection text-white [&_svg]:text-white/80 [&_.text-faint]:text-white/70' : 'hover:bg-fill'}`
      }
    >
      <MessageCircle size={13} className="shrink-0 text-muted" aria-hidden="true" />
      <span className="min-w-0 truncate">{c.title}</span>
      <StatusDot status={c.status} />
      {c.kind === 'agente' && <Bot size={11} className="shrink-0 text-faint" aria-label="Agente" />}
      {poppedOut && (
        <ExternalLink size={11} className="shrink-0 text-faint" aria-label="Aberta em janela separada" />
      )}
      <span
        title={new Date(c.updatedAt).toLocaleString('pt-BR')}
        className="ml-auto shrink-0 pl-1 text-[11px] text-faint"
      >
        {relativeTime(c.updatedAt, now)}
      </span>
    </li>
  )
}

// Subagente rodando, pendurado embaixo da conversa que o lançou: qual agente, o que está
// fazendo agora e há quanto tempo. Some quando ele termina.
export function AgentItem({ agent: a, style, onOpen }: { agent: RunningAgent; style?: CSSProperties; onOpen: () => void }) {
  return (
    <li
      role="button"
      onClick={onOpen}
      title={a.description}
      style={style}
      className="nodrag flex cursor-pointer items-center gap-2 rounded-xl border border-running/40 bg-card px-3 py-1.5 text-xs shadow-lg shadow-black/30 hover:bg-card-hover"
    >
      <Bot size={13} className="shrink-0 text-running" aria-hidden="true" />
      <span className="shrink-0 font-medium">{a.agent}</span>
      <span className="min-w-0 truncate text-muted">{agentActivity(a)}</span>
      <span className="ml-auto shrink-0 pl-1 text-[11px] tabular-nums text-faint">
        <Elapsed since={a.startedAt} />
      </span>
    </li>
  )
}

// Atualiza o "há 5min" a cada minuto.
export function useNow(): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}
