import { useRef } from 'react'
import { Code2, ExternalLink, PictureInPicture2 } from 'lucide-react'
import type { ConversationSummary, ProjectData } from '../canvas/types'
import { ConversationView, HeaderButton } from './ConversationView'
import { DRAWER_DEFAULT_WIDTH, ResizeHandles, useFloatingRect, type PanelRect } from './FloatingPanel'
import { useDrawerZoom } from './useDrawerZoom'
import type { LineRange } from './fileLinks'
import { useEscape } from '../useEscape'

// Painel flutuante à direita. Não é modal: o canvas continua clicável ao lado,
// e abrir outra conversa troca o conteúdo deste mesmo painel.
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
  useEscape(onClose)

  return (
    <aside
      ref={panelRef}
      className="absolute z-40 flex flex-col overflow-hidden rounded-xl border border-line bg-bg shadow-2xl shadow-black/50"
      style={{
        ...(rect ? { left: rect.x, top: rect.y, width: rect.width, height: rect.height } : { visibility: 'hidden', inset: 0 }),
        ...(tint && {
          borderColor: `color-mix(in srgb, ${tint} 35%, var(--color-line))`,
          background: `color-mix(in srgb, ${tint} 3%, var(--color-bg))`
        })
      }}
    >
      <ResizeHandles onResizeStart={floating.onResizeStart} />
      <ConversationView
        cwd={project.path}
        account={account}
        project={loose ? undefined : project.name}
        conversation={conversation}
        onOpenFile={onOpenFile}
        onOpenDiff={onOpenDiff}
        onSessionStarted={onSessionStarted}
        zoom={zoom}
        headerClassName="cursor-grab active:cursor-grabbing"
        headerStyle={{
          zoom,
          ...(tint && {
            background: `color-mix(in srgb, ${tint} 8%, var(--color-bg))`,
            borderBottomColor: `color-mix(in srgb, ${tint} 25%, var(--color-line))`
          })
        }}
        onHeaderPointerDown={floating.onMoveStart}
        actions={
          <>
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
        }
        onClose={onClose}
      />
    </aside>
  )
}
