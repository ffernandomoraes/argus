import { Notification } from 'electron';
import { loadAppSettings } from '../appSettings';
import { tr } from '../i18n';

// O aviso do sistema quando um aparelho entra no acesso remoto deste computador.

// A primeira entrada de um aparelho novo é aviso de segurança: aparece mesmo com as notificações
// desligadas (essa preferência vem da conta do Argus, e um aparelho novo pode parear pela conta sem
// ninguém na frente deste computador). As outras entradas seguem a preferência.
export function notifyConnected(name: string, firstTime: boolean): void {
  if (!Notification.isSupported() || (!firstTime && !loadAppSettings().notifications)) return;
  new Notification(
    firstTime
      ? {
          title: tr(`Aparelho novo no acesso remoto: ${name}`, `New device on remote access: ${name}`),
          body: tr(
            'Ele já pode usar este computador. Se não foi você, remova em Configurações > Acesso remoto.',
            'It can now use this computer. If it wasn’t you, remove it in Settings > Remote access.',
          ),
        }
      : {
          title: tr(`${name} entrou no Argus`, `${name} connected to Argus`),
          body: tr('Acesso remoto: este computador está sendo usado de outro.', 'Remote access: this computer is being used from another one.'),
        },
  ).show();
}
