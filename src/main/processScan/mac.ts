import { ancestorPids, claudeOwned } from './family'
import { parseFields, parsePs, parsePsTree, uniquePorts } from './macParse'
import { sessionIdIn } from './marks'
import { ownPgid } from './ownGroup'
import { LSOF, output, PS } from './run'
import type { Listening } from './types'

// Mac: as portas vêm do lsof; o comando, o grupo e o ambiente, do ps. Cinco consultas por volta,
// as quatro últimas juntas.
export async function scanMac(): Promise<Listening[]> {
  const ports = parseFields(await output(LSOF, ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpn']), 'n')
  if (ports.size === 0) return []
  const pids = [...ports.keys()].join(',')

  const [withEnv, plain, cwds, tree, own] = await Promise.all([
    // -E junta o ambiente ao fim do comando; é só para achar a marca e a sessão.
    output(PS, ['-E', '-ww', '-o', 'pid=,pgid=,command=', '-p', pids]).then(parsePs),
    output(PS, ['-ww', '-o', 'pid=,pgid=,command=', '-p', pids]).then(parsePs),
    output(LSOF, ['-a', '-d', 'cwd', '-p', pids, '-Fpn']).then((s) => parseFields(s, 'n')),
    // Todos os processos, para seguir a família de cada porta (Claude Code, o próprio Argus).
    output(PS, ['-ax', '-ww', '-o', 'pid=,ppid=,pgid=,args=']).then(parsePsTree),
    ownPgid()
  ])
  // No pnpm dev, o servidor deste app é um dos processos acima dele.
  const above = ancestorPids(tree, process.pid)

  const found: Listening[] = []
  for (const [pid, addresses] of ports) {
    const info = plain.get(pid)
    const env = withEnv.get(pid)?.rest
    if (!info || env === undefined) continue
    const current = above.has(pid)
    // No grupo do Argus, fora os processos acima dele, só há o que as conversas do SDK abriram
    // (servidores MCP): conta como do Claude Code mesmo quando a linha de comando não diz.
    const claude = claudeOwned(tree, pid) || (!!own && info.pgid === own && !current)
    found.push({
      pid,
      pgid: info.pgid,
      ports: uniquePorts(addresses),
      cwd: cwds.get(pid)?.[0] ?? '',
      command: info.rest,
      sessionId: sessionIdIn(env),
      current: current || undefined,
      locked: claude ? 'claude' : undefined,
      claude,
      env
    })
  }
  return found
}
