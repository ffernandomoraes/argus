import { useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Code2, ExternalLink, Maximize2, PictureInPicture2 } from 'lucide-react'
import type { ConversationSummary, ProjectData } from '../canvas/types'
import { ConversationView, HeaderButton } from './ConversationView'
import {
  DRAWER_DEFAULT_WIDTH,
  ResizeHandles,
  TITLE_BAR_HEIGHT,
  useFloatingRect,
  type PanelRect
} from './FloatingPanel'
import { useDrawerZoom } from './useDrawerZoom'
import type { LineRange } from './fileLinks'
import { useEscape } from '../useEscape'
import { MOTION, reduced } from '../motion'

// Troca do modo foco com o efeito padrão (motion.tsx): o painel some, o layout troca enquanto
// ele está invisível, e ele volta no novo tamanho. Esticar a largura deixava o texto se
// rearrumando na frente de quem lê.
const HIDDEN = { opacity: 0, transform: MOTION.panel.to }
const SHOWN = { opacity: 1, transform: 'none' }

// Painel flutuante à direita. Não é modal: o canvas continua clicável ao lado,
// e abrir outra conversa troca o conteúdo deste mesmo painel.
// No modo foco, o painel cobre a área toda abaixo da barra de título e a conversa fica numa
// coluna estreita no centro: para ler respostas longas sem distração.
export function ConversationDrawer({
  project,
  account,
  loose = false,
  tint,
  conversation,
  codeOpen,
  onToggleCode,
  onPopout,
  onPinToCanvas,
  onOpenFile,
  onOpenDiff,
  onSessionStarted,
  rect,
  onRectChange,
  onClose
}: {
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
  onClose: () => void
}) {
  const zoom = useDrawerZoom()
  const panelRef = useRef<HTMLElement>(null)
  const floating = useFloatingRect(panelRef, rect, onRectChange, DRAWER_DEFAULT_WIDTH)
  const [focus, setFocusNow] = useState(false)
  const switching = useRef(false)

  // Outra conversa no mesmo drawer: o painel fica, e só o conteúdo entra com o efeito padrão
  // (fade subindo uns pixels). Sem fade de saída: a conversa antiga já deixou de ser a aberta,
  // e segurá-la na tela misturaria o histórico dela com a pasta da nova.
  const contentRef = useRef<HTMLDivElement>(null)
  const shownId = useRef(conversation.id)
  useLayoutEffect(() => {
    if (shownId.current === conversation.id) return
    shownId.current = conversation.id
    if (reduced()) return
    contentRef.current?.animate(
      [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      MOTION.panel.in
    )
  }, [conversation.id])
  const setFocus = async (on: boolean) => {
    const panel = panelRef.current
    if (on === focus || switching.current) return
    if (!panel || matchMedia('(prefers-reduced-motion: reduce)').matches) return setFocusNow(on)
    switching.current = true
    const out = panel.animate([SHOWN, HIDDEN], { ...MOTION.panel.out, fill: 'forwards' })
    await out.finished.catch(() => {})
    flushSync(() => setFocusNow(on))
    // O fade de entrada começa já no estado escondido, então tirar o de saída não pisca.
    const enter = panel.animate([{ opacity: 0, transform: MOTION.panel.from }, SHOWN], MOTION.panel.in)
    out.cancel()
    await enter.finished.catch(() => {})
    switching.current = false
  }
  useEscape(onClose)
  // Empilhado depois do fechar: o primeiro ESC sai do foco, o segundo fecha.
  useEscape(() => setFocus(false), focus)

  // Arquivo e diff abrem no código ao lado, por baixo do foco: saem dele para aparecer.
  const unfocused = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
    setFocus(false)
    fn(...args)
  }

  const view = (
    <ConversationView
      cwd={project.path}
      account={account}
      project={loose ? undefined : project.name}
      conversation={conversation}
      onOpenFile={unfocused(onOpenFile)}
      onOpenDiff={unfocused(onOpenDiff)}
      onSessionStarted={onSessionStarted}
      zoom={zoom}
      headerClassName={focus ? '' : 'cursor-grab active:cursor-grabbing'}
      minimalHeader={focus}
      // No foco, o cabeçalho tem a cor do painel: o tom do grupo destacava demais.
      headerStyle={{
        zoom,
        ...(tint && !focus && {
          background: `color-mix(in srgb, ${tint} 8%, var(--color-bg))`,
          borderBottomColor: `color-mix(in srgb, ${tint} 25%, var(--color-line))`
        })
      }}
      onHeaderPointerDown={focus ? undefined : floating.onMoveStart}
      actions={
        !focus && (
          <>
            <HeaderButton label="Modo foco" onClick={() => setFocus(true)}>
              <Maximize2 size={14} />
            </HeaderButton>
            {!loose && (
              <HeaderButton label={codeOpen ? 'Fechar código' : 'Abrir código'} onClick={onToggleCode} active={codeOpen}>
                <Code2 size={14} />
              </HeaderButton>
            )}
            {/* Conversa ainda não enviada não tem sessão para abrir em outro lugar. */}
            {!conversation.draft && (
              <>
                <HeaderButton label="Colocar no canvas" onClick={onPinToCanvas}>
                  <PictureInPicture2 size={14} />
                </HeaderButton>
                <HeaderButton label="Abrir em janela separada" onClick={onPopout}>
                  <ExternalLink size={14} />
                </HeaderButton>
              </>
            )}
          </>
        )
      }
      // No foco, o fechar só sai do foco: a conversa volta para o drawer de antes.
      onClose={focus ? () => setFocus(false) : onClose}
    />
  )

  return (
    <aside
      ref={panelRef}
      className={`absolute z-40 flex flex-col overflow-hidden rounded-xl border border-line bg-bg ${
        focus ? '' : 'shadow-2xl shadow-black/50'
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
          background: `color-mix(in srgb, ${tint} 3%, var(--color-bg))`
        }),
        ...(focus && { borderColor: 'transparent' })
      }}
    >
      {!focus && <ResizeHandles onResizeStart={floating.onResizeStart} />}
      {/* Mesmo elemento nos dois modos: trocar a árvore recriaria a conversa e soltaria a sessão.
          No foco vira a coluna de leitura: linhas curtas cansam menos que texto de ponta a ponta. */}
      <div ref={contentRef} className={`flex min-h-0 w-full flex-1 flex-col ${focus ? 'mx-auto max-w-[1100px]' : ''}`}>{view}</div>
    </aside>
  )
}
