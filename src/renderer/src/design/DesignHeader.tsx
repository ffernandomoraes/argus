import { Folder, Monitor, PenTool, Smartphone, X } from 'lucide-react'
import type { DesignDevice } from '../../../shared/design'
import { Segmented } from '../settings/controls'
import { IconButton } from '../ui/IconButton'

const NOT_STARTED = 'Comece o protótipo primeiro'

// Barra de cima do drawer do design: o nome e a pasta, a largura da página (desktop ou celular) e
// fechar. Visualizar fica na barra de endereço da página.
export function DesignHeader({
  name,
  projectName,
  device,
  started,
  tint,
  onDevice,
  onClose
}: {
  name?: string
  projectName: string
  device: DesignDevice
  // Antes de começar não há página: a troca de largura fica apagada.
  started: boolean
  // Cor do grupo de onde o design abriu.
  tint?: string
  onDevice: (device: DesignDevice) => void
  onClose: () => void
}) {
  return (
    <div
      className="no-drag nodrag grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line px-3"
      style={
        tint
          ? {
              background: `color-mix(in srgb, ${tint} 8%, var(--color-bg))`,
              borderBottomColor: `color-mix(in srgb, ${tint} 25%, var(--color-line))`
            }
          : undefined
      }
    >
      <div className="flex min-w-0 items-center gap-2 justify-self-start">
        <PenTool size={13} className="shrink-0 text-muted" />
        <span className="truncate text-[13px] font-medium">{name ?? 'Design'}</span>
        <span className="flex min-w-0 items-center gap-1 text-[12px] text-faint" title={`Projeto ${projectName}`}>
          <Folder size={12} className="shrink-0" />
          <span className="truncate">{projectName}</span>
        </span>
      </div>

      <Segmented
        value={device}
        onChange={onDevice}
        options={[
          { value: 'desktop', label: 'Desktop', icon: <Monitor size={12} />, disabled: !started, title: started ? undefined : NOT_STARTED },
          { value: 'mobile', label: 'Celular', icon: <Smartphone size={12} />, disabled: !started, title: started ? undefined : NOT_STARTED }
        ]}
      />

      <div className="flex min-w-0 items-center justify-self-end gap-1">
        <IconButton label="Fechar" onClick={onClose}>
          <X size={15} />
        </IconButton>
      </div>
    </div>
  )
}
