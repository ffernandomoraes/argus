import type { EventKind } from '../../../shared/history'
import type { ClaudeModel } from '../../../shared/models'
import { EFFORTS } from './modelOptions'
import { MODES } from './permissionModes'
import type { SessionSettings } from './SessionSettings'

// Divisor no chat para cada troca feita nos seletores, como na extensão do VS Code: o texto de
// cada um ("Modelo: Opus 5.5", "Esforço: Alto"...).
export function settingChangeEvents(patch: Partial<SessionSettings>, models: ClaudeModel[]): { kind: EventKind; text: string }[] {
  const out: { kind: EventKind; text: string }[] = []
  if (patch.model !== undefined) {
    const m = models.find((x) => x.value === patch.model)
    const name = m?.value === '' ? `Padrão${m.resolvedName ? ` (${m.resolvedName})` : ''}` : (m?.displayName ?? patch.model)
    out.push({ kind: 'model', text: `Modelo: ${name}` })
  }
  if (patch.effort !== undefined) {
    out.push({ kind: 'effort', text: `Esforço: ${EFFORTS.find((e) => e.value === patch.effort)?.label ?? 'automático'}` })
  }
  if (patch.permissionMode !== undefined) {
    out.push({ kind: 'mode', text: `Modo: ${MODES.find((x) => x.value === patch.permissionMode)?.label ?? 'padrão da conta'}` })
  }
  if (patch.thinking !== undefined) out.push({ kind: 'thinking', text: `Raciocínio ${patch.thinking ? 'ligado' : 'desligado'}` })
  if (patch.ultracode !== undefined) out.push({ kind: 'ultracode', text: `Ultracode ${patch.ultracode ? 'ligado' : 'desligado'}` })
  return out
}
