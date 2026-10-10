import { useEffect, useRef, type ReactNode } from 'react'
import type { Design, DesignDevice } from '../../../shared/design'
import { AccountContext } from '../auth/accountContext'
import { agentHint, mentionedAgents } from '../conversation/agentMentions'
import { imagesForSend } from '../conversation/chatImages'
import { DESIGN_PREFIX, useViewing } from '../canvas/sessionsStore'
import { pressEscape } from '../useEscape'
import { AddressBar } from './AddressBar'
import { CommentLayer } from './comments/CommentLayer'
import { commentsHint } from './comments/commentsText'
import { useComments } from './comments/useComments'
import { usePageMessages } from './page/usePageMessages'
import { sendPrototype } from './prototype/conversation'
import { markOf, requestHint, type PageInView } from './prototype/hints'
import { PrototypeChat } from './PrototypeChat'
import { PrototypeFrame } from './PrototypeFrame'
import { ServerPlaceholder } from './ServerPlaceholder'
import { useContextPercent } from './useContextPercent'
import { useProjectAgents } from './useProjectAgents'
import { usePrototypeAddress } from './usePrototypeAddress'
import { usePrototypeSession } from './usePrototypeSession'

// Protótipo: a conversa do Claude Code na pasta escreve a tela no código do projeto, e a página
// aparece aqui pelo servidor de desenvolvimento dele, atualizando a cada arquivo salvo. À esquerda
// fica a conversa inteira, a mesma do chat; à direita, a página.
export function PrototypePane({
  design,
  account,
  onUpdate,
  device,
  start,
  viewing = false,
  onViewing
}: {
  design: Design
  account?: string
  // O que a conversa informa (sessão, endereço, nome) e o endereço digitado entram no design.
  onUpdate: (patch: Partial<Design>) => void
  // Largura em que a página aparece agora (a troca Desktop | Celular); sem ela, a do design.
  device?: DesignDevice
  // Design que ainda não começou: no lugar da página, a escolha de como começar.
  start?: ReactNode
  // Visualizar: só a página e a barra de endereço, sem o chat. O botão fica na barra de endereço.
  viewing?: boolean
  onViewing?: () => void
}) {
  const projectPath = design.projectPath
  const session = usePrototypeSession(design, onUpdate)
  useViewing(DESIGN_PREFIX + design.id)
  const { live, running } = session
  const address = usePrototypeAddress(design, onUpdate, running)
  const { origin, url, here } = address
  const comments = useComments(origin, here)
  const agents = useProjectAgents(projectPath)
  const contextPercent = useContextPercent(projectPath, design.sessionId, live?.revision, running)
  const frameRef = useRef<HTMLIFrameElement>(null)

  // Avisos da página (scripts de designPicker): endereço, links, recarregar, Esc e comentários.
  usePageMessages(frameRef, origin, (m) => {
    if (m.kind === 'location') address.onLocation(m.path, m.title)
    else if (m.kind === 'links') address.onLinks(m.paths)
    else if (m.kind === 'reload') address.reloadHere()
    // Na visualização, o Esc dado dentro da página sai dela.
    else if (m.kind === 'escape' && viewing) pressEscape()
    else if (m.kind === 'comment-add') comments.add(m.comment)
  })
  useEffect(() => {
    if (origin) window.api.design.escape(origin, viewing)
  }, [origin, viewing])

  // Visualizar: os comentários desligam junto.
  const toggleViewing = onViewing
    ? () => {
        if (!viewing) comments.stop()
        onViewing()
      }
    : undefined

  const fresh = !design.sessionId && !design.existing && !design.route && !running

  // Imagens com o mesmo limite e a mesma redução da conversa. Falha ao prepará-las rejeita a
  // promessa: o chat devolve o texto ao campo.
  const send = async (text: string, files: File[]) => {
    const images = await imagesForSend(files)
    // A primeira mensagem da conversa leva o que fazer: criar a tela do zero, ou ajustar a que já
    // existe. Todas, a página que a pessoa está vendo. Comando (/compact, /clear...) vai sozinho:
    // com texto junto, o Claude Code não o reconhece como comando.
    const command = text.trimStart().startsWith('/')
    // Comentários escritos vão junto (o texto deles já veio montado pelo chat, ver extraSend).
    const ready = comments.ready
    const withComments = !command && ready.length > 0
    const marks = withComments ? markOf('comentarios', ready.length === 1 ? '1 comentário' : `${ready.length} comentários`) : ''
    // O estado da tela, lido na hora (no máximo 0,8s de espera).
    const state = !command && url && origin ? await window.api.design.snapshot(origin) : null
    const page: PageInView | undefined = here
      ? {
          path: here,
          title: address.pageTitle || undefined,
          url: origin ? origin + here : undefined,
          device: device ?? design.device,
          state,
          app: address.apps.length > 1 && address.app?.dir ? address.app.dir : undefined
        }
      : undefined
    const hint = command
      ? ''
      : requestHint(design, here, page) + (withComments ? commentsHint(ready) : '') + (agentHint(mentionedAgents(text, agents)) ?? '') + marks
    sendPrototype({ design, cwd: projectPath, account, text, images, hint })
    // O pedido já foi: os comentários somem e o modo comentar desliga.
    if (withComments) comments.discard()
  }

  return (
    <AccountContext.Provider value={account}>
      <PrototypeChat
        projectPath={projectPath}
        sessionId={design.sessionId}
        account={account}
        session={session}
        agents={agents}
        contextPercent={contextPercent}
        hidden={viewing}
        comments={{
          all: comments.comments,
          ready: comments.ready,
          commenting: comments.commenting,
          available: !!url,
          onToggle: comments.toggle,
          onDiscard: comments.discard
        }}
        onSend={send}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {origin && !fresh && (
          <AddressBar design={design} address={address} messages={session.history.messages} viewing={viewing} onViewing={toggleViewing} />
        )}
        {url ? (
          <PrototypeFrame
            url={url}
            device={device ?? design.device}
            reload={address.reload}
            frameRef={frameRef}
            overlay={(scale, loads) => (
              <CommentLayer
                comments={comments.comments}
                route={here ?? '/'}
                scale={scale}
                loads={loads}
                frameRef={frameRef}
                origin={origin}
                editing={comments.editing}
                onEdit={comments.setEditing}
                onSave={comments.save}
                onRemove={comments.remove}
              />
            )}
            // Página recarregada: os scripts do app (endereço, comentários, Esc) voltam a ela.
            onLoad={() => {
              if (!origin) return
              window.api.design.track(origin)
              comments.resume()
              if (viewing) window.api.design.escape(origin, true)
            }}
          />
        ) : fresh && start ? (
          <div className="min-h-0 flex-1 overflow-y-auto">{start}</div>
        ) : (
          <ServerPlaceholder projectPath={projectPath} server={address.server} running={running} checking={address.checking} />
        )}
      </div>
    </AccountContext.Provider>
  )
}
