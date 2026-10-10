import { memo, useEffect, useEffectEvent, useRef, useState } from 'react'
import { Loader2, Mic, SendHorizontal, Sparkles, Square } from 'lucide-react'
import { useDictation } from '../conversation/useDictation'
import { VoiceWave } from '../conversation/VoiceWave'
import { IconButton } from '../ui/IconButton'
import { useEscape } from '../useEscape'
import { SYSTEM_SETTINGS } from '../platform'
import { useCanvasAgent } from './bars/useCanvasAgent'

// Depois de cumprir o pedido, a resposta fica um pouco na tela e a barra some sozinha.
const AUTO_CLOSE_MS = 4000

// Barra de comando do canvas: pede por voz ou texto e o Claude mexe nos blocos.
// voice: abre já ouvindo.
export const CommandBar = memo(function CommandBar({ voice, onClose }: { voice: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState('')
  const agent = useCanvasAgent()
  // Só a resposta de um pedido feito nesta abertura aparece (e fecha a barra sozinha).
  const [asked, setAsked] = useState(false)
  const [hovered, setHovered] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  // Ditado: o que for falado entra depois do texto que já estava no campo ao começar.
  const dictationBase = useRef('')
  const dictation = useDictation((spoken) => {
    const base = dictationBase.current
    setDraft(base && spoken ? `${base.trimEnd()} ${spoken}` : base + spoken)
  })
  const toggleDictation = () => {
    if (dictation.state === 'idle') dictationBase.current = draft
    dictation.toggle()
    input.current?.focus()
  }

  // Ao abrir: o campo pega o foco e, pedindo voz, o microfone já liga.
  const onOpen = useEffectEvent(() => {
    input.current?.focus()
    if (voice) dictation.start()
  })
  useEffect(() => onOpen(), [])

  const running = agent.status === 'running'

  const send = () => {
    if (dictation.state !== 'idle') dictation.stop()
    const text = draft.trim()
    if (!text || running) return
    window.api.canvasAgent.send(text)
    setDraft('')
    setAsked(true)
  }

  // Esc fecha; clique no fundo também. O Claude continua o pedido mesmo com a barra fechada.
  useEscape(onClose)

  // Pedido cumprido: some sozinha. Fica se o Claude perguntou algo, deu erro, ou você já
  // está mexendo na barra.
  const done = asked && !running && !!agent.reply && !agent.error
  const question = agent.reply.trim().endsWith('?')
  const busy = hovered || !!draft || dictation.state !== 'idle'
  useEffect(() => {
    if (!done || question || busy) return
    const t = setTimeout(onClose, AUTO_CLOSE_MS)
    return () => clearTimeout(t)
  }, [done, question, busy, onClose])

  const listening = dictation.state !== 'idle'
  const status = running ? (
    <span className="flex items-center gap-2 text-muted">
      <Loader2 size={13} className="animate-spin" />
      {agent.activity ?? 'Pensando…'}
    </span>
  ) : asked && agent.error ? (
    <span className="text-red-400">{agent.error}</span>
  ) : asked && agent.reply ? (
    <span className="text-text">{agent.reply}</span>
  ) : null

  return (
    // Fundo escuro sobre o canvas inteiro: a barra fica em evidência, sem se misturar aos blocos.
    <div className="fixed inset-0 z-50 bg-black/55" onMouseDown={onClose}>
      <div
        data-motion-card
        onMouseDown={(e) => e.stopPropagation()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="absolute bottom-16 left-1/2 w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
      >
        {/* Embaixo da tela: a resposta aparece acima do campo. */}
        {status && <p className="border-b border-line px-3 py-2 text-xs leading-relaxed">{status}</p>}

        <div className="flex items-center gap-2 px-3 py-2.5">
          <Sparkles size={16} className="shrink-0 text-muted" />
          <input
            ref={input}
            // Vazio, ⌘Z desfaz no canvas (ver Canvas).
            data-canvas-undo
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send()
              }
            }}
            placeholder={
              dictation.state === 'listening'
                ? 'Ouvindo… diga o que fazer no canvas'
                : dictation.state === 'starting'
                  ? 'Ligando o microfone…'
                  : 'Organize, crie, mova ou exclua blocos'
            }
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
          {listening && (
            <span className="flex items-center text-[12px] text-running">
              {dictation.state === 'listening' ? <VoiceWave /> : 'Ligando…'}
            </span>
          )}
          {/* Microfone ligado na cor de "rodando": não há variante de botão para isso. */}
          <button
            aria-label={listening ? 'Parar ditado' : 'Falar'}
            title={listening ? 'Parar ditado' : 'Falar'}
            onClick={toggleDictation}
            className={`flex size-7 shrink-0 items-center justify-center rounded-md ${
              listening ? 'bg-running/15 text-running hover:bg-running/25' : 'text-muted hover:bg-surface-2 hover:text-text'
            }`}
          >
            <Mic size={15} />
          </button>
          {running && !draft ? (
            <IconButton label="Parar" variant="primary" onClick={() => window.api.canvasAgent.interrupt()}>
              <Square size={11} fill="currentColor" />
            </IconButton>
          ) : (
            <IconButton
              label="Enviar"
              title="Enviar (Enter)"
              variant="primary"
              onClick={send}
              disabled={!draft.trim() || running}
            >
              <SendHorizontal size={14} />
            </IconButton>
          )}
        </div>

        {dictation.error && (
          <p className="flex items-center gap-2 border-t border-line px-3 py-2 text-[12px] text-red-400">
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
      </div>
    </div>
  )
})
