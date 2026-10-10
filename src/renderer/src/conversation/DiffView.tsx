import { memo } from 'react'
import type { DiffHunk } from '../../../shared/history'
import { diffLines, type DiffSign } from './diffLines'


const ROW: Record<DiffSign, string> = {
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
      {hunks.map((h, i) => (
        <div key={i} className={i > 0 ? 'border-t border-dashed border-line' : ''}>
          {diffLines(h).map((l, j) => (
            <div key={j} className={`flex whitespace-pre ${ROW[l.sign]}`}>
              <span className="w-9 shrink-0 select-none pr-2 text-right text-faint">{l.number}</span>
              <span className="w-3 shrink-0 select-none">{l.sign === ' ' ? '' : l.sign}</span>
              <span className="pr-3">{l.text}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
})
