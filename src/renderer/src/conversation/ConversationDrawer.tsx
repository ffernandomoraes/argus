import { useCallback, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react'
import { ExternalLink, Maximize2, PictureInPicture2, Pin, PinOff, Star, StarOff } from 'lucide-react'
import { favoriteKey, setFavorite, useFavorites } from '../canvas/favorites'
import type { ConversationSummary, ProjectData } from '../canvas/types'
import { useStableCallback } from '../lib/useStableCallback'
import { MOTION, reduced } from '../motion'
import { useEscape } from '../useEscape'
import { askColors } from './askColors'
import { sameConversation } from './conversationIdentity'
import { CodeTerminalButtons } from './composer/CodeTerminalButtons'
import { ConversationView } from './ConversationView'
import { DrawerTerminal, useDrawerShell } from './DrawerTerminal'
import type { LineRange } from './fileLinks'
import { MoreMenu, type MoreMenuItem } from './header/MoreMenu'
import { useFloatingRect } from './hooks/useFloatingRect'
import { useFocusMode } from './hooks/useFocusMode'
import { BOTTOM_BAR_HEIGHT, DRAWER_DEFAULT_WIDTH, TITLE_BAR_HEIGHT, type PanelRect } from './panelGeometry'
import { ResizeHandles } from './FloatingPanel'
import { useDrawerZoom } from './useDrawerZoom'
import { tr } from '../i18n'

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
  // "Abrir ao lado" no cartão do plano: o plano inteiro ao lado do drawer.
  onOpenPlan: (text: string, path?: string) => void
  // Conversa nova recebeu o id da sessão do Claude no primeiro envio.
  onSessionStarted: (sessionId: string) => void
  // Posição e tamanho no canvas; nulo = ainda não definido (nasce à direita).
  rect: PanelRect | null
  onRectChange: (rect: PanelRect) => void
  // Os outros drawers à vista: este para encostado neles em vez de cobri-los.
  obstacles?: readonly PanelRect[]
  // Fixado: continua à vista (e móvel), e a próxima conversa abre num drawer novo no espaço livre,
  // em vez de trocar esta.
  pinned?: boolean
  // Sem ele, o item de fixar não aparece.
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
  const floating = useFloatingRect(panelRef, rect, props.onRectChange, DRAWER_DEFAULT_WIDTH, props.obstacles)
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
  // O plano também: o drawer volta ao tamanho dele e encolhe se precisar de espaço (drawerState).
  const openPlan = useStableCallback((text: string, path?: string) => {
    leaveFocus()
    props.onOpenPlan(text, path)
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
  const shell = useDrawerShell(conversation)
  const codeButton = useCodeButton(props, focus, shell.open, shell.toggle)
  // Workspace: o shell abre na primeira pasta dele (a do workspace em si é só um id).
  const shellCwd = project.folders?.[0] ?? project.path

  return (
    <aside
      ref={panelRef}
      className={`absolute flex flex-col overflow-hidden rounded-xl border border-line bg-bg ${
        focus ? 'z-50' : 'z-40 shadow-2xl shadow-black/50'
      }`}
      style={{
        ...(focus
          ? // As barras de título e de baixo ficam de fora: é pela de cima que a janela arrasta.
            { left: 0, right: 0, top: TITLE_BAR_HEIGHT, bottom: BOTTOM_BAR_HEIGHT, borderRadius: 0 }
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
        <div className="flex min-h-0 flex-1 flex-col">
        <ConversationView
          cwd={project.path}
          folders={project.folders}
          account={account}
          project={project.name}
          conversation={conversation}
          onOpenFile={openFile}
          onOpenDiff={openDiff}
          onOpenPlan={openPlan}
          onSessionStarted={props.onSessionStarted}
          zoom={zoom}
          headerClassName={focus ? '' : 'cursor-grab active:cursor-grabbing'}
          minimalHeader={focus}
          headerStyle={headerStyle}
          onHeaderPointerDown={focus ? undefined : floating.onMoveStart}
          actions={actions}
          composerAboveEnd={codeButton}
          // No foco, o fechar só sai do foco: a conversa volta para o drawer de antes.
          onClose={focus ? leaveFocus : onClose}
        />
        </div>
        {shell.open && (
          <DrawerTerminal
            sessionKey={shell.key}
            cwd={shellCwd}
            account={account}
            fontScale={zoom}
            ratio={shell.ratio}
            onRatioChange={shell.setRatio}
            areaRef={contentRef}
          />
        )}
      </div>
    </aside>
  )
}

// Botões do cabeçalho do drawer: o menu de mais opções. Some no foco. Memorizados,
// para o cabeçalho e a conversa não redesenharem enquanto o painel é arrastado.
function useDrawerActions(props: Props, focus: boolean, setFocus: (on: boolean) => Promise<void>) {
  const { pinned = false, onTogglePin, conversation, onPinToCanvas, onPopout } = props
  const draft = !!conversation.draft
  // Favoritar precisa do id da sessão: a conversa ainda não enviada não tem.
  const key = favoriteKey(conversation)
  const favorite = useFavorites().has(key ?? '')
  // Estável: a conversa muda a cada passo do Claude e redesenharia o cabeçalho à toa.
  const toggleFavorite = useStableCallback(() => setFavorite(conversation, !favorite))
  return useMemo(() => {
    if (focus) return null
    const items: MoreMenuItem[] = [
      { label: tr('Modo foco', 'Focus mode'), icon: Maximize2, onClick: () => void setFocus(true) },
      ...(onTogglePin ? [pinned ? { label: tr('Desafixar', 'Unpin'), icon: PinOff, onClick: onTogglePin } : { label: tr('Fixar', 'Pin'), icon: Pin, onClick: onTogglePin }] : []),
      // Conversa ainda não enviada não tem sessão para abrir em outro lugar.
      ...(draft
        ? []
        : [
            ...(key
              ? [
                  favorite
                    ? { label: tr('Remover dos favoritos', 'Remove from favorites'), icon: StarOff, onClick: toggleFavorite }
                    : { label: tr('Favoritar', 'Add to favorites'), icon: Star, onClick: toggleFavorite }
                ]
              : []),
            { label: tr('Colocar no canvas', 'Place on canvas'), icon: PictureInPicture2, onClick: onPinToCanvas },
            { label: tr('Abrir em janela separada', 'Open in separate window'), icon: ExternalLink, onClick: onPopout }
          ])
    ]
    return <MoreMenu items={items} />
  }, [focus, setFocus, onTogglePin, pinned, draft, key, favorite, toggleFavorite, onPinToCanvas, onPopout])
}

// Botões do código e do terminal em cima da caixa de escrever. O do código some no foco; o do
// terminal fica, porque o terminal continua embaixo.
function useCodeButton(props: Props, focus: boolean, terminalOpen: boolean, onToggleTerminal: () => void) {
  const { loose = false, codeOpen = false, onToggleCode } = props
  // Workspace: o código abre pelo link de cada arquivo, na pasta dele; a do workspace não tem projeto.
  const workspace = !!props.project.folders
  const showCode = !(focus || loose || workspace)
  return useMemo(
    () => (
      <CodeTerminalButtons
        codeOpen={codeOpen}
        onToggleCode={showCode ? onToggleCode : undefined}
        terminalOpen={terminalOpen}
        onToggleTerminal={onToggleTerminal}
      />
    ),
    [showCode, codeOpen, onToggleCode, terminalOpen, onToggleTerminal]
  )
}
