import { useEffect, useEffectEvent } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { FocusNode, NodesApi } from '../actions/types'
import { createFolderInstance, displayPath, INSTANCE_MIN_HEIGHT, INSTANCE_WIDTH } from '../factory'
import { addNode } from '../operations'

// `argus .` num terminal: a pasta entra no centro da tela, ou, se já está no canvas, a tela vai
// até ela (abrindo o grupo, se ela estiver escondida num recolhido).
export function useCliOpen({ nodesRef, change }: NodesApi, focusNode: FocusNode): void {
  const { screenToFlowPosition } = useReactFlow()

  const open = useEffectEvent((folder: string) => {
    let target = nodesRef.current.find((n) => n.type === 'project' && n.data.path === displayPath(folder))
    if (!target) {
      const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      const node = createFolderInstance({ x: center.x - INSTANCE_WIDTH / 2, y: center.y - INSTANCE_MIN_HEIGHT / 2 }, folder)
      change((ns) => addNode(ns, node))
      target = node
    }
    focusNode(target.id, 0.3)
  })

  useEffect(() => {
    const off = window.api.cli.onOpen((folder) => open(folder))
    window.api.cli.ready()
    return off
  }, [])
}
