import { useCallback, useEffect, useState } from 'react'
import type { DevServer } from '../../../shared/devServers'

const POLL = 5000

// Servidores que o Claude Code ou o play subiu, mais o que roda dentro das pastas do canvas.
// Consulta já ao montar e de novo alguns segundos depois de cada resposta (nunca duas ao mesmo
// tempo). Com a janela oculta, para; volta ao reaparecer.
export function useDevServers(paths: string[]) {
  const [servers, setServers] = useState<DevServer[]>([])
  const [loaded, setLoaded] = useState(false)
  // Lista nova a cada render do canvas; a consulta só muda quando as pastas mudam.
  const key = JSON.stringify(paths)
  const refresh = useCallback(async () => {
    const list = await window.api.devServers.list(JSON.parse(key) as string[])
    setServers(list)
    setLoaded(true)
  }, [key])

  useEffect(() => {
    let alive = true
    let busy = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      clearTimeout(timer)
      timer = undefined
      if (busy || document.hidden) return
      busy = true
      try {
        await refresh()
      } catch {
        // Tenta de novo na próxima volta.
      }
      busy = false
      if (alive && !document.hidden) timer = setTimeout(() => void tick(), POLL)
    }
    const onVisibility = () => void tick()
    void tick()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      alive = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh])

  const kill = useCallback((pgid: number) => window.api.devServers.kill(pgid, JSON.parse(key) as string[]), [key])

  return { servers, loaded, refresh, kill }
}
