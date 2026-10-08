import { useEffect, useReducer, useRef, useState } from 'react'
import type { CanvasNode } from './types'
import { MOTION } from '../motion'

// Blocos do canvas com o efeito padrão de aparecer e sumir (motion.tsx), em CSS (index.css):
// o React Flow posiciona o bloco com transform, então o efeito vai no conteúdo dele.
// - Entrada: todo bloco montado anima; na abertura do app, não (canvas-booting), senão o
//   canvas inteiro piscaria ao abrir.
// - Saída: o bloco apagado continua na tela, sem clique nem arraste, até o fade terminar.
//   Só na lista que vai para o React Flow: o estado, o histórico e o que é salvo já não o têm.
export function useNodeMotion(nodes: CanvasNode[]): { shown: CanvasNode[]; booting: boolean; leaving: Set<string> } {
  const [booting, setBooting] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 600)
    return () => clearTimeout(t)
  }, [])

  const prev = useRef(nodes)
  const leaving = useRef(new Map<string, CanvasNode>())
  const [, refresh] = useReducer((n: number) => n + 1, 0)

  // Calculado no render: no mesmo render em que o bloco sai do estado, ele já fica na tela.
  if (prev.current !== nodes) {
    const ids = new Set(nodes.map((n) => n.id))
    for (const n of prev.current) {
      if (ids.has(n.id) || leaving.current.has(n.id)) continue
      leaving.current.set(n.id, {
        ...n,
        className: `${n.className ?? ''} node-leaving`,
        selected: false,
        draggable: false,
        selectable: false,
        connectable: false
      })
    }
    // Voltou antes do fade acabar (desfazer): sai da lista de saída e fica normal.
    for (const id of ids) leaving.current.delete(id)
    prev.current = nodes
  }

  const pending = [...leaving.current.keys()].join('|')
  useEffect(() => {
    if (!pending) return
    const ids = pending.split('|')
    const t = setTimeout(() => {
      ids.forEach((id) => leaving.current.delete(id))
      refresh()
    }, MOTION.panel.out.duration)
    return () => clearTimeout(t)
  }, [pending])

  const extra = [...leaving.current.values()]
  return {
    shown: extra.length ? [...nodes, ...extra] : nodes,
    booting,
    leaving: new Set(leaving.current.keys())
  }
}
