import { useEffect, useMemo, useState } from 'react'
import { MOTION } from '../../motion'
import type { CanvasNode } from '../types'
import { NO_LEAVING, sameNodes, withLeaving, withoutLeaving } from './leavingNodes'

// Blocos do canvas com o efeito padrão de aparecer e sumir (motion.tsx), em CSS (index.css):
// o React Flow posiciona o bloco com transform, então o efeito vai no conteúdo dele.
// - Entrada: todo bloco montado anima; na abertura do app, não (canvas-booting), senão o
//   canvas inteiro piscaria ao abrir.
// - Saída: o bloco apagado continua na tela, sem clique nem arraste, até o fade terminar.
//   Só na lista que vai para o React Flow: o estado, o histórico e o que é salvo já não o têm.
export function useNodeMotion(nodes: CanvasNode[]): {
  shown: CanvasNode[]
  booting: boolean
  leaving: ReadonlySet<string>
} {
  const [booting, setBooting] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 600)
    return () => clearTimeout(t)
  }, [])

  // Calculado no render (a lista anterior fica no estado): no mesmo render em que o bloco sai do
  // estado, ele já fica na tela. Lista nova com os mesmos nós não conta (e não entra em laço).
  const [seen, setSeen] = useState(nodes)
  const [leaving, setLeaving] = useState(NO_LEAVING)
  if (seen !== nodes && !sameNodes(seen, nodes)) {
    setSeen(nodes)
    const next = withLeaving(seen, nodes, leaving)
    if (next !== leaving) setLeaving(next)
  }

  // Cada saída nova recomeça a contagem; no fim, os que estavam saindo somem de vez.
  useEffect(() => {
    if (!leaving.size) return
    const done = [...leaving.keys()]
    const t = setTimeout(() => setLeaving((current) => withoutLeaving(current, done)), MOTION.panel.out.duration)
    return () => clearTimeout(t)
  }, [leaving])

  const shown = useMemo(() => (leaving.size ? [...nodes, ...leaving.values()] : nodes), [nodes, leaving])
  const ids = useMemo(() => new Set(leaving.keys()), [leaving])
  return { shown, booting, leaving: ids }
}
