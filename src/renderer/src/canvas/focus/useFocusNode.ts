import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { FocusNode, NodesApi } from '../actions/types'
import { hidingGroup, revealNode } from './reveal'
import { selectOnly } from './selectOnly'

// Seleciona o bloco e enquadra ele na tela, sem passar de 100%. Bloco num grupo recolhido ou com o
// conteúdo oculto: o grupo abre antes (o fitView ignora bloco escondido), e isso vai para o ⌘Z.
export function useFocusNode({ nodesRef, setNodes, change }: NodesApi): FocusNode {
  const { fitView } = useReactFlow()
  return useCallback(
    (id: string, padding = 0.15) => {
      if (hidingGroup(nodesRef.current, id)) change((ns) => revealNode(ns, id))
      setNodes((ns) => selectOnly(ns, id))
      // Espera o bloco novo (ou o grupo que abriu) ser medido antes de enquadrar.
      setTimeout(() => void fitView({ nodes: [{ id }], padding, duration: 300, maxZoom: 1 }), 100)
    },
    [nodesRef, setNodes, change, fitView]
  )
}
