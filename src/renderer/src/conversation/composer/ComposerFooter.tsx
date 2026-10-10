import { ContextRing } from '../../canvas/ContextRing'
import { IconButton } from '../../ui/IconButton'
import { ModelEffortPicker } from '../ModelEffortPicker'
import { PermissionModePicker } from '../PermissionModePicker'
import type { SessionSettings } from '../SessionSettings'

// Fora da caixa de texto: comandos, modelo e esforço e o contexto à esquerda, modo à direita.
// No chat reduzido (modo design), o esforço fica sem as bolinhas e o contexto sem a palavra.
export function ComposerFooter({
  onOpenCommands,
  settings,
  onSettingChange,
  contextPercent,
  compact
}: {
  onOpenCommands: () => void
  settings: SessionSettings
  onSettingChange: (patch: Partial<SessionSettings>) => void
  contextPercent: number
  compact: boolean
}) {
  return (
    <div className="mt-1.5 flex items-center justify-between whitespace-nowrap">
      <div className="flex items-center gap-1">
        <IconButton label="Comandos" title="Comandos ( / )" size="sm" onClick={onOpenCommands} className="font-mono text-xs">
          /
        </IconButton>
        <ModelEffortPicker settings={settings} onChange={onSettingChange} dots={!compact} />
        <span className="flex items-center gap-1 px-1 text-[11px] text-faint">
          <ContextRing percent={contextPercent} />
          {!compact && 'contexto'}
        </span>
      </div>
      <PermissionModePicker value={settings.permissionMode} onChange={(permissionMode) => onSettingChange({ permissionMode })} />
    </div>
  )
}
