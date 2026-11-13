import { shell } from 'electron';
import type { RemoteLocalhostResult } from '@argus/shared/remote';
import { tr } from '../i18n';
import { remoteAccess } from '../remote';
import { remoteClientOf, remoteInfoFor } from '../remote/client';
import { tunnelClose, tunnelData, tunnelOpen } from '../remote/tunnelHost';
import { contentsOf, isRemotePage } from './page';
import { handle, on, onSync } from './register';

// Configurações > Acesso remoto: hospedar este computador, parear aparelhos e abrir outro Argus.
// Nenhum destes canais atende janela remota (ver remote/policy.ts), fora o "abrir localhost" (o
// túnel), que é justamente dela.
export function registerRemoteAccessIpc(): void {
  // A janela de acesso remoto pergunta, ao abrir e ao recarregar, o computador que ela mostra.
  onSync('remote:info', (e) => {
    const wc = contentsOf(e.sender);
    return wc ? remoteInfoFor(wc.id) : null;
  });
  handle('remoteAccess:state', () => remoteAccess().state());
  handle('remoteAccess:setHosting', (_e, on) => remoteAccess().setHosting(on));
  handle('remoteAccess:setKeepAwake', (_e, on) => remoteAccess().setKeepAwake(on));
  handle('remoteAccess:startPairing', () => remoteAccess().startPairing());
  handle('remoteAccess:pair', (_e, code) => remoteAccess().pair(code));
  handle('remoteAccess:open', (_e, hostId) => remoteAccess().open(hostId));
  on('remoteAccess:cancelPairing', () => remoteAccess().cancelPairing());
  on('remoteAccess:disconnect', (_e, id) => remoteAccess().disconnect(id));
  on('remoteAccess:removeDevice', (_e, id) => remoteAccess().removeDevice(id));
  on('remoteAccess:forgetHost', (_e, hostId) => remoteAccess().forgetHost(hostId));

  // No notebook: a janela remota pede para abrir um servidor do outro computador no navegador daqui.
  handle('remote:openLocalhost', async (e, port): Promise<RemoteLocalhostResult> => {
    const wc = contentsOf(e.sender);
    const client = wc && remoteClientOf(wc.id);
    if (!client || !Number.isInteger(port) || port <= 0 || port >= 65536)
      return { ok: false, error: tr('Só pela janela de acesso remoto.', 'Only from the remote access window.') };
    try {
      const local = await client.openLocalhost(wc.id, port);
      void shell.openExternal(`http://localhost:${local}`);
      return { ok: true, port: local };
    } catch (err) {
      return { ok: false, error: tr(`Não deu para abrir a porta neste computador: ${(err as Error).message}`, `Couldn’t open the port on this computer: ${(err as Error).message}`) };
    }
  });
  // No de casa: as conexões do túnel, só de uma janela remota (ver remote/tunnelHost.ts).
  on('tunnel:open', (e, id, port) => isRemotePage(e.sender) && tunnelOpen(e.sender, id, port));
  on('tunnel:data', (e, id, data) => isRemotePage(e.sender) && tunnelData(e.sender, id, data));
  on('tunnel:close', (e, id) => isRemotePage(e.sender) && tunnelClose(e.sender, id));
}
