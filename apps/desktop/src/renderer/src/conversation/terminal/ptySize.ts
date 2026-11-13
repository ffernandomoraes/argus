// Tamanho (colunas e linhas) do processo do terminal. Cada troca manda um SIGWINCH, e o `claude`
// redesenha a tela inteira: arrastando a borda do bloco, eram dezenas por segundo. `schedule`
// espera o tamanho parar de mudar (DELAY) e só manda se for diferente do último enviado; `now`
// manda na hora, mesmo igual (a outra janela pode ter trocado o tamanho do mesmo processo).
const PTY_RESIZE_DELAY = 100

export type PtySize = {
  schedule(cols: number, rows: number): void
  now(cols: number, rows: number): void
  // O processo já está com esse tamanho (o pedido de abrir levou junto).
  mark(cols: number, rows: number): void
  dispose(): void
}

export function createPtySize(send: (cols: number, rows: number) => void, delay = PTY_RESIZE_DELAY): PtySize {
  let sent: { cols: number; rows: number } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const cancel = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const now = (cols: number, rows: number) => {
    cancel()
    sent = { cols, rows }
    send(cols, rows)
  }
  return {
    schedule(cols, rows) {
      cancel()
      timer = setTimeout(() => {
        timer = null
        if (sent?.cols !== cols || sent.rows !== rows) now(cols, rows)
      }, delay)
    },
    now,
    mark(cols, rows) {
      sent = { cols, rows }
    },
    dispose: cancel
  }
}
