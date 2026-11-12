import { remoteAccess } from '../remote'
import { handle, on } from './register'

// Configurações > Acesso remoto: hospedar este computador, parear aparelhos e abrir outro Argus.
// Nenhum destes canais atende janela remota (ver remote/policy.ts).
export function registerRemoteAccessIpc(): void {
  handle('remoteAccess:state', () => remoteAccess().state())
  handle('remoteAccess:setHosting', (_e, on) => remoteAccess().setHosting(on))
  handle('remoteAccess:startPairing', () => remoteAccess().startPairing())
  handle('remoteAccess:pair', (_e, code) => remoteAccess().pair(code))
  handle('remoteAccess:open', (_e, hostId) => remoteAccess().open(hostId))
  on('remoteAccess:cancelPairing', () => remoteAccess().cancelPairing())
  on('remoteAccess:removeDevice', (_e, id) => remoteAccess().removeDevice(id))
  on('remoteAccess:forgetHost', (_e, hostId) => remoteAccess().forgetHost(hostId))
}
