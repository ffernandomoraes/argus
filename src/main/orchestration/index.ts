import { tool } from '@anthropic-ai/claude-agent-sdk'
import { DELEGATE_TOOL, LIST_AGENTS_TOOL, REPORT_VALIDATION_TOOL } from '../../shared/orchestrator'
import { callTool, delegateShape, reportShape, TOOL_DESCRIPTIONS } from './tools'
import type { DelegateArgs, StepHost } from './types'

// Orquestração entre agentes: qualquer conversa (Claude, Codex, Gemini, Cursor) delega etapas a
// qualquer outro agente pela ferramenta delegate. Ver tools.ts (as ferramentas), runStep.ts (quem
// executa), mcpServer.ts (o caminho dos agentes de fora) e stepLog.ts (o registro).

export { registerHost } from './mcpServer'
export { orchestrationEnabled, setClaudeInfo, setOrchestrationEnabled } from './state'
export type { DelegateArgs, StepHost } from './types'

// Nomes completos no Claude Code (servidor "argus"): liberados sem perguntar, porque quem pede
// permissão é a etapa, para cada ação dela.
export const ORCHESTRATION_TOOLS = [DELEGATE_TOOL, LIST_AGENTS_TOOL, REPORT_VALIDATION_TOOL]

// As mesmas ferramentas para o servidor dentro do SDK do Claude.
export function sdkOrchestrationTools(host: StepHost) {
  const signalOf = (extra: unknown) => (extra as { signal?: AbortSignal } | undefined)?.signal ?? new AbortController().signal
  return [
    tool(DELEGATE_TOOL, TOOL_DESCRIPTIONS[DELEGATE_TOOL], delegateShape, (args, extra) => callTool(DELEGATE_TOOL, args, host, signalOf(extra))),
    tool(LIST_AGENTS_TOOL, TOOL_DESCRIPTIONS[LIST_AGENTS_TOOL], {}, (args, extra) => callTool(LIST_AGENTS_TOOL, args, host, signalOf(extra))),
    tool(REPORT_VALIDATION_TOOL, TOOL_DESCRIPTIONS[REPORT_VALIDATION_TOOL], reportShape, (args, extra) => callTool(REPORT_VALIDATION_TOOL, args, host, signalOf(extra)))
  ]
}

// Chamadas da delegate vistas na conversa do orquestrador, esperando a etapa que as atende: liga a
// etapa à linha da chamada no chat. Pelo id que o agente manda (Codex) ou pela tarefa.
export class DelegateCalls {
  private list: { id: string; task: string }[] = []

  seen(id: string, task: string): void {
    if (this.list.some((c) => c.id === id)) return
    this.list.push({ id, task })
    if (this.list.length > 50) this.list.shift()
  }

  claim(args: DelegateArgs, metaCallId?: string): string | undefined {
    const i = this.list.findIndex((c) => (metaCallId ? c.id === metaCallId : c.task === args.task))
    if (i < 0) return metaCallId
    return this.list.splice(i, 1)[0].id
  }
}
