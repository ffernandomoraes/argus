// A promessa, ou `fallback` se ela não terminar em `ms`: ela segue rodando, só deixa de ser
// esperada. Uma pasta do WSL com a máquina virtual parada ou travada pode levar minutos para
// responder, e quem espera (a lista de conversas, o status delas) precisa de uma resposta antes.
export function withTimeout<T, F>(promise: Promise<T>, ms: number, fallback: F): Promise<T | F> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<F>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms)
  })
  return Promise.race([promise, late]).finally(() => clearTimeout(timer))
}
