import { remoteAccess } from '../remote'
import { remoteInfoFor } from '../remote/client'
import { contentsOf } from './page'
import { handle, on, onSync } from './register'

// Configurações > Acesso remoto: hospedar este computador, parear aparelhos e abrir outro Argus.
// Nenhum destes canais atende janela remota (ver remote/policy.ts).
export function registerRemoteAccessIpc(): void {
  // A janela de acesso remoto pergunta, ao abrir e ao recarregar, o computador que ela mostra.
  onSync('remote:info', (e) => {
    const wc = contentsOf(e.sender)
    return wc ? remoteInfoFor(wc.id) : null
  })
  handle('remoteAccess:state', () => remoteAccess().state())
  handle('remoteAccess:setHosting', (_e, on) => remoteAccess().setHosting(on))
  handle('remoteAccess:setKeepAwake', (_e, on) => remoteAccess().setKeepAwake(on))
  handle('remoteAccess:startPairing', () => remoteAccess().startPairing())
  handle('remoteAccess:pair', (_e, code) => remoteAccess().pair(code))
  handle('remoteAccess:open', (_e, hostId) => remoteAccess().open(hostId))
  on('remoteAccess:cancelPairing', () => remoteAccess().cancelPairing())
  on('remoteAccess:disconnect', (_e, id) => remoteAccess().disconnect(id))
  on('remoteAccess:removeDevice', (_e, id) => remoteAccess().removeDevice(id))
  on('remoteAccess:forgetHost', (_e, hostId) => remoteAccess().forgetHost(hostId))
}
