import type { ChatState, PermissionAnswer } from '../../../../shared/chat'
import type { SessionStatus } from '../../canvas/types'
import { currentTurn } from '../turnInfo'
import type { Message } from '../types'
import { activityLabel } from './activityLabel'
import type { ImageView } from './imageViews'
import type { PendingSend } from './optimisticSends'
import { PermissionRow } from './rows/PermissionRow'
import { UserBubble } from './rows/UserBubble'
import { WorkingRow } from './rows/WorkingRow'
import { StreamingMarkdown } from './StreamingMarkdown'
import { stepItem, type TimelineItem } from './timelineItem'

export type LiveOptions = {
  messages: Message[]
  // Mensagens enviadas que ainda não estão no histórico.
  waiting: PendingSend[]
  live: ChatState | null
  status: SessionStatus
  clean: (text: string) => string
  // Mesmo objeto por mensagem; a que está a caminho traz a leitura das próprias imagens.
  viewFor: (id: string, read?: () => Promise<string[]>) => ImageView
  onAnswer: (id: string, answer: PermissionAnswer) => void
}

// O que vem depois do histórico gravado: os balões a caminho, a resposta sendo escrita, os
// pedidos de permissão, o passo em andamento e os avisos.
export function liveItems(o: LiveOptions): TimelineItem[] {
  const items: TimelineItem[] = []
  for (const w of o.waiting) {
    const view = w.images ? o.viewFor(w.id, w.read) : undefined
    items.push({ kind: 'user', key: w.id, node: <UserBubble text={w.text} images={w.images} imageView={view} /> })
  }
  const partial = partialText(o.live, o.messages)
  if (partial) {
    const node = (
      <div className="text-[15px] leading-relaxed text-text">
        <StreamingMarkdown text={o.clean(partial)} />
      </div>
    )
    items.push(stepItem('partial', 'bg-running animate-pulse', node))
  }
  o.live?.permissions.forEach((p) => items.push(stepItem(`perm-${p.id}`, 'bg-ask', <PermissionRow request={p} onAnswer={o.onAnswer} />)))
  if (o.status === 'running' || o.waiting.length > 0) {
    // Pedido em andamento: o chat do app sabe na hora; sessão aberta em outro lugar, pelo histórico.
    const fromHistory = currentTurn(o.messages)
    const startedAt = o.live?.turnStartedAt ?? fromHistory.startedAt
    const tokens = Math.max(o.live?.turnStartedAt ? o.live.turnTokens : 0, fromHistory.tokens)
    const label = activityLabel(o.live?.activity, (o.live?.agents ?? []).filter((a) => !a.background).length)
    items.push(stepItem('working', 'bg-running animate-pulse', <WorkingRow label={label} startedAt={startedAt} tokens={tokens} />))
  }
  if (o.live?.error) items.push(stepItem('error', 'bg-red-400', <p className="py-0.5 text-[13px] text-red-400">{o.live.error}</p>))
  if (o.status === 'needs-you' && !o.live?.permissions.length) {
    const notice = (
      <div className="rounded-lg border border-ask/40 bg-ask/10 px-3 py-2 text-[13px] text-text">
        Esperando você responder onde a conversa está aberta (permissão ou pergunta).
      </div>
    )
    items.push(stepItem('needs-you', 'bg-ask', notice))
  }
  return items
}

// A prévia da resposta some quando o mesmo texto já chegou no histórico.
function partialText(live: ChatState | null, messages: Message[]): string {
  if (!live?.partial) return ''
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'assistant') return m.text === live.partial.trim() ? '' : live.partial
  }
  return live.partial
}
