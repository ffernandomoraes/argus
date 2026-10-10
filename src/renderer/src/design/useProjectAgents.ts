import { useEffect, useState } from 'react'
import type { AgentDef } from '../../../shared/agents'

// Agentes para o @ (os globais e os do projeto), como na conversa: relidos ao abrir o design, para
// pegar os criados na biblioteca.
export function useProjectAgents(projectPath: string): AgentDef[] {
  const [agents, setAgents] = useState<AgentDef[]>([])
  useEffect(() => {
    let alive = true
    window.api.agents.list(projectPath).then(
      (list) => alive && setAgents(list),
      (err: unknown) => console.error('[design] agentes:', err)
    )
    return () => {
      alive = false
    }
  }, [projectPath])
  return agents
}
