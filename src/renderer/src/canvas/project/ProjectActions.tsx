import { memo } from 'react'
import { Code2, Plus } from 'lucide-react'
import { ProjectServerButton } from '../../devServers/ProjectServerButton'
import { IconButton } from '../../ui/IconButton'
import { Tooltip } from '../../ui/Tooltip'
import { useCanvasActions } from '../CanvasContext'
import { useBranch, useUncommitted } from '../sessionsStore'
import { useIsCodeOpen } from '../useCanvasView'
import { BranchSwitcher } from './BranchSwitcher'
import type { ProjectData } from '../types'
import { tr } from '../../i18n'

// O que fica fora do card da pasta, logo acima dele: a branch atual (clicar troca) no canto esquerdo e as
// ações (servidor, código e "+") no direito, na mesma altura e no mesmo estilo.
export const ProjectActions = memo(function ProjectActions({ nodeId, project }: { nodeId: string; project: ProjectData }) {
  const { path } = project
  const branch = useBranch(path)
  const uncommitted = useUncommitted(path)
  return (
    <>
      {branch && (
        <div className="absolute bottom-full left-0 mb-1.5 flex max-w-[calc(100%-92px)]">
          <BranchSwitcher path={path} branch={branch} changes={uncommitted?.length} />
        </div>
      )}
      <div className="nodrag absolute bottom-full right-0 mb-1.5 flex items-center gap-1">
        <ProjectServerButton path={path} />
        <CodeButton project={project} />
        <NewButton nodeId={nodeId} />
      </div>
    </>
  )
})

// Abre (ou fecha) o painel de código da pasta, o mesmo que a conversa abre. Fica destacado
// enquanto o painel mostra esta pasta.
function CodeButton({ project }: { project: ProjectData }) {
  const { toggleProjectCode } = useCanvasActions()
  const open = useIsCodeOpen(project.path)
  const label = open ? tr('Fechar código', 'Close code') : tr('Ver código', 'View code')
  return (
    <IconButton
      label={label}
      title=""
      variant="floating"
      size="sm"
      pressed={open}
      className="group relative"
      onClick={() => toggleProjectCode(project, open)}
    >
      <Code2 size={13} />
      <Tooltip label={label} />
    </IconButton>
  )
}

// "+": abre direto uma conversa nova. Novo design fica só no menu do botão direito da pasta.
function NewButton({ nodeId }: { nodeId: string }) {
  const { newConversation } = useCanvasActions()
  return (
    <IconButton
      label={tr('Nova conversa', 'New chat')}
      title=""
      variant="floating"
      size="sm"
      className="group relative"
      onClick={() => newConversation(nodeId)}
    >
      <Plus size={13} />
      <Tooltip label={tr('Nova conversa', 'New chat')} />
    </IconButton>
  )
}
