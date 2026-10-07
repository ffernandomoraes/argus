import { useEffect, useState } from 'react'
import type { UpdateInfo } from '../../../shared/updates'

// Versão em uso e situação da atualização, acompanhando o processo principal.
export function useUpdates(): UpdateInfo | null {
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  useEffect(() => {
    let alive = true
    void window.api.updates.get().then((i) => alive && setInfo(i))
    const off = window.api.updates.onState((state) => setInfo((i) => (i ? { ...i, state } : i)))
    return () => {
      alive = false
      off()
    }
  }, [])
  return info
}
