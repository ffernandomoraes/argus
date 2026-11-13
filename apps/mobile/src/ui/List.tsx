import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

// Lista agrupada no estilo dos Ajustes do iOS: título pequeno em cima, cartão arredondado e linhas
// separadas por um fio de ponta a ponta.

// flush: o título começa rente ao cartão (a pílula do grupo), em vez de alinhado ao texto das linhas.
export function Section({ title, footer, children, action, flush }: { title?: ReactNode; footer?: ReactNode; children: ReactNode; action?: ReactNode; flush?: boolean }) {
  return (
    <section className="mt-6 first:mt-3">
      {(title || action) && (
        <div className={`flex items-end justify-between ${flush ? 'mb-2' : 'mb-1.5 px-4'}`}>
          <h2 className="text-[13px] font-normal tracking-wide text-muted uppercase">{title}</h2>
          {action}
        </div>
      )}
      <div className="overflow-hidden rounded-[12px] border border-card-border bg-card">{children}</div>
      {footer && <p className="mt-1.5 px-4 text-[13px] leading-snug text-muted">{footer}</p>}
    </section>
  )
}

export function Row({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
  chevron = !!onClick,
  danger
}: {
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
  chevron?: boolean
  danger?: boolean
}) {
  const body = (
    <>
      {icon && <span className="flex w-7 shrink-0 justify-center">{icon}</span>}
      <span className="flex min-w-0 flex-1 items-center gap-2 py-[15px] pr-4">
        <span className="min-w-0 flex-1 text-left">
          <span className={`block truncate text-[17px] leading-tight ${danger ? 'text-red' : 'text-text'}`}>{title}</span>
          {subtitle && <span className="mt-0.5 block truncate text-[15px] leading-tight text-muted">{subtitle}</span>}
        </span>
        {trailing && <span className="shrink-0 text-[15px] text-muted">{trailing}</span>}
        {chevron && <ChevronRight size={18} className="shrink-0 text-faint" />}
      </span>
    </>
  )
  // O fio de baixo atravessa a linha inteira; a última do cartão fica sem.
  const cls = 'flex w-full items-center gap-3 border-b border-line pl-4 text-left last:border-0'
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} active:bg-card-press`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-3 text-[15px] text-muted">{children}</p>
}
