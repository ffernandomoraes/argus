import { useEffect, useState } from 'react'
import { Bot, ExternalLink } from 'lucide-react'
import { ContextRing } from './ContextRing'
import { relativeTime } from './relativeTime'
import { StatusDot } from './StatusBadge'
import type { ConversationSummary } from './types'

// Linha de conversa, usada na lista do card da pasta e no painel "todas as conversas".
export function ConversationItem({
  conversation: c,
  snippet,
  active,
  poppedOut,
  now,
  onOpen
}: {
  conversation: ConversationSummary
  snippet?: string
  active: boolean
  poppedOut: boolean
  now: number
  onOpen: () => void
}) {
  return (
    <li
      role="button"
      onClick={onOpen}
      className={`flex flex-col gap-1 rounded-md px-2 py-1.5 hover:bg-surface-2 ${active ? 'bg-surface-2' : ''}`}
    >
      <div className="flex items-center gap-2 text-xs">
        <StatusDot status={c.status} />
        <span className="truncate">{c.title}</span>
        {poppedOut && (
          <ExternalLink size={11} className="shrink-0 text-faint" aria-label="Aberta em janela separada" />
        )}
      </div>
      {snippet && <p className="line-clamp-2 pl-3.5 text-[11px] leading-snug text-muted">{snippet}</p>}
      <div className="flex items-center gap-1.5 pl-3.5 text-[10px] text-faint">
        <span title={new Date(c.updatedAt).toLocaleString('pt-BR')}>{relativeTime(c.updatedAt, now)}</span>
        <span>·</span>
        <ContextRing percent={c.contextPercent} />
        {c.kind === 'agente' && (
          <>
            <span>·</span>
            <Bot size={11} className="shrink-0" aria-label="Agente" />
          </>
        )}
        {c.status === 'needs-you' && (
          <>
            <span>·</span>
            <span className="text-needs-you">precisa de você</span>
          </>
        )}
      </div>
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
