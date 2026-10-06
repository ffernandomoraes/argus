import { NodeResizer, useNodes, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useCanvasActions } from './CanvasContext'
import { EditableName } from './EditableName'
import { getSessions, useSessionsVersion } from './sessionsStore'
import type { AreaNode as AreaNodeType, CanvasNode } from './types'

function CollapsedSummary({ id }: { id: string }) {
  const nodes = useNodes<CanvasNode>()
  const children = nodes.filter((n) => n.parentId === id && n.type === 'project')
  useSessionsVersion()
  const sessions = children.flatMap((n) => (n.type === 'project' ? getSessions(n.data.path) : []))
  const needsYou = sessions.some((c) => c.status === 'needs-you')
  const running = sessions.some((c) => c.status === 'running')

  return (
    <span className="flex items-center gap-2 text-[11px] text-faint">
      <span>{children.length === 1 ? '1 instância' : `${children.length} instâncias`}</span>
      {needsYou && <span className="size-1.5 rounded-full bg-needs-you" title="Alguma instância precisa de você" />}
      {running && <span className="size-1.5 animate-pulse rounded-full bg-running" title="Alguma instância rodando" />}
    </span>
  )
}

export function AreaNode({ id, data, selected }: NodeProps<AreaNodeType>) {
  const { toggleGroup } = useCanvasActions()
  const color = data.color
  const collapsed = !!data.collapsed
  const Chevron = collapsed ? ChevronDown : ChevronUp

  return (
    <>
      <NodeResizer
        isVisible={selected && !collapsed}
        minWidth={320}
        minHeight={200}
        lineStyle={{ borderColor: color }}
        handleStyle={{ background: color, border: 'none', width: 8, height: 8 }}
      />

      {/* Nome e setinha ficam acima do grupo, fora da borda */}
      <div className="absolute bottom-full left-0 right-0 mb-1.5 flex items-end justify-between gap-2">
        <div
          className="flex min-w-0 max-w-full items-center rounded-md px-2 py-0.5"
          style={{ color, background: `color-mix(in srgb, ${color} 22%, var(--color-bg))` }}
        >
          <EditableName id={id} value={data.label} className="text-[11px] font-semibold uppercase tracking-widest" />
        </div>
        <button
          aria-label={collapsed ? 'Expandir grupo' : 'Recolher grupo'}
          onClick={(e) => {
            e.stopPropagation()
            toggleGroup(id)
          }}
          className="nodrag flex size-6 shrink-0 items-center justify-center rounded-md opacity-70 hover:bg-surface-2 hover:opacity-100"
          style={{ color }}
        >
          <Chevron size={14} />
        </button>
      </div>

      <div
        className="flex h-full w-full items-center rounded-xl border border-dashed px-3"
        style={{
          borderColor: `color-mix(in srgb, ${color} ${collapsed ? 55 : 45}%, transparent)`,
          background: `color-mix(in srgb, ${color} ${collapsed ? 8 : 4}%, ${collapsed ? 'var(--color-surface)' : 'transparent'})`
        }}
      >
        {collapsed && <CollapsedSummary id={id} />}
      </div>
    </>
  )
}
