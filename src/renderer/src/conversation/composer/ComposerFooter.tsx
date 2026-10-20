import { ContextRing } from '../../canvas/ContextRing'
import { ModelEffortPicker } from '../ModelEffortPicker'
import { PermissionModePicker } from '../PermissionModePicker'
import type { SessionSettings } from '../SessionSettings'
import { tr } from '../../i18n'

// Fora da caixa de texto: o contexto à esquerda; modelo e esforço e o modo à direita.
// No chat reduzido (modo design), o esforço fica sem as bolinhas e o contexto sem a palavra.
export function ComposerFooter({
  settings,
  onSettingChange,
  contextPercent,
  compact
}: {
  settings: SessionSettings
  onSettingChange: (patch: Partial<SessionSettings>) => void
  contextPercent: number
  compact: boolean
}) {
  return (
    <div className="mt-1.5 flex items-center justify-between whitespace-nowrap">
      <span className="flex items-center gap-1 px-1 text-xs text-faint">
        <ContextRing percent={contextPercent} />
        {!compact && tr('contexto', 'context')}
      </span>
      <div className="flex items-center gap-1">
        <ModelEffortPicker settings={settings} onChange={onSettingChange} dots={!compact} />
        <PermissionModePicker value={settings.permissionMode} onChange={(permissionMode) => onSettingChange({ permissionMode })} />
      </div>
    </div>
  )
}
