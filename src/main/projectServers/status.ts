import { relative, sep } from 'node:path'
import type { ProjectServer } from '../../shared/devServers'
import { realRoot } from '../paths'
import type { Listening } from '../processScan'
import { errors, started } from './launch'
import { ofProject, rootsOf } from './matching'
import { packageName } from './packageJson'
import { servesPage } from './pageCheck'
import { projectScript, type ProjectScript } from './scripts'
import { isWslPath } from '../wsl'
import { portsInOutput } from '../wsl/servers'
import type { Started } from './launch'

// Iniciado daqui e ainda sem porta: "iniciando". Um `dev` que nunca abre porta (tsup --watch, um
// build vigiando) ficaria assim para sempre, com a tela perguntando a cada segundo; depois de um
// minuto, conta como rodando, sem porta.
const QUIET_START = 60_000

export async function statusOf(path: string, listening: Listening[]): Promise<ProjectServer> {
  const root = realRoot(path)
  const entry = started.get(root)
  const run = await projectScript(root)
  if (isWslPath(root)) return wslStatus(root, entry, run)
  const mine = ofProject(rootsOf(path), entry?.child.pid, listening)
  const apps = mine
    .flatMap((p) => p.ports.map((port) => ({ port, pid: p.pid, cwd: p.cwd, dir: p.cwd ? relative(root, p.cwd).split(sep).join('/') : '' })))
    .filter((a, i, all) => all.findIndex((b) => b.port === a.port) === i)
    .sort((a, b) => a.port - b.port)
  const base = {
    script: run?.script ?? null,
    command: run?.command ?? null,
    ports: apps.map((a) => a.port),
    apps: await Promise.all(apps.map(async ({ cwd, pid, ...a }) => ({ ...a, name: await packageName(cwd), page: servesPage(pid, a.port) })))
  }
  if (mine.length > 0) {
    return { ...base, state: 'running', locked: mine.every((p) => p.locked) ? mine[0].locked : undefined }
  }
  if (entry) return { ...base, state: Date.now() - entry.startedAt < QUIET_START ? 'starting' : 'running' }
  return { ...base, state: 'stopped', error: errors.get(root) }
}

// WSL: o Windows não mostra quem abriu cada porta lá dentro. Vale o que foi iniciado daqui, com as
// portas que o servidor anunciou na saída.
async function wslStatus(root: string, entry: Started | undefined, run: ProjectScript | null): Promise<ProjectServer> {
  const ports = entry ? portsInOutput(entry.output.text()) : []
  const pid = entry?.child.pid ?? 0
  const name = await packageName(root)
  const base = {
    script: run?.script ?? null,
    command: run?.command ?? null,
    ports,
    apps: ports.map((port) => ({ port, dir: '', name, page: servesPage(pid, port) }))
  }
  if (!entry) return { ...base, state: 'stopped', error: errors.get(root) }
  if (ports.length) return { ...base, state: 'running' }
  return { ...base, state: Date.now() - entry.startedAt < QUIET_START ? 'starting' : 'running' }
}
