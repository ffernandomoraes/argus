import { useEffect, useEffectEvent } from 'react'
import { useCanvasActions } from '../CanvasContext'

// O `claude` que roda no terminal cria a conversa por conta própria e não avisa qual é. O processo
// principal sabe o pid dele e acha a conversa pelo arquivo de status que o Claude Code grava (ver
// main/terminals/sessionBinding.ts), sem adivinhar pela pasta: avisa por terminal:session quando
// ela já está gravada. O nó amarra a conversa para retomá-la ao reabrir o app. Pergunta também ao
// montar: ela pode ter sido achada enquanto o bloco não estava na tela (grupo recolhido, janela
// recarregada). A chave do terminal é o id do nó (ver TerminalNode).
export function useTerminalBinding(nodeId: string): void {
  const { bindTerminalSession } = useCanvasActions()
  const bind = useEffectEvent((sessionId: string) => bindTerminalSession(nodeId, sessionId))

  useEffect(() => {
    let alive = true
    const off = window.api.terminal.onSession((key, sessionId) => {
      if (key === nodeId) bind(sessionId)
    })
    window.api.terminal.session(nodeId).then(
      (sessionId) => {
        if (alive && sessionId) bind(sessionId)
      },
      (err: unknown) => console.error('[terminal] não consegui perguntar a conversa:', err)
    )
    return () => {
      alive = false
      off()
    }
  }, [nodeId])
}
