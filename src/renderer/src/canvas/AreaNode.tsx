import { NodeResizer, useNodes, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'
import { findAccount, useAuth } from '../auth/useAuth'
import { ClaudeIcon } from '../icons/ClaudeIcon'
import { useCanvasActions } from './CanvasContext'
import { EditableName } from './EditableName'
import { Tooltip } from './NavBar'
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
    <span className="flex items-center gap-2 text-[12px] text-faint">
      <span>{children.length === 1 ? '1 instância' : `${children.length} instâncias`}</span>
      {needsYou && <span className="size-1.5 rounded-full bg-needs-you" title="Alguma instância precisa de você" />}
      {running && <span className="size-1.5 animate-pulse rounded-full bg-running" title="Alguma instância rodando" />}
    </span>
  )
}

// Conteúdo oculto: listras diagonais na área do grupo e um olho fechado no meio, que revela ao clicar.
function HiddenContent({ id, color }: { id: string; color: string }) {
  const { toggleObscure } = useCanvasActions()
  const stripe = `color-mix(in srgb, ${color} 14%, transparent)`
  return (
    <div
      className="absolute inset-0 flex items-center justify-center rounded-xl"
      style={{ background: `repeating-linear-gradient(-45deg, ${stripe} 0 2px, transparent 2px 14px)` }}
    >
      <button
        aria-label="Mostrar conteúdo"
        onClick={(e) => {
          e.stopPropagation()
          toggleObscure(id)
        }}
        className="nodrag group relative flex size-10 items-center justify-center rounded-md border hover:brightness-110"
        style={{
          color,
          background: `color-mix(in srgb, ${color} 10%, var(--color-surface))`,
          borderColor: `color-mix(in srgb, ${color} 35%, transparent)`
        }}
      >
        <EyeOff size={18} />
        <Tooltip label="Mostrar conteúdo" />
      </button>
    </div>
  )
}

// Conta do Claude que vale no grupo (a escolhida ou a padrão), ao lado do nome. Com uma conta
// só, não há o que mostrar.
function AccountTag({ account, color }: { account?: string; color: string }) {
  const auth = useAuth()
  const current = auth && auth.accounts.length > 1 ? findAccount(auth, account) : undefined
  if (!current) return null
  return (
    <span
      title={`Conta do Claude deste grupo: ${current.name}`}
      className="flex max-w-40 shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium"
      style={{ color, borderColor: `color-mix(in srgb, ${color} 35%, transparent)` }}
    >
      <ClaudeIcon size={10} />
      <span className="truncate">{current.name}</span>
    </span>
  )
}

export function AreaNode({ id, data, selected }: NodeProps<AreaNodeType>) {
  const { toggleGroup, toggleObscure, dropTargetId, startRename } = useCanvasActions()
  const receiving = dropTargetId === id
  const color = data.color
  const collapsed = !!data.collapsed
  const Chevron = collapsed ? ChevronDown : ChevronUp
  const obscured = !!data.obscured
  const Visibility = obscured ? EyeOff : Eye

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
        <div className="flex min-w-0 items-center gap-1.5">
          {/* Dois cliques no nome renomeiam o grupo. */}
          <div
            onDoubleClick={(e) => {
              e.stopPropagation()
              startRename(id)
            }}
            className="flex min-w-0 max-w-full items-center rounded-md px-2 py-0.5"
            style={{ color, background: `color-mix(in srgb, ${color} 22%, var(--color-bg))` }}
          >
            <EditableName id={id} value={data.label} className="text-[12px] font-semibold uppercase tracking-widest" />
          </div>
          <AccountTag account={data.account} color={color} />
        </div>
        <div className="flex shrink-0 items-center">
          <button
            aria-label={obscured ? 'Mostrar conteúdo' : 'Ocultar conteúdo'}
            title={obscured ? 'Mostrar conteúdo' : 'Ocultar conteúdo'}
            onClick={(e) => {
              e.stopPropagation()
              toggleObscure(id)
            }}
            className="nodrag flex size-6 items-center justify-center rounded-md opacity-70 hover:bg-surface-2 hover:opacity-100"
            style={{ color }}
          >
            <Visibility size={14} />
          </button>
          <button
            aria-label={collapsed ? 'Expandir grupo' : 'Recolher grupo'}
            onClick={(e) => {
              e.stopPropagation()
              toggleGroup(id)
            }}
            className="nodrag flex size-6 items-center justify-center rounded-md opacity-70 hover:bg-surface-2 hover:opacity-100"
            style={{ color }}
          >
            <Chevron size={14} />
          </button>
        </div>
      </div>

      {/* Recebendo um bloco arrastado: borda cheia e fundo mais forte, para avisar onde ele vai entrar. */}
      <div
        className={`flex h-full w-full items-center rounded-xl border px-3 transition-[background-color,border-color,box-shadow] duration-150 ${
          receiving ? 'border-solid' : 'border-dashed'
        }`}
        style={{
          borderColor: receiving ? color : `color-mix(in srgb, ${color} ${collapsed ? 55 : 45}%, transparent)`,
          background: `color-mix(in srgb, ${color} ${receiving ? 14 : collapsed ? 8 : 4}%, ${collapsed ? 'var(--color-surface)' : 'transparent'})`,
          boxShadow: receiving ? `0 0 0 3px color-mix(in srgb, ${color} 25%, transparent)` : undefined
        }}
      >
        {collapsed && <CollapsedSummary id={id} />}
        {obscured && !collapsed && <HiddenContent id={id} color={color} />}
      </div>
    </>
  )
}
