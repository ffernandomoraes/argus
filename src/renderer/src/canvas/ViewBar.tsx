import { useState } from 'react'
import { MiniMap, Panel, useReactFlow, useStore } from '@xyflow/react'
import { Map, Maximize, Minus, Plus } from 'lucide-react'
import { NavButton } from './NavBar'
import { FIT_OPTIONS, ZOOM_DURATION } from './useCanvasShortcuts'

// Zoom, "ver tudo" e minimapa juntos no canto inferior direito; o minimapa abre acima da barra.
export function ViewBar() {
  const [mapOpen, setMapOpen] = useState(false)
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow()
  const zoom = useStore((s) => s.transform[2])

  return (
    <Panel position="bottom-right" className="!m-4">
      <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-1 shadow-md shadow-black/20">
        {mapOpen && (
          <MiniMap
            pannable
            zoomable
            className="!rounded-md !border-0"
            style={{ position: 'relative', margin: 0, width: 196, height: 120 }}
          />
        )}
        <div className="flex items-center justify-between gap-0.5">
          <NavButton label="Diminuir zoom" shortcut="⌘ −" compact side="top" onClick={() => zoomOut({ duration: ZOOM_DURATION })}>
            <Minus size={14} />
          </NavButton>
          <NavButton label="Zoom em 100%" shortcut="⇧ 0" compact side="top" onClick={() => zoomTo(1, { duration: ZOOM_DURATION })}>
            <span className="px-1 font-mono text-[10px]">{Math.round(zoom * 100)}%</span>
          </NavButton>
          <NavButton label="Aumentar zoom" shortcut="⌘ +" compact side="top" onClick={() => zoomIn({ duration: ZOOM_DURATION })}>
            <Plus size={14} />
          </NavButton>
          <NavButton label="Ver tudo" shortcut="⇧ 1" compact side="top" onClick={() => fitView(FIT_OPTIONS)}>
            <Maximize size={14} />
          </NavButton>
          <span className="mx-0.5 h-4 w-px bg-line" />
          <NavButton
            label={mapOpen ? 'Recolher minimapa' : 'Mostrar minimapa'}
            side="top-end"
            compact
            selected={mapOpen}
            onClick={() => setMapOpen((o) => !o)}
          >
            <Map size={14} />
          </NavButton>
        </div>
      </div>
    </Panel>
  )
}
