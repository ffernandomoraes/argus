import { useEffect, useState } from 'react'
import type { AgentDef, AgentProvider } from '../../../../shared/agents'

const NONE: AgentDef[] = []

// Agentes para o @: os do agente que roda a conversa, globais e os da pasta. Relidos a cada conversa
// aberta (refreshKey) e ao trocar de agente, para pegar os criados na biblioteca.
export function useAgentList(cwd: string, refreshKey: string, provider: AgentProvider): AgentDef[] {
  const [agents, setAgents] = useState<AgentDef[]>(NONE)
  useEffect(() => {
    let alive = true
    window.api.agents.list(provider, cwd).then(
      (list) => {
        if (alive) setAgents(list)
      },
      // Sem a lista, o @ só não sugere nada.
      () => {}
    )
    return () => {
      alive = false
    }
  }, [cwd, refreshKey, provider])
  return agents
}
