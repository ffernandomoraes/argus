import type { Message } from '../../shared/history'
import { diffFromResult } from '../diffs'
import { describeTool } from '../toolLabels'
import { arr, atOf, contentOf, idOf, obj, str, type Line } from '../transcripts/line'
import { marksOf, promptText, resultText } from './content'
import { commandEvent, commandMessage, commandOutput, compactEvent, modelName } from './events'

const RESULT_MAX = 2000
// O relatório de um subagente é o que ele entregou: cabe bem mais.
const AGENT_RESULT_MAX = 20000
// O chat recebe só as últimas mensagens; as mais antigas nem ficam na memória.
const MESSAGES_MAX = 400

type ToolMessage = Extract<Message, { role: 'tool' }>
type DiffSource = Parameters<typeof diffFromResult>[0]
type Take = () => number | undefined

// Histórico de uma sessão, montado linha a linha e na ordem em que aconteceu. Raciocínio
// (thinking) e subagentes ficam de fora. Guarda o que liga uma linha às seguintes (o resultado de
// uma ferramenta chega depois do pedido), então as linhas novas continuam de onde parou e o
// arquivo é lido uma vez só (ver cache.ts).
export class HistoryParser {
  private list: Message[] = []
  // Resultado de ferramenta chega numa linha depois do pedido; liga os dois pelo id.
  private tools = new Map<unknown, ToolMessage>()
  // A mesma resposta da API vem em várias linhas (raciocínio, texto, ferramenta): tokens contam uma vez.
  private counted = new Set<unknown>()
  // Mensagens que já entraram como "enviadas durante a resposta" (ver queued).
  private queuedIds = new Set<string>()
  private queuedTexts = new Set<string>()
  // Modelo da última resposta: quando muda (por /model, pelo app, por outro lugar), vira um divisor.
  private lastModel: string | undefined
  private lastModelEvent: string | undefined

  messages(): Message[] {
    return this.list.slice(-MESSAGES_MAX)
  }

  feed(l: Line): void {
    const marker = compactEvent(l) ?? commandEvent(l)
    if (marker) {
      if (marker.kind === 'model') this.lastModelEvent = marker.text
      return this.push(marker)
    }
    // Comando de barra e a resposta dele ficam visíveis, em vez de sumir da conversa.
    const command = commandMessage(l) ?? commandOutput(l)
    if (command) return this.push(command)
    if (this.queued(l)) return
    if ((l.type !== 'user' && l.type !== 'assistant') || l.isSidechain || l.isMeta || l.isCompactSummary) return
    if (l.type === 'user') this.user(l)
    else this.assistant(l)
  }

  // Mensagem enviada no meio de uma resposta: o Claude Code grava como anexo "queued_command"
  // no ponto em que a entregou ao Claude (entre uma ação e outra).
  private queued(l: Line): boolean {
    const attachment = obj(l.attachment)
    if (l.type !== 'attachment' || attachment?.type !== 'queued_command' || l.isSidechain) return false
    const text = promptText(attachment.prompt)
    if (text) {
      this.push({ id: idOf(l), role: 'user', text, at: atOf(l), queued: true, marks: marksOf(attachment.prompt) })
      // A mesma mensagem pode vir depois como linha comum, com o id que o anexo guarda em
      // source_uuid: é por ele que o SDK junta as duas. Sessões sem esse id: pelo texto.
      const source = str(attachment.source_uuid)
      if (source) this.queuedIds.add(source)
      else this.queuedTexts.add(text)
    }
    return true
  }

  private user(l: Line): void {
    const content = contentOf(l)
    const items = arr(content)
    for (const item of items ?? []) {
      const c = obj(item)
      if (c?.type !== 'tool_result') continue
      const tool = this.tools.get(c.tool_use_id)
      if (!tool) continue
      tool.result = resultText(c.content, tool.agent ? AGENT_RESULT_MAX : RESULT_MAX)
      tool.error = c.is_error === true
      if (!tool.error) tool.diff = diffFromResult(l.toolUseResult as DiffSource)
    }
    const images = items ? items.filter((c) => obj(c)?.type === 'image').length : 0
    const text = promptText(content)
    // A mesma mensagem já entrou como "enviada durante a resposta": não repete.
    if (this.queuedIds.delete(l.uuid as string)) return
    if (text && this.queuedTexts.delete(text)) return
    // Mensagem só com print, sem texto, também aparece.
    if (text || images) {
      this.push({ id: idOf(l), role: 'user', text: text ?? '', at: atOf(l), images: images || undefined, marks: marksOf(content) })
    }
  }

  private assistant(l: Line): void {
    const message = obj(l.message)
    const items = arr(message?.content)
    if (!items) return
    const model = message?.model
    if (typeof model === 'string' && model !== '<synthetic>') {
      const text = `Modelo: ${modelName(model)}`
      // A primeira resposta não marca nada; troca já anunciada pelo /model também não.
      if (this.lastModel && model !== this.lastModel && text !== this.lastModelEvent) {
        this.push({ id: `${l.uuid}-model`, role: 'event', kind: 'model', text, at: atOf(l) })
      }
      this.lastModel = model
      this.lastModelEvent = text
    }
    const apiId = message?.id
    const usageTokens = obj(message?.usage)?.output_tokens
    // Linha só com raciocínio (thinking) não vira mensagem: os tokens ficam para a primeira
    // linha da mesma resposta que aparecer no chat.
    const take: Take = () => {
      if (!apiId || this.counted.has(apiId) || typeof usageTokens !== 'number') return undefined
      this.counted.add(apiId)
      return usageTokens
    }
    items.forEach((item, i) => {
      try {
        this.part(obj(item), `${l.uuid}-${i}`, atOf(l), model, take)
      } catch {
        // parte com formato inesperado: fica de fora, o resto da resposta aparece
      }
    })
  }

  private part(c: Line | undefined, id: string, at: string | undefined, model: unknown, take: Take): void {
    if (c?.type === 'thinking' && typeof c.thinking === 'string' && c.thinking.trim()) {
      // Quanto durou: do fim da linha anterior até esta.
      const previous = this.list[this.list.length - 1]?.at
      const seconds = previous ? Math.round((Date.parse(at as string) - Date.parse(previous)) / 1000) : undefined
      this.push({ id, role: 'thinking', text: c.thinking.trim(), at, tokens: take(), seconds })
    } else if (c?.type === 'text' && typeof c.text === 'string' && c.text.trim()) {
      // Aviso que o próprio Claude Code grava ao retomar uma resposta cortada no meio
      // (o app reiniciou, por exemplo).
      const cut = model === '<synthetic>' && c.text.trim() === 'No response requested.'
      const text = cut ? 'A resposta anterior foi interrompida antes de terminar. Seguindo daqui.' : c.text.trim()
      this.push({ id, role: 'assistant', text, at, tokens: take() })
    } else if (c?.type === 'tool_use' && typeof c.name === 'string') {
      const input = obj(c.input)
      const d = describeTool(c.name, input)
      const agent = c.name === 'Agent' || c.name === 'Task' ? String(input?.subagent_type || 'general-purpose') : undefined
      const tool: ToolMessage = {
        id,
        role: 'tool',
        name: c.name,
        label: d.label,
        input: d.summary,
        detail: d.detail,
        result: '',
        at,
        tokens: take(),
        toolUseId: c.id as string | undefined,
        agent
      }
      this.tools.set(c.id, tool)
      this.push(tool)
    }
  }

  private push(m: Message): void {
    this.list.push(m)
    if (this.list.length >= MESSAGES_MAX * 2) this.trim()
  }

  // Fica só com as últimas: as que saem nunca mais voltam para o fim da lista, e a ferramenta
  // delas deixa de esperar resultado.
  private trim(): void {
    const drop = this.list.length - MESSAGES_MAX
    for (const m of this.list.slice(0, drop)) {
      if (m.role === 'tool' && this.tools.get(m.toolUseId) === m) this.tools.delete(m.toolUseId)
    }
    this.list = this.list.slice(drop)
  }
}
