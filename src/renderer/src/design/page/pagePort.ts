// Porta da página aberta no quadro do protótipo. Escolhida uma vez, só muda por um motivo de
// verdade: um status passageiro do servidor (sem portas por uma consulta) ou uma porta nova ainda
// sendo conferida não podem desmontar a página e abri-la de novo noutra porta.

// `missFrom`: número da consulta em que a porta sumiu da lista (nulo enquanto ela está lá).
export type PagePort = { port: number | null; missFrom: number | null }

export const NO_PAGE_PORT: PagePort = { port: null, missFrom: null }

export type PortInput = {
  // App escolhido na tela (guardado no design: monorepo com vários apps); nulo = o primeiro com página.
  choice: number | null
  // Portas abertas agora pelo servidor do projeto.
  ports: readonly number[]
  // A porta que abriria se ainda não houvesse página.
  candidate: number | null
  // Ainda conferindo quais portas mostram página.
  checking: boolean
  // Consultas ao servidor já feitas.
  poll: number
}

// Devolve `prev` (o mesmo objeto) quando nada muda.
export function nextPagePort(prev: PagePort, now: PortInput): PagePort {
  const listed = (port: number | null) => port !== null && now.ports.includes(port)
  if (prev.port !== null) {
    // O app escolhido (no design, ou trocado na barra de endereço) está no ar: é ele que aparece.
    if (now.choice !== null && now.choice !== prev.port && listed(now.choice)) return { port: now.choice, missFrom: null }
    // Continua listada: fica, mesmo com outra porta sendo conferida ou outro app na frente.
    if (listed(prev.port)) return prev.missFrom === null ? prev : { port: prev.port, missFrom: null }
    // Sumiu numa consulta: espera a seguinte confirmar antes de desmontar a página.
    if (prev.missFrom === null) return { port: prev.port, missFrom: now.poll }
    if (now.poll <= prev.missFrom) return prev
  }
  // Sem página (ou a porta sumiu em duas consultas seguidas): só abre depois de saber quais portas
  // mostram página; senão a primeira (às vezes a API) apareceria antes do app certo.
  const port = now.checking ? null : now.candidate
  return port === prev.port && prev.missFrom === null ? prev : { port, missFrom: null }
}
