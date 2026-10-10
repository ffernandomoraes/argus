import { memo, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { Folder, X } from 'lucide-react'
import { useBranch, useUncommitted } from '../../canvas/sessionsStore'
import { BranchTag, TAG } from './BranchTag'
import { HeaderButton } from './HeaderButton'

// Cabeçalho da conversa: título, pasta e branch (com os não comitados), os botões de quem a
// mostra e o fechar. Memorizado: o chat andando não redesenha o cabeçalho.
export const ConversationHeader = memo(function ConversationHeader({
  title,
  cwd,
  project,
  minimal,
  actions,
  onOpenDiff,
  onClose,
  className,
  style,
  onPointerDown
}: {
  title: string
  cwd: string
  project?: ReactNode
  // Modo foco: uma linha só, com o título e o fechar, sem a borda de baixo.
  minimal: boolean
  actions?: ReactNode
  onOpenDiff?: (path: string) => void
  onClose: () => void
  className: string
  style?: CSSProperties
  onPointerDown?: (e: PointerEvent) => void
}) {
  // Branch atual da pasta: é nela que o Claude vai trabalhar ao responder.
  const branch = useBranch(cwd)
  const uncommitted = useUncommitted(cwd)

  return (
    <header
      onPointerDown={onPointerDown}
      // Mínimo: uma linha só, sem a borda de baixo (no foco ela parava no meio da tela).
      className={`flex shrink-0 gap-3 px-4 ${minimal ? 'items-center py-1.5' : 'items-start border-b border-line py-3'} ${className}`}
      style={style}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        {/* Conversa sem projeto, fora de repositório: não tem o que mostrar aqui. */}
        {!minimal && (project || branch) && (
          <div className="mt-1 flex items-center gap-2 text-[12px] text-faint">
            {project && (
              <span className={`${TAG} min-w-0 gap-1`}>
                <Folder size={12} className="shrink-0" />
                <span className="truncate">{project}</span>
              </span>
            )}
            {branch && <BranchTag cwd={cwd} branch={branch} files={uncommitted} onOpenDiff={onOpenDiff} />}
          </div>
        )}
      </div>

      {/* no-drag: botões fora do arraste da janela; nodrag: fora do arraste do bloco no canvas. */}
      <div className="no-drag nodrag flex shrink-0 items-center gap-1">
        {actions}
        <HeaderButton label="Fechar" onClick={onClose}>
          <X size={15} />
        </HeaderButton>
      </div>
    </header>
  )
})
