import { useCallback, useLayoutEffect, useRef, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { useEscape } from '../useEscape'
import { ModalCloseContext, type ModalCloseReason } from './modalContext'
import { useFocusTrap } from './useFocusTrap'

// panel: os modais grandes (configurações, agentes, memória, servidores), dentro da janela e com
// folga para a barra de título. alert: confirmação pequena, centrada na tela. blocking: por cima
// de tudo, com o fundo desfocado e a faixa de cima ainda arrastando a janela (boas-vindas); não
// fecha clicando fora. palette: caixa de busca presa no alto da tela (Nova pasta).
export type ModalVariant = 'panel' | 'alert' | 'blocking' | 'palette'
export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'auto'

const BACKDROP: Record<ModalVariant, string> = {
  panel: 'absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-6 pt-16',
  alert: 'fixed inset-0 z-50 flex items-center justify-center bg-black/50',
  blocking: 'absolute inset-0 z-[60] flex items-center justify-center bg-black/50 px-6 pb-6 pt-12 backdrop-blur-[2px]',
  palette: 'fixed inset-0 z-50 bg-black/50'
}

const CARD: Record<ModalVariant, string> = {
  panel: 'overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/50 outline-none',
  alert: 'rounded-2xl border border-line bg-surface p-5 shadow-2xl shadow-black/60 outline-none',
  blocking: 'relative overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/50 outline-none',
  palette:
    'absolute left-1/2 top-[18%] max-h-[60vh] w-[520px] max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60 outline-none'
}

// Tamanhos da caixa. xs: confirmação; sm: boas-vindas; md: lista que cresce com o conteúdo
// (servidores); lg: configurações; xl: memória; 2xl: agentes. auto: sem tamanho daqui (a medida
// vem no className, ex.: o painel de MCPs).
const SIZES: Record<ModalSize, string> = {
  xs: 'w-96',
  sm: 'max-h-full w-[min(540px,100%)]',
  md: 'max-h-[min(640px,100%)] w-[min(640px,100%)]',
  lg: 'h-[min(640px,100%)] w-[min(880px,100%)]',
  xl: 'h-[min(680px,100%)] w-[min(980px,100%)]',
  '2xl': 'h-[min(760px,100%)] w-[min(1040px,100%)]',
  auto: ''
}

const DEFAULT_SIZE: Record<ModalVariant, ModalSize> = { panel: 'lg', alert: 'xs', blocking: 'sm', palette: 'auto' }

const stop = (e: MouseEvent) => e.stopPropagation()

export type ModalProps = {
  children: ReactNode
  // Fecha de fato: quem abriu tira o modal da tela.
  onClose: () => void
  // Pedido de fechar (Esc, clique fora, botão de fechar). Devolver false mantém aberto: é onde
  // entra o "Descartar as alterações?".
  onRequestClose?: (reason: ModalCloseReason) => boolean
  // Esc que faz outra coisa antes de fechar (ex.: voltar do agente aberto para a lista). O Esc
  // continua sendo do modal: nunca vaza para o que está atrás.
  onEscape?: () => void
  // Nome para leitor de tela: `label`, ou o id do título em `labelledBy`.
  label?: string
  labelledBy?: string
  variant?: ModalVariant
  size?: ModalSize
  // Só arrumação de dentro da caixa (flex, flex-col) e, com size="auto", a medida; fundo e borda
  // vêm daqui.
  className?: string
  // Quem recebe o foco ao abrir; sem ele, o primeiro focável (autoFocus de dentro também vale).
  initialFocus?: RefObject<HTMLElement | null>
  closeOnBackdrop?: boolean
}

// Casca comum dos modais: fundo escuro, caixa, Esc, clique fora e foco (entra ao abrir, o Tab não
// sai, volta para quem abriu ao fechar). A animação continua com <Presence kind="modal"> em volta,
// do lado de quem abre: ela acha a caixa pelo role de diálogo, filho direto do fundo.
export function Modal({
  children,
  onClose,
  onRequestClose,
  onEscape,
  label,
  labelledBy,
  variant = 'panel',
  size,
  className,
  initialFocus,
  closeOnBackdrop
}: ModalProps) {
  // Padrão: fecha clicando fora, menos o blocking.
  const backdropCloses = closeOnBackdrop ?? variant !== 'blocking'
  const card = useRef<HTMLDivElement>(null)
  const latest = useRef({ onClose, onRequestClose })
  useLayoutEffect(() => {
    latest.current = { onClose, onRequestClose }
  })
  // Função fixa (vai no contexto para o botão de fechar), sempre com as funções do último render.
  const requestClose = useCallback((reason: ModalCloseReason = 'button') => {
    const { onClose, onRequestClose } = latest.current
    if (onRequestClose?.(reason) === false) return
    onClose()
  }, [])

  useFocusTrap(card, { initialFocus })
  useEscape(() => (onEscape ? onEscape() : requestClose('escape')))

  return (
    <div
      className={BACKDROP[variant]}
      onMouseDown={(e) => backdropCloses && e.target === e.currentTarget && requestClose('backdrop')}
    >
      {/* Faixa de cima continua arrastando a janela, como a barra de título. */}
      {variant === 'blocking' && <div className="drag absolute inset-x-0 top-0 h-10" />}
      <div
        ref={card}
        role={variant === 'alert' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        // Confirmação e paleta abrem dentro de drawers e blocos: o clique nelas não segue para eles.
        onMouseDown={variant === 'alert' || variant === 'palette' ? stop : undefined}
        className={[CARD[variant], SIZES[size ?? DEFAULT_SIZE[variant]], className].filter(Boolean).join(' ')}
      >
        <ModalCloseContext.Provider value={requestClose}>{children}</ModalCloseContext.Provider>
      </div>
    </div>
  )
}
