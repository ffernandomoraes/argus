import { memo, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { Folder, X } from 'lucide-react'
import { useBranch, useUncommitted } from '../../canvas/sessionsStore'
import { BranchTag, TAG } from './BranchTag'
import { HeaderButton } from './HeaderButton'

// Cabeçalho da conversa: título e branch (na mesma linha), a pasta quando vem, os botões de quem a
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

  // A pasta, quando vem, ocupa uma segunda linha; sem ela o cabeçalho fica numa linha só.
  const folderRow = !minimal && !!project

  return (
    <header
      onPointerDown={onPointerDown}
      // Mínimo: uma linha só, sem a borda de baixo (no foco ela parava no meio da tela).
      className={`flex shrink-0 gap-3 px-4 ${minimal ? 'items-center py-1.5' : `${folderRow ? 'items-start' : 'items-center'} border-b border-line py-2.5`} ${className}`}
      style={style}
    >
      <div className="min-w-0 flex-1">
        {/* A branch fica em frente ao título; fora de repositório, não aparece. */}
        <div className="flex min-w-0 items-center gap-2 text-[12px] text-faint">
          <div className="min-w-0 truncate text-sm font-medium text-text">{title}</div>
          {!minimal && branch && <BranchTag cwd={cwd} branch={branch} files={uncommitted} onOpenDiff={onOpenDiff} />}
        </div>
        {folderRow && (
          <div className="mt-1 flex items-center text-[12px] text-faint">
            <span className={`${TAG} min-w-0 gap-1`}>
              <Folder size={12} className="shrink-0" />
              <span className="truncate">{project}</span>
            </span>
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
