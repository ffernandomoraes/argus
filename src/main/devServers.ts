import type { DevServer } from '../shared/devServers'
import { inside, realRoot } from './paths'
import { IS_WIN } from './platform'
import { invalidateScan, marked, scanListening, terminate, type Listening } from './processScan'
import { started } from './projectServers/launch'
import { ofProject, rootsOf } from './projectServers/matching'
import { productName } from './projectServers/packageJson'

type Found = { p: Listening; cwd: string }

// Servidores do painel: o que o Claude Code ou o play iniciou (as marcas no ambiente, ver
// processScan/marks.ts) e qualquer porta aberta dentro de uma pasta do canvas (`paths`), venha de
// onde vier, menos o Claude Code e o grupo dele.
function found(listening: Listening[], paths: string[]): Found[] {
  if (IS_WIN) return foundWindows(listening, paths)
  const roots = paths.map(realRoot)
  return listening
    .filter((p) => marked(p.env) || (!p.claude && roots.some((root) => inside(root, p.cwd))))
    .map((p) => ({ p, cwd: p.cwd }))
}

// Windows: sem o ambiente e a pasta de outro processo, vale a mesma regra do botão de cada pasta
// (ver projectServers/matching.ts): o que o play abriu, ou um programa de servidor que cita a pasta
// na linha de comando. A pasta mostrada é a do canvas que bateu, a mais funda primeiro (uma pasta
// dentro de outra no canvas). O que o Claude Code subiu fora das pastas do canvas não aparece.
function foundWindows(listening: Listening[], paths: string[]): Found[] {
  const all = [...new Set([...paths, ...started.keys()])].sort((a, b) => b.length - a.length)
  const seen = new Set<number>()
  const out: Found[] = []
  for (const path of all) {
    const roots = rootsOf(path)
    for (const p of ofProject(roots, started.get(realRoot(path))?.child.pid, listening)) {
      if (seen.has(p.pid)) continue
      seen.add(p.pid)
      out.push({ p, cwd: roots[roots.length - 1] })
    }
  }
  return out
}

async function serversIn(listening: Listening[], paths: string[]): Promise<DevServer[]> {
  const servers: DevServer[] = []
  for (const { p, cwd } of found(listening, paths)) {
    const appName = await productName(cwd)
    for (const port of p.ports) {
      servers.push({ port, pid: p.pid, pgid: p.pgid, cwd, appName, command: p.command, sessionId: p.sessionId, current: p.current, locked: p.locked })
    }
  }
  return servers.sort((a, b) => a.port - b.port)
}

export async function listDevServers(paths: string[] = []): Promise<DevServer[]> {
  return serversIn(await scanListening(), paths)
}

// Encerra o grupo inteiro do servidor (no Windows, o processo e o que ele abriu). Confere de novo
// na hora: só grupos que a lista mostra, e nunca um travado. O servidor deste Argus (o pnpm dev
// dele) a lista avisa que fecha o app; os outros processos do grupo do Argus, nunca (ver
// processScan/ownGroup.ts).
export async function killDevServer(pgid: number, paths: string[] = []): Promise<boolean> {
  const target = (await serversIn(await scanListening({ fresh: true }), paths)).find((s) => s.pgid === pgid)
  if (!target || target.locked) return false
  const ok = await terminate(pgid, { own: target.current === true })
  invalidateScan()
  return ok
}
