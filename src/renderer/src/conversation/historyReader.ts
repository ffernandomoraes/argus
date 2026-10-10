// Quem decide quando reler o histórico de uma conversa. Os avisos chegam mais rápido que a leitura
// (cada passo do Claude sobe a revisão do chat e, logo depois, a hora do arquivo na lista da pasta):
// cancelar a leitura anterior a cada aviso jogava fora todos os resultados. Aqui fica no máximo uma
// leitura de cada vez; o que mudar no meio dela vira uma releitura só, quando ela termina.

// Folga entre a hora do arquivo e a do início da leitura (relógios com precisões diferentes).
const SLACK_MS = 50

export type HistoryReader = {
  // revision: sobe quando o chat grava na sessão; relê sempre que muda.
  // updatedAt: hora do arquivo (ms); relê só se a gravação pode ter ficado de fora da última leitura.
  sync(revision: number, updatedAt: number): void
  dispose(): void
}

export function createHistoryReader<T>(
  read: () => Promise<T>,
  onResult: (value: T) => void,
  now: () => number = Date.now
): HistoryReader {
  let running = false
  let again = false
  let disposed = false
  // Início da leitura mais recente: o arquivo gravado antes disso já está nela.
  let startedAt = -Infinity
  let revision: number | undefined
  let updatedAt = -Infinity

  const start = (): void => {
    running = true
    again = false
    startedAt = now()
    // Leitura que falhou não apaga o que já está na tela.
    read()
      .then((value) => {
        if (!disposed) onResult(value)
      })
      .catch(() => {})
      .finally(() => {
        running = false
        if (again && !disposed) start()
      })
  }
  const request = (): void => {
    if (disposed) return
    if (running) again = true
    else start()
  }

  return {
    sync(nextRevision, nextUpdatedAt) {
      const changedRevision = nextRevision !== revision
      const newerFile = nextUpdatedAt > updatedAt
      revision = nextRevision
      updatedAt = Math.max(updatedAt, nextUpdatedAt)
      if (changedRevision || (newerFile && nextUpdatedAt >= startedAt - SLACK_MS)) request()
    },
    dispose() {
      disposed = true
    }
  }
}
