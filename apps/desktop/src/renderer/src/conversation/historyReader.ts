// Quem decide quando reler o histórico de uma conversa. Os avisos chegam mais rápido que a leitura
// (cada passo do Claude sobe a revisão do chat e, logo depois, a hora do arquivo na lista da pasta):
// cancelar a leitura anterior a cada aviso jogava fora todos os resultados. Aqui fica no máximo uma
// leitura de cada vez; o que mudar no meio dela vira uma releitura só, quando ela termina.
//
// Hora do arquivo mais nova sempre relê. Antes ela era comparada com o relógio do app para pular a
// gravação que a leitura anterior já tinha pego, mas no WSL a hora vem do relógio do Linux, que
// costuma andar atrasado em relação ao do Windows: a última gravação do pedido parecia antiga, era
// pulada, e o fim da resposta só aparecia reabrindo a conversa. Reler o que já foi lido custa pouco
// (o processo principal lê só o que o arquivo ganhou).

export type HistoryReader = {
  // revision: sobe quando o chat grava na sessão; relê sempre que muda.
  // updatedAt: hora do arquivo (ms); relê sempre que fica mais nova.
  sync(revision: number, updatedAt: number): void
  // Relê agora, sem aviso de mudança (a tela pediu mais mensagens).
  now(): void
  dispose(): void
}

export function createHistoryReader<T>(read: () => Promise<T>, onResult: (value: T) => void): HistoryReader {
  let running = false
  let again = false
  let disposed = false
  let revision: number | undefined
  let updatedAt = -Infinity

  const start = (): void => {
    running = true
    again = false
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
      const changed = nextRevision !== revision || nextUpdatedAt > updatedAt
      revision = nextRevision
      updatedAt = Math.max(updatedAt, nextUpdatedAt)
      if (changed) request()
    },
    now: request,
    dispose() {
      disposed = true
    }
  }
}
