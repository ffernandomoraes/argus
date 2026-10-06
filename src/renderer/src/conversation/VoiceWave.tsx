import { useEffect, useRef, useState } from 'react'

const BARS = 10

// Ondas que reagem à voz enquanto o ditado está ligado. Escuta o volume direto, para não
// redesenhar o chat inteiro 20 vezes por segundo.
export function VoiceWave() {
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0))
  const latest = useRef(0)

  useEffect(() => {
    const off = window.api.speech.onEvent((e) => {
      if (e.type === 'level') latest.current = e.value
    })
    // Desliza da direita para a esquerda; cada barra é um instante recente.
    const id = setInterval(() => {
      setLevels((l) => [...l.slice(1), latest.current])
      latest.current *= 0.6
    }, 60)
    return () => {
      off()
      clearInterval(id)
    }
  }, [])

  return (
    <span className="flex h-4 items-center gap-[2px]" aria-hidden="true">
      {levels.map((v, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full bg-running transition-[height] duration-75"
          style={{ height: `${Math.max(12, Math.min(100, v * 140))}%` }}
        />
      ))}
    </span>
  )
}
