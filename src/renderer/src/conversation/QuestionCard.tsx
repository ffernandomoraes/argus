import { useState } from 'react'
import { Check, MessageCircleQuestion } from 'lucide-react'
import type { Question } from '../../../shared/chat'

// Perguntas do Claude com opções. "Outra" deixa escrever a resposta. Várias perguntas viram abas,
// uma por vez, no mesmo cartão.
export function QuestionCard({
  questions,
  onSubmit,
  onDismiss
}: {
  questions: Question[]
  onSubmit: (answers: Record<string, string>) => void
  onDismiss: () => void
}) {
  // Por pergunta: opções marcadas e texto livre.
  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const [other, setOther] = useState<Record<string, string>>({})
  const [step, setStep] = useState(0)
  const last = step === questions.length - 1

  const toggle = (q: Question, label: string) => {
    setPicked((all) => {
      const cur = all[q.question] ?? []
      const next = q.multiSelect ? (cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label]) : [label]
      return { ...all, [q.question]: next }
    })
    // Escolha única já responde: passa para a próxima aba.
    if (!q.multiSelect && label !== '__other' && !last) setStep(step + 1)
  }

  const answerOf = (q: Question) => {
    const labels = (picked[q.question] ?? []).filter((l) => l !== '__other')
    const typed = picked[q.question]?.includes('__other') ? other[q.question]?.trim() : ''
    return [...labels, ...(typed ? [typed] : [])].join(', ')
  }
  const complete = questions.every((q) => answerOf(q))

  return (
    <div className="rounded-lg border border-dashed border-ask/40 bg-ask/10 p-3 text-xs">
      {questions.length > 1 && (
        <div role="tablist" className="mb-3 flex flex-wrap gap-1">
          {questions.map((q, i) => (
            <button
              key={q.question}
              role="tab"
              aria-selected={i === step}
              onClick={() => setStep(i)}
              className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] ${
                i === step ? 'bg-ask text-ask-text' : 'bg-surface-2 text-muted hover:text-text'
              }`}
            >
              {answerOf(q) && <Check size={10} strokeWidth={3} />}
              {q.header || `Pergunta ${i + 1}`}
            </button>
          ))}
        </div>
      )}
      {[questions[step]].map((q) => {
        const cur = picked[q.question] ?? []
        return (
          <div key={q.question} className="mb-3">
            <div className="flex items-start gap-2">
              <MessageCircleQuestion size={14} className="mt-px shrink-0 text-ask" />
              <div>
                {q.header && questions.length === 1 && <span className="mr-1.5 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{q.header}</span>}
                <span className="font-medium text-text">{q.question}</span>
                {q.multiSelect && <span className="ml-1 text-muted">(pode marcar mais de uma)</span>}
              </div>
            </div>
            <div role={q.multiSelect ? 'group' : 'radiogroup'} aria-label={q.question} className="mt-2 flex flex-col gap-1 pl-6">
              {[...q.options, { label: '__other', description: '' }].map((o) => {
                const on = cur.includes(o.label)
                return (
                  <button
                    key={o.label}
                    role={q.multiSelect ? 'checkbox' : 'radio'}
                    aria-checked={on}
                    onClick={() => toggle(q, o.label)}
                    className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-left ${
                      on ? 'border-ask bg-ask/15' : 'border-line-strong bg-bg/60 hover:bg-bg'
                    }`}
                  >
                    {/* Única escolha: radio (círculo). Várias: checkbox (quadrado). */}
                    <span
                      className={`mt-px flex size-3.5 shrink-0 items-center justify-center border ${
                        q.multiSelect ? 'rounded-[4px]' : 'rounded-full'
                      } ${on ? 'border-ask bg-ask' : 'border-muted'}`}
                    >
                      {on && (q.multiSelect ? <Check size={10} strokeWidth={3} className="text-ask-text" /> : <span className="size-1.5 rounded-full bg-ask-text" />)}
                    </span>
                    <div>
                      <div className="text-text">{o.label === '__other' ? 'Outra resposta' : o.label}</div>
                      {o.description && <div className="mt-0.5 text-muted">{o.description}</div>}
                    </div>
                  </button>
                )
              })}
              {cur.includes('__other') && (
                <input
                  autoFocus
                  value={other[q.question] ?? ''}
                  onChange={(e) => setOther((all) => ({ ...all, [q.question]: e.target.value }))}
                  placeholder="Escreva sua resposta"
                  className="rounded-md border border-line bg-bg px-2.5 py-1.5 text-text outline-none focus:border-line-strong"
                />
              )}
            </div>
          </div>
        )
      })}
      <div className="flex justify-end gap-1.5">
        <button onClick={onDismiss} className="rounded-md border border-line-strong px-2.5 py-1 text-text hover:bg-bg">
          Não responder
        </button>
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="rounded-md border border-line-strong px-2.5 py-1 text-text hover:bg-bg">
            Voltar
          </button>
        )}
        {last ? (
          <button
            disabled={!complete}
            onClick={() => onSubmit(Object.fromEntries(questions.map((q) => [q.question, answerOf(q)])))}
            className="rounded-md bg-ask px-2.5 py-1 font-medium text-ask-text hover:brightness-110 disabled:opacity-40"
          >
            Responder
          </button>
        ) : (
          <button
            onClick={() => setStep(step + 1)}
            className="rounded-md bg-ask px-2.5 py-1 font-medium text-ask-text hover:brightness-110"
          >
            Próxima
          </button>
        )}
      </div>
    </div>
  )
}
