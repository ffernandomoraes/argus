import { encodeWeb } from '@argus/shared/webRemote';
import { tr } from '../i18n';
import type { Link } from './link';
import type { PairedDevice } from './store';

// Ligação de um aparelho pareado pela conta recusada na conferência (ver accountDevices.ts). Se o
// pareamento ficou (`stillPaired`: a conta não está aberta neste computador), o app do celular recebe
// o motivo: só fechar faria ele tentar de novo para sempre ("Conectando…" sem fim). Pareamento
// removido: ele recebe "não reconhece mais este aparelho" na próxima tentativa.
export function refuseLink(link: Link, device: PairedDevice, stillPaired: boolean, hostName: string): void {
  if (device.kind === 'web' && stillPaired) {
    const reason = tr(
      `O Argus de ${hostName} está sem a conta do Argus aberta, e quem pareou pela conta só entra com ela aberta. Entre na conta lá (Configurações > Perfil) e tente de novo.`,
      `The Argus on ${hostName} isn't signed in to the Argus account, and devices paired through the account only connect while it is. Sign in there (Settings > Profile) and try again.`,
    );
    try {
      link.send(Buffer.from(encodeWeb({ t: 'reject', reason })));
    } catch {
      // A ligação já caiu: o celular tenta de novo e recebe o motivo na próxima.
    }
  }
  link.close();
}
