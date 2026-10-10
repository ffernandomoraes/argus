import { useState } from 'react'
import { applyNodeChanges, useReactFlow, type NodeChange } from '@xyflow/react'
import { useStableCallback } from '../../lib/useStableCallback'
import type { NodesApi } from '../actions/types'
import { fitAfterResize } from '../operations'
import { snap, type Guide } from '../snapping'
import type { CanvasNode } from '../types'

const NO_GUIDES: Guide[] = []

type Options = Pick<NodesApi, 'nodesRef' | 'setNodes'> & {
  trackGesture: (active: boolean) => void
  // Blocos apagados ainda sumindo na tela (useNodeMotion).
  leaving: ReadonlySet<string>
}

// Mudanças que o React Flow manda (arraste, medida, seleção) entrando no estado, com o encaixe nas
// linhas-guia dos vizinhos e o grupo crescendo junto com o que está dentro dele.
export function useNodesChange({ nodesRef, setNodes, trackGesture, leaving }: Options) {
  const { getZoom } = useReactFlow()
  const [guides, setGuides] = useState(NO_GUIDES)

  const onNodesChange = useStableCallback((all: NodeChange<CanvasNode>[]) => {
    // O que o React Flow mandar sobre os blocos que estão sumindo não volta para o estado.
    const changes = leaving.size ? all.filter((c) => !('id' in c) || !leaving.has(c.id)) : all
    if (!changes.length) return
    trackGesture(
      changes.some((c) => (c.type === 'position' && c.dragging) || (c.type === 'dimensions' && c.resizing))
    )
    // Instância que mudou de tamanho empurra a borda do grupo. Só instância: medida do
    // próprio grupo não entra, senão encolher o grupo na mão seria desfeito na hora.
    const resized = changes.filter((c) => c.type === 'dimensions').map((c) => c.id)
    // Instância arrastada contra a borda do grupo: o grupo cresce para aquele lado, junto com o arraste.
    const dragged = changes.flatMap((c) => (c.type === 'position' && c.dragging ? [c.id] : []))
    // Um bloco sendo arrastado encaixa no alinhamento dos vizinhos (vários juntos, não).
    const moves = changes.filter((c) => c.type === 'position' && c.dragging !== undefined)
    const move = moves.length === 1 && moves[0].type === 'position' ? moves[0] : null
    let applied = changes
    if (move?.position) {
      const snapped = snap(nodesRef.current, move.id, move.position, getZoom())
      applied = changes.map((c) => (c === move ? { ...move, position: snapped.position } : c))
      setGuides(move.dragging ? snapped.guides : NO_GUIDES)
    } else if (moves.length) setGuides(NO_GUIDES)
    setNodes((ns) => {
      const next = applyNodeChanges(applied, ns)
      return resized.length || dragged.length ? fitAfterResize(ns, next, [...resized, ...dragged]) : next
    })
  })

  return { onNodesChange, guides }
}
