import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ClipboardList, FileText, PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react'
import { Markdown } from './Markdown'
import { closeOpenPlan, useOpenPlan } from './openPlanStore'
import { tr } from '../i18n'

// Quem abre o markdown inteiro ao lado da conversa (drawer ou bloco no canvas): o plano ou o .md
// criado, com o caminho dele. Nulo: sem onde abrir (janela separada); fica só o "Mostrar tudo".
export const PlanOpenContext = createContext<((text: string, path?: string) => void) | null>(null)

// Plano do modo plano (ExitPlanMode) na conversa. `children`: os botões de aprovar e negar,
// quando o Claude espera a resposta.
export function PlanCard({ plan, error, children }: { plan: string; error?: boolean; children?: ReactNode }) {
  return (
    <MarkdownCard text={plan} icon={ClipboardList} title={tr('Plano', 'Plan')} error={error}>
      {children}
    </MarkdownCard>
  )
}

// Arquivo .md que o Claude criou: o mesmo cartão, com o título da ação ("Criar arquivo - CLAUDE.md")
// e o caminho completo.
export function MarkdownFileCard({ text, title, path, error }: { text: string; title: string; path: string; error?: boolean }) {
  return <MarkdownCard text={text} icon={FileText} title={title} path={path} error={error} />
}

// Markdown na conversa: o começo já formatado, rolável numa altura limitada e cortado com um
// degradê, e as duas formas de ler o resto: abrir ali mesmo ou numa janela maior ao lado.
function MarkdownCard({
  text,
  icon: Icon,
  title,
  path,
  error,
  children
}: {
  text: string
  icon: LucideIcon
  title: string
  path?: string
  error?: boolean
  children?: ReactNode
}) {
  const openBeside = useContext(PlanOpenContext)
  // Este texto já está na janela ao lado: o botão fecha.
  const beside = useOpenPlan() === text
  const [expanded, setExpanded] = useState(false)
  const whole = expanded
  const bodyRef = useRef<HTMLDivElement>(null)
  // Texto curto cabe inteiro: sem degradê e sem "Mostrar tudo".
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
  useLayoutEffect(measure, [text, whole])

  return (
    <div className="my-1 overflow-hidden rounded-lg border border-line bg-surface text-[14px]">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Icon size={14} className={`shrink-0 ${error ? 'text-red-400' : 'text-muted'}`} />
        <span className={`min-w-0 flex-1 truncate font-medium ${error ? 'text-red-400' : 'text-text'}`}>{title}</span>
        {/* Texto curto cabe inteiro no cartão: sem o que mostrar a mais. */}
        {(cut || whole) && (
          <button onClick={() => setExpanded((e) => !e)} className="shrink-0 rounded-md px-2 py-0.5 text-[13px] text-muted hover:bg-surface-2 hover:text-text">
            {whole ? tr('Mostrar menos', 'Show less') : tr('Mostrar tudo', 'Show all')}
          </button>
        )}
        {openBeside && (
          <button
            onClick={() => (beside ? closeOpenPlan() : openBeside(text, path))}
            className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[13px] text-text hover:bg-surface-2"
          >
            {/* A seta aponta para onde a janela vai: abre à esquerda, fecha de volta. */}
            {beside ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
            {beside ? tr('Fechar', 'Close') : tr('Abrir ao lado', 'Open beside')}
          </button>
        )}
      </div>
      {path && <PathLine path={path} />}
      {/* Limitado na altura, mas rola por dentro. O degradê fica fora da rolagem, parado na borda. */}
      <div className="relative">
        <div ref={bodyRef} onScroll={measure} className={`px-3 py-2.5 ${whole ? '' : 'max-h-56 overflow-y-auto'}`}>
          <Markdown text={text} />
        </div>
        {cut && !whole && !atEnd && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-surface to-transparent" />
        )}
      </div>
      {children && <div className="border-t border-line px-3 py-2">{children}</div>}
    </div>
  )
}

// Caminho em uma linha, cortado no começo (o fim, com a pasta e o arquivo, sempre à vista; como o
// PathLine do ToolRow). Inteiro na dica.
export function PathLine({ path, className = '' }: { path: string; className?: string }) {
  return (
    <div title={path} className={`truncate text-left font-mono text-xs text-muted [direction:rtl] ${className || 'border-b border-line px-3 py-1.5'}`}>
      {`‎${path}‎`}
    </div>
  )
}
