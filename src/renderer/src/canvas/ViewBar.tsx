import { memo, useState } from 'react'
import { MiniMap, Panel, useReactFlow, useStore, type Node } from '@xyflow/react'
import { Map as MapIcon, Maximize, Minus, Plus } from 'lucide-react'
import { NavButton } from '../ui/NavButton'
import { MENU_HOVER, MENU_ROW } from '../ui/menuStyles'
import type { AreaNode } from './types'
import { useFitAll, ZOOM_DURATION } from './useCanvasShortcuts'

// Só muda quando um grupo muda: arrastar uma pasta não redesenha a barra.
const sameGroups = (a: AreaNode[], b: AreaNode[]) => a.length === b.length && a.every((g, i) => g === b[i])

// Zoom, "ver tudo" e minimapa juntos no canto inferior direito; o minimapa abre acima da barra.
export const ViewBar = memo(function ViewBar() {
  const [mapOpen, setMapOpen] = useState(false)
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow()
  const fitAll = useFitAll()
  const zoom = useStore((s) => s.transform[2])
  const groups = useStore((s) => s.nodes.filter((n): n is AreaNode => n.type === 'area'), sameGroups)
  const colorOf = new Map(groups.map((g) => [g.id, g.data.color]))
  // Em ordem alfabética: com muitos grupos, acha-se pelo nome.
  const anchors = [...groups].sort((a, b) => a.data.label.localeCompare(b.data.label, 'pt-BR'))

  // No minimapa, o grupo é a área tingida na cor dele e o que está dentro, a cor cheia; fora de
  // grupo, o cinza padrão.
  const nodeColor = (node: Node) => {
    if (node.type === 'area') return `color-mix(in srgb, ${colorOf.get(node.id)} 22%, transparent)`
    const color = node.parentId ? colorOf.get(node.parentId) : undefined
    return color ? `color-mix(in srgb, ${color} 85%, transparent)` : 'var(--color-line-strong)'
  }

  const goToGroup = (id: string) => {
    void fitView({ nodes: [{ id }], padding: 0.15, maxZoom: 1, duration: 300 })
    setMapOpen(false)
  }

  return (
    <Panel position="bottom-right" className="!m-4">
      <div className={`flex flex-col gap-1 border border-line bg-surface/90 p-1 shadow-md shadow-black/20 backdrop-blur-xl ${mapOpen ? 'rounded-2xl' : 'rounded-xl'}`}>
        {/* Âncoras: um clique leva ao grupo e recolhe o minimapa. */}
        {mapOpen && anchors.length > 0 && (
          <div className="flex max-h-36 w-[196px] flex-col overflow-y-auto">
            {anchors.map((g) => (
              <button key={g.id} onClick={() => goToGroup(g.id)} className={`${MENU_ROW} ${MENU_HOVER} text-text`}>
                <span className="size-2 shrink-0 rounded-full" style={{ background: g.data.color }} />
                <span className="truncate">{g.data.label}</span>
              </button>
            ))}
          </div>
        )}
        {mapOpen && (
          <MiniMap
            pannable
            zoomable
            nodeColor={nodeColor}
            className="!rounded-xl !border-0"
            style={{ position: 'relative', margin: 0, width: 196, height: 120 }}
          />
        )}
        <div className="flex items-center justify-between gap-0.5">
          <NavButton label="Diminuir zoom" shortcut="⌘ −" compact side="top" onClick={() => zoomOut({ duration: ZOOM_DURATION })}>
            <Minus size={14} />
          </NavButton>
          <NavButton label="Zoom em 100%" shortcut="⇧ 0" compact side="top" onClick={() => zoomTo(1, { duration: ZOOM_DURATION })}>
            <span className="px-1 font-mono text-[11px]">{Math.round(zoom * 100)}%</span>
          </NavButton>
          <NavButton label="Aumentar zoom" shortcut="⌘ +" compact side="top" onClick={() => zoomIn({ duration: ZOOM_DURATION })}>
            <Plus size={14} />
          </NavButton>
          <NavButton label="Ver tudo" shortcut="⇧ 1" compact side="top" onClick={fitAll}>
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
            <MapIcon size={14} />
          </NavButton>
        </div>
      </div>
    </Panel>
  )
})
