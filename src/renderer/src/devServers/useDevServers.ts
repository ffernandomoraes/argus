import { useCallback, useEffect, useState } from 'react'
import type { DevServer } from '../../../shared/devServers'

const POLL = 5000

// Servidores que algum Claude Code subiu. Consulta já ao montar e a cada poucos segundos: o
// selo da barra mostra quantos estão de pé mesmo com o painel fechado.
export function useDevServers() {
  const [servers, setServers] = useState<DevServer[]>([])
  const [loaded, setLoaded] = useState(false)
  const refresh = useCallback(
    () =>
      window.api.devServers.list().then((list) => {
        setServers(list)
        setLoaded(true)
      }),
    []
  )

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, POLL)
    return () => clearInterval(timer)
  }, [refresh])

  return { servers, loaded, refresh }
}
