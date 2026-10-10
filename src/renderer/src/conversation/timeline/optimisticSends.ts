import type { ChatState, QueuedMessage } from '../../../../shared/chat'
import type { Message } from '../types'

// Mensagem enviada que ainda não está no histórico gravado: aparece na hora como balão provisório.
export type PendingSend = {
  id: string
  // O que foi enviado (para achar a mensagem no histórico) e o que estava digitado (para voltar ao
  // campo se o envio não chegar).
  text: string
  typed: string
  files: File[]
  // Imagens do envio: quantas e a leitura delas para as miniaturas (endereços locais, sem
  // codificar o arquivo de novo).
  images: number
  read: () => Promise<string[]>
  sentAt: number
  // Última mensagem da conversa no envio: a nova vem depois dela.
  after?: string
  // Estado do chat no envio: se nenhum estado novo chegar até o prazo, o envio não chegou ao Claude.
  live: ChatState | null
}

// Folga entre a hora do envio e a hora gravada pelo Claude Code.
const CLOCK_SLACK_MS = 2000

// A mensagem já está no histórico: uma mensagem sua depois da última que a conversa tinha no envio,
// com o mesmo começo de texto. O histórico vem cortado nas últimas mensagens; se a âncora saiu do
// corte (ou a conversa era nova), vale só mensagem gravada depois do envio, para não confundir com
// uma antiga igual. Antes, o índice da lista servia de âncora e nunca batia com o corte: o balão
// ficava duplicado nas conversas longas.
export function isDelivered(s: PendingSend, messages: Message[]): boolean {
  const anchor = s.after ? messages.findIndex((m) => m.id === s.after) : -1
  for (let i = anchor + 1; i < messages.length; i++) {
    const m = messages[i]
    if (m.role !== 'user') continue
    if (anchor < 0 && m.at && Date.parse(m.at) < s.sentAt - CLOCK_SLACK_MS) continue
    if (!s.text || m.text.trim().startsWith(s.text)) return true
  }
  return false
}

const NO_IMAGES = () => Promise.resolve<string[]>([])

// Mensagens na fila do Claude sem balão nesta tela (a conversa foi fechada e aberta de novo no meio
// do pedido): voltam como balão até chegarem ao histórico. As enviadas daqui já têm o delas. Sem
// as imagens: elas só existem na mensagem que já foi para o Claude.
export function queuedSends(queued: QueuedMessage[] | undefined, own: PendingSend[], messages: Message[]): PendingSend[] {
  const list: PendingSend[] = []
  for (const q of queued ?? []) {
    if (own.some((s) => Math.abs(s.sentAt - q.at) < CLOCK_SLACK_MS && q.text.startsWith(s.text))) continue
    const s: PendingSend = { id: q.id, text: q.text, typed: q.text, files: [], images: 0, read: NO_IMAGES, sentAt: q.at, live: null }
    if (!isDelivered(s, messages)) list.push(s)
  }
  return list
}
