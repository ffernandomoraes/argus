import { Monitor, Smartphone, X } from 'lucide-react'
import type { DesignDevice } from '../../../shared/design'

const DEVICES: { value: DesignDevice; label: string }[] = [
  { value: 'desktop', label: 'Ver no desktop' },
  { value: 'mobile', label: 'Ver no celular' }
]

// Visualizar: só a largura da página e o sair, flutuando por cima da página na altura da barra de
// endereço, à direita dela. Escuros e translúcidos, para ler sobre qualquer página.
export function ViewingControls({
  device,
  onDevice,
  onExit
}: {
  device: DesignDevice
  onDevice: (device: DesignDevice) => void
  onExit: () => void
}) {
  return (
    <div className="absolute right-2 top-1 z-30 flex items-center gap-1.5 opacity-60 hover:opacity-100">
      <div className="flex rounded-lg bg-black/55 p-0.5 shadow-lg backdrop-blur">
        {DEVICES.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => onDevice(d.value)}
            title={d.label}
            aria-label={d.label}
            aria-pressed={device === d.value}
            className={`grid size-6 place-items-center rounded-md text-white ${device === d.value ? 'bg-white/25' : 'hover:bg-white/10'}`}
          >
            {d.value === 'desktop' ? <Monitor size={13} /> : <Smartphone size={13} />}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onExit}
        title="Sair da visualização (Esc)"
        aria-label="Sair da visualização"
        className="grid size-7 place-items-center rounded-md bg-black/55 text-white shadow-lg backdrop-blur"
      >
        <X size={14} />
      </button>
    </div>
  )
}
