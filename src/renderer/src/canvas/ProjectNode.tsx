import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronUp, Folder, List, MessageSquare, PenTool, Plus } from 'lucide-react'
import { useCanvasActions } from './CanvasContext'
import { ContextMenu, type MenuState } from './ContextMenu'
import { EditableName } from './EditableName'
import { DEFAULT_GROUP_COLOR, INSTANCE_WIDTH } from './factory'
import { PathLabel } from './PathLabel'
import { BranchLabel } from './BranchLabel'
import { CodeTyping } from './CodeTyping'
import { ProjectServerButton } from '../devServers/ProjectServerButton'
import { Tooltip } from './NavBar'
import { IconTile } from '../settings/controls'
import { AgentItem, ConversationRow, useNow } from './ConversationItem'
import { getRunningAgents, useRunningAgentsVersion } from './runningAgents'
import { useBranch, useSessions, useUncommitted } from './sessionsStore'
import type { RunningAgent } from '../../../shared/agents'
import type { ConversationSummary, ProjectNode as ProjectNodeType } from './types'

// As conversas mais recentes ficam como linhas dentro da caixa da pasta; todas abrem pelo
// botão no fim da lista, no painel flutuante.
const MAX_CONVERSATIONS = 3

// Recolhida, a pasta ainda mostra o que pede atenção, para nenhum aviso sumir junto.
const isActive = (c: ConversationSummary) => c.status === 'running' || c.status === 'needs-you'

// Conversas recuadas dentro da caixa, cada uma com uma perninha que desce de baixo do ícone
// da pasta e entra pela esquerda dela. As posições saem das alturas fixas das linhas (sem
// medir o layout): cabeçalho de 56px com o ícone de 28px no meio, conversa de 32px
// (ConversationRow) e subagente de 24px (AgentItem), com ROW_GAP entre elas.
const INDENT = 34
// Meio do ícone de pasta: 12px de respiro do cabeçalho + metade do quadradinho de 28px.
const TRUNK = 26
// Base do ícone, contada do topo da lista: 56 / 2 + 14 = 42, e a lista começa em 56.
const TRUNK_TOP = -14
const ROW_HEIGHT = { conversation: 32, agent: 24 }
// Espaço entre as linhas (o gap-1 da lista), para o fundo de cada conversa aparecer separado.
const ROW_GAP = 4
const RADIUS = 6

// Perninha: desce do ícone até o meio da conversa e entra pela lateral.
function leg(middle: number): string {
  return `M ${TRUNK} ${TRUNK_TOP} V ${middle - RADIUS} Q ${TRUNK} ${middle} ${TRUNK + RADIUS} ${middle} H ${INDENT}`
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
    // Design: os agentes são da conversa do protótipo dele (a sessão), não do item da lista.
    const key = conversation.kind === 'design' ? conversation.sessionId : conversation.id
    for (const agent of key ? getRunningAgents(key) : []) rows.push({ kind: 'agent', agent, conversation, parent })
  }
  return rows
}

export function ProjectNode({ id, data, selected, parentId }: NodeProps<ProjectNodeType>) {
  const conversations = useSessions(data.path)
  const branch = useBranch(data.path)
  const uncommitted = useUncommitted(data.path)
  const collapsed = !!data.collapsed
  const shown = [...conversations]
    .filter((c) => !collapsed || isActive(c))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_CONVERSATIONS)
  // Qualquer conversa do projeto rodando (não só as visíveis na lista) troca a pasta pelas linhas de código animadas.
  const running = conversations.some((c) => c.status === 'running')
  useRunningAgentsVersion()
  const rows = withAgents(shown)
  const groupColor = useStore((s) => {
    const group = parentId ? s.nodeLookup.get(parentId) : undefined
    return group?.type === 'area' ? (group.data.color as string) : undefined
  })
  // Linha até a conversa rodando e os subagentes na cor do grupo; grupo cinza (o padrão) conta como sem cor.
  const flowColor = groupColor && groupColor !== DEFAULT_GROUP_COLOR ? groupColor : 'var(--color-running)'
  const now = useNow()
  const {
    activeConversation,
    openConversation,
    openConversationMenu,
    newConversation,
    openAllConversations,
    poppedOut,
    toggleProject,
    activeDesign,
    openDesign
  } = useCanvasActions()
  const [newMenu, setNewMenu] = useState<MenuState | null>(null)

  // Meio de cada conversa na lista, para as perninhas.
  const legs: { middle: number; running: boolean }[] = []
  let top = 0
  for (const row of rows) {
    if (row.kind === 'conversation') {
      legs.push({ middle: top + ROW_HEIGHT.conversation / 2, running: row.conversation.status === 'running' })
    }
    top += ROW_HEIGHT[row.kind] + ROW_GAP
  }

  return (
    <div className="relative" style={{ width: INSTANCE_WIDTH }}>
      {/* Branch atual, fora do card: acima do canto esquerdo, na mesma altura e no mesmo estilo das ações. */}
      {branch && (
        <div className="absolute bottom-full left-0 mb-1.5 flex h-6 max-w-[calc(100%-64px)] items-center rounded-md border border-line bg-surface px-2 text-[12px] text-muted shadow-sm">
          <BranchLabel branch={branch} changes={uncommitted?.length} highlight />
        </div>
      )}

      {/* Ações da pasta, fora do card: acima do canto direito. */}
      <div className="nodrag absolute bottom-full right-0 mb-1.5 flex items-center gap-1">
        <ProjectServerButton path={data.path} />
        {/* "+": nova conversa ou novo design (os designs que já existem ficam na lista de conversas). */}
        <button
          aria-label="Novo"
          aria-haspopup="menu"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setNewMenu({
              x: r.left,
              y: r.bottom + 4,
              items: [
                { type: 'action', label: 'Nova conversa', icon: MessageSquare, onSelect: () => newConversation(id) },
                { type: 'action', label: 'Novo design', icon: PenTool, onSelect: () => openDesign(id) }
              ]
            })
          }}
          className={`group relative flex size-6 items-center justify-center rounded-md border bg-surface shadow-sm hover:bg-surface-2 hover:text-text ${
            newMenu ? 'border-accent text-accent' : 'border-line text-muted'
          }`}
        >
          <Plus size={13} />
          {!newMenu && <Tooltip label="Nova conversa ou design" />}
        </button>
        {newMenu && createPortal(<ContextMenu menu={newMenu} onClose={() => setNewMenu(null)} />, document.body)}
      </div>

      {/* Uma caixa só: cabeçalho com a pasta, e as conversas como linhas dentro dela.
          O ícone fica num quadradinho tingido de leve: na cor do grupo, para não brigar com ele;
          fora de grupo, no azul de pasta do Finder. Selecionada, a borda vai para a cor de destaque. */}
      <div
        className="flex flex-col overflow-hidden rounded-xl border bg-project shadow-xl shadow-black/40"
        style={{ borderColor: selected ? 'var(--color-accent)' : 'var(--color-line-strong)' }}
      >
        <header className="flex h-14 shrink-0 items-center gap-2.5 px-3">
          <IconTile color={groupColor ?? '#3d9df5'} size={28} soft>
            {running ? <CodeTyping size={16} label="Conversa em andamento" /> : <Folder size={15} />}
          </IconTile>
          <div className="flex min-w-0 flex-1 flex-col">
            <EditableName id={id} value={data.name} className="text-[15px] font-semibold leading-tight" />
            <PathLabel path={data.path} className="text-[12px] text-faint" />
          </div>
          {conversations.length > 0 && (
            <button
              aria-label={collapsed ? 'Mostrar conversas' : 'Recolher conversas'}
              title={collapsed ? 'Mostrar conversas' : 'Recolher conversas'}
              onClick={(e) => {
                e.stopPropagation()
                toggleProject(id)
              }}
              className="nodrag -mr-1 flex size-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-line hover:text-text"
            >
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          )}
        </header>

        {conversations.length === 0 && (
          <p className="border-t border-line px-3 py-2.5 text-xs text-faint">Nenhuma conversa ainda</p>
        )}

        {(rows.length > 0 || !collapsed) && conversations.length > 0 && (
          <ul className="relative flex flex-col gap-1 pb-1.5 pr-1.5" style={{ paddingLeft: INDENT }}>
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 h-full overflow-visible"
              style={{ width: INDENT }}
            >
              {legs.map((l, i) => (
                <path key={i} d={leg(l.middle)} fill="none" stroke="var(--color-line-strong)" strokeWidth={1.5} />
              ))}
              {/* Por cima das outras: o caminho até a conversa rodando, tracejado andando. */}
              {legs.map((l, i) =>
                l.running ? (
                  <path
                    key={`running-${i}`}
                    d={leg(l.middle)}
                    fill="none"
                    stroke={flowColor}
                    strokeWidth={1.5}
                    className="conversation-flow"
                  />
                ) : null
              )}
            </svg>
            {rows.map((row, i) => {
              const c = row.conversation
              if (row.kind === 'agent') {
                return (
                  <AgentItem
                    key={`agent-${row.agent.id}`}
                    agent={row.agent}
                    first={row.parent === i - 1}
                    color={flowColor}
                    onOpen={() => openConversation(id, c.id)}
                  />
                )
              }
              return (
                <ConversationRow
                  key={c.id}
                  conversation={c}
                  now={now}
                  poppedOut={poppedOut.has(c.id)}
                  active={
                    (activeConversation?.nodeId === id &&
                      (activeConversation.conversationId === c.id || activeConversation.sessionId === c.id)) ||
                    (!!c.designId && activeDesign?.nodeId === id && activeDesign.designId === c.designId)
                  }
                  onOpen={() => openConversation(id, c.id)}
                  onContextMenu={(e) => openConversationMenu(e, id, c)}
                />
              )
            })}
            {/* Fecha a lista: abre todas no painel flutuante. */}
            {!collapsed && (
              <li>
                <button
                  onClick={() => openAllConversations(id)}
                  className="nodrag flex h-7 w-full items-center gap-2.5 rounded-lg px-2 text-xs text-faint hover:bg-fill hover:text-text"
                >
                  <List size={12} className="shrink-0" />
                  Ver todas as {conversations.length} conversas
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
