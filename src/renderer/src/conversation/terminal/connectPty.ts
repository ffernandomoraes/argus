import type { Terminal } from '@xterm/xterm'
import type { TerminalOpenRequest } from '../../../../shared/terminal'
import { createPtySize } from './ptySize'

export type PtyRequest = Omit<TerminalOpenRequest, 'cols' | 'rows' | 'keepSize'>

// Liga o xterm ao processo do terminal (no processo principal) pela chave da sessão: abre (ou
// reconecta) o processo, escreve a saída, manda o que se digita e acompanha o tamanho. Devolve
// como desligar; o processo continua vivo.
export function connectPty(
  term: Terminal,
  req: PtyRequest,
  events: { onError: (error: string) => void; onExit: (code: number) => void }
): () => void {
  const api = window.api.terminal
  const { key } = req
  let disposed = false
  // Até a resposta do open, o que chega já está no buffer que ela devolve (o processo guarda a
  // saída para redesenhar a tela ao reconectar): escrever as duas coisas repetia o começo.
  let opened = false
  const offData = api.onData((k, data) => {
    if (k === key && opened) term.write(data)
  })
  const offExit = api.onExit((k, code) => {
    if (k === key) events.onExit(code)
  })
  const input = term.onData((data) => api.write(key, data))

  // Só a janela em uso muda o tamanho do processo (ver takeSize).
  const size = createPtySize((cols, rows) => api.resize(key, cols, rows))
  const focused = document.hasFocus()
  if (focused) size.mark(term.cols, term.rows)
  api
    .open({ ...req, cols: term.cols, rows: term.rows, keepSize: !focused })
    .then(
      (res) => {
        if (disposed) return
        opened = true
        if (!res.ok) events.onError(res.error)
        else if (res.buffer) term.write(res.buffer)
      },
      (err: unknown) => {
        // Sem resposta, a saída que chegar segue aparecendo, como antes.
        opened = true
        console.error('[terminal] falha ao abrir:', err)
      }
    )

  // Colunas e linhas mudaram (borda do bloco, fonte): manda depois que pararem de mudar.
  const resized = term.onResize(({ cols, rows }) => {
    if (document.hasFocus()) size.schedule(cols, rows)
  })

  // O mesmo terminal pode estar no canvas de duas janelas, mas o processo tem um tamanho só: fica
  // com o da janela em que se está digitando.
  const takeSize = () => size.now(term.cols, term.rows)
  term.textarea?.addEventListener('focus', takeSize)

  return () => {
    disposed = true
    size.dispose()
    term.textarea?.removeEventListener('focus', takeSize)
    resized.dispose()
    input.dispose()
    offData()
    offExit()
  }
}
