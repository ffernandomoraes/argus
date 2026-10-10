import type { MemoryProject } from '../../../../shared/memory'
import type { CanvasNode } from '../types'

// Pastas do canvas, sem repetir: cada uma tem seu CLAUDE.md, sua memória automática e seus
// servidores. Usadas pela memória, pelos servidores rodando e pelo "Nova pasta".
export function projectsOnCanvas(nodes: CanvasNode[]): MemoryProject[] {
  const seen = new Map<string, MemoryProject>()
  for (const n of nodes) {
    if (n.type === 'project' && !seen.has(n.data.path)) seen.set(n.data.path, { name: n.data.name, path: n.data.path })
  }
  return [...seen.values()]
}
