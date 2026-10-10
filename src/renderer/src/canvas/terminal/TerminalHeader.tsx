import type { ReactNode } from 'react'
import { SquareTerminal, Terminal } from 'lucide-react'
import { EditableName } from '../EditableName'
import { PathLabel } from '../PathLabel'

// Cabeçalho do terminal, no canvas e no modo foco: ícone (shell ou claude), nome, pasta e ações.
export function TerminalHeader({
  nodeId,
  name,
  path,
  shell,
  children
}: {
  nodeId: string
  name: string
  path: string
  shell: boolean
  // Botões à direita.
  children: ReactNode
}) {
  const Icon = shell ? Terminal : SquareTerminal
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
      <Icon size={14} className="shrink-0 text-muted" />
      <EditableName id={nodeId} value={name} className="shrink-0 text-sm font-medium" />
      <PathLabel path={path} className="ml-auto min-w-0 pl-2 text-[12px] text-faint" />
      {children}
    </header>
  )
}
