import { memo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageSquare, PenTool, Plus } from 'lucide-react'
import { ProjectServerButton } from '../../devServers/ProjectServerButton'
import { IconButton } from '../../ui/IconButton'
import { Tooltip } from '../../ui/Tooltip'
import { useAnchoredMenu } from '../../ui/useAnchoredMenu'
import { BranchLabel } from '../BranchLabel'
import { useCanvasActions } from '../CanvasContext'
import { ContextMenu, type MenuState } from '../ContextMenu'
import { useBranch, useUncommitted } from '../sessionsStore'

// O que fica fora do card da pasta, logo acima dele: a branch atual no canto esquerdo e as
// ações (servidor e "+") no direito, na mesma altura e no mesmo estilo.
export const ProjectActions = memo(function ProjectActions({ nodeId, path }: { nodeId: string; path: string }) {
  const branch = useBranch(path)
  const uncommitted = useUncommitted(path)
  return (
    <>
      {branch && (
        <div className="absolute bottom-full left-0 mb-1.5 flex h-6 max-w-[calc(100%-64px)] items-center rounded-md border border-line bg-surface px-2 text-[12px] text-muted shadow-sm">
          <BranchLabel branch={branch} changes={uncommitted?.length} highlight />
        </div>
      )}
      <div className="nodrag absolute bottom-full right-0 mb-1.5 flex items-center gap-1">
        <ProjectServerButton path={path} />
        <NewButton nodeId={nodeId} />
      </div>
    </>
  )
})

// "+": nova conversa ou novo design (os designs que já existem ficam na lista de conversas).
// Clicar de novo no botão fecha o menu (useAnchoredMenu).
function NewButton({ nodeId }: { nodeId: string }) {
  const { newConversation, openDesign } = useCanvasActions()
  const anchor = useRef<HTMLButtonElement>(null)
  const menu = useAnchoredMenu(anchor)
  const [at, setAt] = useState<MenuState | null>(null)
  return (
    <>
      <IconButton
        ref={anchor}
        label="Novo"
        title=""
        variant="floating"
        size="sm"
        pressed={menu.open}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        className="group relative"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setAt({
            x: r.left,
            y: r.bottom + 4,
            items: [
              { type: 'action', label: 'Nova conversa', icon: MessageSquare, onSelect: () => newConversation(nodeId) },
              { type: 'action', label: 'Novo design', icon: PenTool, onSelect: () => openDesign(nodeId) }
            ]
          })
          menu.toggle()
        }}
      >
        <Plus size={13} />
        {!menu.open && <Tooltip label="Nova conversa ou design" />}
      </IconButton>
      {menu.open && at && createPortal(<ContextMenu menu={at} onClose={menu.close} />, document.body)}
    </>
  )
}
