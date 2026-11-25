import type { RemoteHostInfo } from '@argus/shared/remote';
import { tr } from '../i18n';
import type { Link } from './link';
import { markPhoneChat } from './phoneChats';
import { sendPush, type PushKeys } from './push';
import { relayWebUrl } from './relay';
import type { PairedDevice } from './store';
import { WebHostSession } from './webHost';

// O app do celular conectado ao computador de casa: mensagens em JSON e só a lista curta de canais
// (ver webHost.ts), com as notificações do navegador (inscrever, testar) gravadas no aparelho.

type Context = { info: () => RemoteHostInfo; pushKeys: () => PushKeys; save: () => void };

export function acceptWebDevice(link: Link, device: PairedDevice, ctx: Context): WebHostSession {
  return new WebHostSession(link, {
    info: () => ({ ...ctx.info(), pushKey: ctx.pushKeys().publicKey }),
    push: (sub) => {
      if (sub) device.push = sub;
      else delete device.push;
      ctx.save();
    },
    pushTest: async () => {
      const sub = device.push;
      if (!sub) return 'none';
      const result = await sendPush(
        sub,
        { title: 'Argus', body: tr('Notificação de teste: está funcionando.', 'Test notification: it works.'), url: '#/settings', tag: 'argus-test' },
        ctx.pushKeys(),
        relayWebUrl(),
      );
      if (result === 'gone' && device.push === sub) {
        delete device.push;
        ctx.save();
      }
      return result;
    },
    interacted: (keys) => markPhoneChat(device.id, keys),
    onEnd: () => {},
  });
}
