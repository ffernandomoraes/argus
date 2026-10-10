import { relative, sep } from 'node:path'
import type { ProjectServer } from '../../shared/devServers'
import { realRoot } from '../paths'
import type { Listening } from '../processScan'
import { errors, started } from './launch'
import { ofProject, rootsOf } from './matching'
import { packageName } from './packageJson'
import { servesPage } from './pageCheck'
import { projectScript } from './scripts'

// Iniciado daqui e ainda sem porta: "iniciando". Um `dev` que nunca abre porta (tsup --watch, um
// build vigiando) ficaria assim para sempre, com a tela perguntando a cada segundo; depois de um
// minuto, conta como rodando, sem porta.
const QUIET_START = 60_000

export async function statusOf(path: string, listening: Listening[]): Promise<ProjectServer> {
  const root = realRoot(path)
  const entry = started.get(root)
  const run = await projectScript(root)
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
