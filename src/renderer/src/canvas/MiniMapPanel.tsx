import { useState } from 'react'
import { MiniMap, Panel } from '@xyflow/react'
import { ChevronDown, Map } from 'lucide-react'

export function MiniMapPanel() {
  const [open, setOpen] = useState(false)

  return (
    <Panel position="bottom-right" className="!m-4">
      {open ? (
        <div className="group relative">
          <MiniMap
            pannable
            zoomable
            style={{ position: 'relative', margin: 0, width: 160, height: 104 }}
          />
          <button
            aria-label="Recolher minimapa"
            onClick={() => setOpen(false)}
            className="absolute right-1 top-1 z-10 flex size-6 items-center justify-center rounded-md bg-surface-2/90 text-muted opacity-60 hover:text-text group-hover:opacity-100"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      ) : (
        <button
          aria-label="Mostrar minimapa"
          onClick={() => setOpen(true)}
          className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-muted shadow-xl shadow-black/40 hover:text-text"
        >
          <Map size={16} />
        </button>
      )}
    </Panel>
  )
}
