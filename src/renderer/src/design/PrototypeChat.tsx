import { useState } from 'react'
import { MessageSquarePlus, X } from 'lucide-react'
import type { AgentDef } from '../../../shared/agents'
import { dismissInterrupted, useInterrupted } from '../canvas/interruptedChats'
import { useWasFreed } from '../systemHealth/store'
import { ChatView } from '../conversation/ChatView'
import { McpPanel } from '../conversation/McpPanel'
import { OutputStylePanel } from '../conversation/OutputStylePanel'
import { Presence } from '../motion'
import { Button } from '../ui/Button'
import { commentsText } from './comments/commentsText'
import type { PageComment } from './comments/types'
import { withoutAppLines } from './prototype/appLines'
import { WidthResizer } from '../ui/WidthResizer'
import { useWidth } from '../ui/widthStore'
import { sideWidth as sideWidthStore } from './sideWidth'
import type { usePrototypeSession } from './usePrototypeSession'
import { tr } from '../i18n'

const countText = (n: number) => (n === 1 ? tr('1 comentário', '1 comment') : tr(`${n} comentários`, `${n} comments`))

// Coluna da esquerda do drawer: a conversa inteira do protótipo, a mesma do chat, com o comentar
// na página em cima do campo. A largura vem de sideWidth (arrastando a borda).
export function PrototypeChat({
  projectPath,
  sessionId,
  account,
  session,
  agents,
  contextPercent,
  hidden,
  comments,
  onSend
}: {
  projectPath: string
  sessionId?: string
  account?: string
  session: ReturnType<typeof usePrototypeSession>
  agents: AgentDef[]
  contextPercent: number
  // Visualizar: a coluna some e a página ocupa o drawer.
  hidden: boolean
  comments: {
    all: PageComment[]
    // Os escritos: vão junto do próximo envio.
    ready: PageComment[]
    commenting: boolean
    // A página abriu: dá para comentar.
    available: boolean
    onToggle: () => void
    onDiscard: () => void
  }
  onSend: (text: string, files: File[]) => Promise<void>
}) {
  const sideWidth = useWidth(sideWidthStore)
  // /mcp abre a lista de servidores aqui no app, como na conversa.
  const [mcpOpen, setMcpOpen] = useState(false)
  const [styleOpen, setStyleOpen] = useState(false)
  const { key, live, settings, history } = session
  const { ready } = comments
  // Parou no meio sem você pedir: o aviso para continuar de onde parou (ver ConversationView).
  const stopped = useInterrupted(sessionId)
  const freed = useWasFreed(sessionId)

  return (
    <>
      <section className={`relative flex shrink-0 flex-col border-r border-line ${hidden ? 'hidden' : ''}`} style={{ width: sideWidth }}>
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatView
            draftKey={key}
            messages={history.messages}
            loading={history.loading}
            older={history.older}
            status={live?.status ?? 'idle'}
            live={live}
            onSend={onSend}
            loadImages={(id) => (sessionId ? window.api.sessions.images(projectPath, sessionId, id) : Promise.resolve([]))}
            onOpenMcp={() => setMcpOpen(true)}
            onOpenOutputStyle={() => setStyleOpen(true)}
            onRemoteControl={(enabled) => window.api.chat.remoteControl({ key, cwd: projectPath, account, sessionId, settings, enabled })}
            onInterrupt={() => window.api.chat.interrupt(key)}
            onAnswer={(id, answer) => window.api.chat.answer(key, id, answer)}
            settings={settings}
            onSettingChange={session.changeSettings}
            contextPercent={contextPercent}
            compact
            agents={agents}
            interrupted={stopped ? { reason: stopped.reason, onDismiss: () => dismissInterrupted(stopped.sessionId) } : undefined}
            freed={freed}
            composerAbove={
              <div className="mb-1.5 flex items-center gap-1">
                <Button
                  size="sm"
                  variant="subtle"
                  pressed={comments.commenting}
                  disabled={!comments.available}
                  onClick={comments.onToggle}
                  title={
                    comments.available
                      ? tr('Clicar na página para deixar comentários, como no Figma', 'Click the page to leave comments, like in Figma')
                      : tr('A página ainda não abriu', 'The page hasn’t opened yet')
                  }
                >
                  <MessageSquarePlus size={13} />
                  {comments.commenting ? tr('Comentando…', 'Commenting…') : tr('Comentar', 'Comment')}
                </Button>
              </div>
            }
            cleanText={withoutAppLines}
            extraSend={ready.length ? { compose: (typed) => (typed ? `${typed}\n\n` : '') + commentsText(ready) } : undefined}
            composerChips={
              comments.all.length > 0 && (
                <div className="flex flex-wrap gap-1 px-2 pt-2">
                  <span
                    title={ready.length ? tr('Vão junto com o próximo envio', 'Sent with your next message') : tr('Escreva nos balões da página', 'Write in the bubbles on the page')}
                    className="flex min-w-0 max-w-full items-center gap-1 rounded-md bg-accent/15 py-0.5 pl-2 pr-1 text-[12px] text-accent"
                  >
                    <MessageSquarePlus size={11} className="shrink-0" />
                    <span className="truncate">{countText(ready.length)}</span>
                    <button
                      aria-label={tr('Descartar os comentários', 'Discard comments')}
                      title={tr('Descartar os comentários', 'Discard comments')}
                      onClick={comments.onDiscard}
                      className="flex size-4 shrink-0 items-center justify-center rounded-md hover:bg-accent/20"
                    >
                      <X size={11} />
                    </button>
                  </span>
                </div>
              )
            }
          />
        </div>
        <WidthResizer width={sideWidthStore} />
      </section>
      <Presence kind="modal">
        {mcpOpen && <McpPanel conversationKey={key} cwd={projectPath} account={account} onClose={() => setMcpOpen(false)} />}
        {styleOpen && <OutputStylePanel conversationKey={key} cwd={projectPath} account={account} onClose={() => setStyleOpen(false)} />}
      </Presence>
    </>
  )
}
