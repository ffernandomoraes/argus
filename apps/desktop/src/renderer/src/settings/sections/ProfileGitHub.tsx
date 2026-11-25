import { useCallback, useEffect, useState } from 'react';
import type { GitHubConnectResult, GitHubStatus } from '@argus/shared/accountGitHub';
import { tr } from '../../i18n';
import { Button } from '../../ui/Button';
import { Group, Row } from '../controls';

// Perfil: o GitHub conectado à conta do Argus, para clonar os repositórios pela Nova pasta e pelo
// "Clonar…" dos workspaces importados (ver main/account/github.ts). Vale em todos os computadores da
// conta. Some sem conta ou com o servidor sem o app do GitHub. Conectado, ganha a aba GitHub, com as
// contas e organizações (ProfileGitHubTab.tsx).

export function connectErrorText(r: GitHubConnectResult): string | null {
  if (r.ok || r.error === 'canceled') return null;
  if (r.error === 'denied') return tr('Conexão cancelada no GitHub.', 'Connection canceled on GitHub.');
  if (r.error === 'expired') return tr('Demorou demais. Clique em conectar de novo.', 'It took too long. Click connect again.');
  if (r.error === 'offline') return tr('Sem internet agora. Tente de novo.', 'No connection right now. Try again.');
  return tr('Não deu para conectar. Tente de novo daqui a pouco.', "Couldn't connect. Try again in a moment.");
}

// O estado do GitHub, buscado de novo quando a janela volta ao foco (a pessoa escolheu os
// repositórios no navegador e voltou).
export function useGitHubStatus(): [GitHubStatus | null, () => void] {
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const load = useCallback(() => {
    void window.api.account.github().then(setStatus);
  }, []);
  useEffect(() => {
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);
  return [status, load];
}

// A conexão em si: "Conectar GitHub" (na aba Conta, sem conexão) ou quem está conectado e
// "Desconectar GitHub" (no topo da aba GitHub).
export function ProfileGitHub({ status, reload }: { status: GitHubStatus | null; reload: () => void }) {
  const [busy, setBusy] = useState<'connect' | 'disconnect' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!status || status.status === 'signedOut' || status.status === 'unavailable') return null;

  const connect = async () => {
    setBusy('connect');
    setError(null);
    const r = await window.api.account.githubConnect();
    setBusy(null);
    setError(connectErrorText(r));
    reload();
  };
  const disconnect = async () => {
    setBusy('disconnect');
    if (!(await window.api.account.githubDisconnect())) setError(tr('Não deu para desconectar agora. Confira a internet.', "Couldn't disconnect right now. Check your connection."));
    setBusy(null);
    reload();
  };

  const description =
    error ??
    (status.status === 'offline'
      ? tr('Não deu para ver o GitHub agora. Confira a internet.', "Couldn't check GitHub right now. Check your connection.")
      : status.status === 'connected'
        ? tr(
            `Conectado como @${status.login}. Para clonar, use Nova pasta > Clonar do GitHub.`,
            `Connected as @${status.login}. To clone, use New folder > Clone from GitHub.`,
          )
        : tr(
            'Conecte para clonar seus repositórios diretamente no Argus.',
            'Connect to clone your repositories right in Argus.',
          ));

  return (
    <Group>
      <Row label="GitHub" description={description}>
        {busy === 'connect' ? (
          <div className="flex gap-2">
            <Button onClick={() => window.api.account.githubCancel()}>{tr('Cancelar', 'Cancel')}</Button>
            <Button variant="primary" disabled>
              {tr('Esperando o navegador…', 'Waiting for the browser…')}
            </Button>
          </div>
        ) : status.status === 'connected' ? (
          <Button disabled={busy !== null} onClick={() => void disconnect()}>
            {tr('Desconectar GitHub', 'Disconnect GitHub')}
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void connect()}>
            {tr('Conectar GitHub', 'Connect GitHub')}
          </Button>
        )}
      </Row>
    </Group>
  );
}
