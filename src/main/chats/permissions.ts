import type { CanUseTool, PermissionResult, PermissionUpdate } from '@anthropic-ai/claude-agent-sdk'
import type { PermissionAnswer, PermissionRequest, Question } from '../../shared/chat'
import { diffFromInput } from '../diffs'
import { describeTool } from '../toolLabels'

type AskOptions = Parameters<CanUseTool>[2]
type Waiting = { resolve: (r: PermissionResult) => void; input: Record<string, unknown>; suggestions?: PermissionUpdate[] }

// "Sempre permitir" só quando o Claude Code sugere uma regra e ela não daria mais permissão do que
// a ação pedida (suppressAlwaysAllowRule).
const alwaysAllowable = (o: AskOptions): boolean => !!o.suggestions?.length && !o.suppressAlwaysAllowRule

// Pedido de permissão como o chat mostra.
function toRequest(toolName: string, input: Record<string, unknown>, options: AskOptions): PermissionRequest {
  const d = describeTool(toolName, input)
  return {
    id: options.toolUseID,
    toolName,
    title: options.title,
    label: d.label,
    summary: d.summary,
    detail: d.detail,
    canAlwaysAllow: alwaysAllowable(options),
    diff: diffFromInput(toolName, input),
    questions: toolName === 'AskUserQuestion' ? (input.questions as Question[]) : undefined
  }
}

// Sua resposta no formato do SDK. A regra de "sempre permitir" só vai se o pedido a ofereceu.
function toResult(answer: PermissionAnswer, w: Waiting): PermissionResult {
  // Perguntas: as respostas vão junto da entrada da ferramenta, como faz o Claude Code.
  if (typeof answer === 'object') return { behavior: 'allow', updatedInput: { ...w.input, answers: answer.answers } }
  if (answer === 'deny') return { behavior: 'deny', message: 'A pessoa negou esta ação.' }
  return { behavior: 'allow', updatedInput: w.input, ...(answer === 'always' && w.suggestions && { updatedPermissions: w.suggestions }) }
}

// Pedidos de permissão (e perguntas) da conversa esperando sua resposta.
export class PendingPermissions {
  private waiting = new Map<string, Waiting>()

  constructor(
    private onAsk: (request: PermissionRequest) => void,
    // Respondido, ou desistido porque o pedido foi interrompido: sai da tela.
    private onSettle: (id: string) => void
  ) {}

  get size(): number {
    return this.waiting.size
  }

  canUseTool: CanUseTool = (toolName, input, options) =>
    new Promise<PermissionResult>((resolve) => {
      const id = options.toolUseID
      this.waiting.set(id, { resolve, input, suggestions: alwaysAllowable(options) ? options.suggestions : undefined })
      this.onAsk(toRequest(toolName, input, options))
      // Interrompido antes da resposta: o pedido some.
      options.signal.addEventListener('abort', () => this.settle(id))
    })

  answer(id: string, answer: PermissionAnswer): void {
    const w = this.waiting.get(id)
    if (!w) return
    w.resolve(toResult(answer, w))
    this.settle(id)
  }

  // Conversa fechada: o que ainda esperava resposta é negado.
  denyAll(message: string): void {
    for (const w of this.waiting.values()) w.resolve({ behavior: 'deny', message })
    this.waiting.clear()
  }

  private settle(id: string): void {
    if (this.waiting.delete(id)) this.onSettle(id)
  }
}
