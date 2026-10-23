import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type UIEvent } from 'react'
import { ArrowDown } from 'lucide-react'
import type { AgentDef } from '../../../shared/agents'
import type { ChatState, PermissionAnswer } from '../../../shared/chat'
import type { SessionStatus } from '../canvas/types'
import { useStableCallback } from '../lib/useStableCallback'
import { Presence } from '../motion'
import { Composer, type ComposerHandle } from './composer/Composer'
import { ImageViewer } from './ImageViewer'
import { RemoteControlTag } from './RemoteControlTag'
import { usePreference } from '../settings/preferences'
import { SuggestionChip } from './composer/SuggestionChip'
import type { SessionSettings } from './SessionSettings'
import { ChatPlaceholder } from './timeline/ChatPlaceholder'
import { olderRow } from './timeline/olderRow'
import { PinnedPrompt } from './timeline/PinnedPrompt'
import { promptOf } from './timeline/promptOf'
import { Timeline, type TimelineHandle } from './timeline/Timeline'
import { useImageViews } from './timeline/useImageViews'
import { useOlderMessages, type OlderMessages } from './timeline/useOlderMessages'
import { useOptimisticSends, type OutgoingMessage } from './timeline/useOptimisticSends'
import { useStickyScroll } from './timeline/useStickyScroll'
import { useTimeline } from './timeline/useTimeline'
import type { Message } from './types'
import { tr } from '../i18n'

const NO_AGENTS: AgentDef[] = []
const NO_PROMPTS: string[] = []
const asIs = (text: string) => text
const LOST = tr('A mensagem não chegou ao Claude. Tente enviar de novo.', 'The message didn’t reach Claude. Try sending it again.')

export type ChatViewProps = {
  // Conversa dona do rascunho guardado.
  draftKey: string
  messages: Message[]
  loading?: boolean
  // Mensagens anteriores às da tela: carregam ao rolar perto do topo (ver useOlderMessages).
  older?: OlderMessages
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
  // /output-style abre a escolha do estilo de resposta aqui no app.
  onOpenOutputStyle: () => void
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
  // O remote control ligado já vai no composerAbove (na linha da branch); sem isto, ganha linha própria.
  remoteAbove?: boolean
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
  // Sobe quando a conversa é aberta de novo já estando à vista: volta a seguir o fim.
  endSignal?: number
}

// A conversa: a linha do tempo (o histórico gravado e o que acontece agora), o prompt preso no
// topo e a caixa de escrever. Serve à conversa (ConversationView) e ao chat do modo design.
export const ChatView = memo(function ChatView({
  draftKey,
  messages,
  loading = false,
  older,
  status,
  live,
  onSend,
  loadImages,
  onOpenMcp,
  onOpenOutputStyle,
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
  remoteAbove = false,
  composerChips,
  extraSend,
  cleanText,
  endSignal = 0
}: ChatViewProps) {
  const scroller = useRef<HTMLDivElement>(null)
  // A mesma área, para a linha do tempo virtualizada: ela precisa saber quando a área montou.
  const [scrollerEl, setScrollerEl] = useState<HTMLDivElement | null>(null)
  const attachScroller = useCallback((el: HTMLDivElement | null) => {
    scroller.current = el
    setScrollerEl(el)
  }, [])
  const content = useRef<HTMLDivElement>(null)
  const timeline = useRef<TimelineHandle>(null)
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
  // Com mensagem a caminho, sem o "Nova conversa" (ver o comentário onde ele aparece).
  const placeholder = (loading || messages.length === 0) && sends.waiting.length === 0
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

  // Enquanto há anteriores, o loader delas vai na frente (olderRow).
  const olderMore = !!older?.more
  const olderLoading = !!older?.loading
  const rows = useMemo(() => (olderMore ? [olderRow(olderLoading), ...items] : items), [olderMore, olderLoading, items])
  const promptBefore = useStableCallback((index: number) => {
    for (let i = Math.min(index, rows.length) - 1; i >= 0; i--) if (rows[i].kind === 'user') return rows[i].key
    return null
  })
  const scrollToKey = useStableCallback((key: string) => timeline.current?.scrollToKey(key))
  const stickyTimeline = useMemo(() => ({ promptBefore, scrollToKey }), [promptBefore, scrollToKey])
  const sticky = useStickyScroll(scroller, content, stickyTimeline)
  const { toEnd, follow, settle } = sticky
  const olderMessages = useOlderMessages(scroller, older)
  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    sticky.onScroll(e)
    olderMessages.onScroll()
  }
  // Mudou algo na conversa: vai para o fim, se estiver seguindo.
  useLayoutEffect(() => toEnd(), [items, toEnd])
  // Abriu: assim que o histórico chega (ou de cara, sem histórico a esperar), acerta no fim. Aberta
  // de novo já estando à vista (endSignal), também.
  useLayoutEffect(() => {
    if (!loading) return settle()
  }, [loading, endSignal, settle])

  // No chat reduzido (protótipo do modo design), o último pedido não fica preso no topo.
  const pinned = useMemo(
    () => (compact ? null : promptOf(sticky.pinnedKey, messages, sends.waiting)),
    [compact, sticky.pinnedKey, messages, sends.waiting]
  )

  // Pedidos já feitos, para as setas da caixa de escrever. No modo design o texto gravado leva os
  // comentários junto (extraSend), então lá só vale o que foi digitado com o app aberto.
  const pastPrompts = useMemo(
    () => (extraSend ? NO_PROMPTS : messages.flatMap((m) => (m.role === 'user' && m.text.trim() ? [m.text] : []))),
    [messages, extraSend]
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
  const openOutputStyle = useStableCallback(onOpenOutputStyle)
  const interrupt = useStableCallback(onInterrupt)
  // Texto no campo esconde a sugestão; clicar nela envia pelo mesmo caminho da caixa de escrever.
  const [typing, setTyping] = useState(false)
  const sendSuggestion = useStableCallback((text: string) => composer.current?.send(text))
  // Desligada em Configurações > Conversas, o balão nunca aparece.
  const suggestions = usePreference('promptSuggestions')
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
          />
        )}
        <div
          ref={attachScroller}
          onScroll={onScroll}
          onWheel={sticky.onWheel}
          onKeyDown={sticky.onKeyDown}
          onPointerDown={sticky.onPointerDown}
          onTouchMove={sticky.onTouchMove}
          // relative: a lista mede onde começa a partir daqui (offsetTop). Sem a âncora do navegador:
          // quem segura a posição quando algo acima muda de tamanho é a linha do tempo virtualizada.
          className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 [overflow-anchor:none]"
        >
          {/* Com mensagem a caminho, sem o "Nova conversa": centralizado, ele empurrava o balão para
              baixo, perto da caixa de escrever, e o balão pulava para o topo quando o histórico
              chegava (e voltava se o histórico sumisse por um instante). */}
          {placeholder && <ChatPlaceholder loading={loading} />}
          {/* O app inteiro tem seleção de texto desligada (index.css); as mensagens, não: dá para copiar. */}
          <div ref={content} className="flex select-text flex-col gap-3">
            {/* key: a lista nasce de novo quando o histórico chega. Ela guarda a posição da rolagem
                de quando nasceu: criada no "Carregando conversa", vazia, desenhava as primeiras
                mensagens enquanto a rolagem já estava no fim, e a conversa abria em branco. */}
            <Timeline key={loading ? 'loading' : 'ready'} rows={rows} scroller={scrollerEl} placeholder={placeholder} handle={timeline} />
          </div>
        </div>
        {/* Longe do fim: volta para ele com uma rolagem suave. Com o Claude trabalhando, a borda
            destaca que tem coisa nova chegando lá embaixo (como no Claude Desktop). */}
        <button
          type="button"
          onClick={sticky.jumpToEnd}
          title={tr('Ir para o fim', 'Go to the end')}
          aria-label={tr('Ir para o fim', 'Go to the end')}
          tabIndex={sticky.away ? 0 : -1}
          aria-hidden={!sticky.away}
          className={`absolute bottom-3 left-1/2 z-10 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border bg-surface-2/90 shadow-md shadow-black/20 backdrop-blur transition-[opacity,border-color,translate] duration-200 hover:text-text ${
            running ? 'border-running/60 text-running' : 'border-line text-muted hover:border-line-strong'
          } ${sticky.away && !placeholder ? 'opacity-100' : 'pointer-events-none translate-y-1 opacity-0'}`}
        >
          <ArrowDown size={16} />
        </button>
      </div>

      <SuggestionChip text={live?.suggestion} visible={suggestions && !running && !typing} onSend={sendSuggestion} />
      <div className={`px-3 pb-2 pt-3 ${composerBorder ? 'border-t border-line' : ''}`}>
        {live?.remote && !remoteAbove && (
          <div className="mb-1 flex">
            <RemoteControlTag remote={live.remote} onTurnOff={turnOffRemote} />
          </div>
        )}
        <Composer
          ref={composer}
          draftKey={draftKey}
          autoFocus={autoFocus}
          agents={agents}
          running={running}
          onSubmit={submit}
          onOpenMcp={openMcp}
          onOpenOutputStyle={openOutputStyle}
          onToggleRemote={toggleRemote}
          onInterrupt={interrupt}
          settings={settings}
          onSettingChange={changeSetting}
          contextPercent={contextPercent}
          compact={compact}
          above={composerAbove}
          chips={composerChips}
          extraSend={extraSend}
          pastPrompts={pastPrompts}
          onTypingChange={setTyping}
        />
      </div>
      <Presence kind="modal">
        {images.viewer && <ImageViewer load={images.viewer.load} start={images.viewer.start} onClose={images.close} />}
      </Presence>
    </div>
  )
})
