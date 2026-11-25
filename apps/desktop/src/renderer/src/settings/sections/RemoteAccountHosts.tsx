import { useEffect, useState } from 'react';
import type { AccountRemoteHost, RemoteAccessState } from '@argus/shared/remote';
import { tr } from '../../i18n';
import { Button } from '../../ui/Button';
import { Group, Row } from '../controls';
import { platformName } from './ProfileDevices';

// Acesso remoto > Conexão a outros computadores: os computadores da mesma conta do Argus com o
// acesso ligado, para abrir sem código (ver main/remote/accountRemote.ts). Os já pareados ficam na
// lista de baixo, como antes.
export function RemoteAccountHosts({ state }: { state: RemoteAccessState }) {
  const [hosts, setHosts] = useState<AccountRemoteHost[] | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signedIn = state.account !== 'signedOut';

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    void window.api.remoteAccess.accountHosts().then((list) => alive && setHosts(list));
    return () => {
      alive = false;
    };
  }, [signedIn]);

  const open = async (hostId: string) => {
    setBusy(hostId);
    setError(null);
    setError(await window.api.remoteAccess.openAccountHost(hostId));
    setBusy(null);
  };

  if (!signedIn) {
    return (
      <Group>
        <Row
          label={tr('Seus computadores', 'Your computers')}
          description={tr(
            'Entre na conta do Argus (Configurações - Perfil) nos dois computadores para abrir um do outro sem código.',
            'Sign in to your Argus account (Settings - Profile) on both computers to open one from the other without a code.',
          )}
        >
          {null}
        </Row>
      </Group>
    );
  }
  if (hosts === undefined) return null;
  const known = new Set(state.hosts.map((h) => h.hostId));
  const fresh = (hosts ?? []).filter((h) => !known.has(h.hostId));
  return (
    <Group>
      {hosts === null && (
        <p className="border-b border-dashed border-line py-5 text-[15px] text-muted">
          {tr('Não deu para buscar seus computadores na conta agora.', "Couldn't fetch your computers from the account right now.")}
        </p>
      )}
      {hosts !== null && !fresh.length && (
        <p className="border-b border-dashed border-line py-5 text-[15px] leading-relaxed text-muted">
          {tr(
            'Nenhum outro computador da sua conta com o acesso ligado. No outro computador: entre na mesma conta e ligue "Permitir acesso de outros computadores".',
            'No other computer in your account has access turned on. On the other computer: sign in to the same account and turn on "Allow access from other computers".',
          )}
        </p>
      )}
      {fresh.map((h) => (
        <Row
          key={h.hostId}
          label={h.name}
          description={`${platformName(h.platform)} - ${h.available ? tr('na sua conta do Argus, abre sem código', 'in your Argus account, opens without a code') : tr('desligado ou sem internet agora', 'off or offline right now')}`}
        >
          <Button variant="primary" disabled={!h.available || busy !== null} onClick={() => void open(h.hostId)}>
            {busy === h.hostId ? tr('Abrindo…', 'Opening…') : tr('Abrir', 'Open')}
          </Button>
        </Row>
      ))}
      {error && <p className="border-b border-dashed border-line py-3 text-[15px] text-red-400">{error}</p>}
    </Group>
  );
}
