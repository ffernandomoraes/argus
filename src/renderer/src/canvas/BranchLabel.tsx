import { GitBranch } from 'lucide-react'

// Branch do git: ícone e nome, cortado no fim quando falta espaço (o nome inteiro fica no title).
export function BranchLabel({ branch, className }: { branch: string; className?: string }) {
  return (
    <span title={`Branch: ${branch}`} className={`flex min-w-0 items-center gap-1 font-mono ${className ?? ''}`}>
      <GitBranch size={11} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{branch}</span>
    </span>
  )
}
