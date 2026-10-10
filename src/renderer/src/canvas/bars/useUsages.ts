import { useEffect, useState } from 'react'
import type { Usage } from '../../../../shared/usage'
import { applyUsage, mergeLoaded, type Usages } from './usageState'

// Pede o uso de todas as contas e ouve os avisos de cada uma. Fora do hook: as contas que já
// tiveram aviso ficam guardadas aqui, para a resposta do pedido não passar por cima delas.
function watchUsages(update: (change: (current: Usages) => Usages) => void): () => void {
  let alive = true
  const heard = new Set<string>()
  const off = window.api.usage.onUpdate((account: string, usage: Usage | null) => {
    heard.add(account)
    update((current) => applyUsage(current, account, usage))
  })
  window.api.usage.get().then(
    (loaded) => alive && update((current) => mergeLoaded(current, loaded, heard)),
    (err: unknown) => console.error('[limites] uso das contas:', err)
  )
  return () => {
    alive = false
    off()
  }
}

// Uso de cada conta logada; some quando a conta sai ou é removida.
export function useUsages(): Usages {
  const [usages, setUsages] = useState<Usages>({})
  useEffect(() => watchUsages(setUsages), [])
  return usages
}
