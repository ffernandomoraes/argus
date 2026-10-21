import { memo } from 'react'
import { NodeResizer, useStore, type NodeProps, type ReactFlowState } from '@xyflow/react'
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus } from 'lucide-react'
import { findAccount, useAuth } from '../auth/useAuth'
import { parseAgentRef, PROVIDER_NAMES } from '../../../shared/providers'
import { AgentIcon } from '../icons/AgentIcon'
import { ClaudeIcon } from '../icons/ClaudeIcon'
import { useProviders } from '../providers/useProviders'
import { usePreference } from '../settings/preferences'
import { shallowEqual } from '../lib/shallowEqual'
import { Tooltip } from '../ui/Tooltip'
import { sameNodeProps } from './blocks/sameNodeProps'
import { useCanvasActions } from './CanvasContext'
import { EditableName } from './EditableName'
import { useSessionsOf } from './sessionsStore'
import type { AreaNode as AreaNodeType } from './types'
import { useIsDropTarget } from './useCanvasView'
import { tr } from '../i18n'

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
      <span>{paths.length === 1 ? tr('1 instância', '1 instance') : tr(`${paths.length} instâncias`, `${paths.length} instances`)}</span>
      {needsYou && <span className="size-1.5 rounded-full bg-needs-you" title={tr('Alguma instância precisa de você', 'An instance needs you')} />}
      {running && (
        <span className="size-1.5 rounded-full bg-running motion-safe:animate-pulse" title={tr('Alguma instância rodando', 'An instance is running')} />
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
        aria-label={tr('Mostrar conteúdo', 'Show content')}
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
        <Tooltip label={tr('Mostrar conteúdo', 'Show content')} />
      </button>
    </div>
  )
}

// Conta do Claude que vale no grupo (a escolhida ou a padrão), ao lado do nome. Com uma conta
// só, não há o que mostrar.
function AccountTag({ account, color }: { account?: string; color: string }) {
  const auth = useAuth()
  const providers = useProviders()
  const multiAgents = usePreference('multiAgents')
  const ref = multiAgents ? parseAgentRef(account) : null
  if (ref) {
    const { accounts, defaultId } = providers?.providers[ref.provider] ?? { accounts: [], defaultId: null }
    const chosen = accounts.find((a) => a.id === ref.account) ?? accounts.find((a) => a.id === defaultId)
    const name = `${PROVIDER_NAMES[ref.provider]}${chosen && accounts.length > 1 ? ` - ${chosen.name}` : ''}`
    return (
      <Tag color={color} title={tr(`Agente deste grupo: ${name}`, `Agent for this group: ${name}`)}>
        <AgentIcon provider={ref.provider} size={10} />
        <span className="truncate">{name}</span>
      </Tag>
    )
  }
  // Com o experimento ligado, o Claude aparece mesmo com uma conta só: deixa claro qual agente roda.
  const current = auth && (auth.accounts.length > 1 || multiAgents) ? findAccount(auth, ref ? undefined : account) : undefined
  if (!current) return null
  return (
    <Tag color={color} title={tr(`Conta do Claude deste grupo: ${current.name}`, `Claude account for this group: ${current.name}`)}>
      <ClaudeIcon size={10} />
      <span className="truncate">{current.name}</span>
    </Tag>
  )
}

function Tag({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
  return (
    <span
      title={title}
      className="flex max-w-48 shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, var(--color-bg))`
      }}
    >
      {children}
    </span>
  )
}

// Botão do grupo, acima da borda: quadrado com a borda na cor do grupo.
function GroupButton({ label, color, onClick, children }: { label: string; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="nodrag flex size-6 items-center justify-center rounded-lg border bg-bg opacity-80 hover:bg-surface-2 hover:opacity-100"
      style={{ color, borderColor: `color-mix(in srgb, ${color} 50%, transparent)` }}
    >
      {children}
    </button>
  )
}

function AreaNodeView({ id, data, selected }: NodeProps<AreaNodeType>) {
  const { toggleGroup, toggleObscure, startRename, newGroupConversation } = useCanvasActions()
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

      {/* Fora da caixa, logo acima da borda (AREA_OUTSET): o nome numa etiqueta cheia na cor do grupo
          e a conta, à esquerda; à direita, conversa nova do grupo todo, ocultar e recolher, cada um
          num botão. */}
      <div className="absolute bottom-full left-0 right-0 z-10 mb-1.5 flex items-center gap-1.5">
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
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <GroupButton label={tr('Nova conversa do grupo', 'New group chat')} color={color} onClick={() => newGroupConversation(id)}>
            <Plus size={13} />
          </GroupButton>
          <GroupButton
            label={obscured ? tr('Mostrar conteúdo', 'Show content') : tr('Ocultar conteúdo', 'Hide content')}
            color={color}
            onClick={() => toggleObscure(id)}
          >
            <Visibility size={13} />
          </GroupButton>
          <GroupButton label={collapsed ? tr('Expandir grupo', 'Expand group') : tr('Recolher grupo', 'Collapse group')} color={color} onClick={() => toggleGroup(id)}>
            <Chevron size={13} />
          </GroupButton>
        </div>
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
