import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Bot, Brain, Image as ImageIcon, ImagePlus, Loader2, Mic, Paperclip, SendHorizontal, Square } from 'lucide-react'
import { agentActivity, useRunningAgent } from '../canvas/runningAgents'
import { AgentMenu, matchAgents } from './AgentMenu'
import { ContextRing } from '../canvas/ContextRing'
import { CopyButton } from './CopyButton'
import { AttachmentList } from './AttachmentList'
import { ImageThumbs, ImageViewer } from './ImageViewer'
import { Markdown } from './Markdown'
import { currentTurn, Elapsed, formatClock, formatDuration, formatTokens, turnFooters } from './turnInfo'
import { DiffView, diffStats } from './DiffView'
import { PermissionCard } from './PermissionCard'
import { RemoteControlBar } from './RemoteControlBar'
import { ModelEffortPicker } from './ModelEffortPicker'
import { PermissionModePicker } from './PermissionModePicker'
import { matchCommands, SlashMenu, type SlashCommand } from './SlashMenu'
import { useAttachments } from './useAttachments'
import { toBase64 } from './useChat'
import { useDictation } from './useDictation'
import { VoiceWave } from './VoiceWave'
import type { SessionSettings } from './SessionSettings'
import type { SessionStatus } from '../canvas/types'
import type { AgentDef, RunningAgent } from '../../../shared/agents'
import type { ChatActivity, ChatState, PermissionAnswer } from '../../../shared/chat'
import type { Message } from './types'
import { Presence } from '../motion'
import { keys, SYSTEM_SETTINGS } from '../platform'

// Texto digitado e não enviado, por conversa: fechar o drawer (ESC, X) ou trocar de conversa
// não perde o que estava escrito. Vale enquanto o app está aberto.
const drafts = new Map<string, string>()

type TimelineItem =
  | { kind: 'user'; key: string; node: ReactNode }
  | { kind: 'divider'; key: string; node: ReactNode }
  | { kind: 'step'; key: string; dot: string; dotTop?: number; node: ReactNode }

// Altura da bolinha (topo, em px) para ficar no meio da primeira linha do passo. A padrão
// serve à resposta (15px, leading-relaxed); ações e raciocínio têm linha de 20px com 4px
// de respiro em cima; o subagente ainda tem borda e padding da caixa.
const DOT_ROW = 10.5
const DOT_AGENT = 15.5

// Um passo da linha do tempo: bolinha à esquerda e linha até o próximo passo.
function Step({ dot, dotTop = 8, connect, children }: { dot: string; dotTop?: number; connect: boolean; children: ReactNode }) {
  return (
    <div className="relative pl-5">
      {connect && <span className="absolute left-[5px] w-px bg-line" style={{ top: dotTop + 10, bottom: -18 }} />}
      <span className={`absolute left-[2px] size-[7px] rounded-full ${dot}`} style={{ top: dotTop }} />
      <div className="timeline-item">{children}</div>
    </div>
  )
}

// Mensagem sua. queued: enviada enquanto o Claude trabalhava.
// imageView: lê as imagens enviadas (miniaturas) e abre o preview grande numa delas.
type ImageView = { load: () => Promise<string[]>; open: (index: number) => void }

const UserBubble = memo(function UserBubble({
  text,
  at,
  queued,
  images = 0,
  imageView
}: {
  text: string
  at?: string
  queued?: boolean
  images?: number
  imageView?: ImageView
}) {
  return (
    <div className="flex flex-col gap-1">
      {(at || queued) && (
        <span className="self-end px-1 text-[13px] text-faint">
          {queued && 'enviada durante a resposta'}
          {queued && at && ' - '}
          {at && formatClock(at)}
        </span>
      )}
      {/* Copiar fica dentro do balão, numa coluna à direita, no meio da altura do texto. */}
      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 py-2 pl-3 pr-2 text-[15px]">
        <div className="min-w-0 flex-1">
          {images > 0 && (
            <div className={`flex flex-col gap-1.5 ${text ? 'mb-1.5' : ''}`}>
              {imageView && <ImageThumbs count={images} load={imageView.load} onOpen={imageView.open} />}
              <button
                onClick={() => imageView?.open(0)}
                disabled={!imageView}
                title={imageView ? (images === 1 ? 'Ver imagem' : 'Ver imagens') : undefined}
                className="flex items-center gap-1.5 self-start rounded text-[13px] text-muted enabled:hover:text-text enabled:hover:underline"
              >
                <ImageIcon size={12} className="shrink-0" />
                {images === 1 ? '1 imagem enviada' : `${images} imagens enviadas`}
              </button>
            </div>
          )}
          {text && <span className="whitespace-pre-wrap break-words">{text}</span>}
        </div>
        {text && <CopyButton text={text} label="Copiar prompt" className="shrink-0" />}
      </div>
    </div>
  )
})

// Raciocínio do Claude: uma linha recolhida ("Pensou por 4s"), aberta com um clique.
const ThinkingRow = memo(function ThinkingRow({ message }: { message: Extract<Message, { role: 'thinking' }> }) {
  return (
    <details className="group text-[13px]">
      <summary className="-ml-1 flex cursor-pointer list-none items-center gap-2 rounded-md px-1 py-1 leading-5 text-faint hover:bg-surface-2 hover:text-muted">
        <Brain size={12} className="shrink-0" />
        <span className="italic">
          {message.seconds && message.seconds > 0 ? `Pensou por ${message.seconds}s` : 'Pensou um pouco'}
        </span>
      </summary>
      <div className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words border-l border-line pl-3 text-[13px] italic leading-relaxed text-muted">
        {message.text}
      </div>
    </details>
  )
})

const ToolRow = memo(function ToolRow({ message }: { message: Extract<Message, { role: 'tool' }> }) {
  const stats = message.diff && diffStats(message.diff)
  // Sem caixa, como a resposta: a ação não chama mais atenção que o texto. Passar o mouse só clareia a linha.
  return (
    <details className="group text-[13px]" open={!!message.diff}>
      <summary className="flex cursor-pointer list-none items-center gap-2 py-1 leading-5 text-muted hover:text-text">
        <span className={`shrink-0 font-medium ${message.error ? 'text-red-400' : 'text-text'}`} title={message.name}>
          {message.label}
        </span>
        <span className="truncate text-muted">{message.input}</span>
        {stats && (
          <span className="ml-auto shrink-0 font-mono">
            <span className="text-emerald-400">+{stats.added}</span>{' '}
            <span className="text-red-400">−{stats.removed}</span>
          </span>
        )}
      </summary>
      {message.detail && message.detail !== message.input && (
        <div className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md bg-bg px-2 py-1.5 font-mono text-[13px] text-muted">
          {message.detail}
        </div>
      )}
      {message.diff ? (
        <div className="mt-1">
          <DiffView hunks={message.diff} />
        </div>
      ) : message.result && (
        <div className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-md bg-bg px-2 py-1.5 font-mono text-[13px] text-faint">
          {message.result}
        </div>
      )}
    </details>
  )
})

// Comando no terminal, como no VS Code: o comando (IN) e a saída (OUT) ficam à vista,
// resumidos em poucas linhas; um clique abre os dois inteiros. No chat reduzido (protótipo do modo
// design) fica só a linha do comando, e o clique mostra o IN/OUT.
const BashRow = memo(function BashRow({ message, compact }: { message: Extract<Message, { role: 'tool' }>; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const command = message.detail ?? message.input
  const output = message.result.trim()
  const clamp = open ? 'max-h-60 overflow-auto' : 'line-clamp-3'
  return (
    <div className="text-[13px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 py-1 text-left leading-5 text-muted hover:text-text"
      >
        <span className={`shrink-0 font-medium ${message.error ? 'text-red-400' : 'text-text'}`} title={message.name}>
          {message.label}
        </span>
        <span className="truncate text-muted">{message.input}</span>
      </button>
      {/* Arrastar para copiar um trecho não conta como clique. */}
      {(!compact || open) && (
      <div
        onClick={() => !window.getSelection()?.toString() && setOpen((o) => !o)}
        className="mt-1 grid cursor-pointer grid-cols-[auto_1fr] gap-x-3 rounded-md border border-line bg-bg font-mono text-[13px]"
      >
        <span className="px-2 py-1.5 text-faint">IN</span>
        <div className={`whitespace-pre-wrap break-all py-1.5 pr-2 text-muted ${clamp}`}>{command}</div>
        {output && (
          <>
            <span className="border-t border-line px-2 py-1.5 text-faint">OUT</span>
            <div
              className={`whitespace-pre-wrap break-words border-t border-line py-1.5 pr-2 ${
                message.error ? 'text-red-400' : 'text-faint'
              } ${clamp}`}
            >
              {output}
            </div>
          </>
        )}
      </div>
      )}
    </div>
  )
})

// Subagente chamado pela conversa: qual agente, o pedido que recebeu, o que está fazendo
// (enquanto roda) e o que entregou.
const AgentToolRow = memo(function AgentToolRow({ message }: { message: Extract<Message, { role: 'tool' }> }) {
  const running = useRunningAgent(message.toolUseId)
  const steps = running?.steps ?? []
  return (
    <details className="group rounded-md border border-line bg-surface-2 px-2 py-1.5 text-[13px]">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded px-1 py-0.5 leading-5 text-muted hover:bg-line/50">
        <Bot size={13} className={`shrink-0 ${running ? 'text-running' : message.error ? 'text-red-400' : 'text-text'}`} />
        <span className={`shrink-0 font-medium ${message.error ? 'text-red-400' : 'text-text'}`}>{message.agent}</span>
        <span className="truncate text-muted">{running ? agentActivity(running) : message.input}</span>
        {running && (
          <span className="ml-auto shrink-0 pl-1 tabular-nums text-faint">
            <Elapsed since={running.startedAt} />
          </span>
        )}
      </summary>
      {message.detail && (
        <div className="mt-1.5">
          <div className="mb-1 px-1 text-[13px] uppercase tracking-wide text-faint">Pedido</div>
          <div className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-bg px-2 py-1.5 text-[13px] text-muted">
            {message.detail}
          </div>
        </div>
      )}
      {steps.length > 0 && (
        <div className="mt-1.5">
          <div className="mb-1 px-1 text-[13px] uppercase tracking-wide text-faint">
            Atividade - {running?.toolUses || steps.length} ferramentas
          </div>
          <ul className="max-h-48 overflow-auto rounded-md bg-bg px-2 py-1.5 text-[13px]">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2 py-0.5">
                <span className="shrink-0 text-text">{s.label}</span>
                <span className="truncate text-faint">{s.summary}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {message.result && (
        <div className="mt-1.5">
          <div className="mb-1 px-1 text-[13px] uppercase tracking-wide text-faint">Entregou</div>
          <div className="max-h-96 overflow-auto rounded-md bg-bg px-3 py-2 text-[13px] leading-relaxed text-text">
            <Markdown text={message.result} />
          </div>
        </div>
      )}
    </details>
  )
})

export function ChatView({
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
  agents = [],
  composerBorder = true,
  compact = false
}: {
  // Conversa dona do rascunho guardado.
  draftKey: string
  messages: Message[]
  loading?: boolean
  status: SessionStatus
  // Sessão aberta pelo chat: resposta em andamento, mensagens a caminho, permissões.
  live: ChatState | null
  onSend: (text: string, files: File[]) => void
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
  // Coluna estreita (o modo design): ditando, só o fundo do microfone acende, e o contexto não
  // aparece embaixo, para a linha do modelo e do modo caber sem quebrar.
  compact?: boolean
}) {
  const attachments = useAttachments()
  const imageInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState(() => drafts.get(draftKey) ?? '')
  useEffect(() => {
    if (draft) drafts.set(draftKey, draft)
    else drafts.delete(draftKey)
  }, [draftKey, draft])

  // Abrir a conversa já deixa o campo pronto para digitar, com o cursor no fim do rascunho.
  // Espera um quadro: o drawer nasce invisível até ser posicionado, e campo invisível não recebe foco.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const el = textarea.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
    return () => cancelAnimationFrame(frame)
  }, [])
  const [activeCommand, setActiveCommand] = useState(0)
  const [menuClosed, setMenuClosed] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  // Segue o fim da conversa quando chega mensagem nova, a menos que a pessoa tenha subido para ler.
  const pinned = useRef(true)
  // Mensagem enviada aparece na hora; sai quando já estiver no histórico gravado.
  // files: as imagens, para o preview enquanto o histórico ainda não tem a mensagem.
  const [sent, setSent] = useState<{ id: string; text: string; images: number; files: File[]; after: number }[]>([])
  // Preview aberto das imagens de uma mensagem.
  const [viewer, setViewer] = useState<{ load: () => Promise<string[]>; start: number } | null>(null)
  // Por ref: o histórico memorizado não é remontado só porque a função chegou nova.
  const loadImagesRef = useRef(loadImages)
  loadImagesRef.current = loadImages
  // Imagens já lidas, por mensagem: a miniatura e o preview grande usam a mesma leitura.
  const imageCache = useRef(new Map<string, Promise<string[]>>())
  const imageView = useRef((key: string, read: () => Promise<string[]>): ImageView => {
    const load = () => {
      let p = imageCache.current.get(key)
      if (!p) {
        p = read().catch(() => [])
        imageCache.current.set(key, p)
      }
      return p
    }
    return { load, open: (start) => setViewer({ load, start }) }
  }).current

  useLayoutEffect(() => {
    const el = scroller.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [messages, status, live, sent])

  // Mensagem fora da tela começa com altura estimada (.timeline-item) e cresce ao aparecer.
  // Grudado no fim, acompanha esse crescimento para não parar no meio da última resposta.
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (!el || !content.current) return
    const observer = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight
      findPinned.current()
    })
    observer.observe(content.current)
    return () => observer.disconnect()
  }, [])

  // Prompt do trecho que está na tela fica preso no topo: o último cujo balão já subiu para
  // fora da área visível. Rolando para trás, troca para o prompt daquele ponto do histórico.
  const [pinnedKey, setPinnedKey] = useState<string | null>(null)
  const findPinned = useRef(() => {})
  findPinned.current = () => {
    const root = scroller.current
    if (!root) return
    const top = root.getBoundingClientRect().top + 8
    let key: string | null = null
    for (const el of root.querySelectorAll<HTMLElement>('[data-prompt]')) {
      if (el.getBoundingClientRect().bottom > top) break
      key = el.dataset.prompt ?? null
    }
    setPinnedKey(key)
  }

  // Lista de comandos aparece enquanto o texto é "/" + palavra (igual à extensão do VS Code).
  const commands = menuClosed ? null : matchCommands(draft)
  // Lista de agentes aparece enquanto o texto termina em "@" + palavra.
  const mention = menuClosed || commands ? null : matchAgents(draft, agents)
  const menuSize = commands?.length ?? mention?.items.length

  const updateDraft = (value: string) => {
    setDraft(value)
    setActiveCommand(0)
    setMenuClosed(false)
  }

  // Escolher um agente completa o nome dele no campo.
  const selectAgent = (a: AgentDef) => {
    setDraft(`${draft.slice(0, mention?.start ?? draft.length)}@${a.name} `)
    setMenuClosed(true)
    textarea.current?.focus()
  }

  // Escolher um comando escreve ele no campo; Enter envia.
  const selectCommand = (c: SlashCommand) => {
    setDraft(`/${c.name} `)
    setMenuClosed(true)
    textarea.current?.focus()
  }

  const delivered = (s: { text: string; after: number }) =>
    messages.slice(s.after).some((m) => m.role === 'user' && (!s.text || m.text.trim().startsWith(s.text)))
  const waiting = sent.filter((s) => !delivered(s))
  useEffect(() => {
    if (waiting.length !== sent.length) setSent(waiting)
  }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

  // Comando de barra não volta no histórico como mensagem sua, então o balão provisório
  // nunca seria dado como entregue. Terminou o pedido, limpa o que sobrou.
  const wasRunning = useRef(false)
  useEffect(() => {
    const running = live?.status === 'running' || live?.status === 'needs-you'
    if (wasRunning.current && !running) setSent([])
    wasRunning.current = running
  }, [live?.status])

  // A prévia da resposta some quando o mesmo texto já chegou no histórico.
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const partial = live?.partial && lastAssistant?.text !== live.partial.trim() ? live.partial : ''

  const running = status === 'running' || status === 'needs-you' || waiting.length > 0
  const footers = useMemo(() => turnFooters(messages, running), [messages, running])
  // Pedido em andamento: o chat do app sabe na hora; sessão aberta em outro lugar, pelo histórico.
  const fromHistory = currentTurn(messages)
  const turnStartedAt = live?.turnStartedAt ?? fromHistory.startedAt
  const turnTokens = Math.max(live?.turnStartedAt ? live.turnTokens : 0, fromHistory.tokens)
  const canSend = draft.trim().length > 0 || attachments.items.length > 0

  const send = () => {
    if (dictation.state !== 'idle') dictation.stop()
    if (!canSend) return
    const text = draft.trim()
    if (text === '/mcp') {
      setDraft('')
      return onOpenMcp()
    }
    if (text === '/remote-control') {
      setDraft('')
      return onRemoteControl(!live?.remote || live.remote.status === 'failed')
    }
    const files = attachments.items.filter((a) => a.previewUrl).map((a) => a.file)
    setSent((all) => [...all, { id: crypto.randomUUID(), text, images: files.length, files, after: messages.length }])
    onSend(text, attachments.items.map((a) => a.file))
    setDraft('')
    attachments.clear()
    pinned.current = true
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Enter envia; Shift+Enter quebra a linha (igual à extensão do VS Code).
    if (menuSize === undefined && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
      return
    }
    if (menuSize === undefined) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActiveCommand((i) => (i + step + menuSize) % Math.max(1, menuSize))
    } else if ((e.key === 'Enter' || e.key === 'Tab') && commands?.[activeCommand]) {
      e.preventDefault()
      selectCommand(commands[activeCommand])
    } else if ((e.key === 'Enter' || e.key === 'Tab') && mention?.items[activeCommand]) {
      e.preventDefault()
      selectAgent(mention.items[activeCommand])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setMenuClosed(true)
    }
  }

  // Ditado: o que for falado entra depois do texto que já estava no campo ao começar.
  const dictationBase = useRef('')
  const dictation = useDictation((spoken) => {
    const base = dictationBase.current
    setDraft(base && spoken ? `${base.trimEnd()} ${spoken}` : base + spoken)
  })
  // O texto ditado entra por código, e o navegador não rola o campo sozinho:
  // sem isso as últimas palavras ficam escondidas abaixo da segunda linha.
  useEffect(() => {
    const el = textarea.current
    if (!el || dictation.state === 'idle') return
    el.setSelectionRange(el.value.length, el.value.length)
    el.scrollTop = el.scrollHeight
  }, [draft, dictation.state])
  const toggleDictation = () => {
    if (dictation.state === 'idle') {
      dictationBase.current = draft
      setMenuClosed(true)
      textarea.current?.focus()
    }
    dictation.toggle()
  }

  const openCommands = () => {
    updateDraft('/')
    textarea.current?.focus()
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) attachments.add(e.target.files)
    e.target.value = ''
  }

  // ⌘V com imagem ou arquivo copiado vira anexo; texto colado segue normal.
  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files)
    if (files.length === 0) return
    e.preventDefault()
    attachments.add(files)
  }

  // Linha do tempo: suas mensagens em balões; cada passo do Claude (resposta, comando,
  // leitura, permissão) com uma bolinha, na ordem em que aconteceu.
  const timeline: TimelineItem[] = []
  const user = (key: string, text: string, at?: string, queued?: boolean, images?: number, view?: ImageView) =>
    timeline.push({
      kind: 'user',
      key,
      node: <UserBubble text={text} at={at} queued={queued} images={images} imageView={view} />
    })
  const step = (key: string, dot: string, node: ReactNode, dotTop?: number) =>
    timeline.push({ kind: 'step', key, dot, dotTop, node })

  // O histórico só é remontado quando as mensagens mudam: assim o texto chegando aos poucos
  // não obriga a redesenhar a conversa inteira (com diffs, raciocínio e tudo).
  const history = useMemo(() => {
    const timeline: TimelineItem[] = []
    const user = (key: string, text: string, at?: string, queued?: boolean, images?: number, view?: ImageView) =>
      timeline.push({
        kind: 'user',
        key,
        node: <UserBubble text={text} at={at} queued={queued} images={images} imageView={view} />
      })
    const step = (key: string, dot: string, node: ReactNode, dotTop?: number) =>
      timeline.push({ kind: 'step', key, dot, dotTop, node })
    messages.forEach((m, i) => {
      if (m.role === 'user') {
        const read = loadImagesRef.current
        const view = m.images && read ? imageView(m.id, () => read(m.id)) : undefined
        return user(m.id, m.text, m.at, m.queued, m.images, view)
      }
      if (m.role === 'event') {
        // Divisor: troca de modelo, esforço, modo ou compactação no meio da conversa.
        return timeline.push({
          kind: 'divider',
          key: m.id,
          node: (
            <div className="flex items-center gap-2 py-1 text-[13px] text-faint">
              <span className="h-px flex-1 bg-line" />
              <span className="shrink-0">
                {m.text}
                {m.at && ` - ${formatClock(m.at)}`}
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>
          )
        })
      }
      if (m.role === 'output') {
        return step(
          m.id,
          'bg-line',
          <div className="rounded-md border border-line bg-surface-2/60 px-3 py-2 text-[13px] leading-relaxed text-muted">
            <Markdown text={m.text} />
          </div>
        )
      }
      if (m.role === 'thinking') return step(m.id, 'bg-line', <ThinkingRow message={m} />, DOT_ROW)
      if (m.role === 'tool' && m.agent) {
        const dot = m.error ? 'bg-red-400' : !m.result && running ? 'bg-running animate-pulse' : 'bg-emerald-400'
        return step(m.id, dot, <AgentToolRow message={m} />, DOT_AGENT)
      }
      if (m.role === 'tool') {
        // Sem resultado ainda e com o Claude trabalhando: é a ação em andamento.
        const pending = !m.result && !m.diff && running && i === messages.length - 1
        const dot = m.error ? 'bg-red-400' : pending ? 'bg-running animate-pulse' : 'bg-emerald-400'
        return step(m.id, dot, m.name === 'Bash' ? <BashRow message={m} compact={compact} /> : <ToolRow message={m} />, DOT_ROW)
      }
      const footer = footers.get(m.id)
      step(
        m.id,
        'bg-faint',
        <div className="text-[15px] leading-relaxed text-text">
          <Markdown text={m.text} />
          {footer && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-faint">
              <span>
                {formatClock(footer.at)}
                {footer.duration !== undefined && ` - levou ${formatDuration(footer.duration)}`}
                {footer.tokens > 0 && ` - ${formatTokens(footer.tokens)}`}
              </span>
              <CopyButton text={m.text} label="Copiar resposta" />
            </div>
          )}
        </div>
      )
    })
    return timeline
  }, [messages, footers, running, compact])

  timeline.push(...history)
  waiting.forEach((w) =>
    user(
      w.id,
      w.text,
      undefined,
      false,
      w.images,
      imageView(w.id, () => Promise.all(w.files.map(async (f) => `data:${f.type};base64,${await toBase64(f)}`)))
    )
  )

  // No chat reduzido (protótipo do modo design), o último pedido não fica preso no topo.
  const pinnedPrompt = useMemo(() => {
    if (compact || !pinnedKey) return null
    const m = messages.find((m) => m.role === 'user' && m.id === pinnedKey)
    if (m?.role === 'user') return { key: m.id, text: m.text, images: m.images ?? 0 }
    const w = waiting.find((w) => w.id === pinnedKey)
    return w ? { key: w.id, text: w.text, images: w.images } : null
  }, [compact, pinnedKey, messages, waiting])

  const scrollToPrompt = () =>
    scroller.current
      ?.querySelector(`[data-prompt="${CSS.escape(pinnedKey ?? '')}"]`)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' })

  if (partial) {
    step(
      'partial',
      'bg-running animate-pulse',
      <div className="text-[15px] leading-relaxed text-text">
        <Markdown text={partial} />
      </div>
    )
  }
  live?.permissions.forEach((p) =>
    step(`perm-${p.id}`, 'bg-ask', <PermissionCard request={p} onAnswer={(answer) => onAnswer(p.id, answer)} />)
  )
  if (status === 'running' || waiting.length > 0) {
    step(
      'working',
      'bg-running animate-pulse',
      <div className="flex min-w-0 items-center gap-2 py-0.5 text-[13px] text-muted">
        <span className="min-w-0 truncate">{activityLabel(live?.activity, live?.agents ?? [])}</span>
        {turnStartedAt !== undefined && (
          <span className="shrink-0 tabular-nums text-faint">
            <Elapsed since={turnStartedAt} />
            {turnTokens > 0 && ` - ${formatTokens(turnTokens)}`}
          </span>
        )}
      </div>
    )
  }
  if (live?.error) step('error', 'bg-red-400', <p className="py-0.5 text-[13px] text-red-400">{live.error}</p>)
  if (status === 'needs-you' && !live?.permissions.length) {
    step(
      'needs-you',
      'bg-ask',
      <div className="rounded-lg border border-ask/40 bg-ask/10 px-3 py-2 text-[13px] text-text">
        Esperando você responder onde a conversa está aberta (permissão ou pergunta).
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col">
        {pinnedPrompt && (
          <button
            onClick={scrollToPrompt}
            title="Ir para a mensagem"
            className="absolute inset-x-4 top-2 z-10 rounded-lg border border-line bg-surface-2 px-3 py-2 text-left text-[15px] shadow-md hover:border-line-strong"
          >
            {pinnedPrompt.text ? (
              <span className="line-clamp-2 whitespace-pre-wrap break-words">{pinnedPrompt.text}</span>
            ) : (
              <span className="flex items-center gap-1.5 text-[13px] text-muted">
                <ImageIcon size={12} className="shrink-0" />
                {pinnedPrompt.images === 1 ? '1 imagem enviada' : `${pinnedPrompt.images} imagens enviadas`}
              </span>
            )}
          </button>
        )}
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget
            pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
            findPinned.current()
          }}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
        >
          {loading && (
            <div className="m-auto flex items-center gap-2 text-xs text-faint">
              <Loader2 size={13} className="animate-spin" />
              Carregando conversa…
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div className="m-auto max-w-64 text-center">
              <p className="text-sm text-text">Nova conversa</p>
              <p className="mt-1 text-xs leading-relaxed text-faint">
                Escreva, fale pelo microfone ou cole um print para começar.
              </p>
            </div>
          )}
          {/* O app inteiro tem seleção de texto desligada (index.css); as mensagens, não: dá para copiar. */}
          <div ref={content} className="flex select-text flex-col gap-3">
            {timeline.map((item, i) => {
              if (item.kind !== 'step') {
                return (
                  <div key={item.key} data-prompt={item.kind === 'user' ? item.key : undefined} className="timeline-item">
                    {item.node}
                  </div>
                )
              }
              // A linha só desce até o próximo passo; mensagem sua interrompe a linha do tempo.
              const connect = timeline[i + 1]?.kind === 'step'
              return (
                <Step key={item.key} dot={item.dot} dotTop={item.dotTop} connect={connect}>
                  {item.node}
                </Step>
              )
            })}
          </div>
        </div>
      </div>

      <div className={`px-3 pb-2 pt-3 ${composerBorder ? 'border-t border-line' : ''}`}>
        {live?.remote && <RemoteControlBar remote={live.remote} onTurnOff={() => onRemoteControl(false)} />}
        <div className="relative rounded-lg border border-line bg-surface focus-within:border-line-strong">
          <Presence kind="menu">
            {commands && (
              <SlashMenu items={commands} active={activeCommand} onHover={setActiveCommand} onSelect={selectCommand} />
            )}
          </Presence>
          <Presence kind="menu">
            {mention && (
              <AgentMenu items={mention.items} active={activeCommand} onHover={setActiveCommand} onSelect={selectAgent} />
            )}
          </Presence>
          <AttachmentList items={attachments.items} onRemove={attachments.remove} />
          <textarea
            ref={textarea}
            value={draft}
            onChange={(e) => updateDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => setMenuClosed(true)}
            onPaste={onPaste}
            rows={2}
            placeholder={
              dictation.state === 'listening'
                ? 'Ouvindo… fale à vontade'
                : dictation.state === 'starting'
                  ? 'Ligando o microfone…'
                  : agents.length
                    ? `Escreva, fale, cole um print (${keys('⌘V')}), / para comandos ou @ para agentes`
                    : `Escreva, fale, cole um print (${keys('⌘V')}) ou digite / para comandos`
            }
            className="mb-1.5 block w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-faint"
          />
          <div className="flex items-center gap-1 px-2 pb-2">
            <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={onPick} />
            <input ref={fileInput} type="file" multiple hidden onChange={onPick} />
            <button
              aria-label="Anexar imagem"
              title="Anexar imagem"
              onClick={() => imageInput.current?.click()}
              className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
            >
              <ImagePlus size={15} />
            </button>
            <button
              aria-label="Anexar arquivo"
              title="Anexar arquivo"
              onClick={() => fileInput.current?.click()}
              className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
            >
              <Paperclip size={15} />
            </button>
            <span className="flex-1" />
            {!compact && dictation.state !== 'idle' && (
              <span className="mr-1 flex items-center gap-2 text-[12px] text-running">
                {dictation.state === 'listening' ? <VoiceWave /> : 'Ligando…'}
              </span>
            )}
            <button
              aria-label={dictation.state === 'idle' ? 'Ditar por voz' : 'Parar ditado'}
              title={dictation.state === 'idle' ? 'Ditar por voz' : 'Parar ditado'}
              onClick={toggleDictation}
              className={`mr-1 flex size-7 items-center justify-center rounded-md ${
                dictation.state === 'idle'
                  ? 'text-muted hover:bg-surface-2 hover:text-text'
                  : compact && dictation.state === 'listening'
                    ? 'bg-running text-white hover:brightness-110'
                    : 'bg-running/15 text-running hover:bg-running/25'
              }`}
            >
              <Mic size={15} />
            </button>
            {running && !canSend ? (
              <button
                aria-label="Parar"
                title="Parar"
                onClick={onInterrupt}
                className="flex size-7 items-center justify-center rounded-md bg-accent text-white hover:brightness-110"
              >
                <Square size={11} fill="currentColor" />
              </button>
            ) : (
              <button
                aria-label="Enviar"
                title="Enviar (Enter)"
                onClick={send}
                disabled={!canSend && dictation.state === 'idle'}
                className="flex size-7 items-center justify-center rounded-md bg-accent text-white hover:brightness-110 disabled:opacity-40"
              >
                <SendHorizontal size={14} />
              </button>
            )}
          </div>
        </div>

        {dictation.warning && !dictation.error && (
          <p className="mt-1.5 px-1 text-[12px] text-faint">{dictation.warning}</p>
        )}
        {dictation.error && (
          <p className="mt-1.5 flex items-center gap-2 px-1 text-[12px] text-red-400">
            <span>{dictation.error.message}</span>
            {dictation.error.action === 'dictation-settings' && (
              <button
                onClick={() => window.api.speech.openSettings()}
                className="shrink-0 rounded-md border border-red-400/40 px-1.5 py-0.5 text-red-300 hover:bg-red-500/10"
              >
                Abrir {SYSTEM_SETTINGS}
              </button>
            )}
          </p>
        )}

        {/* Fora da caixa de texto: contexto, modelo e esforço à esquerda, modo à direita */}
        <div className="mt-1.5 flex items-center justify-between whitespace-nowrap">
          <div className="flex items-center gap-1">
            <button
              aria-label="Comandos"
              title="Comandos ( / )"
              onClick={openCommands}
              className="flex size-6 items-center justify-center rounded-md font-mono text-xs text-muted hover:bg-surface-2 hover:text-text"
            >
              /
            </button>
            <ModelEffortPicker settings={settings} onChange={onSettingChange} dots={!compact} />
            <span className="flex items-center gap-1 px-1 text-[11px] text-faint">
              <ContextRing percent={contextPercent} />
              {!compact && 'contexto'}
            </span>
          </div>
          <PermissionModePicker
            value={settings.permissionMode}
            onChange={(permissionMode) => onSettingChange({ permissionMode })}
          />
        </div>
      </div>
      <Presence kind="modal">
        {viewer && <ImageViewer load={viewer.load} start={viewer.start} onClose={() => setViewer(null)} />}
      </Presence>
    </div>
  )
}

// O que o Claude está fazendo agora, no lugar de um "Trabalhando…" parado. Só o tipo da ação:
// o detalhe (comando, arquivo) já aparece na linha da ferramenta logo acima.
function activityLabel(activity: ChatActivity | undefined, agents: RunningAgent[]): string {
  const tool = activity?.tool
  const foreground = agents.filter((a) => !a.background).length
  switch (activity?.kind) {
    case 'thinking':
      return 'Pensando…'
    case 'writing':
      return 'Escrevendo a resposta…'
    case 'preparing':
      return tool === 'Comando' ? 'Montando comando…' : `Montando: ${tool}…`
    case 'running':
      if (foreground) return foreground === 1 ? 'Esperando o subagente…' : `Esperando ${foreground} subagentes…`
      return tool === 'Comando' ? 'Executando comando…' : `Executando: ${tool}…`
    default:
      return 'Trabalhando…'
  }
}
