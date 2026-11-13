import type { AttachedFile } from '@argus/shared/attachedFiles'
import type { ChatState, PermissionAnswer } from '@argus/shared/chat'
import { isSendableImage } from '../chatImages'
import type { SessionStatus } from '../../canvas/types'
import { currentTurn } from '../turnInfo'
import type { Message } from '../types'
import type { ImageView } from './imageViews'
import type { PendingSend } from './optimisticSends'
import { savedPreviewId } from './previewKeys'
import { ErrorRow } from './rows/ErrorRow'
import { PermissionRow } from './rows/PermissionRow'
import { UserBubble } from './rows/UserBubble'
import { WorkingRow } from './rows/WorkingRow'
import { StreamingMarkdown } from './StreamingMarkdown'
import { stepItem, type TimelineItem } from './timelineItem'
import { tr } from '../../i18n'

export type LiveOptions = {
  messages: Message[]
  // Mensagens enviadas que ainda não estão no histórico.
  waiting: PendingSend[]
  live: ChatState | null
  status: SessionStatus
  // Mesmo objeto por mensagem; a que está a caminho traz a leitura das próprias imagens.
  viewFor: (id: string, read?: () => Promise<string[]>) => ImageView
  onAnswer: (id: string, answer: PermissionAnswer) => void
  // Manda de novo a mensagem que falhou (o "Reenviar" depois de entrar de novo; ver ErrorRow).
  onResend?: () => void
}

type LiveItemsOptions = LiveOptions & {
  // Chave da prévia: a resposta gravada herda a mesma (ver previewKeys).
  previewKey: string
}

// O que vem depois do histórico gravado: os balões a caminho, a resposta sendo escrita, os
// pedidos de permissão, o passo em andamento e os avisos.
export function liveItems(o: LiveItemsOptions): TimelineItem[] {
  const items: TimelineItem[] = []
  for (const w of o.waiting) {
    const view = w.images ? o.viewFor(w.id, w.read) : undefined
    const files = attachedFiles(w.files)
    // fresh: acabou de ser enviada, entra com animação (ver Timeline).
    items.push({ kind: 'user', key: w.id, fresh: true, node: <UserBubble text={w.text} images={w.images} imageView={view} files={files} /> })
  }
  const partial = partialText(o.live, o.messages)
  if (partial) {
    const node = (
      <div className="text-[15px] leading-relaxed text-text">
        <StreamingMarkdown text={partial} />
      </div>
    )
    items.push(stepItem(o.previewKey, 'bg-running animate-pulse', node))
  }
  // data-continues-turn: responder deixa o pedido seguir, então o clique não solta o fim da conversa
  // (ver useStickyScroll).
  o.live?.permissions.forEach((p) =>
    items.push(
      stepItem(
        `perm-${p.id}`,
        'bg-ask',
        <div data-continues-turn>
          <PermissionRow request={p} onAnswer={o.onAnswer} />
        </div>
      )
    )
  )
  if (o.status === 'running' || o.waiting.length > 0) {
    // Pedido em andamento: o chat do app sabe na hora; sessão aberta em outro lugar, pelo histórico.
    const fromHistory = currentTurn(o.messages)
    const startedAt = o.live?.turnStartedAt ?? fromHistory.startedAt
    const tokens = Math.max(o.live?.turnStartedAt ? o.live.turnTokens : 0, fromHistory.tokens)
    const row = (
      <WorkingRow
        activity={o.live?.activity}
        foreground={(o.live?.agents ?? []).filter((a) => !a.background).length}
        retry={o.live?.retry}
        compactingSince={o.live?.compactingSince}
        startedAt={startedAt}
        tokens={tokens}
      />
    )
    items.push(stepItem('working', 'bg-running animate-pulse', row))
  }
  if (o.live?.error) items.push(stepItem('error', 'bg-red-400', <ErrorRow error={o.live.error} loginNeeded={o.live.loginNeeded} onResend={o.onResend} />))
  if (o.status === 'needs-you' && !o.live?.permissions.length) {
    const notice = (
      <div className="rounded-lg border border-ask/40 bg-ask/10 px-3 py-2 text-[13px] text-text">
        {tr(
          'Esperando você responder onde a conversa está aberta (permissão ou pergunta).',
          'Waiting for your answer where the chat is open (permission or question).'
        )}
      </div>
    )
    items.push(stepItem('needs-you', 'bg-ask', notice))
  }
  return items
}

// A prévia da resposta some quando o mesmo texto já chegou no histórico.
function partialText(live: ChatState | null, messages: Message[]): string {
  if (!live?.partial) return ''
  return savedPreviewId(live, messages) === null ? live.partial : ''
}

// Os anexos que não são imagem, como o balão do histórico vai mostrar (o caminho vira o nome).
function attachedFiles(files: File[]): AttachedFile[] | undefined {
  const list = files.filter((f) => !isSendableImage(f)).map((f) => ({ path: window.api.filePath(f) || f.name, size: f.size }))
  return list.length ? list : undefined
}
