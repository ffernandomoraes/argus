// Marcas no ambiente de um processo. Todo comando que o Claude Code roda herda CLAUDECODE=1; o que
// o play em cima da pasta iniciou leva a marca do app (ver projectServers/launch.ts). Seguir a
// árvore de processos não serve: rodando em segundo plano, o servidor perde o pai e é adotado
// pelo sistema.
export const APP_MARK = 'ARGUS_SERVER'

const CLAUDE = /(^|\s)CLAUDECODE=1(\s|$)/
const APP = new RegExp(`(^|\\s)${APP_MARK}=1(\\s|$)`)

export const marked = (env: string): boolean => CLAUDE.test(env) || APP.test(env)

// Conversa do Claude Code que rodou o comando, quando o ambiente diz.
export const sessionIdIn = (env: string): string | undefined => env.match(/(?:^|\s)CLAUDE_CODE_SESSION_ID=([\w-]+)/)?.[1]
