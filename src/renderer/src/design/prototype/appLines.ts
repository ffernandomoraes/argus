// Linhas que o Claude escreve para o app no texto da resposta: ROTA (o endereço da tela) e TELA
// (o nome dela); vale a última de cada. Ele escreve em Markdown: a linha ROTA pode vir entre
// crases, em negrito, como item de lista ou com o endereço completo do servidor local, e a
// pontuação do fim fica de fora ("ROTA: /produtos." é /produtos).
const ROTA = /^\s*(?:[-*]\s+)?\**ROTA:?\**:?\s*`?(?:https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?)?(\/[^\s`*]*?)[`*.,;]*\s*$/i
// TELA com o mesmo enfeite (item de lista, negrito); o nome sai sem os asteriscos e crases das pontas.
const TELA = /^\s*(?:[-*]\s+)?\**TELA(?::\**|\**:)\s*(.+?)\s*$/
// Linha que começa com ROTA: ou TELA: é recado para o app, mesmo sem um endereço que sirva.
const APP_LINE = /^\s*(?:[-*]\s+)?\**(?:ROTA|TELA)(?::|\**:)/

const lines = (text: string) => text.split('\n')
const routeOf = (line: string) => ROTA.exec(line)?.[1]
const nameOf = (line: string) => TELA.exec(line)?.[1].replace(/^[`*\s]+|[`*\s]+$/g, '') || undefined

export const routeIn = (text: string): string | undefined => lines(text).map(routeOf).filter(Boolean).at(-1)

// Todas as rotas que o Claude já informou na conversa, sem repetir.
export const routesIn = (text: string): string[] => [...new Set(lines(text).map(routeOf).filter((r): r is string => !!r))]

// A resposta como a pessoa lê: sem as linhas ROTA e TELA, que são recado para o app.
export const withoutAppLines = (text: string): string =>
  lines(text)
    .filter((l) => !APP_LINE.test(l) && !ROTA.test(l))
    .join('\n')
    .trimEnd()

export const nameIn = (text: string): string | undefined => lines(text).map(nameOf).filter(Boolean).at(-1)?.slice(0, 60)
