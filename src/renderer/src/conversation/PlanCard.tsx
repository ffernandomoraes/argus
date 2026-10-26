import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ClipboardList, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Markdown } from './Markdown'
import { closeOpenPlan, useOpenPlan } from './openPlanStore'
import { tr } from '../i18n'

// Quem abre o plano inteiro ao lado da conversa (drawer ou bloco no canvas). Nulo: sem onde abrir
// (janela separada); fica só o "Mostrar tudo".
export const PlanOpenContext = createContext<((plan: string) => void) | null>(null)

// Plano do modo plano (ExitPlanMode) na conversa: o começo dele já formatado, cortado com um
// degradê, e as duas formas de ler o resto: abrir ali mesmo ou numa janela maior ao lado.
// `children`: os botões de aprovar e negar, quando o Claude espera a resposta.
export function PlanCard({ plan, error, children }: { plan: string; error?: boolean; children?: ReactNode }) {
  const openPlan = useContext(PlanOpenContext)
  // Este plano já está na janela ao lado: o botão fecha.
  const beside = useOpenPlan() === plan
  const [expanded, setExpanded] = useState(false)
  const whole = expanded
  const bodyRef = useRef<HTMLDivElement>(null)
  // Plano curto cabe inteiro: sem degradê e sem "Mostrar tudo".
  const [cut, setCut] = useState(false)
  // Rolou até o fim do trecho: o degradê sai, não há mais o que ver embaixo.
  const [atEnd, setAtEnd] = useState(false)
  const measure = () => {
    const body = bodyRef.current
    if (!body || whole) return
    setCut(body.scrollHeight > body.clientHeight + 1)
    setAtEnd(body.scrollTop + body.clientHeight >= body.scrollHeight - 1)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(measure, [plan, whole])

  return (
    <div className="my-1 overflow-hidden rounded-lg border border-line bg-surface text-[14px]">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <ClipboardList size={14} className={`shrink-0 ${error ? 'text-red-400' : 'text-muted'}`} />
        <span className={`flex-1 font-medium ${error ? 'text-red-400' : 'text-text'}`}>{tr('Plano', 'Plan')}</span>
        {/* Plano curto cabe inteiro no cartão: sem o que mostrar a mais. */}
        {(cut || whole) && (
          <button onClick={() => setExpanded((e) => !e)} className="rounded-md px-2 py-0.5 text-[13px] text-muted hover:bg-surface-2 hover:text-text">
            {whole ? tr('Mostrar menos', 'Show less') : tr('Mostrar tudo', 'Show all')}
          </button>
        )}
        {openPlan && (
          <button
            onClick={() => (beside ? closeOpenPlan() : openPlan(plan))}
            className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[13px] text-text hover:bg-surface-2"
          >
            {/* A seta aponta para onde a janela vai: abre à esquerda, fecha de volta. */}
            {beside ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
            {beside ? tr('Fechar', 'Close') : tr('Abrir ao lado', 'Open beside')}
          </button>
        )}
      </div>
      {/* Limitado na altura, mas rola por dentro. O degradê fica fora da rolagem, parado na borda. */}
      <div className="relative">
        <div ref={bodyRef} onScroll={measure} className={`px-3 py-2.5 ${whole ? '' : 'max-h-56 overflow-y-auto'}`}>
          <Markdown text={plan} />
        </div>
        {cut && !whole && !atEnd && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-surface to-transparent" />
        )}
      </div>
      {children && <div className="border-t border-line px-3 py-2">{children}</div>}
    </div>
  )
}
