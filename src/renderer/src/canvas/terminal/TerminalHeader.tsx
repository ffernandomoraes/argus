import type { ReactNode } from 'react'
import { SquareTerminal, Terminal } from 'lucide-react'
import type { ProviderId } from '../../../../shared/providers'
import { AgentIcon } from '../../icons/AgentIcon'
import { EditableName } from '../EditableName'
import { PathLabel } from '../PathLabel'

// Cabeçalho do terminal, no canvas e no modo foco: ícone (shell, claude ou o logo do outro agente),
// nome, pasta e ações.
export function TerminalHeader({
  nodeId,
  name,
  path,
  shell,
  agent,
  children
}: {
  nodeId: string
  name: string
  path: string
  shell: boolean
  // Codex, Gemini ou Cursor rodando no terminal.
  agent?: ProviderId
  // Botões à direita.
  children: ReactNode
}) {
  const Icon = shell ? Terminal : SquareTerminal
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
      {agent && !shell ? <AgentIcon provider={agent} size={14} /> : <Icon size={14} className="shrink-0 text-muted" />}
      <EditableName id={nodeId} value={name} className="shrink-0 text-sm font-medium" />
      <PathLabel path={path} className="ml-auto min-w-0 pl-2 text-[12px] text-faint" />
      {children}
    </header>
  )
}
