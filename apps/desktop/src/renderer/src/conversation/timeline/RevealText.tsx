import { useEffect, useRef, useState } from 'react'

// Texto que troca com animação, como o status do Claude Desktop: o antigo some (OUT_MS) e o novo
// entra letra a letra, cada uma saindo de um leve desfoque (reveal-letter em animations.css).
// Enquanto as letras entram, outra troca espera; ao fim vale o texto mais recente.
//
// Curta de propósito: o rótulo do Claude muda várias vezes em pouco tempo (pensando, montando,
// executando) e, com os tempos do Desktop (30 ms por letra e uma folga no fim), um rótulo longo
// levava ~1,5 s e o texto ficava para trás do que o Claude fazia. Aqui as letras se espalham por no
// máximo SPREAD_MS, e a troca inteira fica abaixo de meio segundo.

const OUT_MS = 120
// Duração de cada letra (a mesma de reveal-letter no CSS).
const LETTER_MS = 90
// Intervalo máximo entre uma letra e a seguinte; rótulo longo encurta o intervalo.
const MAX_STEP_MS = 30
// Do começo da primeira letra ao começo da última, no máximo.
const SPREAD_MS = 200

type Phase = 'idle' | 'out' | 'in'

const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null
// Letras como a pessoa vê (acento e emoji compostos ficam juntos).
const graphemes = (text: string): string[] => (segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text))

const stepFor = (count: number) => Math.min(MAX_STEP_MS, SPREAD_MS / Math.max(1, count - 1))

const reduceMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export function RevealText({ text }: { text: string }) {
  const [shown, setShown] = useState(text)
  const [phase, setPhase] = useState<Phase>('idle')
  const latest = useRef(text)
  useEffect(() => {
    latest.current = text
  })

  // Parado e com texto novo: começa a troca. Com "Reduzir movimento", troca direto.
  useEffect(() => {
    if (phase !== 'idle' || text === shown) return
    if (reduceMotion()) setShown(text)
    else setPhase('out')
  }, [phase, text, shown])

  // Cada fase acaba sozinha; o texto mudando no meio não estica a espera (só vale no fim).
  useEffect(() => {
    if (phase === 'idle') return
    const count = graphemes(shown).length
    const ms = phase === 'out' ? OUT_MS : (count - 1) * stepFor(count) + LETTER_MS
    const timer = setTimeout(() => {
      if (phase === 'out') {
        setShown(latest.current)
        setPhase('in')
      } else setPhase('idle')
    }, ms)
    return () => clearTimeout(timer)
  }, [phase, shown])

  if (phase === 'in') {
    const letters = graphemes(shown)
    const step = stepFor(letters.length)
    return (
      <span className="min-w-0 truncate">
        <span className="sr-only">{shown}</span>
        {/* Trechos de texto comuns (não caixas): as letras ficam onde o texto parado vai ficar, sem
            pular de lugar quando a animação acaba. */}
        <span aria-hidden="true">
          {letters.map((g, i) => (
            <span key={i} className="reveal-letter" style={{ animationDelay: `${Math.round(i * step)}ms` }}>
              {g}
            </span>
          ))}
        </span>
      </span>
    )
  }
  return (
    <span className="min-w-0 truncate">
      <span className={phase === 'out' ? 'reveal-out' : undefined}>{shown}</span>
    </span>
  )
}
