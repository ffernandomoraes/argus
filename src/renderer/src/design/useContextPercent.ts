import { useEffect, useState } from 'react'

// Quanto da janela de contexto a conversa ocupa: relido a cada resposta (`revision`) e quando ela
// para de trabalhar. Sem sessão ainda, zero.
export function useContextPercent(projectPath: string, sessionId: string | undefined, revision: number | undefined, running: boolean): number {
  const key = `${projectPath}|${sessionId ?? ''}`
  const [read, setRead] = useState<{ key: string; percent: number } | null>(null)
  useEffect(() => {
    if (!sessionId) return
    let alive = true
    window.api.sessions.context(projectPath, sessionId).then(
      (percent) => alive && setRead({ key: `${projectPath}|${sessionId}`, percent }),
      (err: unknown) => console.error('[design] contexto da conversa:', err)
    )
    return () => {
      alive = false
    }
  }, [projectPath, sessionId, revision, running])
  return sessionId && read?.key === key ? read.percent : 0
}
