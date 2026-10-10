import { useEffect, useState } from 'react'
import type { AgentDef } from '../../../../shared/agents'

const NONE: AgentDef[] = []

// Agentes para o @: globais e os da pasta. Relidos a cada conversa aberta (refreshKey), para pegar
// os criados na biblioteca.
export function useAgentList(cwd: string, refreshKey: string): AgentDef[] {
  const [agents, setAgents] = useState<AgentDef[]>(NONE)
  useEffect(() => {
    let alive = true
    window.api.agents.list(cwd).then(
      (list) => {
        if (alive) setAgents(list)
      },
      // Sem a lista, o @ só não sugere nada.
      () => {}
    )
    return () => {
      alive = false
    }
  }, [cwd, refreshKey])
  return agents
}
