import { useCallback, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react'
import { Code2, ExternalLink, Maximize2, PictureInPicture2, Pin, PinOff } from 'lucide-react'
import type { ConversationSummary, ProjectData } from '../canvas/types'
import { useStableCallback } from '../lib/useStableCallback'
import { MOTION, reduced } from '../motion'
import { useEscape } from '../useEscape'
import { askColors } from './askColors'
import { sameConversation } from './conversationIdentity'
import { ConversationView } from './ConversationView'
import type { LineRange } from './fileLinks'
import { HeaderButton } from './header/HeaderButton'
import { MoreMenu, type MoreMenuItem } from './header/MoreMenu'
import { useFloatingRect } from './hooks/useFloatingRect'
import { useFocusMode } from './hooks/useFocusMode'
import { DRAWER_DEFAULT_WIDTH, TITLE_BAR_HEIGHT, type PanelRect } from './panelGeometry'
import { ResizeHandles } from './FloatingPanel'
import { useDrawerZoom } from './useDrawerZoom'

type Props = {
  project: ProjectData
  // Conta do Claude do grupo da pasta; vazia = a padrão.
  account?: string
  // Conversa sem projeto: roda na pasta do usuário, sem nome de projeto nem explorador de código.
  loose?: boolean
  // Cor do grupo onde o projeto está; o painel puxa esse tom de leve.
  tint?: string
  conversation: ConversationSummary
  codeOpen: boolean
  onToggleCode: () => void
  // Abre a conversa numa janela própria do sistema.
  onPopout: () => void
  // Põe a conversa num bloco dentro do canvas, como o terminal.
  onPinToCanvas: () => void
  // Link de arquivo clicado no chat.
  onOpenFile: (path: string, lines?: LineRange) => void
  // Arquivo da lista de não comitados: abre o diff dele.
  onOpenDiff: (path: string) => void
  // Conversa nova recebeu o id da sessão do Claude no primeiro envio.
  onSessionStarted: (sessionId: string) => void
  // Posição e tamanho no canvas; nulo = ainda não definido (nasce à direita).
  rect: PanelRect | null
  onRectChange: (rect: PanelRect) => void
  // Fixado: continua à vista (e móvel), e a próxima conversa abre num segundo drawer no espaço livre
  // ao lado, em vez de trocar esta.
  pinned?: boolean
  // Sem ele, o item de fixar não aparece (só o drawer principal fixa).
  onTogglePin?: () => void
  onClose: () => void
}

// Painel flutuante à direita. Não é modal: o canvas continua clicável ao lado,
// e abrir outra conversa troca o conteúdo deste mesmo painel.
// No modo foco, o painel cobre a área toda abaixo da barra de título e a conversa fica numa
// coluna estreita no centro: para ler respostas longas sem distração.
export function ConversationDrawer(props: Props) {
  const { project, account, tint, conversation, rect, onClose } = props
  const zoom = useDrawerZoom()
  const panelRef = useRef<HTMLElement>(null)
  const floating = useFloatingRect(panelRef, rect, props.onRectChange, DRAWER_DEFAULT_WIDTH)
  const [focus, setFocus] = useFocusMode(panelRef)
  const leaveFocus = useCallback(() => void setFocus(false), [setFocus])

  // Outra conversa no mesmo drawer: o painel fica, e só o conteúdo entra com o efeito padrão
  // (fade subindo uns pixels). Sem fade de saída: a conversa antiga já deixou de ser a aberta,
  // e segurá-la na tela misturaria o histórico dela com a pasta da nova. A conversa nova que
  // ganhou o id da sessão continua a mesma: não anima.
  const contentRef = useRef<HTMLDivElement>(null)
  const { id, sessionId } = conversation
  const shown = useRef({ id, sessionId })
  useLayoutEffect(() => {
    const before = shown.current
    const now = { id, sessionId }
    shown.current = now
    if (sameConversation(before, now) || reduced()) return
    contentRef.current?.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], MOTION.panel.in)
  }, [id, sessionId])

  useEscape(onClose)
  // Empilhado depois do fechar: o primeiro ESC sai do foco, o segundo fecha.
  useEscape(leaveFocus, focus)

  // Arquivo e diff abrem no código ao lado, por baixo do foco: saem dele para aparecer.
  const openFile = useStableCallback((path: string, lines?: LineRange) => {
    leaveFocus()
    props.onOpenFile(path, lines)
  })
  const openDiff = useStableCallback((path: string) => {
    leaveFocus()
    props.onOpenDiff(path)
  })

  // No foco, o cabeçalho tem a cor do painel: o tom do grupo destacava demais.
  const headerStyle = useMemo<CSSProperties>(
    () => ({
      zoom,
      ...(tint &&
        !focus && {
          background: `color-mix(in srgb, ${tint} 8%, var(--color-bg))`,
          borderBottomColor: `color-mix(in srgb, ${tint} 25%, var(--color-line))`
        })
    }),
    [zoom, tint, focus]
  )
  const actions = useDrawerActions(props, focus, setFocus)

  return (
    <aside
      ref={panelRef}
      className={`absolute flex flex-col overflow-hidden rounded-xl border border-line bg-bg ${
        focus ? 'z-50' : 'z-40 shadow-2xl shadow-black/50'
      }`}
      style={{
        ...(focus
          ? // A barra de título fica de fora: é por ela que a janela arrasta.
            { left: 0, right: 0, top: TITLE_BAR_HEIGHT, bottom: 0, borderRadius: 0 }
          : rect
            ? { left: rect.x, top: rect.y, width: rect.width, height: rect.height }
            : { visibility: 'hidden', inset: 0 }),
        ...(tint && {
          borderColor: `color-mix(in srgb, ${tint} 35%, var(--color-line))`,
          background: `color-mix(in srgb, ${tint} 3%, var(--color-bg))`,
          ...askColors(tint)
        }),
        ...(focus && { borderColor: 'transparent' })
      }}
    >
      {!focus && <ResizeHandles onResizeStart={floating.onResizeStart} />}
      {/* Mesmo elemento nos dois modos: trocar a árvore recriaria a conversa e soltaria a sessão.
          No foco vira a coluna de leitura: linhas curtas cansam menos que texto de ponta a ponta. */}
      <div ref={contentRef} className={`flex min-h-0 w-full flex-1 flex-col ${focus ? 'mx-auto max-w-[1100px]' : ''}`}>
        <ConversationView
          cwd={project.path}
          account={account}
          conversation={conversation}
          onOpenFile={openFile}
          onOpenDiff={openDiff}
          onSessionStarted={props.onSessionStarted}
          zoom={zoom}
          headerClassName={focus ? '' : 'cursor-grab active:cursor-grabbing'}
          minimalHeader={focus}
          headerStyle={headerStyle}
          onHeaderPointerDown={focus ? undefined : floating.onMoveStart}
          actions={actions}
          // No foco, o fechar só sai do foco: a conversa volta para o drawer de antes.
          onClose={focus ? leaveFocus : onClose}
        />
      </div>
    </aside>
  )
}

// Botões do cabeçalho do drawer: o menu de mais opções e o código. Somem no foco. Memorizados,
// para o cabeçalho e a conversa não redesenharem enquanto o painel é arrastado.
function useDrawerActions(props: Props, focus: boolean, setFocus: (on: boolean) => Promise<void>) {
  const { pinned = false, onTogglePin, conversation, onPinToCanvas, onPopout, loose = false, codeOpen, onToggleCode } = props
  const draft = !!conversation.draft
  return useMemo(() => {
    if (focus) return null
    const items: MoreMenuItem[] = [
      { label: 'Modo foco', icon: Maximize2, onClick: () => void setFocus(true) },
      ...(onTogglePin ? [pinned ? { label: 'Desafixar', icon: PinOff, onClick: onTogglePin } : { label: 'Fixar', icon: Pin, onClick: onTogglePin }] : []),
      // Conversa ainda não enviada não tem sessão para abrir em outro lugar.
      ...(draft
        ? []
        : [
            { label: 'Colocar no canvas', icon: PictureInPicture2, onClick: onPinToCanvas },
            { label: 'Abrir em janela separada', icon: ExternalLink, onClick: onPopout }
          ])
    ]
    return (
      <>
        <MoreMenu items={items} />
        {!loose && (
          <HeaderButton label={codeOpen ? 'Fechar código' : 'Abrir código'} onClick={onToggleCode} active={codeOpen}>
            <Code2 size={14} />
          </HeaderButton>
        )}
      </>
    )
  }, [focus, setFocus, onTogglePin, pinned, draft, onPinToCanvas, onPopout, loose, codeOpen, onToggleCode])
}
