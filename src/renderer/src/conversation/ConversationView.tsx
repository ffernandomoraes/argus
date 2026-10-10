import { memo, useCallback, useEffect, useEffectEvent, useMemo, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { AccountContext } from '../auth/useAuth'
import type { ConversationSummary } from '../canvas/types'
import { useStableCallback } from '../lib/useStableCallback'
import { Presence } from '../motion'
import { ChatView } from './ChatView'
import { moveConversationSettings, useConversationSettings } from './conversationSettings'
import { FileLinkContext, type LineRange } from './fileLinks'
import { ConversationHeader } from './header/ConversationHeader'
import { useAgentList } from './hooks/useAgentList'
import { useConversationActions } from './hooks/useConversationActions'
import { useLiveChat } from './hooks/useLiveChat'
import { useViewKey } from './hooks/useViewKey'
import { useLocalEvents } from './localEvents'
import { McpPanel } from './McpPanel'
import { mergeEvents } from './mergeEvents'
import { useConversationHistory } from './useConversationHistory'

// O botão do cabeçalho e as cores das mudanças moram em header/; saem daqui também, como antes,
// para o canvas, o design e o código.
export { HeaderButton } from './header/HeaderButton'
export { KIND_COLOR, KIND_LABEL } from './header/changeKinds'

type Props = {
  // Pasta onde o Claude roda.
  cwd: string
  // Conta do Claude do grupo da pasta; vazia = a padrão. Só vale ao abrir a sessão: a conversa já
  // aberta segue na conta com que abriu.
  account?: string
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
  // Classes do corpo (chat). No canvas, tiram o corpo do arraste e do pan para dar para ler e escrever.
  bodyClassName?: string
  // Modo foco do drawer: cabeçalho numa linha só, com o título e o fechar (sem pasta, branch,
  // não comitados nem a borda de baixo), e a caixa de escrever sem a linha de cima.
  minimalHeader?: boolean
  // Caixa de escrever com o foco ao abrir (padrão). O bloco no canvas só pede quando é novo.
  autoFocus?: boolean
  onClose: () => void
}

// Cabeçalho e chat de uma conversa, sem decidir onde eles moram: servem ao painel lateral
// (ConversationDrawer), à janela separada (ConversationWindow) e ao bloco no canvas (ChatPanelNode).
// Memorizado: arrastar o canvas ou o painel não redesenha a conversa.
export const ConversationView = memo(function ConversationView({
  cwd,
  account,
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
  bodyClassName = '',
  minimalHeader = false,
  autoFocus = true,
  onClose
}: Props) {
  const viewKey = useViewKey(conversation)
  const live = useLiveChat(viewKey)
  const agents = useAgentList(cwd, viewKey)
  const history = useConversationHistory(cwd, conversation.sessionId, conversation.updatedAt, live?.revision)
  const localEvents = useLocalEvents(conversation.sessionId)
  const messages = useMemo(() => mergeEvents(history.messages, localEvents), [history.messages, localEvents])
  // Com o chat ligado aqui, o status dele manda: o registro do Claude Code demora a dizer
  // que parou, e isso deixava a conversa como "trabalhando" depois de você mandar parar.
  const status = live ? live.status : conversation.status
  // Conversa nova ainda sem sessão guarda as trocas pelo id provisório.
  const settings = useConversationSettings(conversation.sessionId ?? conversation.id)
  const actionsFor = useConversationActions({ chatKey: viewKey, conversation, cwd, account, settings, agents })

  // Conversa nova recebeu o id da sessão: as trocas feitas antes vão junto, e quem mostra fica sabendo.
  const sessionId = live?.sessionId
  const started = useEffectEvent((sid: string) => {
    if (!conversation.draft) return
    moveConversationSettings(conversation.id, sid)
    onSessionStarted?.(sid)
  })
  useEffect(() => {
    if (sessionId) started(sessionId)
  }, [sessionId])

  // O valor do contexto é fixo: com uma função nova a cada desenho, todo link de toda mensagem
  // redesenhava (o drawer mandava uma nova a cada arraste no canvas).
  const openFile = useStableCallback((path: string, lines?: LineRange) => onOpenFile?.(path, lines))
  const [mcpOpen, setMcpOpen] = useState(false)
  const openMcp = useCallback(() => setMcpOpen(true), [])
  const closeMcp = useCallback(() => setMcpOpen(false), [])

  return (
    <AccountContext.Provider value={account}>
      <ConversationHeader
        title={conversation.title}
        cwd={cwd}
        project={project}
        minimal={minimalHeader}
        actions={actions}
        onOpenDiff={onOpenDiff}
        onClose={onClose}
        className={headerClassName}
        style={headerStyle}
        onPointerDown={onHeaderPointerDown}
      />

      {/* key: trocar de conversa recria o conteúdo (rolagem); o rascunho fica guardado por conversa */}
      <FileLinkContext.Provider value={onOpenFile ? openFile : null}>
        <div className={`flex min-h-0 flex-1 flex-col ${bodyClassName}`} style={zoom === 1 ? undefined : { zoom }}>
          <ChatView
            key={viewKey}
            draftKey={conversation.id}
            messages={messages}
            loading={history.loading}
            status={status}
            live={live}
            onSend={actionsFor.send}
            loadImages={actionsFor.loadImages}
            onOpenMcp={openMcp}
            onRemoteControl={actionsFor.remoteControl}
            onInterrupt={actionsFor.interrupt}
            onAnswer={actionsFor.answer}
            settings={settings}
            onSettingChange={actionsFor.change}
            contextPercent={conversation.contextPercent}
            agents={agents}
            composerBorder={!minimalHeader}
            autoFocus={autoFocus}
          />
        </div>
      </FileLinkContext.Provider>
      <Presence kind="modal">
        {mcpOpen && <McpPanel conversationKey={viewKey} cwd={cwd} account={account} onClose={closeMcp} />}
      </Presence>
    </AccountContext.Provider>
  )
})
