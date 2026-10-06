import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Code2, ExternalLink, Folder, X } from 'lucide-react'
import { STATUS_LABEL, StatusDot } from '../canvas/StatusBadge'
import type { ConversationSummary, ProjectData } from '../canvas/types'
import { ChatView } from './ChatView'
import { ResizeHandles, useFloatingRect, type PanelRect } from './FloatingPanel'
import { liveCommand, type SessionSettings } from './SessionSettings'
import { useConversationHistory } from './useConversationHistory'
import { addLocalEvent, mergeEvents, useLocalEvents } from './localEvents'
import { EFFORTS } from './ModelEffortPicker'
import { MODES } from './PermissionModePicker'
import { useClaudeInfo } from './useModels'
import { useDrawerZoom } from './useDrawerZoom'
import { isSendableImage, toBase64, useChat } from './useChat'
import { FileLinkContext, type LineRange } from './fileLinks'

// Espaço dos botões do sistema no topo da janela (pl-20), em px de tela.
const TRAFFIC_LIGHTS = 80

function HeaderButton({
  label,
  onClick,
  active,
  children
}: {
  label: string
  onClick: () => void
  active?: boolean
  children: ReactNode
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex size-7 items-center justify-center rounded-md ${
        active ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2 hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}

// Painel flutuante à direita. Não é modal: o canvas continua clicável ao lado,
// e abrir outra conversa troca o conteúdo deste mesmo painel.
export function ConversationDrawer({
  project,
  conversation,
  settings,
  onSettingsChange,
  codeOpen,
  onToggleCode,
  onPopout,
  onOpenFile,
  onSessionStarted,
  variant = 'panel',
  rect = null,
  onRectChange,
  onClose
}: {
  project: ProjectData
  conversation: ConversationSummary
  settings: SessionSettings
  onSettingsChange: (settings: SessionSettings) => void
  codeOpen: boolean
  onToggleCode: () => void
  // Abre a conversa numa janela própria do sistema (só no painel).
  onPopout?: () => void
  // Link de arquivo clicado no chat (só no painel, onde existe o visualizador de código).
  onOpenFile?: (path: string, lines?: LineRange) => void
  // Conversa nova recebeu o id da sessão do Claude no primeiro envio.
  onSessionStarted?: (sessionId: string) => void
  // 'window': ocupa a janela inteira, sem arrastar nem código.
  variant?: 'panel' | 'window'
  // Posição e tamanho no canvas; nulo = ainda não definido (nasce à direita).
  rect?: PanelRect | null
  onRectChange?: (rect: PanelRect) => void
  onClose: () => void
}) {
  const isWindow = variant === 'window'
  const zoom = useDrawerZoom()
  const live = useChat(conversation.id)
  // Enquanto a conversa está na tela a sessão fica de pé; ao fechar, ela é encerrada.
  useEffect(() => {
    const key = conversation.id
    window.api.chat.retain(key)
    return () => window.api.chat.release(key)
  }, [conversation.id])

  const history = useConversationHistory(project.path, conversation.sessionId, conversation.updatedAt, live?.revision)
  const localEvents = useLocalEvents(conversation.sessionId)
  const messages = useMemo(() => mergeEvents(history.messages, localEvents), [history.messages, localEvents])
  const info = useClaudeInfo()
  // Com o chat ligado, o status dele chega na hora; sem ele, vem do registro do Claude Code.
  const status = live && live.status !== 'idle' ? live.status : conversation.status

  const sessionId = live?.sessionId
  useEffect(() => {
    if (conversation.draft && sessionId) onSessionStarted?.(sessionId)
  }, [conversation.draft, sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Imagens vão junto da mensagem; outros arquivos, pelo caminho no disco.
  const send = async (text: string, files: File[]) => {
    const images = await Promise.all(
      files.filter(isSendableImage).map(async (f) => ({ mediaType: f.type, data: await toBase64(f) }))
    )
    const paths = files.filter((f) => !isSendableImage(f)).map((f) => window.api.filePath(f)).filter(Boolean)
    const full = paths.length ? `${text}\n\nArquivos anexados:\n${paths.map((p) => `- ${p}`).join('\n')}`.trim() : text
    window.api.chat.send({
      key: conversation.id,
      cwd: project.path,
      sessionId: conversation.sessionId,
      settings,
      text: full,
      images
    })
  }
  const panelRef = useRef<HTMLElement>(null)
  const floating = useFloatingRect(panelRef, isWindow ? null : rect, (r) => onRectChange?.(r))

  // Numa sessão de terminal já aberta, a troca vai como comando do próprio Claude Code.
  // Sem sessão aberta, o write é ignorado e a escolha vale ao abrir o terminal.
  // Divisor no chat para cada troca feita aqui, como na extensão do VS Code.
  const markChange = (patch: Partial<SessionSettings>) => {
    const sid = conversation.sessionId
    if (!sid) return
    if (patch.model !== undefined) {
      const m = info?.models.find((x) => x.value === patch.model)
      addLocalEvent(sid, 'model', `Modelo: ${m?.value === '' ? `Padrão${m.resolvedName ? ` (${m.resolvedName})` : ''}` : m?.displayName ?? patch.model}`)
    }
    if (patch.effort !== undefined) {
      addLocalEvent(sid, 'effort', `Esforço: ${EFFORTS.find((e) => e.value === patch.effort)?.label ?? 'automático'}`)
    }
    if (patch.permissionMode !== undefined) {
      addLocalEvent(sid, 'mode', `Modo: ${MODES.find((x) => x.value === patch.permissionMode)?.label ?? 'padrão da conta'}`)
    }
    if (patch.thinking !== undefined) addLocalEvent(sid, 'thinking', `Raciocínio ${patch.thinking ? 'ligado' : 'desligado'}`)
    if (patch.ultracode !== undefined) addLocalEvent(sid, 'ultracode', `Ultracode ${patch.ultracode ? 'ligado' : 'desligado'}`)
  }

  const change = (patch: Partial<SessionSettings>) => {
    markChange(patch)
    onSettingsChange({ ...settings, ...patch })
    const command = liveCommand(patch)
    if (command) window.api.terminal.write(conversation.id, `${command}\r`)
    window.api.chat.configure(conversation.id, patch)
  }

  return (
    <aside
      ref={panelRef}
      className={`absolute z-40 flex flex-col overflow-hidden bg-bg ${
        isWindow
          ? 'inset-0'
          : 'rounded-xl border border-line shadow-2xl shadow-black/50'
      }`}
      style={
        isWindow
          ? undefined
          : rect
            ? { left: rect.x, top: rect.y, width: rect.width, height: rect.height }
            : { visibility: 'hidden', inset: 0 }
      }
    >
      {!isWindow && onRectChange && <ResizeHandles onResizeStart={floating.onResizeStart} />}
      <header
        onPointerDown={isWindow ? undefined : floating.onMoveStart}
        className={`flex items-start gap-3 border-b border-line px-4 py-3 ${
          isWindow ? 'drag' : 'cursor-grab active:cursor-grabbing'
        }`}
        // Os botões do sistema não acompanham a escala: o recuo volta ao tamanho de tela.
        style={{ zoom, ...(isWindow ? { paddingLeft: TRAFFIC_LIGHTS / zoom } : null) }}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{conversation.title}</div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-faint">
            <Folder size={12} className="shrink-0" />
            <span className="truncate">{project.name}</span>
            <span>·</span>
            <StatusDot status={status} />
            <span>{STATUS_LABEL[status]}</span>
          </div>
        </div>

        <div className="no-drag flex shrink-0 items-center gap-1">
          {!isWindow && (
            <>
              <HeaderButton label={codeOpen ? 'Fechar código' : 'Abrir código'} onClick={onToggleCode} active={codeOpen}>
                <Code2 size={14} />
              </HeaderButton>
              {onPopout && (
                <HeaderButton label="Abrir em janela separada" onClick={onPopout}>
                  <ExternalLink size={14} />
                </HeaderButton>
              )}
            </>
          )}
          <HeaderButton label="Fechar" onClick={onClose}>
            <X size={15} />
          </HeaderButton>
        </div>
      </header>

      {/* key: trocar de conversa recria o conteúdo (rascunho, rolagem) */}
      <FileLinkContext.Provider value={onOpenFile ?? null}>
          <div className="flex min-h-0 flex-1 flex-col" style={{ zoom }}>
            <ChatView
              key={conversation.id}
              messages={messages}
              loading={history.loading}
              status={status}
              live={live}
              onSend={send}
              onInterrupt={() => window.api.chat.interrupt(conversation.id)}
              onAnswer={(id, answer) => window.api.chat.answer(conversation.id, id, answer)}
              settings={settings}
              onSettingChange={change}
              contextPercent={conversation.contextPercent}
            />
          </div>
      </FileLinkContext.Provider>
    </aside>
  )
}
