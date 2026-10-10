import { memo, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import type { AgentDef } from '../../../shared/agents'
import type { ChatState, PermissionAnswer } from '../../../shared/chat'
import type { SessionStatus } from '../canvas/types'
import { useStableCallback } from '../lib/useStableCallback'
import { Presence } from '../motion'
import { Composer, type ComposerHandle } from './composer/Composer'
import { ImageViewer } from './ImageViewer'
import { RemoteControlBar } from './RemoteControlBar'
import type { SessionSettings } from './SessionSettings'
import { ChatPlaceholder } from './timeline/ChatPlaceholder'
import { PinnedPrompt } from './timeline/PinnedPrompt'
import { promptOf } from './timeline/promptOf'
import { Timeline } from './timeline/Timeline'
import { useImageViews } from './timeline/useImageViews'
import { useOptimisticSends, type OutgoingMessage } from './timeline/useOptimisticSends'
import { useStickyScroll } from './timeline/useStickyScroll'
import { useTimeline } from './timeline/useTimeline'
import type { Message } from './types'

const NO_AGENTS: AgentDef[] = []
const asIs = (text: string) => text
const LOST = 'A mensagem não chegou ao Claude. Tente enviar de novo.'

export type ChatViewProps = {
  // Conversa dona do rascunho guardado.
  draftKey: string
  messages: Message[]
  loading?: boolean
  status: SessionStatus
  // Sessão aberta pelo chat: resposta em andamento, mensagens a caminho, permissões.
  live: ChatState | null
  // Envia a mensagem. Se devolver uma promessa que falha, o balão sai e o texto e os anexos
  // voltam para o campo, com o aviso.
  onSend: (text: string, files: File[]) => void | Promise<void>
  // Imagens de uma mensagem já gravada no histórico, para o preview.
  loadImages?: (messageId: string) => Promise<string[]>
  // /mcp abre a lista de servidores aqui no app, em vez de ir para o Claude.
  onOpenMcp: () => void
  // /remote-control liga; de novo (ou o X da faixa), desliga.
  onRemoteControl: (enabled: boolean) => void
  onInterrupt: () => void
  onAnswer: (id: string, answer: PermissionAnswer) => void
  contextPercent: number
  settings: SessionSettings
  onSettingChange: (patch: Partial<SessionSettings>) => void
  // Agentes que dá para chamar com @nome: globais e os do projeto.
  agents?: AgentDef[]
  // Linha separando a caixa de escrever da conversa; o modo foco do drawer tira.
  composerBorder?: boolean
  // Foco na caixa de escrever ao aparecer (padrão). O bloco de conversa no canvas só pede quando
  // acabou de ser criado (useIsNewBlock).
  autoFocus?: boolean
  // Em cima da caixa de escrever (o "Selecionar" do modo design).
  composerAbove?: ReactNode
  // Dentro da caixa, antes do texto (a parte escolhida na página, com o X para soltar).
  composerChips?: ReactNode
  // Algo a enviar além do texto (os comentários na página do modo design): libera o Enviar mesmo
  // com a caixa vazia, e `compose` monta o texto que vai.
  extraSend?: { compose: (text: string) => string }
  // Tira da resposta do Claude o que é recado para o app, não para a pessoa (as linhas ROTA e TELA
  // do modo design). Função fixa (de módulo): uma nova a cada desenho refaz a conversa inteira.
  cleanText?: (text: string) => string
  // Chat reduzido (o modo design): comandos e edições só na linha, sem o último pedido preso no
  // topo, e a linha de baixo mais curta (esforço sem as bolinhas, contexto sem a palavra).
  compact?: boolean
}

// A conversa: a linha do tempo (o histórico gravado e o que acontece agora), o prompt preso no
// topo e a caixa de escrever. Serve à conversa (ConversationView) e ao chat do modo design.
export const ChatView = memo(function ChatView({
  draftKey,
  messages,
  loading = false,
  status,
  live,
  onSend,
  loadImages,
  onOpenMcp,
  onRemoteControl,
  onInterrupt,
  onAnswer,
  settings,
  onSettingChange,
  contextPercent,
  agents = NO_AGENTS,
  composerBorder = true,
  autoFocus = true,
  compact = false,
  composerAbove,
  composerChips,
  extraSend,
  cleanText
}: ChatViewProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const composer = useRef<ComposerHandle>(null)
  const images = useImageViews(loadImages)
  // Envio que não chegou ao Claude no prazo: o texto e os anexos voltam para o campo.
  const sends = useOptimisticSends(messages, live, images.viewer !== null, (lost) =>
    composer.current?.restore(
      lost.map((s) => s.typed).filter(Boolean).join('\n\n'),
      lost.flatMap((s) => s.files),
      LOST
    )
  )
  const running = status === 'running' || status === 'needs-you' || sends.waiting.length > 0
  const answer = useStableCallback(onAnswer)
  const items = useTimeline({
    messages,
    waiting: sends.waiting,
    live,
    status,
    running,
    compact,
    clean: cleanText ?? asIs,
    viewFor: images.viewFor,
    readsImages: !!loadImages,
    onAnswer: answer
  })

  const sticky = useStickyScroll(scroller, content)
  const { toEnd, follow } = sticky
  // Mudou algo na conversa: vai para o fim, se estiver seguindo.
  useLayoutEffect(() => toEnd(), [items, toEnd])

  // No chat reduzido (protótipo do modo design), o último pedido não fica preso no topo.
  const pinned = useMemo(
    () => (compact ? null : promptOf(sticky.pinnedKey, messages, sends.waiting)),
    [compact, sticky.pinnedKey, messages, sends.waiting]
  )

  // A mensagem aparece na hora como balão provisório. Envio que falha antes de sair tira o balão
  // e repassa o erro: o campo devolve o texto e os anexos.
  const submit = useStableCallback(async (message: OutgoingMessage) => {
    const id = sends.add(message)
    follow()
    try {
      await onSend(message.text, message.files)
    } catch (err) {
      sends.drop(id)
      throw err
    }
  })
  // Funções fixas para a caixa de escrever, que é memorizada: as que chegam podem mudar a cada desenho.
  const toggleRemote = useStableCallback(() => onRemoteControl(!live?.remote || live.remote.status === 'failed'))
  const turnOffRemote = useStableCallback(() => onRemoteControl(false))
  const openMcp = useStableCallback(onOpenMcp)
  const interrupt = useStableCallback(onInterrupt)
  const changeSetting = useStableCallback(onSettingChange)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col">
        {pinned && (
          <PinnedPrompt
            text={pinned.text}
            images={pinned.images}
            visible={sticky.scrollingUp}
            onClick={sticky.scrollToPrompt}
            onMouseEnter={sticky.keepShown}
            onMouseLeave={sticky.hideSoon}
          />
        )}
        <div
          ref={scroller}
          onScroll={sticky.onScroll}
          onWheel={sticky.onWheel}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
        >
          {(loading || messages.length === 0) && <ChatPlaceholder loading={loading} />}
          {/* O app inteiro tem seleção de texto desligada (index.css); as mensagens, não: dá para copiar. */}
          <div ref={content} className="flex select-text flex-col gap-3">
            <Timeline items={items} />
          </div>
        </div>
      </div>

      <div className={`px-3 pb-2 pt-3 ${composerBorder ? 'border-t border-line' : ''}`}>
        {live?.remote && <RemoteControlBar remote={live.remote} onTurnOff={turnOffRemote} />}
        <Composer
          ref={composer}
          draftKey={draftKey}
          autoFocus={autoFocus}
          agents={agents}
          running={running}
          onSubmit={submit}
          onOpenMcp={openMcp}
          onToggleRemote={toggleRemote}
          onInterrupt={interrupt}
          settings={settings}
          onSettingChange={changeSetting}
          contextPercent={contextPercent}
          compact={compact}
          above={composerAbove}
          chips={composerChips}
          extraSend={extraSend}
        />
      </div>
      <Presence kind="modal">
        {images.viewer && <ImageViewer load={images.viewer.load} start={images.viewer.start} onClose={images.close} />}
      </Presence>
    </div>
  )
})
