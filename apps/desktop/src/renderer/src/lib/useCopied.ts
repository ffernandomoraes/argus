import { useCallback, useEffect, useState } from 'react'

// Copiar para a área de transferência e mostrar o "Copiado" por um instante. `copy` resolve com
// false se o sistema recusar (nunca lança). Copiar de novo antes do fim recomeça a contagem; o
// timer some junto com o componente.
export function useCopied(ms = 1500): { copied: boolean; copy: (text: string) => Promise<boolean> } {
  // Quantas cópias desde que o aviso apareceu; zero é sem aviso. Cada cópia nova reinicia o tempo.
  const [stamp, setStamp] = useState(0)

  useEffect(() => {
    if (!stamp) return
    const timer = setTimeout(() => setStamp(0), ms)
    return () => clearTimeout(timer)
  }, [stamp, ms])

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      return false
    }
    setStamp((s) => s + 1)
    return true
  }, [])

  return { copied: stamp > 0, copy }
}
