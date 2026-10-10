import type { PermissionMode } from '@anthropic-ai/claude-agent-sdk'
import type { ChatSettings } from '../../shared/chat'

// "manual" é o nome que o app mostra; para o Claude Code é "default".
export function toPermissionMode(mode: string): PermissionMode | undefined {
  if (!mode) return undefined
  return (mode === 'manual' ? 'default' : mode) as PermissionMode
}

// Na abertura vão sempre explícitas: sem elas, vale o que estiver no settings.json do Claude Code.
export function openingFlags(s: ChatSettings): Record<string, unknown> {
  return { alwaysThinkingEnabled: s.thinking, ultracode: s.ultracode }
}

// Mudanças feitas nos seletores com a conversa aberta, no formato do applyFlagSettings. Trocar o
// esforço sem a chave do ultracode desliga o ultracode (comentário de applyFlagSettings no
// sdk.d.ts), então ela vai junto sempre que o esforço muda, com o valor atual.
export function flagChanges(patch: Partial<ChatSettings>, current: ChatSettings): Record<string, unknown> {
  const flags: Record<string, unknown> = {}
  if (patch.effort !== undefined) {
    flags.effortLevel = patch.effort || null
    flags.ultracode = patch.ultracode ?? current.ultracode
  }
  if (patch.thinking !== undefined) flags.alwaysThinkingEnabled = patch.thinking
  if (patch.ultracode !== undefined) flags.ultracode = patch.ultracode
  return flags
}

// Configurações depois da troca. Chave sem valor não apaga a atual.
export function mergeSettings(current: ChatSettings, patch: Partial<ChatSettings>): ChatSettings {
  return { ...current, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) }
}
