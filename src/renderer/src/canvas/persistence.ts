import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { CanvasNode } from './types'

// Estado passageiro do React Flow (seleção, arraste) não vai para o arquivo nem para as outras janelas.
function clean(nodes: CanvasNode[]): CanvasNode[] {
  return nodes.map(({ selected: _s, dragging: _d, resizing: _r, ...n }) => n as CanvasNode) // eslint-disable-line @typescript-eslint/no-unused-vars
}

export function loadNodes(): CanvasNode[] {
  const saved = window.api.canvas.load()
  // "conversation" e "browser" foram testes que não ficaram: não voltam para a tela.
  if (!Array.isArray(saved)) return []
  return (saved as CanvasNode[])
    .filter((n) => !['conversation', 'browser'].includes((n as { type?: string }).type ?? ''))
    // As primeiras notas tinham tamanho fixo; hoje o balão acompanha o texto.
    .map((n) => (n.type === 'note' && n.style ? { ...n, style: undefined, width: undefined, height: undefined } : n))
}

// O mesmo canvas aberto em várias janelas (uma por monitor). A mudança feita aqui sai para o
// processo principal, que grava e repassa às outras; a que chega de lá entra mantendo a seleção
// desta janela, que é só dela.
export function useCanvasSync(nodes: CanvasNode[], setNodes: Dispatch<SetStateAction<CanvasNode[]>>): void {
  // Último estado trocado com o processo principal: o que chegou de lá não volta para lá.
  const last = useRef<string | null>(null)

  useEffect(() => {
    const data = clean(nodes)
    const json = JSON.stringify(data)
    if (json === last.current) return
    last.current = json
    window.api.canvas.sync(data)
  }, [nodes])

  useEffect(
    () =>
      window.api.canvas.onRemote((remote) => {
        if (!Array.isArray(remote)) return
        last.current = JSON.stringify(remote)
        setNodes((ns) => {
          const selected = new Set(ns.filter((n) => n.selected).map((n) => n.id))
          return (remote as CanvasNode[]).map((n) => (selected.has(n.id) ? { ...n, selected: true } : n))
        })
      }),
    [setNodes]
  )
}
