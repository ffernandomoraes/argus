import type { EventKind } from '../../../shared/history'
import type { ClaudeModel } from '../../../shared/models'
import { EFFORTS } from './modelOptions'
import { MODES } from './permissionModes'
import type { SessionSettings } from './SessionSettings'
import { tr } from '../i18n'

// Divisor no chat para cada troca feita nos seletores, como na extensão do VS Code: o texto de
// cada um ("Modelo: Opus 5.5", "Esforço: Alto"...).
export function settingChangeEvents(patch: Partial<SessionSettings>, models: ClaudeModel[]): { kind: EventKind; text: string }[] {
  const out: { kind: EventKind; text: string }[] = []
  if (patch.model !== undefined) {
    const m = models.find((x) => x.value === patch.model)
    const name = m?.value === '' ? `${tr('Padrão', 'Default')}${m.resolvedName ? ` (${m.resolvedName})` : ''}` : (m?.displayName ?? patch.model)
    out.push({ kind: 'model', text: tr(`Modelo: ${name}`, `Model: ${name}`) })
  }
  if (patch.effort !== undefined) {
    const effort = EFFORTS.find((e) => e.value === patch.effort)?.label
    out.push({ kind: 'effort', text: tr(`Esforço: ${effort ?? 'automático'}`, `Effort: ${effort ?? 'automatic'}`) })
  }
  if (patch.permissionMode !== undefined) {
    const mode = MODES.find((x) => x.value === patch.permissionMode)?.label
    out.push({ kind: 'mode', text: tr(`Modo: ${mode ?? 'padrão da conta'}`, `Mode: ${mode ?? 'account default'}`) })
  }
  if (patch.thinking !== undefined) out.push({ kind: 'thinking', text: patch.thinking ? tr('Raciocínio ligado', 'Thinking on') : tr('Raciocínio desligado', 'Thinking off') })
  if (patch.ultracode !== undefined) out.push({ kind: 'ultracode', text: patch.ultracode ? tr('Ultracode ligado', 'Ultracode on') : tr('Ultracode desligado', 'Ultracode off') })
  if (patch.orchestrator !== undefined) out.push({ kind: 'orchestrator', text: patch.orchestrator ? tr('Orquestrador ligado', 'Orchestrator on') : tr('Orquestrador desligado', 'Orchestrator off') })
  return out
}
