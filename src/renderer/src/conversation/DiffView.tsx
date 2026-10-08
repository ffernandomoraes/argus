import { memo } from 'react'
import type { DiffHunk } from '../../../shared/history'

const ROW: Record<string, string> = {
  '+': 'bg-emerald-500/12 text-emerald-300 [[data-theme=light]_&]:text-emerald-800',
  '-': 'bg-red-500/12 text-red-300 [[data-theme=light]_&]:text-red-800',
  ' ': 'text-muted'
}

// Linhas removidas e adicionadas numa edição. Sem número de linha quando é só a proposta.
// full: ocupa o painel de código inteiro, sem caixa nem altura máxima; quem rola é o painel.
export const DiffView = memo(function DiffView({ hunks, full = false }: { hunks: DiffHunk[]; full?: boolean }) {
  return (
    <div
      className={
        full
          ? 'min-w-full w-max py-2 font-mono text-[13px] leading-[1.6]'
          : 'max-h-72 overflow-auto rounded-md border border-line bg-bg font-mono text-[12px] leading-[1.55]'
      }
    >
      {hunks.map((h, i) => {
        let line = h.newStart
        return (
          <div key={i} className={i > 0 ? 'border-t border-dashed border-line' : ''}>
            {h.lines.map((text, j) => {
              const sign = text[0] === '+' || text[0] === '-' ? text[0] : ' '
              const number = sign === '-' || !h.newStart ? '' : line++
              return (
                <div key={j} className={`flex whitespace-pre ${ROW[sign]}`}>
                  <span className="w-9 shrink-0 select-none pr-2 text-right text-faint">{number}</span>
                  <span className="w-3 shrink-0 select-none">{sign === ' ' ? '' : sign}</span>
                  <span className="pr-3">{text.slice(1)}</span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
})

// "+12 −3" para o resumo da edição.
export function diffStats(hunks: DiffHunk[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const h of hunks) for (const l of h.lines) l[0] === '+' ? added++ : l[0] === '-' && removed++
  return { added, removed }
}
