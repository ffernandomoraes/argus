import type { ProjectServer } from '../../shared/devServers'
import { realRoot } from '../paths'
import { invalidateScan, scanListening, terminate } from '../processScan'
import { errors, launch, launchWsl, started } from './launch'
import { isWslPath } from '../wsl'
import { ofProject, rootsOf } from './matching'
import { keepPages, pageKey } from './pageCheck'
import { freePort } from './freePort'
import { projectScript } from './scripts'
import { statusOf, wslPorts } from './status'

// Servidor de cada pasta do canvas, para o botão de iniciar e encerrar acima dela.
export { stopStartedServers } from './launch'

// Uma varredura de portas só, para todas as pastas na tela.
export async function projectServers(paths: string[]): Promise<Record<string, ProjectServer>> {
  const listening = await scanListening()
  // Os do WSL não aparecem na varredura do Windows: sem eles aqui, a conferência da página era
  // apagada a cada consulta, antes de responder, e o modo design ficava carregando para sempre.
  const wsl = [...started.values()].flatMap((e) => wslPorts(e).map((port) => pageKey(e.child.pid ?? 0, port)))
  keepPages([...listening.flatMap((p) => p.ports.map((port) => pageKey(p.pid, port))), ...wsl])
  const entries = await Promise.all(paths.map(async (path) => [path, await statusOf(path, listening)] as const))
  return Object.fromEntries(entries)
}

// Pastas entre o clique e o processo aberto: um segundo "Iniciar" no meio (a leitura do
// package.json leva um instante) não sobe outro servidor.
const reserving = new Set<string>()

// noBrowser: sem abrir o navegador sozinho (ver launch.ts).
export async function startProjectServer(path: string, noBrowser = false): Promise<boolean> {
  const root = realRoot(path)
  if (started.has(root) || reserving.has(root)) return false
  reserving.add(root)
  try {
    const run = await projectScript(root)
    if (!run) return false
    if (isWslPath(root)) await launchWsl(root, run, noBrowser)
    else launch(root, await freePort(root, run), noBrowser)
    invalidateScan()
    return true
  } finally {
    reserving.delete(root)
  }
}

// Encerra tudo da pasta com porta aberta, venha de onde vier, e o que foi iniciado daqui e
// ainda não abriu porta. O que uma sessão do Claude Code abriu no grupo dela fica de fora, e o
// servidor que abriu este Argus (o pnpm dev dele) também.
export async function stopProjectServer(path: string): Promise<boolean> {
  const root = realRoot(path)
  const entry = started.get(root)
  if (entry) entry.stopping = true
  errors.delete(root)
  // WSL: o Windows não enxerga os processos de lá; para o que foi iniciado daqui.
  if (isWslPath(root)) {
    if (!entry?.wsl) return false
    await entry.wsl.stop()
    return true
  }
  const mine = ofProject(rootsOf(path), entry?.child.pid, await scanListening({ fresh: true }))
  const groups = new Set(mine.filter((p) => !p.locked && !p.current).map((p) => p.pgid))
  if (entry?.child.pid) groups.add(entry.child.pid)
  if (groups.size === 0) return false
  await Promise.all([...groups].map((pgid) => terminate(pgid)))
  invalidateScan()
  return true
}
