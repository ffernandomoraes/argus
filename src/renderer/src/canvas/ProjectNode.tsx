import { useLayoutEffect, useRef, useState } from 'react'
import { useStore, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronUp, Folder, List, Loader2, Plus } from 'lucide-react'
import { useCanvasActions } from './CanvasContext'
import { EditableName } from './EditableName'
import { DEFAULT_GROUP_COLOR, INSTANCE_WIDTH } from './factory'
import { PathLabel } from './PathLabel'
import { BranchLabel } from './BranchLabel'
import { ProjectServerButton } from '../devServers/ProjectServerButton'
import { Tooltip } from './NavBar'
import { AgentItem, ConversationItem, useNow } from './ConversationItem'
import { getRunningAgents, useRunningAgentsVersion } from './runningAgents'
import { useBranch, useSessions } from './sessionsStore'
import type { RunningAgent } from '../../../shared/agents'
import type { ConversationSummary, ProjectNode as ProjectNodeType } from './types'

// As conversas mais recentes ficam empilhadas embaixo da pasta; todas abrem pelo botão
// abaixo da lista, no painel flutuante.
const MAX_CONVERSATIONS = 3

// Recolhida, a pasta ainda mostra o que pede atenção, para nenhum aviso sumir junto.
const isActive = (c: ConversationSummary) => c.status === 'running' || c.status === 'needs-you'

// Conversas recuadas e mais estreitas que a pasta, como itens dentro dela. As linhas formam
// uma árvore: descem de baixo da pasta, alinhadas ao ícone de pasta, e entram pela lateral
// esquerda de cada conversa.
const INDENT = 44
// Meio do ícone de pasta: 12px de respiro do cabeçalho + metade do quadradinho de 28px.
const TRUNK = 26
const RADIUS = 6
// Subagente rodando: mais um nível, recuado em relação à conversa que o lançou. A linha sai
// de baixo da conversa, alinhada ao ícone dela (12px de respiro + metade do ícone de 13px).
const SUB_INDENT = 36
const SUB_TRUNK = 18

// Onde a pasta termina e onde fica o meio e a base de cada linha da lista, medidos no layout
// (sem o zoom do canvas), para as linhas acertarem as laterais mesmo quando um bloco muda de altura.
type Middles = { project: number; items: { middle: number; bottom: number }[] }

// Linha da árvore: desce de (x, from) até a altura `to` e entra pela lateral em `end`.
function route(x: number, from: number, to: number, end: number): string {
  return [`M ${x} ${from}`, `V ${to - RADIUS}`, `Q ${x} ${to} ${x + RADIUS} ${to}`, `H ${end}`].join(' ')
}

// Conversas na ordem da lista, cada uma seguida dos subagentes que ela tem rodando agora.
type Row =
  | { kind: 'conversation'; conversation: ConversationSummary }
  | { kind: 'agent'; agent: RunningAgent; conversation: ConversationSummary; parent: number }

function withAgents(conversations: ConversationSummary[]): Row[] {
  const rows: Row[] = []
  for (const conversation of conversations) {
    const parent = rows.length
    rows.push({ kind: 'conversation', conversation })
    for (const agent of getRunningAgents(conversation.id)) rows.push({ kind: 'agent', agent, conversation, parent })
  }
  return rows
}

export function ProjectNode({ id, data, selected, parentId }: NodeProps<ProjectNodeType>) {
  const conversations = useSessions(data.path)
  const branch = useBranch(data.path)
  const collapsed = !!data.collapsed
  const shown = [...conversations]
    .filter((c) => !collapsed || isActive(c))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_CONVERSATIONS)
  // Qualquer conversa do projeto rodando (não só as visíveis na lista) troca a pasta pelo loader.
  const running = conversations.some((c) => c.status === 'running')
  useRunningAgentsVersion()
  const rows = withAgents(shown)
  // Linha e loader da conversa rodando na cor do grupo; grupo cinza (o padrão) conta como sem cor.
  const flowColor = useStore((s) => {
    const group = parentId ? s.nodeLookup.get(parentId) : undefined
    const color = group?.type === 'area' ? (group.data.color as string) : undefined
    return color && color !== DEFAULT_GROUP_COLOR ? color : 'var(--color-running)'
  })
  const now = useNow()
  const { activeConversation, openConversation, newConversation, openAllConversations, poppedOut, toggleProject } =
    useCanvasActions()

  const rootRef = useRef<HTMLDivElement>(null)
  const blockRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [middles, setMiddles] = useState<Middles | null>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const measure = () => {
      const block = blockRef.current
      if (!block) return
      const items = [...(listRef.current?.children ?? [])] as HTMLElement[]
      const next = {
        project: block.offsetTop + block.offsetHeight,
        items: items.map((el) => ({ middle: el.offsetTop + el.offsetHeight / 2, bottom: el.offsetTop + el.offsetHeight }))
      }
      setMiddles((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [rows.length])

  return (
    <div ref={rootRef} className="relative flex flex-col gap-2.5" style={{ width: INSTANCE_WIDTH }}>
      {middles && middles.items.length === rows.length && rows.length > 0 && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute top-0 h-full overflow-visible"
          style={{ left: 0, width: INDENT }}
        >
          {rows.map((row, i) =>
            row.kind === 'conversation' ? (
              <path
                key={i}
                d={route(TRUNK, middles.project, middles.items[i].middle, INDENT)}
                fill="none"
                stroke="var(--color-line-strong)"
                strokeWidth={1.5}
              />
            ) : null
          )}
          {/* Por cima das outras: o caminho até a conversa rodando e até cada subagente, tracejado andando. */}
          {rows.map((row, i) =>
            row.kind === 'agent' ? (
              <path
                key={`agent-${row.agent.id}`}
                d={route(INDENT + SUB_TRUNK, middles.items[row.parent].bottom, middles.items[i].middle, INDENT + SUB_INDENT)}
                fill="none"
                stroke={flowColor}
                strokeWidth={1.5}
                className="conversation-flow"
              />
            ) : row.conversation.status === 'running' ? (
              <path
                key={`running-${i}`}
                d={route(TRUNK, middles.project, middles.items[i].middle, INDENT)}
                fill="none"
                stroke={flowColor}
                strokeWidth={1.5}
                className="conversation-flow"
              />
            ) : null
          )}
        </svg>
      )}

      {/* Branch atual, fora do card: acima do canto esquerdo, na mesma altura e no mesmo estilo das ações. */}
      {branch && (
        <div className="absolute bottom-full left-0 mb-1.5 flex h-6 max-w-[calc(100%-40px)] items-center rounded-md border border-line bg-surface px-2 text-[11px] text-muted shadow-sm">
          <BranchLabel branch={branch} />
        </div>
      )}

      {/* Ações da pasta, fora do card: acima do canto direito, como o nome do grupo fica acima da borda. */}
      <div className="nodrag absolute bottom-full right-0 mb-1.5 flex items-center gap-1">
        <ProjectServerButton path={data.path} />
        <button
          aria-label="Nova conversa"
          onClick={() => newConversation(id)}
          className="group relative flex size-6 items-center justify-center rounded-md border border-line bg-surface text-muted shadow-sm hover:bg-surface-2 hover:text-text"
        >
          <Plus size={13} />
          <Tooltip label="Nova conversa" />
        </button>
      </div>

      <div
        ref={blockRef}
        // Destaque da pasta sobre as conversas: borda mais forte, cabeçalho mais alto,
        // nome maior e o ícone num quadradinho.
        className="flex flex-col overflow-hidden rounded-[10px] border bg-surface-2 shadow-xl shadow-black/40"
        style={{ borderColor: selected ? 'var(--color-muted)' : 'var(--color-line-strong)' }}
      >
        <header
          className={`flex items-center gap-2.5 px-3 py-2.5 ${conversations.length === 0 ? 'border-b border-line' : ''}`}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-line text-text">
            {running ? (
              <Loader2 size={15} aria-label="Conversa em andamento" className="animate-spin" style={{ color: flowColor }} />
            ) : (
              <Folder size={15} />
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <EditableName id={id} value={data.name} className="text-[15px] font-semibold leading-tight" />
            <PathLabel path={data.path} className="text-[11px] text-faint" />
          </div>
          {conversations.length > 0 && (
            <button
              aria-label={collapsed ? 'Mostrar conversas' : 'Recolher conversas'}
              title={collapsed ? 'Mostrar conversas' : 'Recolher conversas'}
              onClick={(e) => {
                e.stopPropagation()
                toggleProject(id)
              }}
              className="nodrag flex size-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-line hover:text-text"
            >
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          )}
        </header>

        {conversations.length === 0 && <p className="bg-surface px-3 py-2.5 text-xs text-faint">Nenhuma conversa ainda</p>}
      </div>

      {shown.length > 0 && (
        <ul ref={listRef} className="flex flex-col gap-2.5" style={{ marginLeft: INDENT }}>
          {rows.map((row) => {
            const c = row.conversation
            if (row.kind === 'agent') {
              return (
                <AgentItem
                  key={`agent-${row.agent.id}`}
                  agent={row.agent}
                  style={{ marginLeft: SUB_INDENT }}
                  onOpen={() => openConversation(id, c.id)}
                />
              )
            }
            return (
              <ConversationItem
                key={c.id}
                card
                conversation={c}
                now={now}
                poppedOut={poppedOut.has(c.id)}
                active={
                  activeConversation?.nodeId === id &&
                  (activeConversation.conversationId === c.id || activeConversation.sessionId === c.id)
                }
                onOpen={() => openConversation(id, c.id)}
              />
            )
          })}
        </ul>
      )}

      {/* Fecha a lista: depois da última conversa, no mesmo recuo, fora das linhas da árvore. */}
      {conversations.length > 0 && !collapsed && (
        <button
          onClick={() => openAllConversations(id)}
          className="nodrag flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-text"
          style={{ marginLeft: INDENT }}
        >
          <List size={13} />
          Ver todas as {conversations.length} conversas
        </button>
      )}
    </div>
  )
}
