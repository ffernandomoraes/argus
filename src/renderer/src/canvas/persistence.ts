import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { nodesFromSaved } from './flow/savedNodes'
import { forSync, mergeRemote } from './flow/syncNodes'
import type { CanvasNode } from './types'

// Canvas salvo (lido pelo processo principal) de volta à tela, sem os blocos estragados.
export function loadNodes(): CanvasNode[] {
  const { nodes, dropped } = nodesFromSaved(window.api.canvas.load())
  if (dropped) console.warn(`[canvas] ${dropped} bloco(s) estragado(s) no canvas salvo ficaram de fora`)
  return nodes
}

// O mesmo canvas aberto em várias janelas (uma por monitor). A mudança feita aqui sai para o
// processo principal, que grava e repassa às outras; a que chega de lá entra mantendo a seleção
// e a medida desta janela, que são só dela.
export function useCanvasSync(nodes: CanvasNode[], setNodes: Dispatch<SetStateAction<CanvasNode[]>>): void {
  // Último estado trocado com o processo principal: o que chegou de lá não volta para lá. Começa
  // com o que foi carregado, então abrir o app não grava nada; se a leitura falhou e veio vazio,
  // gravar agora apagaria o arquivo.
  const [loaded] = useState(() => JSON.stringify(forSync(nodes)))
  const last = useRef(loaded)

  useEffect(() => {
    const data = forSync(nodes)
    const json = JSON.stringify(data)
    if (json === last.current) return
    last.current = json
    window.api.canvas.sync(data)
  }, [nodes])

  useEffect(
    () =>
      window.api.canvas.onRemote((remote) => {
        if (!Array.isArray(remote)) return
        // Passa pela mesma conferência do arquivo: o ⌘Z pode trazer o canvas como foi lido dele.
        const incoming = nodesFromSaved(remote).nodes
        last.current = JSON.stringify(forSync(incoming))
        setNodes((ns) => mergeRemote(ns, incoming))
      }),
    [setNodes]
  )
}
