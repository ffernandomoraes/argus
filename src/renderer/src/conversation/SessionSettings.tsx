// Valores são os que o `claude` aceita em --model e --effort; vazio = padrão do Claude Code.
export type SessionSettings = {
  model: string
  effort: string
  // Pensamento estendido antes de responder. Desligado por padrão; liga nas Configurações ou no chat.
  thinking: boolean
  // Workflows dinâmicos (vários subagentes) em toda tarefa, só nesta sessão.
  ultracode: boolean
  // Modo orquestrador (shared/orchestrator.ts), só nesta sessão.
  orchestrator: boolean
  // Modo de permissão (--permission-mode); vazio = padrão da conta.
  permissionMode: string
}

export const DEFAULT_SETTINGS: SessionSettings = {
  model: '',
  effort: '',
  thinking: false,
  ultracode: false,
  orchestrator: false,
  permissionMode: ''
}

// Configurações do Claude Code para o --settings ao abrir o terminal. Vão sempre explícitas para
// o settings.json do Claude Code não ligar thinking ou Ultracode por conta própria.
export function launchSettings(s: SessionSettings): string {
  return JSON.stringify({ alwaysThinkingEnabled: s.thinking, ultracode: s.ultracode })
}

// Comandos para aplicar a mudança numa sessão de terminal já aberta (thinking e orquestrador não
// têm). Ligar o orquestrador troca modelo e esforço juntos.
export function liveCommands(patch: Partial<SessionSettings>): string[] {
  const out: string[] = []
  if (patch.model) out.push(`/model ${patch.model}`)
  if (patch.effort !== undefined) out.push(`/effort ${patch.effort || 'auto'}`)
  if (patch.ultracode !== undefined) out.push(`/effort ultracode ${patch.ultracode ? 'on' : 'off'}`)
  return out
}
