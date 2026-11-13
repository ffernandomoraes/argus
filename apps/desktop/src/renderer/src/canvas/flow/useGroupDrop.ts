import { useCallback, useEffect, useRef } from 'react'
import type { OnNodeDrag } from '@xyflow/react'
import type { NodesApi } from '../actions/types'
import { patchView, type CanvasViewStore } from '../canvasView'
import { dropIntoGroup, groupUnder } from '../operations'
import type { CanvasNode } from '../types'

// Tempo com o bloco em cima de um grupo, durante o arraste, para ele entrar sem precisar soltar.
const DWELL_MS = 2000

// Bloco solto entra no grupo ao ser largado em cima dele, ou antes, se ficar em cima por DWELL_MS:
// o arraste continua, já dentro do grupo. Sem histórico próprio: o arraste já gravou, e desfazer
// volta o bloco para fora de uma vez.
export function useGroupDrop({ nodesRef, setNodes }: Pick<NodesApi, 'nodesRef' | 'setNodes'>, view: CanvasViewStore) {
  // Grupo que recebe o bloco solto sendo arrastado, se ele for largado agora; fica destacado. Vai
  // para o store do canvas: só o grupo que entra ou sai do destaque redesenha (useIsDropTarget).
  const setDropTargetId = useCallback((dropTargetId: string | null) => patchView(view, { dropTargetId }), [view])
  // Contagem do bloco parado em cima do grupo destacado; recomeça ao trocar de grupo ou sair dele.
  const dwell = useRef<{ groupId: string; timer: number } | null>(null)
  const stopDwell = useCallback(() => {
    if (dwell.current) clearTimeout(dwell.current.timer)
    dwell.current = null
  }, [])
  useEffect(() => stopDwell, [stopDwell])

  const onNodeDrag = useCallback<OnNodeDrag<CanvasNode>>(
    (_, __, dragged) => {
      const target = dragged.map((n) => groupUnder(nodesRef.current, n)).find(Boolean)
      setDropTargetId(target?.id ?? null)
      if (dwell.current?.groupId === target?.id) return
      stopDwell()
      if (!target) return
      const ids = dragged.map((n) => n.id)
      const timer = window.setTimeout(() => {
        dwell.current = null
        setDropTargetId(null)
        setNodes((ns) => dropIntoGroup(ns, ids))
      }, DWELL_MS)
      dwell.current = { groupId: target.id, timer }
    },
    [nodesRef, setNodes, setDropTargetId, stopDwell]
  )

  const onNodeDragStop = useCallback<OnNodeDrag<CanvasNode>>(
    (_, __, dragged) => {
      stopDwell()
      setDropTargetId(null)
      setNodes((ns) => dropIntoGroup(ns, dragged.map((n) => n.id)))
    },
    [setNodes, setDropTargetId, stopDwell]
  )

  return { onNodeDrag, onNodeDragStop }
}
