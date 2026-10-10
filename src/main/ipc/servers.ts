import { killDevServer, listDevServers } from '../devServers'
import { projectServers, startProjectServer, stopProjectServer } from '../projectServers'
import { handle } from './register'

// Servidores locais: os que estão rodando nas pastas do canvas e o servidor de cada projeto.
export function registerServersIpc(): void {
  handle('devServers:list', (_e, paths) => listDevServers(paths))
  handle('devServers:kill', (_e, pgid, paths) => killDevServer(pgid, paths))
  handle('projectServers:status', (_e, paths) => projectServers(paths))
  handle('projectServers:start', (_e, path, noBrowser) => startProjectServer(path, !!noBrowser))
  handle('projectServers:stop', (_e, path) => stopProjectServer(path))
}
