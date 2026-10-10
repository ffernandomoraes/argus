import type { DevServer } from '../shared/devServers'
import { inside, realRoot } from './paths'
import { IS_WIN } from './platform'
import { invalidateScan, marked, scanListening, terminate, type Listening } from './processScan'
import { productName } from './projectServers/packageJson'

// Servidores do painel: o que o Claude Code ou o play iniciou (as marcas no ambiente, ver
// processScan/marks.ts) e qualquer porta aberta dentro de uma pasta do canvas (`paths`), venha de
// onde vier, menos o Claude Code e o grupo dele.
// No Windows não dá para ler o ambiente nem a pasta de outro processo: a lista fica vazia, e a
// interface esconde o painel.
async function serversIn(listening: Listening[], paths: string[]): Promise<DevServer[]> {
  const roots = paths.map(realRoot)
  const servers: DevServer[] = []
  for (const p of listening) {
    if (!marked(p.env) && (p.claude || !roots.some((root) => inside(root, p.cwd)))) continue
    const appName = await productName(p.cwd)
    for (const port of p.ports) {
      servers.push({ port, pid: p.pid, pgid: p.pgid, cwd: p.cwd, appName, command: p.command, sessionId: p.sessionId, current: p.current, locked: p.locked })
    }
  }
  return servers.sort((a, b) => a.port - b.port)
}

export async function listDevServers(paths: string[] = []): Promise<DevServer[]> {
  if (IS_WIN) return []
  return serversIn(await scanListening(), paths)
}

// Encerra o grupo inteiro do servidor. Confere de novo na hora: só grupos que a lista mostra, e
// nunca um travado. O servidor deste Argus (o pnpm dev dele) a lista avisa que fecha o app; os
// outros processos do grupo do Argus, nunca (ver processScan/ownGroup.ts).
export async function killDevServer(pgid: number, paths: string[] = []): Promise<boolean> {
  if (IS_WIN) return false
  const target = (await serversIn(await scanListening({ fresh: true }), paths)).find((s) => s.pgid === pgid)
  if (!target || target.locked) return false
  const ok = await terminate(pgid, { own: target.current === true })
  invalidateScan()
  return ok
}
