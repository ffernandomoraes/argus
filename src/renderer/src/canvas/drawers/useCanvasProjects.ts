import { useMemo } from 'react'
import type { MemoryProject } from '../../../../shared/memory'
import type { CanvasNode } from '../types'
import { projectsOnCanvas } from './canvasProjects'

// Pastas do canvas com identidade fixa enquanto os nomes e caminhos não mudam. Mover um bloco cria
// uma lista de nós nova, e a memória relia os arquivos (piscava) a cada lista de pastas nova.
export function useCanvasProjects(nodes: CanvasNode[]): MemoryProject[] {
  const key = JSON.stringify(projectsOnCanvas(nodes))
  return useMemo(() => JSON.parse(key) as MemoryProject[], [key])
}
