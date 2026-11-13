import { listAgents, removeAgent, saveAgent } from '../agents'
import { handle } from './register'

// Biblioteca de agentes (~/.claude/agents e os do projeto).
export function registerAgentsIpc(): void {
  handle('agents:list', (_e, provider, projectPath) => listAgents(provider, projectPath))
  handle('agents:save', (_e, provider, req) => saveAgent(provider, req))
  handle('agents:remove', (_e, provider, name) => removeAgent(provider, name))
}
