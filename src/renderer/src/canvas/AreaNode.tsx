import { memo } from 'react'
import { NodeResizer, useStore, type NodeProps, type ReactFlowState } from '@xyflow/react'
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'
import { findAccount, useAuth } from '../auth/useAuth'
import { ClaudeIcon } from '../icons/ClaudeIcon'
import { shallowEqual } from '../lib/shallowEqual'
import { Tooltip } from '../ui/Tooltip'
import { sameNodeProps } from './blocks/sameNodeProps'
import { useCanvasActions } from './CanvasContext'
import { EditableName } from './EditableName'
import { useSessionsOf } from './sessionsStore'
import type { AreaNode as AreaNodeType } from './types'
import { useIsDropTarget } from './useCanvasView'

// Pastas de dentro do grupo. Lida por seletor e comparada item a item: arrastar qualquer bloco
// muda a lista de nós a cada quadro, mas só redesenha o resumo quando entra ou sai uma pasta.
const projectPathsIn = (s: ReactFlowState, id: string) =>
  s.nodes.flatMap((n) => (n.parentId === id && n.type === 'project' ? [(n.data as { path: string }).path] : []))

// As pastas escondidas não estão na tela: o resumo observa as listas delas (useSessionsOf) e
// redesenha só quando alguma muda.
function CollapsedSummary({ id }: { id: string }) {
  const paths = useStore((s) => projectPathsIn(s, id), shallowEqual)
  const sessions = useSessionsOf(paths).flat()
  const needsYou = sessions.some((c) => c.status === 'needs-you')
  const running = sessions.some((c) => c.status === 'running')

  return (
    <span className="flex items-center gap-2 text-[12px] text-faint">
      <span>{paths.length === 1 ? '1 instância' : `${paths.length} instâncias`}</span>
      {needsYou && <span className="size-1.5 rounded-full bg-needs-you" title="Alguma instância precisa de você" />}
      {running && (
        <span className="size-1.5 rounded-full bg-running motion-safe:animate-pulse" title="Alguma instância rodando" />
      )}
    </span>
  )
}

// Conteúdo oculto: listras diagonais na área do grupo e um olho fechado no meio, que revela ao clicar.
function HiddenContent({ id, color }: { id: string; color: string }) {
  const { toggleObscure } = useCanvasActions()
  const stripe = `color-mix(in srgb, ${color} 14%, transparent)`
  return (
    <div
      className="absolute inset-0 flex items-center justify-center rounded-2xl"
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
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, var(--color-bg))`
      }}
    >
      <ClaudeIcon size={10} />
      <span className="truncate">{current.name}</span>
    </span>
  )
}

function AreaNodeView({ id, data, selected }: NodeProps<AreaNodeType>) {
  const { toggleGroup, toggleObscure, startRename } = useCanvasActions()
  const receiving = useIsDropTarget(id)
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

      {/* Nome numa etiqueta cheia na cor do grupo, em cima da borda, no canto esquerdo. */}
      <div className="absolute left-4 right-24 top-0 z-10 flex -translate-y-1/2 items-center gap-1.5">
        {/* Dois cliques no nome renomeiam o grupo. */}
        <div
          onDoubleClick={(e) => {
            e.stopPropagation()
            startRename(id)
          }}
          className="flex h-6 min-w-0 max-w-full items-center rounded-full px-3 text-white shadow-sm [&_input]:text-text"
          // Escurecida para o branco ler bem: com 35% de preto toda a paleta passa de 4,5:1 (o âmbar fica em ~4,7).
          style={{ background: `color-mix(in srgb, ${color} 65%, black)` }}
        >
          {/* Sempre em maiúsculas, também ao renomear; o nome salvo fica como foi digitado. */}
          <EditableName id={id} value={data.label} className="text-[12px] font-semibold uppercase tracking-wide" />
        </div>
        <AccountTag account={data.account} color={color} />
      </div>

      {/* Ocultar e recolher, também em cima da borda, no canto direito. */}
      <div
        className="absolute right-4 top-0 z-10 flex -translate-y-1/2 items-center rounded-lg border bg-bg p-0.5"
        style={{ borderColor: `color-mix(in srgb, ${color} 50%, transparent)` }}
      >
        <button
          aria-label={obscured ? 'Mostrar conteúdo' : 'Ocultar conteúdo'}
          title={obscured ? 'Mostrar conteúdo' : 'Ocultar conteúdo'}
          onClick={(e) => {
            e.stopPropagation()
            toggleObscure(id)
          }}
          className="nodrag flex size-5 items-center justify-center rounded-md opacity-70 hover:bg-surface-2 hover:opacity-100"
          style={{ color }}
        >
          <Visibility size={13} />
        </button>
        <button
          aria-label={collapsed ? 'Expandir grupo' : 'Recolher grupo'}
          onClick={(e) => {
            e.stopPropagation()
            toggleGroup(id)
          }}
          className="nodrag flex size-5 items-center justify-center rounded-md opacity-70 hover:bg-surface-2 hover:opacity-100"
          style={{ color }}
        >
          <Chevron size={13} />
        </button>
      </div>

      {/* Recebendo um bloco arrastado: borda na cor cheia e fundo mais forte, para avisar onde ele vai entrar. */}
      <div
        className="flex h-full w-full items-center rounded-2xl border px-3 pt-1 transition-[background-color,border-color,box-shadow] duration-150"
        style={{
          borderColor: receiving ? color : `color-mix(in srgb, ${color} 50%, transparent)`,
          background: `color-mix(in srgb, ${color} ${receiving ? 14 : collapsed ? 8 : 6}%, ${collapsed ? 'var(--color-surface)' : 'transparent'})`,
          boxShadow: receiving ? `0 0 0 3px color-mix(in srgb, ${color} 25%, transparent)` : undefined
        }}
      >
        {collapsed && <CollapsedSummary id={id} />}
        {obscured && !collapsed && <HiddenContent id={id} color={color} />}
      </div>
    </>
  )
}

// Arrastar o grupo não redesenha o conteúdo dele (ver sameNodeProps).
export const AreaNode = memo(AreaNodeView, sameNodeProps)
