// No máximo `max` tarefas rodando ao mesmo tempo; as outras esperam a vez, na ordem em que
// chegaram. A vaga de quem termina passa direto para a primeira da fila: devolver a vaga e deixar
// a da fila pegar de novo abriria espaço para uma chegada no meio passar na frente e estourar o
// limite.
export function limiter(max: number): <T>(task: () => Promise<T>) => Promise<T> {
  let active = 0
  const waiting: (() => void)[] = []
  const release = () => {
    const next = waiting.shift()
    if (next) next()
    else active--
  }
  return async (task) => {
    if (active < max) active++
    else await new Promise<void>((resolve) => waiting.push(resolve))
    try {
      return await task()
    } finally {
      release()
    }
  }
}
