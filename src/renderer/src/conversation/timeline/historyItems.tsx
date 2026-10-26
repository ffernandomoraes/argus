import { imageType } from '../../../../shared/imageFiles'
import type { TurnFooter } from '../turnInfo'
import type { Message } from '../types'
import type { ImageView } from './imageViews'
import { AgentToolRow } from './rows/AgentToolRow'
import { AssistantRow } from './rows/AssistantRow'
import { BashRow } from './rows/BashRow'
import { DayDivider, dayKey } from './rows/DayDivider'
import { EventDivider } from './rows/EventDivider'
import { OutputRow } from './rows/OutputRow'
import { MarkdownFileRow, PlanRow } from './rows/PlanRow'
import { ThinkingRow } from './rows/ThinkingRow'
import { ToolRow } from './rows/ToolRow'
import { UserBubble } from './rows/UserBubble'
import { DOT_AGENT, DOT_PLAN, DOT_ROW, stepItem, type TimelineItem } from './timelineItem'

export type HistoryOptions = {
  footers: Map<string, TurnFooter>
  // Claude trabalhando: a última ação sem resultado é a que está rodando.
  running: boolean
  compact: boolean
  // Tira da resposta o que é recado para o app (ver cleanText no ChatView).
  clean: (text: string) => string
  // Imagens de uma mensagem gravada; sem quem as leia, o balão só conta quantas foram.
  viewFor?: (messageId: string) => ImageView
  // Preview de uma imagem que o Claude leu do disco (ferramenta Ler).
  viewFile?: (messageId: string, load: () => Promise<string[]>) => ImageView
}

// Linha do tempo do histórico gravado: suas mensagens em balões; cada passo do Claude (resposta,
// comando, leitura, raciocínio) com uma bolinha, na ordem em que aconteceu. As linhas são
// memorizadas e recebem a própria mensagem (o mesmo objeto enquanto ela não muda). Quando a
// conversa passa de um dia para outro, uma divisória com o dia novo ("Hoje", "Ontem", a data).
export function historyItems(messages: Message[], o: HistoryOptions): TimelineItem[] {
  const items: TimelineItem[] = []
  let day: string | null = null
  messages.forEach((m, i) => {
    if (m.at) {
      const key = dayKey(m.at)
      // No começo do trecho não: só na troca de um dia para o outro.
      if (day !== null && key !== day) items.push({ kind: 'divider', key: `day-${m.id}`, node: <DayDivider at={m.at} /> })
      day = key
    }
    items.push(itemOf(m, i, messages, o))
  })
  return items
}

function itemOf(m: Message, i: number, messages: Message[], o: HistoryOptions): TimelineItem {
  switch (m.role) {
    case 'user': {
      const view = m.images && o.viewFor ? o.viewFor(m.id) : undefined
      const bubble = <UserBubble text={m.text} at={m.at} queued={m.queued} images={m.images} imageView={view} marks={m.marks} files={m.files} />
      return { kind: 'user', key: m.id, node: bubble }
    }
    case 'event':
      return { kind: 'divider', key: m.id, node: <EventDivider text={m.text} at={m.at} /> }
    case 'output':
      return stepItem(m.id, 'bg-line', <OutputRow text={m.text} />)
    case 'thinking':
      return stepItem(m.id, 'bg-line', <ThinkingRow message={m} />, DOT_ROW)
    case 'tool': {
      if (m.agent) {
        const dot = m.error ? 'bg-red-400' : !m.result && o.running ? 'bg-running animate-pulse' : 'bg-emerald-400'
        return stepItem(m.id, dot, <AgentToolRow message={m} />, DOT_AGENT)
      }
      // Plano respondido: o cartão do plano. Esperando a resposta, fica a linha comum, e o plano
      // aparece no pedido de aprovação logo embaixo.
      if (m.name === 'ExitPlanMode' && m.detail && m.result) {
        return stepItem(m.id, m.error ? 'bg-red-400' : 'bg-emerald-400', <PlanRow message={m} />, DOT_PLAN)
      }
      // .md criado: formatado como o plano, com o caminho. Esperando a permissão, a linha comum.
      if (m.document !== undefined && (m.result || m.diff)) {
        return stepItem(m.id, m.error ? 'bg-red-400' : 'bg-emerald-400', <MarkdownFileRow message={m} />, DOT_PLAN)
      }
      // Sem resultado ainda e com o Claude trabalhando: é a ação em andamento.
      const pending = !m.result && !m.diff && o.running && i === messages.length - 1
      const dot = m.error ? 'bg-red-400' : pending ? 'bg-running animate-pulse' : 'bg-emerald-400'
      const image = m.name === 'Read' && m.detail && o.viewFile ? fileView(m.id, m.detail, o.viewFile) : undefined
      const row = m.name === 'Bash' ? <BashRow message={m} /> : <ToolRow message={m} compact={o.compact} image={image} />
      return stepItem(m.id, dot, row, DOT_ROW)
    }
    default: {
      const footer = o.footers.get(m.id)
      const row = <AssistantRow text={o.clean(m.text)} footerAt={footer?.at} duration={footer?.duration} tokens={footer?.tokens} />
      return stepItem(m.id, 'bg-faint', row)
    }
  }
}

const fileView = (id: string, path: string, viewFile: NonNullable<HistoryOptions['viewFile']>) =>
  imageType(path) ? viewFile(id, () => window.api.files.image(path).then((url) => (url ? [url] : []))) : undefined
