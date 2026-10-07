import { ViewportPortal, useStore } from '@xyflow/react'
import type { Guide } from './snapping'

// Linhas-guia do encaixe, desenhadas dentro do canvas (acompanham zoom e posição).
export function AlignmentGuides({ guides }: { guides: Guide[] }) {
  // Espessura de 1px na tela em qualquer zoom.
  const thickness = useStore((s) => 1 / s.transform[2])
  if (guides.length === 0) return null

  return (
    <ViewportPortal>
      {guides.map((g, i) => (
        <div
          key={i}
          className="pointer-events-none absolute left-0 top-0 z-[10000] bg-guide"
          style={
            g.axis === 'x'
              ? { transform: `translate(${g.at}px, ${g.from}px)`, width: thickness, height: g.to - g.from }
              : { transform: `translate(${g.from}px, ${g.at}px)`, width: g.to - g.from, height: thickness }
          }
        />
      ))}
    </ViewportPortal>
  )
}
