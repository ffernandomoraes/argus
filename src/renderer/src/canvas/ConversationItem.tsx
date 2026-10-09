import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Bot, ExternalLink, PenTool, MessageCircle } from 'lucide-react'
import { Elapsed } from '../conversation/turnInfo'
import { relativeTime } from './relativeTime'
import { agentActivity } from './runningAgents'
import { StatusDot } from './StatusBadge'
import type { RunningAgent } from '../../../shared/agents'
import type { ConversationSummary } from './types'

// Conversa: bloco solto no canvas (card) ou linha no painel "todas as conversas".
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
  // Bloco com borda, solto no canvas.
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
      <span
        title={new Date(c.updatedAt).toLocaleString('pt-BR')}
        className="ml-auto shrink-0 pl-1 text-[11px] text-faint"
      >
        {relativeTime(c.updatedAt, now)}
      </span>
    </li>
  )
}

// Conversa como linha dentro da caixa da pasta: bolinha de status, título e, à direita,
// "esperando você" quando ela pede atenção ou há quanto tempo mexeu (rodando, a bolinha já diz).
export function ConversationRow({
  conversation: c,
  active,
  poppedOut,
  now,
  onOpen,
  onContextMenu
}: {
  conversation: ConversationSummary
  active: boolean
  poppedOut: boolean
  now: number
  onOpen: () => void
  onContextMenu?: (e: ReactMouseEvent) => void
}) {
  const needsYou = c.status === 'needs-you'
  return (
    <li
      role="button"
      onClick={onOpen}
      onContextMenu={onContextMenu}
      className={`nodrag flex h-8 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px] ${
        active ? 'bg-accent/15' : 'bg-fill hover:bg-text/10'
      }`}
    >
      <StatusDot status={c.status} large />
      <span className="min-w-0 truncate">{c.title}</span>
      {(c.design || c.kind === 'design') && (
        <PenTool size={11} className="shrink-0 text-faint" aria-label="Modo design" />
      )}
      {c.kind === 'agente' && <Bot size={11} className="shrink-0 text-faint" aria-label="Agente" />}
      {poppedOut && (
        <ExternalLink size={11} className="shrink-0 text-faint" aria-label="Aberta em janela separada" />
      )}
      {needsYou ? (
        <span className="ml-auto shrink-0 pl-2 text-[11px] font-semibold text-needs-you">esperando você</span>
      ) : (
        c.status !== 'running' && (
          <span
            title={new Date(c.updatedAt).toLocaleString('pt-BR')}
            className="ml-auto shrink-0 pl-2 text-[11px] text-faint"
          >
            {relativeTime(c.updatedAt, now)}
          </span>
        )
      )}
    </li>
  )
}

// Linha de um subagente: o tronco desce da bolinha de cima (a da conversa, no primeiro; a
// do subagente anterior, nos outros) e entra pela esquerda, um nível para dentro.
// Os números seguem a ConversationRow: bolinha no x 14, conversa com 32px e subagente com 24px,
// com 4px entre as linhas (ROW_GAP da ProjectNode). O primeiro sai logo abaixo da bolinha da
// conversa (meio dela a 20px acima, menos o raio com o halo); os outros, de onde a linha do
// anterior faz a curva (8px do topo dele, 28px acima).
const TRUNK_X = 14
const agentRoute = (first: boolean) => `M ${TRUNK_X} ${first ? -13 : -20} V 8 Q ${TRUNK_X} 12 ${TRUNK_X + 4} 12 H 25`

// Subagente rodando, pendurado embaixo da conversa que o lançou: qual agente, o que está
// fazendo agora e há quanto tempo. Some quando ele termina.
export function AgentItem({
  agent: a,
  first,
  color,
  onOpen
}: {
  agent: RunningAgent
  // Primeiro subagente da conversa: a linha sai da bolinha dela.
  first: boolean
  color: string
  onOpen: () => void
}) {
  return (
    <li
      role="button"
      onClick={onOpen}
      title={a.description}
      className="nodrag relative flex h-6 cursor-pointer items-center gap-2 rounded-lg pl-[30px] pr-2.5 text-xs hover:bg-fill"
    >
      <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-full w-[30px] overflow-visible">
        <path d={agentRoute(first)} fill="none" stroke={color} strokeWidth={1.5} className="conversation-flow" />
      </svg>
      <span className="size-1.5 shrink-0 rounded-full bg-running/80" aria-hidden="true" />
      <span className="min-w-0 truncate text-muted">
        {a.agent} - {agentActivity(a)}
      </span>
      <span className="ml-auto shrink-0 pl-2 text-[11px] tabular-nums text-faint">
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
