import { IS_WIN } from '../platform'
import { ancestors, processTable } from '../winProcesses'
import { output, PS } from './run'

// O grupo de processos do próprio Argus. As conversas do SDK rodam nele (e os servidores MCP
// delas também): mandar sinal para ele fecharia o app. A regra fica só aqui.

let pgidOfApp: Promise<number> | null = null

// Mac: o grupo do Argus não muda enquanto ele roda; lido uma vez. Sem resposta do ps, tenta de
// novo na próxima pergunta.
export async function ownPgid(): Promise<number> {
  pgidOfApp ??= output(PS, ['-o', 'pgid=', '-p', String(process.pid)]).then((s) => Number(s.trim()) || 0)
  const pgid = await pgidOfApp
  if (!pgid) pgidOfApp = null
  return pgid
}

// Mac: o grupo do Argus. Windows (sem grupos): o Argus e os processos acima dele, porque encerrar
// um deles com tudo que abriu (taskkill /T) leva o Argus junto.
export async function isOwnGroup(pgid: number): Promise<boolean> {
  if (pgid === process.pid) return true
  if (!IS_WIN) return pgid === (await ownPgid())
  const table = await processTable(5 * 60_000, [process.pid])
  return ancestors(table, process.pid).some((p) => p.pid === pgid)
}
