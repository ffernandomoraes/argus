import { useEffect, useState } from 'react';
import type { AccountDevice } from '@argus/shared/account';
import { relativeTime } from '../../canvas/relativeTime';
import { tr } from '../../i18n';
import { Button } from '../../ui/Button';
import { Group, Row } from '../controls';

// Os aparelhos com a conta aberta. Remover um faz ele sair da conta na próxima vez que falar com o
// servidor, e o acesso remoto que ele abriu pela conta acaba na hora (ver
// main/remote/accountDevices.ts); este computador sai pelo "Sair" lá em cima.

const PLATFORMS: Record<string, string> = { darwin: 'Mac', win32: 'Windows', linux: 'Linux' };
// web: o app do celular, com a conta aberta nele.
const phone = () => tr('Celular', 'Phone');

export const platformName = (platform: string): string => (platform === 'web' ? phone() : (PLATFORMS[platform] ?? tr('Outro sistema', 'Other system')));

function detail(d: AccountDevice): string {
  const system = platformName(d.platform);
  if (d.current) return `${system} - ${tr('este computador', 'this computer')}`;
  const when = relativeTime(new Date(d.lastSeenAt).toISOString());
  return `${system} - ${tr(`usado ${when}`, `used ${when}`)}`;
}

export function ProfileDevices() {
  const [devices, setDevices] = useState<AccountDevice[] | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void window.api.account.devices().then((list) => alive && setDevices(list));
    return () => {
      alive = false;
    };
  }, []);

  const remove = async (id: string) => {
    if (await window.api.account.removeDevice(id)) setDevices((list) => list?.filter((d) => d.id !== id));
  };

  if (devices === undefined) return null;
  if (devices === null) {
    return (
      <Group>
        <p className="py-3 text-[15px] text-muted">{tr('Não deu para carregar os aparelhos agora.', "Couldn't load the devices right now.")}</p>
      </Group>
    );
  }
  return (
    <Group>
      {devices.map((d) => (
        <Row
          key={d.id}
          label={d.name}
          description={detail(d)}
          info={
            d.current
              ? undefined
              : tr(
                  'Remover tira o aparelho da conta e corta o acesso remoto que ele abriu por ela.',
                  'Removing takes the device out of the account and cuts the remote access it opened through it.',
                )
          }
        >
          {!d.current && <Button onClick={() => void remove(d.id)}>{tr('Remover', 'Remove')}</Button>}
        </Row>
      ))}
    </Group>
  );
}
