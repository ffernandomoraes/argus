import { useLayoutEffect, useRef, useState } from 'react'

type Commands = Record<string, (...args: never[]) => unknown>

// Objeto de comandos criado uma vez só: cada comando chama a versão do último render. Para o
// contexto do canvas, que nunca muda de valor (quem lê não redesenha por ele). Como no
// useStableCallback, só para eventos e efeitos; o conjunto de nomes é o do primeiro render.
export function useStableCommands<T extends Commands>(commands: T): T {
  const latest = useRef(commands)
  useLayoutEffect(() => {
    latest.current = commands
  })
  const [stable] = useState(() => {
    const out: Record<string, unknown> = {}
    for (const name of Object.keys(commands)) {
      out[name] = (...args: unknown[]) => (latest.current[name] as (...a: unknown[]) => unknown)(...args)
    }
    return out as T
  })
  return stable
}
