import { useEffect, useState } from 'react'
import type { AgentDef, AgentProvider } from '../../../shared/agents'

// Agentes para o @ (os globais e os do projeto) do agente que roda o design, como na conversa:
// relidos ao abrir o design, para pegar os criados na biblioteca.
export function useProjectAgents(projectPath: string, provider: AgentProvider): AgentDef[] {
  const [agents, setAgents] = useState<AgentDef[]>([])
  useEffect(() => {
    let alive = true
    window.api.agents.list(provider, projectPath).then(
      (list) => alive && setAgents(list),
      (err: unknown) => console.error('[design] agentes:', err)
    )
    return () => {
      alive = false
    }
  }, [projectPath, provider])
  return agents
}
