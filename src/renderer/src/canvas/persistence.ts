import { useEffect } from 'react'
import type { CanvasNode } from './types'

// Estado passageiro do React Flow (seleção, arraste) não vai para o arquivo.
function clean(nodes: CanvasNode[]): CanvasNode[] {
  return nodes.map(({ selected: _s, dragging: _d, resizing: _r, ...n }) => n as CanvasNode) // eslint-disable-line @typescript-eslint/no-unused-vars
}

export function loadNodes(): CanvasNode[] {
  const saved = window.api.canvas.load()
  // O nó "conversation" foi um teste que não ficou: não volta para a tela.
  return Array.isArray(saved)
    ? ((saved as { type?: string }[]).filter((n) => n.type !== 'conversation') as CanvasNode[])
    : []
}

// Salva pouco depois da última mudança, para não gravar a cada quadro de um arraste.
export function useSaveNodes(nodes: CanvasNode[]): void {
  useEffect(() => {
    const id = setTimeout(() => void window.api.canvas.save(clean(nodes)), 400)
    return () => clearTimeout(id)
  }, [nodes])
}
