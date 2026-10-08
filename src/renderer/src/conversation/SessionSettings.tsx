// Valores são os que o `claude` aceita em --model e --effort; vazio = padrão do Claude Code.
export type SessionSettings = {
  model: string
  effort: string
  // Pensamento estendido antes de responder. Desligado por padrão; liga nas Configurações ou no chat.
  thinking: boolean
  // Workflows dinâmicos (vários subagentes) em toda tarefa, só nesta sessão.
  ultracode: boolean
  // Modo de permissão (--permission-mode); vazio = padrão da conta.
  permissionMode: string
}

export const DEFAULT_SETTINGS: SessionSettings = {
  model: '',
  effort: '',
  thinking: false,
  ultracode: false,
  permissionMode: ''
}

// Configurações do Claude Code para o --settings ao abrir o terminal. Vão sempre explícitas para
// o settings.json do Claude Code não ligar thinking ou Ultracode por conta própria.
export function launchSettings(s: SessionSettings): string {
  return JSON.stringify({ alwaysThinkingEnabled: s.thinking, ultracode: s.ultracode })
}

// Comando para aplicar a mudança numa sessão de terminal já aberta (thinking não tem).
export function liveCommand(patch: Partial<SessionSettings>): string | null {
  if (patch.model) return `/model ${patch.model}`
  if (patch.effort !== undefined) return `/effort ${patch.effort || 'auto'}`
  if (patch.ultracode !== undefined) return `/effort ultracode ${patch.ultracode ? 'on' : 'off'}`
  return null
}
