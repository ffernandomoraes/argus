import { useCallback, useEffect, useState } from 'react'
import type { DevServer } from '../../../shared/devServers'

const POLL = 5000

// Servidores que o Claude Code ou o play subiu, mais o que roda dentro das pastas do canvas.
// Consulta já ao montar e a cada poucos segundos.
export function useDevServers(paths: string[]) {
  const [servers, setServers] = useState<DevServer[]>([])
  const [loaded, setLoaded] = useState(false)
  // Lista nova a cada render do canvas; a consulta só muda quando as pastas mudam.
  const key = JSON.stringify(paths)
  const refresh = useCallback(
    () =>
      window.api.devServers.list(JSON.parse(key)).then((list) => {
        setServers(list)
        setLoaded(true)
      }),
    [key]
  )

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, POLL)
    return () => clearInterval(timer)
  }, [refresh])

  const kill = useCallback((pgid: number) => window.api.devServers.kill(pgid, JSON.parse(key)), [key])

  return { servers, loaded, refresh, kill }
}
