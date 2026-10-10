import { useState } from 'react'
import { MessageSquarePlus, X } from 'lucide-react'
import type { AgentDef } from '../../../shared/agents'
import { ChatView } from '../conversation/ChatView'
import { McpPanel } from '../conversation/McpPanel'
import { Presence } from '../motion'
import { Button } from '../ui/Button'
import { commentsText } from './comments/commentsText'
import type { PageComment } from './comments/types'
import { withoutAppLines } from './prototype/appLines'
import { SideResizer } from './SideResizer'
import { useSideWidth } from './sideWidth'
import type { usePrototypeSession } from './usePrototypeSession'

const countText = (n: number) => (n === 1 ? '1 comentário' : `${n} comentários`)

// Coluna da esquerda do drawer: a conversa inteira do protótipo, a mesma do chat, com o comentar
// na página em cima do campo. A largura vem de useSideWidth (arrastando a borda).
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
  const sideWidth = useSideWidth()
  // /mcp abre a lista de servidores aqui no app, como na conversa.
  const [mcpOpen, setMcpOpen] = useState(false)
  const { key, live, settings, history } = session
  const { ready } = comments

  return (
    <>
      <section className={`relative flex shrink-0 flex-col border-r border-line ${hidden ? 'hidden' : ''}`} style={{ width: sideWidth }}>
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatView
            draftKey={key}
            messages={history.messages}
            loading={history.loading}
            status={live?.status ?? 'idle'}
            live={live}
            onSend={onSend}
            loadImages={(id) => (sessionId ? window.api.sessions.images(projectPath, sessionId, id) : Promise.resolve([]))}
            onOpenMcp={() => setMcpOpen(true)}
            onRemoteControl={(enabled) => window.api.chat.remoteControl({ key, cwd: projectPath, account, sessionId, settings, enabled })}
            onInterrupt={() => window.api.chat.interrupt(key)}
            onAnswer={(id, answer) => window.api.chat.answer(key, id, answer)}
            settings={settings}
            onSettingChange={session.changeSettings}
            contextPercent={contextPercent}
            compact
            agents={agents}
            composerAbove={
              <div className="mb-1.5 flex items-center gap-1">
                <Button
                  size="sm"
                  variant="subtle"
                  pressed={comments.commenting}
                  disabled={!comments.available}
                  onClick={comments.onToggle}
                  title={comments.available ? 'Clicar na página para deixar comentários, como no Figma' : 'A página ainda não abriu'}
                >
                  <MessageSquarePlus size={13} />
                  {comments.commenting ? 'Comentando…' : 'Comentar'}
                </Button>
              </div>
            }
            cleanText={withoutAppLines}
            extraSend={ready.length ? { compose: (typed) => (typed ? `${typed}\n\n` : '') + commentsText(ready) } : undefined}
            composerChips={
              comments.all.length > 0 && (
                <div className="flex flex-wrap gap-1 px-2 pt-2">
                  <span
                    title={ready.length ? 'Vão junto com o próximo envio' : 'Escreva nos balões da página'}
                    className="flex min-w-0 max-w-full items-center gap-1 rounded-md bg-accent/15 py-0.5 pl-2 pr-1 text-[12px] text-accent"
                  >
                    <MessageSquarePlus size={11} className="shrink-0" />
                    <span className="truncate">{countText(ready.length)}</span>
                    <button
                      aria-label="Descartar os comentários"
                      title="Descartar os comentários"
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
        <SideResizer />
      </section>
      <Presence kind="modal">
        {mcpOpen && <McpPanel conversationKey={key} cwd={projectPath} account={account} onClose={() => setMcpOpen(false)} />}
      </Presence>
    </>
  )
}
