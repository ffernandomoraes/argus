import { memo, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useBranch, useUncommitted } from '../../canvas/sessionsStore'
import { AccountTag } from './AccountTag'
import { BranchTag } from './BranchTag'
import { FolderTag } from './FolderTag'
import { HeaderButton } from './HeaderButton'
import { tr } from '../../i18n'

// Cabeçalho da conversa: o logo do agente e o título numa linha e, embaixo, os selos da pasta e da
// branch; à direita, os botões de quem a mostra e o fechar. Memorizado: o chat andando não
// redesenha o cabeçalho.
export const ConversationHeader = memo(function ConversationHeader({
  title,
  cwd,
  folders,
  project,
  account,
  onAccountChange,
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
  // Workspace: as pastas dele. Sem branch no selo: cada pasta pode ser um repositório diferente.
  folders?: string[]
  project?: ReactNode
  // Conta que roda a conversa; com onAccountChange (conversa vazia), o selo vira seletor.
  account?: string
  onAccountChange?: (account: string) => void
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
  const repoBranch = useBranch(cwd)
  const branch = folders ? null : repoBranch
  const uncommitted = useUncommitted(cwd)
  const secondRow = !minimal && (!!project || !!branch)

  return (
    <header
      onPointerDown={onPointerDown}
      // Mínimo: uma linha só, sem a borda de baixo (no foco ela parava no meio da tela).
      className={`flex shrink-0 gap-3 px-4 ${minimal ? 'items-center py-1.5' : `${secondRow ? 'items-start' : 'items-center'} border-b border-line py-2.5`} ${className}`}
      style={style}
    >
      <div className="min-w-0 flex-1">
        {/* O logo do agente vem antes do título; no foco, só o título. */}
        <div className="flex min-w-0 items-center gap-1.5">
          {!minimal && <AccountTag account={account} onChange={onAccountChange} />}
          <div className="min-w-0 truncate text-sm font-medium text-text">{title}</div>
        </div>
        {/* Pasta e branch (fora de repositório, não aparece), com o mesmo selo. */}
        {secondRow && (
          <div className="mt-1 flex min-w-0 items-center gap-2 text-[12px] text-faint">
            {project && (
              <FolderTag cwd={cwd} folders={folders}>
                {project}
              </FolderTag>
            )}
            {branch && <BranchTag cwd={cwd} branch={branch} files={uncommitted} onOpenDiff={onOpenDiff} />}
          </div>
        )}
      </div>

      {/* no-drag: botões fora do arraste da janela; nodrag: fora do arraste do bloco no canvas. */}
      <div className="no-drag nodrag flex shrink-0 items-center gap-1">
        {actions}
        <HeaderButton label={tr('Fechar', 'Close')} onClick={onClose}>
          <X size={15} />
        </HeaderButton>
      </div>
    </header>
  )
})
