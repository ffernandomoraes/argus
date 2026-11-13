import { memo } from 'react'
import { Handle, Position, useStore as useFlowStore, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronUp, Folder, Folders, GitBranch, MessagesSquare } from 'lucide-react'
import { IconTile } from '../settings/controls'
import { IconButton } from '../ui/IconButton'
import { sameNodeProps } from './blocks/sameNodeProps'
import { useGroupOf } from './blocks/useGroupOf'
import { useCanvasActions } from './CanvasContext'
import { CodeTyping } from './CodeTyping'
import { EditableName } from './EditableName'
import { DEFAULT_GROUP_COLOR, INSTANCE_WIDTH, WORKTREE_WIDTH } from './factory'
import { PathLabel } from './PathLabel'
import { ConversationStack } from './project/ConversationStack'
import { ProjectActions } from './project/ProjectActions'
import { useEmptyListText } from './project/useEmptyListText'
import { WorkspaceFolders } from './project/WorkspaceFolders'
import { useSessions } from './sessionsStore'
import type { ProjectNode as ProjectNodeType } from './types'
import { Tag } from '../ui/Tag'
import { WORKTREE_IN, WORKTREE_OUT } from './worktrees/edges'
import { useWorktreeJob } from './worktrees/jobs'
import { WorktreeStrip } from './worktrees/WorktreeStrip'
import { tr } from '../i18n'

// Pasta no canvas: uma caixa só, com a pasta no cabeçalho e as conversas como linhas dentro dela
// (project/ConversationStack). Branch e ações ficam fora da caixa, logo acima (project/ProjectActions).
function ProjectNodeView({ id, data, selected, parentId }: NodeProps<ProjectNodeType>) {
  const conversations = useSessions(data.path)
  const emptyText = useEmptyListText(data.path)
  const collapsed = !!data.collapsed
  const { color: groupColor } = useGroupOf(parentId)
  // Linha até a conversa rodando e os subagentes na cor do grupo; grupo cinza (o padrão) conta como sem cor.
  const flowColor = groupColor && groupColor !== DEFAULT_GROUP_COLOR ? groupColor : 'var(--color-running)'
  // Qualquer conversa do projeto rodando (não só as visíveis na lista) troca a pasta pelas linhas de código animadas.
  const running = conversations.some((c) => c.status === 'running')
  const { toggleProject } = useCanvasActions()
  // Workspace: várias pastas num card só. Ícone, selo e a lista das pastas deixam isso à vista.
  const folders = data.folders
  // Conversas do grupo: as pastas vêm do grupo (useGroupWide) e já estão à vista nele; o card diz
  // quais enxerga, sem lista própria.
  const groupWide = !!data.groupWide
  // Tarefa isolada (git worktree): ícone de branch, sem caminho embaixo do nome (a branch fica no
  // selo acima do card) e a faixa com o que está acontecendo (WorktreeStrip).
  const worktree = data.worktree
  // Com tarefas embaixo, recolher a pasta esconde elas também (operations/worktrees.ts).
  // Tarefa sendo removida (apagando a pasta): o card pisca até sair do canvas.
  const removing = useWorktreeJob(id)?.kind === 'removing'
  const hasTasks = useFlowStore((s) => s.nodes.some((n) => (n.data as { worktree?: { of: string } }).worktree?.of === id))

  return (
    <div
      className={`relative ${removing ? 'worktree-removing pointer-events-none' : ''}`}
      style={{ width: worktree ? WORKTREE_WIDTH : INSTANCE_WIDTH }}
    >
      {/* Alças invisíveis das linhas até as tarefas isoladas (worktrees/WorktreeEdge): a que sai,
          embaixo do ícone; a que entra, à esquerda, na altura do ícone. */}
      <Handle id={WORKTREE_OUT} type="source" position={Position.Bottom} isConnectable={false} className="worktree-handle" style={{ left: 26 }} />
      <Handle id={WORKTREE_IN} type="target" position={Position.Left} isConnectable={false} className="worktree-handle" style={{ top: 28 }} />
      <ProjectActions nodeId={id} project={data} />

      {/* O ícone fica num quadradinho tingido de leve: na cor do grupo, para não brigar com ele;
          fora de grupo, no azul de pasta do Finder. Selecionada, a borda vai para a cor de destaque. */}
      <div
        className={`flex flex-col overflow-hidden rounded-xl border ${
          // Tarefa isolada: borda tracejada (como a linha que a liga à pasta), fundo mais leve e
          // sombra menor; é uma cópia ligada à pasta, não outra pasta.
          worktree ? 'border-dashed bg-project/60 shadow-lg shadow-black/25' : 'bg-project shadow-xl shadow-black/40'
        }`}
        style={{ borderColor: selected ? 'var(--color-accent)' : 'var(--color-line-strong)' }}
      >
        <header className="flex h-14 shrink-0 items-center gap-2.5 px-3">
          <IconTile color={groupColor ?? '#3d9df5'} size={28} soft>
            {running ? (
              <CodeTyping size={16} label={tr('Conversa em andamento', 'Chat in progress')} />
            ) : groupWide ? (
              <MessagesSquare size={15} />
            ) : worktree ? (
              <GitBranch size={15} />
            ) : folders ? (
              <Folders size={15} />
            ) : (
              <Folder size={15} />
            )}
          </IconTile>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-w-0 items-center gap-1.5">
              <EditableName id={id} value={data.name} className="min-w-0 text-[15px] font-semibold leading-tight" />
              {folders && !groupWide && (
                <Tag icon={Folders} tone="info">
                  {tr('Espaço de trabalho', 'Workspace')}
                </Tag>
              )}
              {groupWide && (
                <Tag tone="info">
                  {tr('Grupo', 'Group')}
                </Tag>
              )}
              {worktree && (
                <Tag icon={GitBranch} tone="info">
                  Worktree
                </Tag>
              )}
            </div>
            {groupWide ? (
              // Quantas pastas as conversas enxergam; quais, ao passar o mouse.
              <span title={folders?.join('\n')} className="text-[12px] text-faint">
                {!folders?.length
                  ? tr('Nenhuma pasta no grupo', 'No folders in the group')
                  : folders.length === 1
                    ? tr('1 pasta', '1 folder')
                    : tr(`${folders.length} pastas`, `${folders.length} folders`)}
              </span>
            ) : worktree ? null : folders ? (
              <span className="text-[12px] text-faint">
                {folders.length === 1 ? tr('1 pasta', '1 folder') : tr(`${folders.length} pastas`, `${folders.length} folders`)}
              </span>
            ) : (
              <PathLabel path={data.path} className="text-[12px] text-faint" />
            )}
          </div>
          {/* Espaço de trabalho sempre recolhe: a lista das pastas some junto. */}
          {(conversations.length > 0 || hasTasks || (folders && !groupWide)) && (
            <IconButton
              label={collapsed ? tr('Expandir', 'Expand') : tr('Recolher', 'Collapse')}
              variant="subtle"
              size="sm"
              className="nodrag -mr-1"
              onClick={(e) => {
                e.stopPropagation()
                toggleProject(id)
              }}
            >
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </IconButton>
          )}
        </header>

        {conversations.length === 0 ? (
          <p className="border-t border-line px-3 py-2.5 text-xs text-faint">{emptyText}</p>
        ) : (
          <ConversationStack nodeId={id} conversations={conversations} collapsed={collapsed} flowColor={flowColor} />
        )}

        {/* Embaixo das conversas: no meio, cortaria as linhas que descem do ícone até elas.
            Recolhido, some (o "N pastas" do cabeçalho continua dizendo quantas são). */}
        {folders && !groupWide && !collapsed && <WorkspaceFolders nodeId={id} folders={folders} />}

        {/* Tarefa em paralelo: o erro (criar, instalar, remover) fica no pé do card. */}
        {worktree && <WorktreeStrip nodeId={id} name={data.name} path={data.path} />}
      </div>
    </div>
  )
}

// Arrastar a pasta não redesenha o conteúdo dela (ver sameNodeProps).
export const ProjectNode = memo(ProjectNodeView, sameNodeProps)
