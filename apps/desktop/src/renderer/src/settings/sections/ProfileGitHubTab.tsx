import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { GitHubInstallationList, GitHubStatus } from '@argus/shared/accountGitHub';
import { tr } from '../../i18n';
import { EmptyState } from '../../ui/emptyState/EmptyState';
import { GitHubArt } from '../../ui/emptyState/illustrations';
import { Button } from '../../ui/Button';
import { Group, Row } from '../controls';
import { ProfileGitHub } from './ProfileGitHub';

// Perfil > GitHub (só com o GitHub conectado): quem está conectado e as contas e organizações onde o
// app do Argus está instalado. Desconectar uma abre a página da instalação no GitHub, onde a pessoa
// clica em Uninstall (numa organização, só quem é admin consegue); conectar outra abre a escolha de
// conta ou organização. Enquanto a pessoa está no navegador, o botão gira; ao voltar, a lista vem de
// novo.

// Qual botão espera a volta do navegador: o id da instalação ou 'add'.
type Waiting = number | 'add' | null;

function useInstallations() {
  const [list, setList] = useState<GitHubInstallationList | null>(null);
  const [waiting, setWaitingState] = useState<Waiting>(null);
  const waitingRef = useRef<Waiting>(null);
  const setWaiting = (w: Waiting) => {
    waitingRef.current = w;
    setWaitingState(w);
  };
  const load = useCallback(() => window.api.account.githubInstallations().then(setList), []);
  useEffect(() => {
    void load();
    const onFocus = () => {
      const was = waitingRef.current;
      void load().then(() => {
        if (waitingRef.current === was) setWaiting(null);
      });
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);
  const open = (w: Exclude<Waiting, null>, url: string) => {
    setWaiting(w);
    window.open(url);
  };
  const stop = () => {
    setWaiting(null);
    void load();
  };
  return { list, waiting, open, stop };
}

function WaitingButton({ onStop }: { onStop: () => void }) {
  return (
    <Button onClick={onStop} title={tr('Parar de esperar', 'Stop waiting')}>
      <span className="flex items-center gap-1.5">
        <Loader2 size={14} className="animate-spin" />
        {tr('Esperando o GitHub…', 'Waiting for GitHub…')}
      </span>
    </Button>
  );
}

export function ProfileGitHubTab({ status, reload }: { status: Extract<GitHubStatus, { status: 'connected' }>; reload: () => void }) {
  const { list, waiting, open, stop } = useInstallations();

  const note = (text: string) => <p className="py-5 text-[15px] leading-relaxed text-muted">{text}</p>;
  let rows;
  if (!list) rows = note(tr('Buscando…', 'Loading…'));
  else if (!list.ok && list.error === 'offline') rows = note(tr('Não deu para buscar agora. Confira a internet.', "Couldn't load right now. Check your connection."));
  else if (!list.ok) rows = note(tr('O servidor da conta não respondeu direito. Tente de novo daqui a pouco.', "The account server didn't respond properly. Try again in a moment."));
  else if (!list.installations.length) {
    rows = (
      <EmptyState
        art={<GitHubArt />}
        title={tr('Nenhuma conta conectada ainda', 'No account connected yet')}
        text={tr(
          'Conecte sua conta ou uma organização do GitHub e clone os repositórios direto no canvas.',
          'Connect your account or a GitHub organization and clone repositories straight onto the canvas.',
        )}
      />
    );
  }
  else {
    rows = list.installations.map((i) => (
      <Row
        key={i.id}
        label={i.account}
        description={`${i.organization ? tr('Organização', 'Organization') : tr('Sua conta', 'Your account')} - ${
          i.selection === 'all' ? tr('todos os repositórios', 'all repositories') : tr('repositórios escolhidos', 'selected repositories')
        }`}
      >
        {waiting === i.id ? (
          <WaitingButton onStop={stop} />
        ) : (
          <Button danger onClick={() => open(i.id, i.manageUrl)}>
            {tr('Desconectar', 'Disconnect')}
          </Button>
        )}
      </Row>
    ));
  }

  return (
    <>
      <ProfileGitHub status={status} reload={reload} />
      <Group>
        <Row
          label={tr('Contas e organizações', 'Accounts and organizations')}
          description={tr(
            'Onde o Argus pode clonar. Desconectar abre o GitHub: clique em Uninstall no fim da página. Em organização, só quem é admin consegue.',
            'Where Argus can clone. Disconnect opens GitHub: click Uninstall at the bottom of the page. In an organization, only admins can.',
          )}
        >
          {waiting === 'add' ? (
            <WaitingButton onStop={stop} />
          ) : (
            <Button variant="primary" onClick={() => open('add', status.installUrl)}>
              {tr('Conectar organização', 'Connect organization')}
            </Button>
          )}
        </Row>
        {rows}
      </Group>
    </>
  );
}
