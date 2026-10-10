import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronUp, Folder } from 'lucide-react'
import { IconTile } from '../settings/controls'
import { IconButton } from '../ui/IconButton'
import { sameNodeProps } from './blocks/sameNodeProps'
import { useGroupOf } from './blocks/useGroupOf'
import { useCanvasActions } from './CanvasContext'
import { CodeTyping } from './CodeTyping'
import { EditableName } from './EditableName'
import { DEFAULT_GROUP_COLOR, INSTANCE_WIDTH } from './factory'
import { PathLabel } from './PathLabel'
import { ConversationStack } from './project/ConversationStack'
import { ProjectActions } from './project/ProjectActions'
import { useSessions } from './sessionsStore'
import type { ProjectNode as ProjectNodeType } from './types'

// Pasta no canvas: uma caixa só, com a pasta no cabeçalho e as conversas como linhas dentro dela
// (project/ConversationStack). Branch e ações ficam fora da caixa, logo acima (project/ProjectActions).
function ProjectNodeView({ id, data, selected, parentId }: NodeProps<ProjectNodeType>) {
  const conversations = useSessions(data.path)
  const collapsed = !!data.collapsed
  const { color: groupColor } = useGroupOf(parentId)
  // Linha até a conversa rodando e os subagentes na cor do grupo; grupo cinza (o padrão) conta como sem cor.
  const flowColor = groupColor && groupColor !== DEFAULT_GROUP_COLOR ? groupColor : 'var(--color-running)'
  // Qualquer conversa do projeto rodando (não só as visíveis na lista) troca a pasta pelas linhas de código animadas.
  const running = conversations.some((c) => c.status === 'running')
  const { toggleProject } = useCanvasActions()

  return (
    <div className="relative" style={{ width: INSTANCE_WIDTH }}>
      <ProjectActions nodeId={id} path={data.path} />

      {/* O ícone fica num quadradinho tingido de leve: na cor do grupo, para não brigar com ele;
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
            <IconButton
              label={collapsed ? 'Mostrar conversas' : 'Recolher conversas'}
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
          <p className="border-t border-line px-3 py-2.5 text-xs text-faint">Nenhuma conversa ainda</p>
        ) : (
          <ConversationStack nodeId={id} conversations={conversations} collapsed={collapsed} flowColor={flowColor} />
        )}
      </div>
    </div>
  )
}

// Arrastar a pasta não redesenha o conteúdo dela (ver sameNodeProps).
export const ProjectNode = memo(ProjectNodeView, sameNodeProps)
