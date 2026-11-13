import { useCallback, useLayoutEffect, useRef } from 'react'

// Função de identidade fixa que sempre roda a versão mais recente de `fn`, com os valores do último
// render. Para o que vai ao React Flow, aos nós e aos drawers: uma função nova a cada render
// desfaz o memo de quem a recebe (com o onNodeContextMenu, todos os nós redesenhavam).
// Só para eventos e efeitos: chamada durante o render, ainda teria os valores do render anterior.
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const latest = useRef(fn)
  useLayoutEffect(() => {
    latest.current = fn
  })
  return useCallback((...args: A) => latest.current(...args), [])
}
