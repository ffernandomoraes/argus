import { listAgents, removeAgent, saveAgent } from '../agents'
import { handle } from './register'

// Biblioteca de agentes (~/.claude/agents e os do projeto).
export function registerAgentsIpc(): void {
  handle('agents:list', (_e, projectPath) => listAgents(projectPath))
  handle('agents:save', (_e, req) => saveAgent(req))
  handle('agents:remove', (_e, name) => removeAgent(name))
}
