import { listMemory, readMemory, writeMemory } from '../memory'
import { handle } from './register'

// Memória do Claude Code (os CLAUDE.md e as memórias de cada projeto).
export function registerMemoryIpc(): void {
  handle('memory:list', (_e, projects) => listMemory(projects))
  handle('memory:read', (_e, path, projects) => readMemory(path, projects))
  handle('memory:write', (_e, path, text, projects, base) => writeMemory(path, text, projects, base))
}
