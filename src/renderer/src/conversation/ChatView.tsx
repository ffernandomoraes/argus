import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Brain, Image as ImageIcon, ImagePlus, Loader2, Mic, Paperclip, SendHorizontal, Square } from 'lucide-react'
import { ContextRing } from '../canvas/ContextRing'
import { AttachmentList } from './AttachmentList'
import { Markdown } from './Markdown'
import { currentTurn, Elapsed, formatClock, formatDuration, formatTokens, turnFooters } from './turnInfo'
import { DiffView, diffStats } from './DiffView'
import { PermissionCard } from './PermissionCard'
import { ModelEffortPicker } from './ModelEffortPicker'
import { PermissionModePicker } from './PermissionModePicker'
import { matchCommands, SlashMenu, type SlashCommand } from './SlashMenu'
import { useAttachments } from './useAttachments'
import { useDictation } from './useDictation'
import { VoiceWave } from './VoiceWave'
import type { SessionSettings } from './SessionSettings'
import type { SessionStatus } from '../canvas/types'
import type { ChatState, PermissionAnswer } from '../../../shared/chat'
import type { Message } from './types'

type TimelineItem =
  | { kind: 'user'; key: string; node: ReactNode }
  | { kind: 'divider'; key: string; node: ReactNode }
  | { kind: 'step'; key: string; dot: string; node: ReactNode }

// Um passo da linha do tempo: bolinha à esquerda e linha até o próximo passo.
function Step({ dot, connect, children }: { dot: string; connect: boolean; children: ReactNode }) {
  return (
    <div className="relative pl-5">
      {connect && <span className="absolute left-[5px] top-[18px] w-px bg-line" style={{ bottom: -18 }} />}
      <span className={`absolute left-[2px] top-[8px] size-[7px] rounded-full ${dot}`} />
      {children}
    </div>
  )
}

// Mensagem sua. queued: enviada enquanto o Claude trabalhava.
const UserBubble = memo(function UserBubble({
  text,
  at,
  queued,
  images = 0
}: {
  text: string
  at?: string
  queued?: boolean
  images?: number
}) {
  return (
    <div className="flex flex-col gap-1">
      {(at || queued) && (
        <span className="self-end px-1 text-[10px] text-faint">
          {queued && 'enviada durante a resposta'}
          {queued && at && ' · '}
          {at && formatClock(at)}
        </span>
      )}
      <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
        {images > 0 && (
          <div className={`flex items-center gap-1.5 text-[11px] text-muted ${text ? 'mb-1.5' : ''}`}>
            <ImageIcon size={12} className="shrink-0" />
            {images === 1 ? '1 imagem enviada' : `${images} imagens enviadas`}
          </div>
        )}
        {text && <span className="whitespace-pre-wrap break-words">{text}</span>}
      </div>
    </div>
  )
})

// Raciocínio do Claude: uma linha recolhida ("Pensou por 4s"), aberta com um clique.
const ThinkingRow = memo(function ThinkingRow({ message }: { message: Extract<Message, { role: 'thinking' }> }) {
  return (
    <details className="group text-xs">
      <summary className="-ml-1 flex cursor-pointer list-none items-center gap-2 rounded-md px-1 py-1 text-faint hover:bg-surface-2 hover:text-muted">
        <Brain size={12} className="shrink-0" />
        <span className="italic">
          {message.seconds && message.seconds > 0 ? `Pensou por ${message.seconds}s` : 'Pensou um pouco'}
        </span>
      </summary>
      <div className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words border-l border-line pl-3 text-[12px] italic leading-relaxed text-muted">
        {message.text}
      </div>
    </details>
  )
})

const ToolRow = memo(function ToolRow({ message }: { message: Extract<Message, { role: 'tool' }> }) {
  const stats = message.diff && diffStats(message.diff)
  // Fundo mais claro que o do painel: separa o comando do raciocínio e da resposta final, que não têm caixa.
  return (
    <details className="group rounded-md bg-surface-2 px-2 py-1.5 text-xs" open={!!message.diff}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded px-1 py-0.5 text-muted hover:bg-line/50">
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
        <div className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md bg-bg px-2 py-1.5 font-mono text-[11px] text-muted">
          {message.detail}
        </div>
      )}
      {message.diff ? (
        <div className="mt-1">
          <DiffView hunks={message.diff} />
        </div>
      ) : message.result && (
        <div className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-md bg-bg px-2 py-1.5 font-mono text-[11px] text-faint">
          {message.result}
        </div>
      )}
    </details>
  )
})

export function ChatView({
  messages,
  loading = false,
  status,
  live,
  onSend,
  onInterrupt,
  onAnswer,
  settings,
  onSettingChange,
  contextPercent
}: {
  messages: Message[]
  loading?: boolean
  status: SessionStatus
  // Sessão aberta pelo chat: resposta em andamento, mensagens a caminho, permissões.
  live: ChatState | null
  onSend: (text: string, files: File[]) => void
  onInterrupt: () => void
  onAnswer: (id: string, answer: PermissionAnswer) => void
  contextPercent: number
  settings: SessionSettings
  onSettingChange: (patch: Partial<SessionSettings>) => void
}) {
  const attachments = useAttachments()
  const imageInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState('')
  const [activeCommand, setActiveCommand] = useState(0)
  const [menuClosed, setMenuClosed] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  // Segue o fim da conversa quando chega mensagem nova, a menos que a pessoa tenha subido para ler.
  const pinned = useRef(true)
  // Mensagem enviada aparece na hora; sai quando já estiver no histórico gravado.
  const [sent, setSent] = useState<{ id: string; text: string; images: number; after: number }[]>([])

  useLayoutEffect(() => {
    const el = scroller.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [messages, status, live, sent])

  // Lista de comandos aparece enquanto o texto é "/" + palavra (igual à extensão do VS Code).
  const commands = menuClosed ? null : matchCommands(draft)

  const updateDraft = (value: string) => {
    setDraft(value)
    setActiveCommand(0)
    setMenuClosed(false)
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
    const images = attachments.items.filter((a) => a.previewUrl).length
    setSent((all) => [...all, { id: crypto.randomUUID(), text, images, after: messages.length }])
    onSend(text, attachments.items.map((a) => a.file))
    setDraft('')
    attachments.clear()
    pinned.current = true
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Enter envia; Shift+Enter quebra a linha (igual à extensão do VS Code).
    if (!commands && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
      return
    }
    if (!commands) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActiveCommand((i) => (i + step + commands.length) % Math.max(1, commands.length))
    } else if ((e.key === 'Enter' || e.key === 'Tab') && commands[activeCommand]) {
      e.preventDefault()
      selectCommand(commands[activeCommand])
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
  const user = (key: string, text: string, at?: string, queued?: boolean, images?: number) =>
    timeline.push({ kind: 'user', key, node: <UserBubble text={text} at={at} queued={queued} images={images} /> })
  const step = (key: string, dot: string, node: ReactNode) => timeline.push({ kind: 'step', key, dot, node })

  // O histórico só é remontado quando as mensagens mudam: assim o texto chegando aos poucos
  // não obriga a redesenhar a conversa inteira (com diffs, raciocínio e tudo).
  const history = useMemo(() => {
    const timeline: TimelineItem[] = []
    const user = (key: string, text: string, at?: string, queued?: boolean, images?: number) =>
      timeline.push({ kind: 'user', key, node: <UserBubble text={text} at={at} queued={queued} images={images} /> })
    const step = (key: string, dot: string, node: ReactNode) => timeline.push({ kind: 'step', key, dot, node })
    messages.forEach((m, i) => {
      if (m.role === 'user') return user(m.id, m.text, m.at, m.queued, m.images)
      if (m.role === 'event') {
        // Divisor: troca de modelo, esforço, modo ou compactação no meio da conversa.
        return timeline.push({
          kind: 'divider',
          key: m.id,
          node: (
            <div className="flex items-center gap-2 py-1 text-[10px] text-faint">
              <span className="h-px flex-1 bg-line" />
              <span className="shrink-0">
                {m.text}
                {m.at && ` · ${formatClock(m.at)}`}
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>
          )
        })
      }
      if (m.role === 'thinking') return step(m.id, 'bg-line', <ThinkingRow message={m} />)
      if (m.role === 'tool') {
        // Sem resultado ainda e com o Claude trabalhando: é a ação em andamento.
        const pending = !m.result && !m.diff && running && i === messages.length - 1
        const dot = m.error ? 'bg-red-400' : pending ? 'bg-running animate-pulse' : 'bg-emerald-400'
        return step(m.id, dot, <ToolRow message={m} />)
      }
      const footer = footers.get(m.id)
      step(
        m.id,
        'bg-faint',
        <div className="text-sm leading-relaxed text-text">
          <Markdown text={m.text} />
          {footer && (
            <div className="mt-1.5 text-[10px] text-faint">
              {formatClock(footer.at)}
              {footer.duration !== undefined && ` · levou ${formatDuration(footer.duration)}`}
              {footer.tokens > 0 && ` · ${formatTokens(footer.tokens)}`}
            </div>
          )}
        </div>
      )
    })
    return timeline
  }, [messages, footers, running])

  timeline.push(...history)
  waiting.forEach((w) => user(w.id, w.text, undefined, false, w.images))
  if (partial) {
    step(
      'partial',
      'bg-running animate-pulse',
      <div className="text-sm leading-relaxed text-text">
        <Markdown text={partial} />
      </div>
    )
  }
  live?.permissions.forEach((p) =>
    step(`perm-${p.id}`, 'bg-needs-you', <PermissionCard request={p} onAnswer={(answer) => onAnswer(p.id, answer)} />)
  )
  if (status === 'running' || waiting.length > 0) {
    step(
      'working',
      'bg-running animate-pulse',
      <div className="flex items-center gap-2 py-0.5 text-xs text-muted">
        Trabalhando…
        {turnStartedAt !== undefined && (
          <span className="tabular-nums text-faint">
            <Elapsed since={turnStartedAt} />
            {turnTokens > 0 && ` · ${formatTokens(turnTokens)}`}
          </span>
        )}
      </div>
    )
  }
  if (live?.error) step('error', 'bg-red-400', <p className="py-0.5 text-xs text-red-400">{live.error}</p>)
  if (status === 'needs-you' && !live?.permissions.length) {
    step(
      'needs-you',
      'bg-needs-you',
      <div className="rounded-lg border border-needs-you/40 bg-needs-you/10 px-3 py-2 text-xs text-text">
        Esperando você responder onde a conversa está aberta (permissão ou pergunta).
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
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
        {timeline.map((item, i) => {
          if (item.kind !== 'step') return <div key={item.key}>{item.node}</div>
          // A linha só desce até o próximo passo; mensagem sua interrompe a linha do tempo.
          const connect = timeline[i + 1]?.kind === 'step'
          return (
            <Step key={item.key} dot={item.dot} connect={connect}>
              {item.node}
            </Step>
          )
        })}
      </div>

      <div className="border-t border-line px-3 pb-2 pt-3">
        <div className="relative rounded-lg border border-line bg-surface focus-within:border-line-strong">
          {commands && (
            <SlashMenu items={commands} active={activeCommand} onHover={setActiveCommand} onSelect={selectCommand} />
          )}
          <AttachmentList items={attachments.items} onRemove={attachments.remove} />
          <textarea
            ref={textarea}
            value={draft}
            onChange={(e) => updateDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => setMenuClosed(true)}
            onPaste={onPaste}
            rows={3}
            placeholder={
              dictation.state === 'listening'
                ? 'Ouvindo… fale à vontade'
                : dictation.state === 'starting'
                  ? 'Ligando o microfone…'
                  : 'Escreva, fale, cole um print (⌘V) ou digite / para comandos'
            }
            className="block w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-faint"
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
            {dictation.state !== 'idle' && (
              <span className="mr-1 flex items-center gap-2 text-[11px] text-running">
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
                className="flex size-7 items-center justify-center rounded-md bg-text text-bg hover:opacity-85"
              >
                <Square size={11} fill="currentColor" />
              </button>
            ) : (
              <button
                aria-label="Enviar"
                title="Enviar (Enter)"
                onClick={send}
                disabled={!canSend && dictation.state === 'idle'}
                className="flex size-7 items-center justify-center rounded-md bg-text text-bg hover:opacity-85 disabled:opacity-40"
              >
                <SendHorizontal size={14} />
              </button>
            )}
          </div>
        </div>

        {dictation.warning && !dictation.error && (
          <p className="mt-1.5 px-1 text-[11px] text-faint">{dictation.warning}</p>
        )}
        {dictation.error && (
          <p className="mt-1.5 flex items-center gap-2 px-1 text-[11px] text-red-400">
            <span>{dictation.error.message}</span>
            {dictation.error.action === 'dictation-settings' && (
              <button
                onClick={() => window.api.speech.openSettings()}
                className="shrink-0 rounded border border-red-400/40 px-1.5 py-0.5 text-red-300 hover:bg-red-500/10"
              >
                Abrir Ajustes
              </button>
            )}
          </p>
        )}

        {/* Fora da caixa de texto: contexto, modelo e esforço à esquerda, modo à direita */}
        <div className="mt-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              aria-label="Comandos"
              title="Comandos ( / )"
              onClick={openCommands}
              className="flex size-6 items-center justify-center rounded-md font-mono text-xs text-muted hover:bg-surface-2 hover:text-text"
            >
              /
            </button>
            <ModelEffortPicker settings={settings} onChange={onSettingChange} />
            <span className="flex items-center gap-1 px-1 text-[10px] text-faint">
              <ContextRing percent={contextPercent} />
              contexto
            </span>
          </div>
          <PermissionModePicker
            value={settings.permissionMode}
            onChange={(permissionMode) => onSettingChange({ permissionMode })}
          />
        </div>
      </div>
    </div>
  )
}
