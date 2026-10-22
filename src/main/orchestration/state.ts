import type { ClaudeInfo } from '../../shared/models'

// Liga e desliga com o experimento "Orquestrador" (Configurações > Experimentos). Vale para as
// conversas abertas depois: a ferramenta entra quando o agente abre.
let enabled = false
let claudeInfo: (account: string) => ClaudeInfo | null = () => null

export const orchestrationEnabled = (): boolean => enabled

export function setOrchestrationEnabled(on: boolean): void {
  enabled = on
}

// Modelos de cada conta do Claude (o monitor de uso guarda); os outros agentes vêm de agentInfo.
export function setClaudeInfo(fn: (account: string) => ClaudeInfo | null): void {
  claudeInfo = fn
}

export const claudeInfoOf = (account: string): ClaudeInfo | null => claudeInfo(account)
