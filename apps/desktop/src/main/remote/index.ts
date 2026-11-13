import { homedir, hostname, release } from 'node:os'
import { app, BrowserWindow } from 'electron'
import { REMOTE_ARG, type RemoteHostInfo } from '@argus/shared/remote'
import { createRemoteWindow } from '../app/windows'
import { broadcastLocal } from '../ipc/events'
import { IS_WIN } from '../platform'
import { RemoteAccess } from './access'
import { RemoteClient } from './client'
import { RemoteHost } from './host'
import { memoryLinks } from './link'

// Acesso remoto: este Argus pode hospedar (o "de casa", que guarda projetos, conversas e
// terminais) e pode mostrar o de outro computador numa janela (o notebook). As peças:
// - protocol.ts: as mensagens; link.ts: a ligação que leva os bytes;
// - host.ts: o lado de casa; client.ts: o lado do notebook;
// - policy.ts: o que cada canal faz numa janela remota;
// - ipc/page.ts e remotePage.ts: a janela de lá vista daqui como uma página.

export function hostName(): string {
  return hostname().replace(/\.local$/i, '')
}

// Windows: o build é o terceiro número de "10.0.22631" (o mesmo que o preload lê).
function windowsBuild(): number | null {
  if (!IS_WIN) return null
  const build = Number(release().split('.')[2])
  return Number.isInteger(build) && build > 0 ? build : null
}

export function hostInfo(): RemoteHostInfo {
  return { name: hostName(), platform: process.platform, homeDir: homedir(), windowsBuild: windowsBuild(), version: app.getVersion() }
}

function encodeRemoteArg(info: RemoteHostInfo): string {
  return REMOTE_ARG + Buffer.from(JSON.stringify(info), 'utf8').toString('base64')
}

let loopbackHost: RemoteHost | null = null

function remoteHost(): RemoteHost {
  loopbackHost ??= new RemoteHost(hostInfo)
  return loopbackHost
}

// Abre uma janela remota ligada a este próprio Argus por uma ligação na memória: o caminho inteiro
// (página remota, política dos canais, cópia do V8, avisos) sem a rede. Só no pnpm dev, com
// ARGUS_REMOTE_LOOPBACK=1.
export async function openLoopbackWindow(): Promise<void> {
  const [hostSide, clientSide] = memoryLinks()
  remoteHost().accept(hostSide)
  const client = new RemoteClient(clientSide, app.getVersion(), hostName())
  const info = await client.connect()
  client.attach(createRemoteWindow(encodeRemoteArg({ ...info, name: `${info.name} (teste)`, clientVersion: app.getVersion() })))
}

let access: RemoteAccess | null = null

// O serviço do acesso remoto (Configurações > Acesso remoto), um por app.
export function remoteAccess(): RemoteAccess {
  access ??= new RemoteAccess({
    hostName,
    hostInfo,
    openWindow: async (client) => {
      if (!client.info) return
      client.attach(createRemoteWindow(encodeRemoteArg({ ...client.info, clientVersion: app.getVersion() })))
    },
    focus: (client) => {
      const wc = client.firstWindow()
      const win = wc && BrowserWindow.fromWebContents(wc)
      if (!win) return
      if (win.isMinimized()) win.restore()
      win.focus()
    },
    onChange: (state) => broadcastLocal('remoteAccess:state', state)
  })
  return access
}
