import type { RunningAgent } from '../../shared/agents'
import type { PermissionAsk, PermissionReply } from '../agentChats/driver'

// O que o orquestrador pede na ferramenta delegate (ver tools.ts).
export type DelegateArgs = {
  agent: string
  model?: string
  effort?: string
  task: string
  title?: string
  rule?: string
  readOnly?: boolean
  validates?: string
}

// A conversa que orquestra, como a etapa delegada a enxerga: a pasta, o modo de permissão (a etapa
// herda), onde perguntar e onde mostrar o andamento. Cada sessão (Claude ou outro agente) implementa.
export type StepHost = {
  cwd: string
  folders: string[]
  // Quem orquestra: a conta da conversa ("main", "codex:main"), para o registro.
  orchestrator: string
  permissionMode: () => string
  // Dispara quando a pessoa para o pedido ou fecha a conversa: as etapas em andamento param junto.
  stopSignal: () => AbortSignal
  // Pergunta da etapa (comando, edição) no chat do orquestrador.
  permission: (ask: PermissionAsk) => Promise<PermissionReply>
  // Etapa rodando: aparece na linha da chamada (AgentToolRow) e no canvas, como um subagente.
  started: (agent: RunningAgent) => void
  progressed: (id: string, patch: Partial<RunningAgent>) => void
  finished: (id: string, result: string, error: boolean) => void
  // Id da chamada da ferramenta no orquestrador, para ligar a etapa à linha dela. metaCallId: o que
  // o próprio agente manda junto (o Codex manda); sem ele, pela tarefa.
  callIdFor: (args: DelegateArgs, metaCallId?: string) => string | undefined
}
