import type { EventKind } from '../../../shared/history'
import type { EventMessage } from './localEvents'
import type { Message } from './types'

// Encaixa os divisores do app entre as mensagens pelo horário e tira repetições:
// a troca de modelo feita aqui também aparece no histórico quando a próxima resposta chega.
// O histórico vem cortado nas últimas mensagens: troca de antes da primeira mensagem à vista não
// tem onde ficar (todas se empilhavam no topo) e fica de fora. Sem mensagem nenhuma (ainda
// carregando), também.
export function mergeEvents(messages: Message[], events: EventMessage[]): Message[] {
  if (!events.length || !messages.length) return messages
  const first = messages.find((m) => m.at)?.at
  const pending = events
    .filter((e) => !first || (e.at ?? '') >= first)
    .sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''))
  if (!pending.length) return messages
  const merged: Message[] = []
  for (const m of messages) {
    while (pending.length && m.at && (pending[0].at ?? '') <= m.at) merged.push(pending.shift()!)
    merged.push(m)
  }
  merged.push(...pending)

  const out: Message[] = []
  const lastText: Partial<Record<EventKind, string>> = {}
  let localModelSinceReply = false
  for (const m of merged) {
    if (m.role === 'event') {
      // Cada parada é um momento seu, mesmo com o mesmo texto da anterior.
      if (m.kind !== 'interrupted' && lastText[m.kind] === m.text) continue
      const derived = m.kind === 'model' && !m.id.startsWith('local-')
      if (derived && localModelSinceReply) continue
      if (m.kind === 'model' && m.id.startsWith('local-')) localModelSinceReply = true
      lastText[m.kind] = m.text
    } else if (m.role !== 'user') {
      localModelSinceReply = false
    }
    out.push(m)
  }
  return out
}
