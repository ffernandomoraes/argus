import { useRef } from 'react'
import { Button } from '../ui/Button'
import { TERMINAL_THEME } from './terminal/theme'
import { useXterm } from './terminal/useXterm'

// Terminal de verdade rodando o `claude` (ou o shell, com `shell`) na pasta. O processo vive
// no processo principal: fechar o painel ou trocar de conversa não encerra a sessão. Modelo,
// esforço e modo saem das configurações da conversa `sessionId`, lidas ao abrir.
export function TerminalView({
  sessionKey,
  cwd,
  account,
  shell,
  sessionId,
  fontScale = 1,
  autoFocus = true
}: {
  sessionKey: string
  cwd: string
  // Conta do Claude do grupo; vazia = a padrão. Como modelo e esforço, só entra ao abrir.
  account?: string
  shell?: boolean
  sessionId?: string
  // Escala do drawer: o xterm desenha o próprio texto, então ela vira tamanho de fonte.
  fontScale?: number
  // Pega o foco ao abrir (padrão). No canvas, só o bloco recém-criado: um terminal que só remonta
  // (abrir o app, expandir o grupo) roubava as teclas do canvas.
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { error, exitCode, reopen } = useXterm(ref, { sessionKey, cwd, shell, account, sessionId, fontScale, autoFocus })

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" style={{ background: TERMINAL_THEME.background }}>
      {/* O respiro fica no invólucro: o encaixe do xterm mede o elemento dele inteiro, e com o
          padding nele a última linha saía cortada. */}
      <div className="min-h-0 flex-1 px-3 py-2">
        <div ref={ref} className="h-full" />
      </div>
      {(error || exitCode !== null) && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-2.5 text-xs">
          <span className="text-muted">{error ?? `Sessão encerrada (código ${exitCode}).`}</span>
          {!error && (
            <Button size="sm" onClick={reopen}>
              Abrir de novo
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
