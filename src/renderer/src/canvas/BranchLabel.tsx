import { GitBranch } from 'lucide-react'

// Branch do git: ícone e nome, cortado no fim quando falta espaço (o nome inteiro fica no title).
// Com arquivos não comitados, o número deles vem depois do nome, numa pílula cinza discreta.
export function BranchLabel({ branch, changes, className }: { branch: string; changes?: number; className?: string }) {
  const dirty = !!changes && changes > 0
  const title = dirty
    ? `Branch: ${branch} - ${changes} ${changes === 1 ? 'arquivo não comitado' : 'arquivos não comitados'}`
    : `Branch: ${branch}`
  return (
    <span title={title} className={`flex min-w-0 items-center gap-1 font-mono ${className ?? ''}`}>
      <GitBranch size={11} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{branch}</span>
      {dirty && (
        <span
          aria-label={title}
          className="ml-0.5 flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-surface-2 px-1 font-sans text-[11px] font-medium leading-none text-muted"
        >
          {changes > 999 ? '999+' : changes}
        </span>
      )}
    </span>
  )
}
