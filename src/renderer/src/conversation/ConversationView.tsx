import { memo, useCallback, useEffect, useEffectEvent, useMemo, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { agentProviderOf } from '../../../shared/agents'
import { parseAgentRef } from '../../../shared/providers'
import { AccountContext } from '../auth/useAuth'
import { useViewing } from '../canvas/sessionsStore'
import type { ConversationSummary } from '../canvas/types'
import { useStableCallback } from '../lib/useStableCallback'
import { Presence } from '../motion'
import { ChatView } from './ChatView'
import { moveConversationAccount, setConversationAccount, useConversationAccountChoice } from './conversationAccount'
import { moveConversationSettings, useConversationSettings } from './conversationSettings'
import { fileInFolder } from '../canvas/drawers/fileInFolder'
import { FileLinkContext, FileRevealContext, type LineRange } from './fileLinks'
import { isAbsolutePath } from '../platform'
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
  // Workspace: as pastas dele; o cwd é a pasta do workspace nos dados do Argus (ver ProjectData.folders).
  folders?: string[]
  // Conta do Claude do grupo da pasta; vazia = a padrão. Vale para a conversa nova sem conta
  // escolhida e para as antigas sem conta guardada (ver conversationAccount.ts).
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
  folders,
  account: groupAccount,
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
  // Na tela: a resposta que chegar aqui já foi vista (a bolinha da lista não fica verde).
  useViewing(conversation.sessionId ?? live?.sessionId ?? conversation.id)
  const history = useConversationHistory(cwd, conversation.sessionId, conversation.updatedAt, live?.revision)
  const localEvents = useLocalEvents(conversation.sessionId)
  const messages = useMemo(() => mergeEvents(history.messages, localEvents), [history.messages, localEvents])
  // Com o chat ligado aqui, o status dele manda: o registro do Claude Code demora a dizer
  // que parou, e isso deixava a conversa como "trabalhando" depois de você mandar parar.
  const status = live ? live.status : conversation.status
  // Conversa nova ainda sem sessão guarda as trocas (e a conta) pelo id provisório.
  const settingsId = conversation.sessionId ?? conversation.id
  const chosen = useConversationAccountChoice(settingsId)
  const account = conversationAccount(conversation, chosen ?? groupAccount, live?.agent)
  const agents = useAgentList(cwd, viewKey, agentProviderOf(account))
  // A conta só troca com a conversa vazia: nada enviado e nenhuma sessão aberta.
  const canChangeAccount = !!conversation.draft && !live && !messages.length
  const chooseAccount = useCallback((id: string) => setConversationAccount(settingsId, id), [settingsId])
  const settings = useConversationSettings(settingsId)
  const actionsFor = useConversationActions({ chatKey: viewKey, conversation, cwd, folders, account, settings, agents })

  // Conversa nova recebeu o id da sessão: as trocas feitas antes vão junto, e quem mostra fica sabendo.
  const sessionId = live?.sessionId
  const started = useEffectEvent((sid: string) => {
    if (!conversation.draft) return
    moveConversationSettings(conversation.id, sid)
    moveConversationAccount(conversation.id, sid)
    onSessionStarted?.(sid)
  })
  useEffect(() => {
    if (sessionId) started(sessionId)
  }, [sessionId])

  // O valor do contexto é fixo: com uma função nova a cada desenho, todo link de toda mensagem
  // redesenhava (o drawer mandava uma nova a cada arraste no canvas).
  // No workspace o arquivo é procurado em cada pasta dele: a da conversa só tem o aviso para os agentes.
  const roots = folders ?? [cwd]
  const openFile = useStableCallback((path: string, lines?: LineRange) => {
    void locate(roots, path).then((found) => onOpenFile?.(found, lines))
  })
  const revealFile = useStableCallback((path: string) => {
    void locate(roots, path).then((found) => {
      const root = roots.find((r) => fileInFolder(r, found) !== null && isAbsolutePath(found))
      const rel = root ? fileInFolder(root, found) : fileInFolder(cwd, found)
      if (rel) window.api.files.reveal(root ?? cwd, rel)
    })
  })
  const [mcpOpen, setMcpOpen] = useState(false)
  const openMcp = useCallback(() => setMcpOpen(true), [])
  const closeMcp = useCallback(() => setMcpOpen(false), [])

  return (
    <AccountContext.Provider value={account}>
      <ConversationHeader
        title={conversation.title}
        cwd={cwd}
        folders={folders}
        project={project}
        account={account}
        onAccountChange={canChangeAccount ? chooseAccount : undefined}
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
      <FileRevealContext.Provider value={onOpenFile ? revealFile : null}>
        <div className={`flex min-h-0 flex-1 flex-col ${bodyClassName}`} style={zoom === 1 ? undefined : { zoom }}>
          <ChatView
            key={viewKey}
            draftKey={conversation.id}
            messages={messages}
            loading={history.loading}
            older={history.older}
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
      </FileRevealContext.Provider>
      </FileLinkContext.Provider>
      <Presence kind="modal">
        {mcpOpen && <McpPanel conversationKey={viewKey} cwd={cwd} account={account} onClose={closeMcp} />}
      </Presence>
    </AccountContext.Provider>
  )
})

// Agente e conta que rodam a conversa: a que já existe continua com o dela (outro agente, ou o
// Claude mesmo num grupo que agora é de outro agente); a nova usa o do grupo.
function conversationAccount(conversation: ConversationSummary, group?: string, running?: string): string | undefined {
  if (conversation.agent ?? running) return conversation.agent ?? running
  const started = !conversation.draft && !!conversation.sessionId
  return started && parseAgentRef(group) ? undefined : group
}

// Caminho relativo do link: o Claude às vezes corta o começo ("conversation/X.tsx" dentro de
// src/renderer/src). O principal acha o arquivo; sem achar, segue o original e o erro aparece.
async function locate(roots: string[], path: string): Promise<string> {
  if (isAbsolutePath(path) || path.startsWith('~')) return path
  for (const root of roots) {
    const found = await window.api.files.locate(root, path).catch(() => null)
    if (found) return found
  }
  return path
}
