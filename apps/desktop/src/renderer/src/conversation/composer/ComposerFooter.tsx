import { ContextRing } from '../../canvas/ContextRing'
import { ModelEffortPicker } from '../ModelEffortPicker'
import { PermissionModePicker } from '../PermissionModePicker'
import type { SessionSettings } from '../SessionSettings'
import { tr } from '../../i18n'

// Fora da caixa de texto: o contexto à esquerda; modelo e esforço e o modo à direita.
export function ComposerFooter({
  settings,
  onSettingChange,
  contextPercent
}: {
  settings: SessionSettings
  onSettingChange: (patch: Partial<SessionSettings>) => void
  contextPercent: number
}) {
  return (
    <div className="mt-1.5 flex items-center justify-between whitespace-nowrap">
      <span className="flex items-center gap-1 px-1 text-xs text-faint">
        <ContextRing percent={contextPercent} />
        {tr('contexto', 'context')}
      </span>
      <div className="flex items-center gap-1">
        <ModelEffortPicker settings={settings} onChange={onSettingChange} />
        <PermissionModePicker value={settings.permissionMode} onChange={(permissionMode) => onSettingChange({ permissionMode })} />
      </div>
    </div>
  )
}
