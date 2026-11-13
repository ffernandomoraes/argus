import { useEffect, useRef, useState } from 'react'
import { ArrowUp, FileText, Mic, Plus, Square, X } from 'lucide-react'
import type { ChatSettings } from '../../../src/shared/chat'
import type { ClaudeInfo } from '../../../src/shared/models'
import { tr } from '../i18n'
import { isImage } from '../lib/images'
import { ComposerOptions, ContextRing, modelSummary, type OptionsSheet } from './ComposerBar'
import type { COMMANDS } from './options'

// A caixa de escrever, flutuando embaixo como uma pílula: o + (fotos e arquivos, modelo, modo,
// comandos e contexto, ver ComposerBar.tsx), o texto (o microfone do teclado do celular já dita),
// o ditado próprio onde o navegador tem reconhecimento de voz, e enviar ou parar.

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

const Recognition =
  (globalThis as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
  (globalThis as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition

function useDictation(onText: (text: string) => void) {
  const [on, setOn] = useState(false)
  const rec = useRef<SpeechRecognitionLike | null>(null)
  const onTextRef = useRef(onText)
  onTextRef.current = onText
  useEffect(() => () => rec.current?.stop(), [])
  if (!Recognition) return null
  const toggle = () => {
    if (on) return rec.current?.stop()
    const r = new Recognition()
    r.lang = navigator.language
    r.continuous = true
    r.interimResults = false
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) onTextRef.current(e.results[i][0].transcript)
    }
    r.onend = () => setOn(false)
    r.onerror = () => setOn(false)
    rec.current = r
    try {
      r.start()
      setOn(true)
    } catch {
      setOn(false)
    }
  }
  return { on, toggle }
}

export type Draft = { text: string; files: File[] }

// Miniatura do anexo; o endereço temporário é liberado ao sair.
function Thumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  return url ? <img src={url} alt="" className="size-14 rounded-xl object-cover" /> : <div className="size-14 rounded-xl bg-code" />
}

export function Composer({
  busy,
  onSend,
  onStop,
  disabled,
  settings,
  info,
  agentChat,
  contextPercent,
  onSettingsChange,
  onCommand
}: {
  busy: boolean
  onSend: (d: Draft) => Promise<void>
  onStop: () => void
  disabled?: boolean
  settings: ChatSettings
  info: ClaudeInfo | null
  agentChat: boolean
  // Quanto da janela de contexto a conversa já usou; nulo na conversa que ainda não começou.
  contextPercent: number | null
  onSettingsChange: (patch: Partial<ChatSettings>) => void
  onCommand: (name: (typeof COMMANDS)[number]['name']) => void
}) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<OptionsSheet>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const dictation = useDictation((t) => setText((prev) => (prev && !prev.endsWith(' ') ? `${prev} ${t.trim()}` : prev + t.trim())))

  useEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.35)}px`
  }, [text])

  const canSend = (text.trim() || files.length > 0) && !sending && !disabled
  const send = async () => {
    if (!canSend) return
    setSending(true)
    setError(null)
    try {
      await onSend({ text: text.trim(), files })
      setText('')
      setFiles([])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  const round = 'flex size-10 shrink-0 items-center justify-center rounded-full active:opacity-60'

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
      {/* O conteúdo some suave atrás da pílula, em vez de cortar seco. */}
      <div className="h-6 bg-gradient-to-b from-transparent to-bg" />
      <div className="px-safe bg-bg pb-[max(12px,env(safe-area-inset-bottom))]">
        {error && <p className="pointer-events-auto px-2 pb-1.5 text-[13px] text-red">{error}</p>}
        <div className="pointer-events-auto rounded-[28px] border border-line bg-card p-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.10)]">
          {files.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-1.5 pt-1.5 pb-2">
              {files.map((f, i) => (
                <div key={`${f.name}:${i}`} className="relative shrink-0">
                  {isImage(f) ? (
                    <Thumb file={f} />
                  ) : (
                    <div className="flex size-14 flex-col items-center justify-center gap-1 rounded-xl bg-code p-1 text-[11px] text-muted">
                      <FileText size={18} />
                      <span className="w-full truncate text-center">{f.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label={tr('Remover', 'Remove')}
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-text text-bg"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-1.5">
            <button type="button" aria-label={tr('Opções e anexos', 'Options and attachments')} onClick={() => setSheet('menu')} className={`${round} bg-code text-text`}>
              <Plus size={22} />
            </button>
            <textarea
              ref={area}
              value={text}
              rows={1}
              onChange={(e) => setText(e.target.value)}
              placeholder={busy ? tr('Mandar mais um pedido…', 'Send another request…') : tr('Escreva um pedido…', 'Write a request…')}
              className="max-h-[35vh] min-w-0 flex-1 resize-none bg-transparent px-1 py-[9px] leading-snug outline-none placeholder:text-faint"
            />
            {dictation && (
              <button
                type="button"
                aria-label={tr('Ditar', 'Dictate')}
                onClick={dictation.toggle}
                className={`${round} ${dictation.on ? 'bg-red text-white' : 'bg-code text-muted'}`}
              >
                <Mic size={20} />
              </button>
            )}
            {busy && !canSend ? (
              <button type="button" aria-label={tr('Parar', 'Stop')} onClick={onStop} className={`${round} bg-text text-bg`}>
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button type="button" aria-label={tr('Enviar', 'Send')} disabled={!canSend} onClick={() => void send()} className={`${round} bg-text text-bg disabled:opacity-25`}>
                <ArrowUp size={20} strokeWidth={2.6} />
              </button>
            )}
          </div>
        </div>
        {/* Embaixo da caixa, discreto: o contexto usado à esquerda e o modelo à direita (tocar abre
            a escolha do modelo). */}
        <div className="pointer-events-auto mt-1.5 flex items-center gap-2 px-2 text-[12px] text-faint tabular-nums">
          {contextPercent !== null && (
            <span className="flex items-center gap-1" aria-label={tr(`Contexto usado: ${contextPercent}%`, `Context used: ${contextPercent}%`)}>
              <ContextRing percent={contextPercent} size={12} />
              {contextPercent}%
            </span>
          )}
          <button type="button" onClick={() => setSheet('model')} className="ml-auto min-w-0 truncate active:opacity-60">
            {modelSummary(settings, info)}
          </button>
        </div>
      </div>
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const list = [...(e.target.files ?? [])]
          if (list.length) setFiles((prev) => [...prev, ...list])
          e.target.value = ''
        }}
      />
      <ComposerOptions
        open={sheet}
        onOpen={setSheet}
        onAttach={() => picker.current?.click()}
        settings={settings}
        info={info}
        agentChat={agentChat}
        onChange={onSettingsChange}
        onCommand={onCommand}
      />
    </div>
  )
}
