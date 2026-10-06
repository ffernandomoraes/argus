import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Message } from '../shared/history'
import { diffFromResult } from './diffs'
import { sessionsDir } from './sessions'
import { describeTool } from './toolLabels'
import { commandEvent, compactEvent, modelName } from './historyEvents'

type Line = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const RESULT_MAX = 2000
const MESSAGES_MAX = 400

function resultText(content: unknown): string {
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((c: Line) => (c?.type === 'text' ? c.text : c?.type === 'image' ? '[imagem]' : '')).join('\n')
        : ''
  return text.length > RESULT_MAX ? text.slice(0, RESULT_MAX) + '\n…' : text
}

// Texto que a pessoa escreveu; avisos internos (<system-reminder>, <command-name>...) ficam de fora.
function promptText(content: unknown): string | null {
  const parts =
    typeof content === 'string'
      ? [content]
      : Array.isArray(content)
        ? content.filter((c: Line) => c?.type === 'text').map((c: Line) => c.text as string)
        : []
  const text = parts.map((t) => t.trim()).filter((t) => t && !t.startsWith('<')).join('\n\n')
  return text || null
}

// Histórico de uma sessão, na ordem em que aconteceu. Raciocínio (thinking) e subagentes ficam de fora.
export async function readHistory(projectPath: string, sessionId: string): Promise<Message[]> {
  if (!/^[\w-]+$/.test(sessionId)) return []
  let raw: string
  try {
    raw = await readFile(join(sessionsDir(projectPath), `${sessionId}.jsonl`), 'utf8')
  } catch {
    return []
  }

  const messages: Message[] = []
  // Resultado de ferramenta chega numa linha depois do pedido; liga os dois pelo id.
  const tools = new Map<string, Extract<Message, { role: 'tool' }>>()
  // A mesma resposta da API vem em várias linhas (raciocínio, texto, ferramenta): tokens contam uma vez.
  const counted = new Set<string>()
  const queuedTexts = new Set<string>()
  // Modelo da última resposta: quando muda (por /model, pelo app, por outro lugar), vira um divisor.
  let lastModel: string | undefined
  let lastModelEvent: string | undefined

  for (const rawLine of raw.split('\n')) {
    if (!rawLine.startsWith('{')) continue
    let l: Line
    try {
      l = JSON.parse(rawLine)
    } catch {
      continue
    }
    const marker = compactEvent(l) ?? commandEvent(l)
    if (marker) {
      if (marker.kind === 'model') lastModelEvent = marker.text
      messages.push(marker)
      continue
    }

    // Mensagem enviada no meio de uma resposta: o Claude Code grava como anexo "queued_command"
    // no ponto em que a entregou ao Claude (entre uma ação e outra).
    if (l.type === 'attachment' && l.attachment?.type === 'queued_command' && !l.isSidechain) {
      const text = promptText(l.attachment.prompt)
      if (text) {
        messages.push({ id: l.uuid, role: 'user', text, at: l.timestamp, queued: true })
        queuedTexts.add(text)
      }
      continue
    }
    if ((l.type !== 'user' && l.type !== 'assistant') || l.isSidechain || l.isMeta || l.isCompactSummary) continue
    const content = l.message?.content

    if (l.type === 'user') {
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type !== 'tool_result') continue
          const tool = tools.get(c.tool_use_id)
          if (tool) {
            tool.result = resultText(c.content)
            tool.error = c.is_error === true
            if (!tool.error) tool.diff = diffFromResult(l.toolUseResult)
          }
        }
      }
      const images = Array.isArray(content) ? content.filter((c: Line) => c?.type === 'image').length : 0
      const text = promptText(content)
      // A mesma mensagem já entrou como "enviada durante a resposta": não repete.
      if (text && queuedTexts.delete(text)) continue
      // Mensagem só com print, sem texto, também aparece.
      if (text || images) {
        messages.push({ id: l.uuid, role: 'user', text: text ?? '', at: l.timestamp, images: images || undefined })
      }
      continue
    }

    if (!Array.isArray(content)) continue
    const model: unknown = l.message?.model
    if (typeof model === 'string' && model !== '<synthetic>') {
      const text = `Modelo: ${modelName(model)}`
      // A primeira resposta não marca nada; troca já anunciada pelo /model também não.
      if (lastModel && model !== lastModel && text !== lastModelEvent) {
        messages.push({ id: `${l.uuid}-model`, role: 'event', kind: 'model', text, at: l.timestamp })
      }
      lastModel = model
      lastModelEvent = text
    }
    const apiId: string | undefined = l.message?.id
    const usageTokens = l.message?.usage?.output_tokens
    // Linha só com raciocínio (thinking) não vira mensagem: os tokens ficam para a primeira
    // linha da mesma resposta que aparecer no chat.
    const take = (): number | undefined => {
      if (!apiId || counted.has(apiId) || typeof usageTokens !== 'number') return undefined
      counted.add(apiId)
      return usageTokens
    }
    content.forEach((c: Line, i: number) => {
      const id = `${l.uuid}-${i}`
      const at = l.timestamp
      if (c?.type === 'thinking' && c.thinking?.trim()) {
        // Quanto durou: do fim da linha anterior até esta.
        const previous = messages[messages.length - 1]?.at
        const seconds = previous ? Math.round((Date.parse(at) - Date.parse(previous)) / 1000) : undefined
        messages.push({ id, role: 'thinking', text: c.thinking.trim(), at, tokens: take(), seconds })
      } else if (c?.type === 'text' && c.text?.trim()) {
        messages.push({ id, role: 'assistant', text: c.text.trim(), at, tokens: take() })
      } else if (c?.type === 'tool_use') {
        const d = describeTool(c.name, c.input)
        const tool = { id, role: 'tool' as const, name: c.name, label: d.label, input: d.summary, detail: d.detail, result: '', at, tokens: take() }
        tools.set(c.id, tool)
        messages.push(tool)
      }
    })
  }
  return messages.slice(-MESSAGES_MAX)
}
