import { memo, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { ChevronRight, Star, X } from 'lucide-react'
import { AccountTag } from './AccountTag'
import { FolderTag } from './FolderTag'
import { HeaderButton } from './HeaderButton'
import { tr } from '../../i18n'

// Cabeçalho da conversa, numa linha só: a pasta e o título (pasta > conversa, com a estrela se favorita) e, à
// direita, a conta em cinza, os botões de quem a mostra e o fechar. A branch fica em cima da caixa de
// escrever (ConversationBranch). Memorizado: o chat andando não redesenha o cabeçalho.
export const ConversationHeader = memo(function ConversationHeader({
  title,
  cwd,
  folders,
  project,
  account,
  onAccountChange,
  claudeOnly,
  favorite = false,
  minimal,
  actions,
  onClose,
  className,
  style,
  onPointerDown
}: {
  title: string
  cwd: string
  // Workspace: as pastas dele (o menu da pasta abre cada uma).
  folders?: string[]
  project?: ReactNode
  // Conta que roda a conversa; com onAccountChange, vira seletor (claudeOnly: só as do Claude).
  account?: string
  onAccountChange?: (account: string) => void
  claudeOnly?: boolean
  // Conversa favoritada: estrela antes do título.
  favorite?: boolean
  // Modo foco: uma linha só, com o título e o fechar, sem a borda de baixo.
  minimal: boolean
  actions?: ReactNode
  onClose: () => void
  className: string
  style?: CSSProperties
  onPointerDown?: (e: PointerEvent) => void
}) {
  return (
    <header
      onPointerDown={onPointerDown}
      // Mínimo: uma linha só, sem a borda de baixo (no foco ela parava no meio da tela).
      className={`flex shrink-0 items-center gap-3 px-4 ${minimal ? 'py-1.5' : 'border-b border-line py-2.5'} ${className}`}
      style={style}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          {project && (
            <>
              <FolderTag cwd={cwd} folders={folders}>
                {project}
              </FolderTag>
              <ChevronRight size={13} className="shrink-0 text-faint" />
            </>
          )}
          {favorite && (
            <span title={tr('Conversa favoritada', 'Favorite chat')} className="flex shrink-0 items-center">
              <Star size={13} className="fill-current text-amber-400" aria-label={tr('Conversa favoritada', 'Favorite chat')} />
            </span>
          )}
          <div className="min-w-0 truncate font-medium text-text">{title}</div>
        </div>
      </div>

      {/* no-drag: botões fora do arraste da janela; nodrag: fora do arraste do bloco no canvas. */}
      <div className="no-drag nodrag flex shrink-0 items-center gap-1">
        {/* Modo foco: só o título e o fechar. */}
        {!minimal && <AccountTag account={account} onChange={onAccountChange} claudeOnly={claudeOnly} />}
        {actions}
        <HeaderButton label={tr('Fechar', 'Close')} onClick={onClose}>
          <X size={15} />
        </HeaderButton>
      </div>
    </header>
  )
})
