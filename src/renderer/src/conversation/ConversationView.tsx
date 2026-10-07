import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { Folder, GitBranch, X } from 'lucide-react'
import { BranchLabel } from '../canvas/BranchLabel'
import { useBranch, useUncommitted } from '../canvas/sessionsStore'
import type { ConversationSummary } from '../canvas/types'
import { ChatView } from './ChatView'
import { liveCommand, type SessionSettings } from './SessionSettings'
import { McpPanel } from './McpPanel'
import { moveConversationSettings, setConversationSettings, useConversationSettings } from './conversationSettings'
import { useConversationHistory } from './useConversationHistory'
import { addLocalEvent, mergeEvents, useLocalEvents } from './localEvents'
import { EFFORTS } from './ModelEffortPicker'
import { MODES } from './PermissionModePicker'
import { useClaudeInfo } from './useModels'
import { isSendableImage, toBase64, useChat } from './useChat'
import { FileLinkContext, type LineRange } from './fileLinks'
import { agentHint, mentionedAgents } from './AgentMenu'
import type { AgentDef } from '../../../shared/agents'
import type { UncommittedFile } from '../../../shared/sessions'
import { useEscape } from '../useEscape'

export function HeaderButton({
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

// Pasta e branch no cabeçalho: o mesmo selo de cima do card da pasta no canvas.
const TAG = 'flex h-6 items-center rounded-md border border-line bg-surface px-2 text-muted shadow-sm'

// Cor da letra de cada mudança, nos tons do VS Code.
export const KIND_COLOR: Record<UncommittedFile['kind'], string> = {
  M: 'text-needs-you',
  R: 'text-needs-you',
  A: 'text-done',
  U: 'text-done',
  D: 'text-red-400',
  '!': 'text-red-400'
}

export const KIND_LABEL: Record<UncommittedFile['kind'], string> = {
  M: 'Alterado',
  R: 'Renomeado',
  A: 'Adicionado',
  U: 'Novo, fora do git',
  D: 'Apagado',
  '!': 'Em conflito'
}

// Arquivos do repositório ainda não comitados: o ícone de controle de versão com o
// contador por cima, como o do VS Code. Clicar abre a lista; clicar num arquivo abre o
// diff dele no código da pasta.
function UncommittedBadge({
  cwd,
  files,
  onOpenDiff
}: {
  cwd: string
  files: UncommittedFile[]
  onOpenDiff?: (path: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  useEscape(() => setOpen(false), open)

  const n = files.length
  const label = `${n} ${n === 1 ? 'arquivo não comitado' : 'arquivos não comitados'}`
  // Caminhos relativos à pasta da conversa; fora dela (pasta é parte do repo), com ~.
  const home = window.api.homeDir
  const base = (cwd.startsWith('~/') ? home + cwd.slice(1) : cwd).replace(/\/$/, '') + '/'
  const shown = (path: string) =>
    path.startsWith(base) ? path.slice(base.length) : path.startsWith(home + '/') ? '~' + path.slice(home.length) : path

  return (
    <div ref={ref} className="relative">
      <button
        aria-label={label}
        title={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`relative flex size-7 items-center justify-center rounded-md ${
          open ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2 hover:text-text'
        }`}
      >
        <GitBranch size={16} aria-hidden="true" />
        <span className="absolute -right-1 bottom-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-badge px-1 text-[10px] font-semibold leading-none text-white">
          {n > 999 ? '999+' : n}
        </span>
      </button>

      {open && (
        // pointerdown não sobe: o cabeçalho arrasta o painel.
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute right-0 top-full z-50 mt-1 flex max-h-96 w-80 cursor-default flex-col rounded-lg border border-line bg-surface shadow-2xl shadow-black/30"
        >
          <div className="shrink-0 border-b border-line px-3 py-2 text-[11px] text-faint">{label}</div>
          <ul className="min-h-0 overflow-y-auto p-1">
            {files.map((f) => {
              const rel = shown(f.path)
              const slash = rel.lastIndexOf('/')
              const name = rel.slice(slash + 1)
              const dir = slash > 0 ? rel.slice(0, slash) : ''
              // Fora da pasta, o visualizador não alcança.
              const canOpen = !!onOpenDiff && f.path.startsWith(base)
              return (
                <li key={f.path}>
                  <button
                    disabled={!canOpen}
                    title={rel}
                    onClick={() => {
                      onOpenDiff?.(f.path)
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs enabled:hover:bg-surface-2"
                  >
                    <span className={`min-w-0 truncate text-text ${f.kind === 'D' ? 'line-through' : ''}`}>{name}</span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-faint">{dir}</span>
                    <span title={KIND_LABEL[f.kind]} className={`shrink-0 font-mono text-[11px] font-semibold ${KIND_COLOR[f.kind]}`}>
                      {f.kind}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// Cabeçalho e chat de uma conversa, sem decidir onde eles moram: servem ao painel lateral
// (ConversationDrawer) e à janela separada (ConversationWindow).
export function ConversationView({
  cwd,
  project,
  conversation,
  onOpenFile,
  onOpenDiff,
  onSessionStarted,
  zoom = 1,
  actions,
  headerClassName = '',
  headerStyle,
  onHeaderPointerDown,
  onClose
}: {
  // Pasta onde o Claude roda.
  cwd: string
  // Nome da pasta, mostrado no cabeçalho.
  project?: ReactNode
  conversation: ConversationSummary
  // Link de arquivo clicado no chat; sem isso, os links viram texto comum.
  onOpenFile?: (path: string, lines?: LineRange) => void
  // Arquivo da lista de não comitados; sem isso, a lista só mostra.
  onOpenDiff?: (path: string) => void
  // Conversa nova recebeu o id da sessão do Claude no primeiro envio.
  onSessionStarted?: (sessionId: string) => void
  // Escala do conteúdo, ajustada com ⌘+ / ⌘- (useDrawerZoom).
  zoom?: number
  // Botões extras do cabeçalho, antes do fechar.
  actions?: ReactNode
  headerClassName?: string
  headerStyle?: CSSProperties
  onHeaderPointerDown?: (e: PointerEvent) => void
  onClose: () => void
}) {
  const [mcpOpen, setMcpOpen] = useState(false)
  // Agentes para o @: relidos ao abrir a conversa, para pegar os criados na biblioteca.
  const [agents, setAgents] = useState<AgentDef[]>([])
  useEffect(() => {
    let alive = true
    window.api.agents.list(cwd).then((list) => alive && setAgents(list))
    return () => {
      alive = false
    }
  }, [cwd, conversation.id])
  const live = useChat(conversation.id)
  // Enquanto a conversa está na tela a sessão fica de pé; ao fechar, ela é encerrada.
  useEffect(() => {
    const key = conversation.id
    window.api.chat.retain(key)
    return () => window.api.chat.release(key)
  }, [conversation.id])

  // Branch atual da pasta: é nela que o Claude vai trabalhar ao responder.
  const branch = useBranch(cwd)
  const uncommitted = useUncommitted(cwd)
  const history = useConversationHistory(cwd, conversation.sessionId, conversation.updatedAt, live?.revision)
  const localEvents = useLocalEvents(conversation.sessionId)
  const messages = useMemo(() => mergeEvents(history.messages, localEvents), [history.messages, localEvents])
  const info = useClaudeInfo()
  // Com o chat ligado aqui, o status dele manda: o registro do Claude Code demora a dizer
  // que parou, e isso deixava a conversa como "trabalhando" depois de você mandar parar.
  const status = live ? live.status : conversation.status

  // Conversa nova ainda sem sessão guarda as trocas pelo id provisório.
  const settings = useConversationSettings(conversation.sessionId ?? conversation.id)

  const sessionId = live?.sessionId
  useEffect(() => {
    if (!conversation.draft || !sessionId) return
    moveConversationSettings(conversation.id, sessionId)
    onSessionStarted?.(sessionId)
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
      cwd,
      sessionId: conversation.sessionId,
      settings,
      text: full,
      images,
      hint: agentHint(mentionedAgents(text, agents))
    })
  }

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
    setConversationSettings(conversation.sessionId ?? conversation.id, patch)
    const command = liveCommand(patch)
    if (command) window.api.terminal.write(conversation.id, `${command}\r`)
    window.api.chat.configure(conversation.id, patch)
  }

  return (
    <>
      <header
        onPointerDown={onHeaderPointerDown}
        className={`flex shrink-0 items-start gap-3 border-b border-line px-4 py-3 ${headerClassName}`}
        style={headerStyle}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{conversation.title}</div>
          {/* Conversa sem projeto, fora de repositório: não tem o que mostrar aqui. */}
          {(project || branch) && (
            <div className="mt-1 flex items-center gap-2 text-[11px] text-faint">
              {project && (
                <span className={`${TAG} min-w-0 gap-1`}>
                  <Folder size={12} className="shrink-0" />
                  <span className="truncate">{project}</span>
                </span>
              )}
              {branch && (
                <span className={`${TAG} max-w-[40%] shrink-0`}>
                  <BranchLabel branch={branch} />
                </span>
              )}
            </div>
          )}
        </div>

        <div className="no-drag flex shrink-0 items-center gap-1">
          {!!uncommitted?.length && <UncommittedBadge cwd={cwd} files={uncommitted} onOpenDiff={onOpenDiff} />}
          {actions}
          <HeaderButton label="Fechar" onClick={onClose}>
            <X size={15} />
          </HeaderButton>
        </div>
      </header>

      {/* key: trocar de conversa recria o conteúdo (rolagem); o rascunho fica guardado por conversa */}
      <FileLinkContext.Provider value={onOpenFile ?? null}>
        <div className="flex min-h-0 flex-1 flex-col" style={zoom === 1 ? undefined : { zoom }}>
          <ChatView
            key={conversation.id}
            draftKey={conversation.id}
            messages={messages}
            loading={history.loading}
            status={status}
            live={live}
            onSend={send}
            loadImages={(id) =>
              conversation.sessionId ? window.api.sessions.images(cwd, conversation.sessionId, id) : Promise.resolve([])
            }
            onOpenMcp={() => setMcpOpen(true)}
            onRemoteControl={(enabled) =>
              window.api.chat.remoteControl({ key: conversation.id, cwd, sessionId: conversation.sessionId, settings, enabled })
            }
            onInterrupt={() => window.api.chat.interrupt(conversation.id)}
            onAnswer={(id, answer) => window.api.chat.answer(conversation.id, id, answer)}
            settings={settings}
            onSettingChange={change}
            contextPercent={conversation.contextPercent}
            agents={agents}
          />
        </div>
      </FileLinkContext.Provider>
      {mcpOpen && <McpPanel conversationKey={conversation.id} cwd={cwd} onClose={() => setMcpOpen(false)} />}
    </>
  )
}
