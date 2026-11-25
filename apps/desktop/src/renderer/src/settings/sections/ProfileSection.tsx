import { useState } from 'react';
import { FolderGit2, LayoutGrid, ScrollText, MonitorSmartphone, TriangleAlert, UserRound } from 'lucide-react';
import type { AccountProfile, AccountSync } from '@argus/shared/account';
import { Avatar } from '../../account/Avatar';
import { ProviderMark, providerName } from '../../account/ProviderMark';
import { useAccount } from '../../account/useAccount';
import { LOCALE, tr } from '../../i18n';
import { Button } from '../../ui/Button';
import { Group, Row } from '../controls';
import { Tabs } from '../Tabs';
import { ProfileAgentFiles } from './ProfileAgentFiles';
import { ProfileDevices } from './ProfileDevices';
import { ProfileSignIn } from './ProfileSignIn';
import { ProfileGitHub, useGitHubStatus } from './ProfileGitHub';
import { ProfileGitHubTab } from './ProfileGitHubTab';
import { ProfileWorkspaces } from './ProfileWorkspaces';

// Perfil: a conta do Argus deste computador (login com GitHub ou Google) e as preferências que vão
// com ela para os outros computadores (ver src/main/account). Não confundir com a aba Contas, que é
// das contas do Claude e dos outros agentes.

function identitiesText(profile: AccountProfile): string {
  const names = profile.identities.map((i) => {
    const who = i.login ? `@${i.login}` : i.email;
    return who ? `${providerName(i.provider)} (${who})` : providerName(i.provider);
  });
  if (profile.identities.length !== 1) return names.join(tr(' e ', ' and '));
  const other = profile.identities[0].provider === 'github' ? 'Google' : 'GitHub';
  return tr(
    `${names[0]}. Entrar com o ${other} do mesmo e-mail liga os dois nesta conta.`,
    `${names[0]}. Signing in with ${other} using the same email links both to this account.`,
  );
}

function syncText(sync: AccountSync): string {
  if (sync.status === 'syncing') return tr('Sincronizando…', 'Syncing…');
  if (sync.status === 'error') return tr('Sem conexão com o servidor agora. Tenta de novo sozinho.', "Can't reach the server right now. It will retry on its own.");
  if (!sync.lastSyncedAt) return tr('Ainda não sincronizou.', 'Not synced yet.');
  // Data e hora da última vez (24/11/2026 às 17:05).
  const at = new Date(sync.lastSyncedAt);
  const date = at.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = at.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
  const when = tr(`em ${date} às ${time}`, `on ${date} at ${time}`);
  if (sync.first === 'adopted') return tr(`As preferências da sua conta vieram para este computador ${when}.`, `Your account preferences came to this computer ${when}.`);
  if (sync.first === 'uploaded') return tr(`As preferências deste computador foram para a sua conta ${when}.`, `This computer's preferences went to your account ${when}.`);
  return tr(`Última sincronização ${when}.`, `Last synced ${when}.`);
}

function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<'idle' | 'busy' | 'failed'>('idle');
  const remove = async () => {
    setStatus('busy');
    setStatus((await window.api.account.deleteAccount()) ? 'idle' : 'failed');
  };
  return (
    <Group>
      <Row
        label={tr('Apagar conta', 'Delete account')}
        description={
          status === 'failed'
            ? tr('Não deu para apagar. Confira a internet e tente de novo.', "Couldn't delete it. Check your connection and try again.")
            : tr('Apaga o perfil e as preferências guardadas na conta. As deste computador continuam aqui.', 'Deletes the profile and the preferences stored in the account. The ones on this computer stay here.')
        }
      >
        {confirming ? (
          <div className="flex gap-2">
            <Button onClick={() => setConfirming(false)}>{tr('Cancelar', 'Cancel')}</Button>
            <Button variant="primary" danger disabled={status === 'busy'} onClick={() => void remove()}>
              {tr('Apagar de vez', 'Delete for good')}
            </Button>
          </div>
        ) : (
          <Button danger onClick={() => setConfirming(true)}>
            {tr('Apagar conta…', 'Delete account…')}
          </Button>
        )}
      </Row>
    </Group>
  );
}

type Tab = 'account' | 'workspaces' | 'files' | 'github' | 'devices' | 'danger';

// Abas: a conta (quem está logado, os logins e o estado da sincronização), os workspaces dos
// outros computadores, as instruções e skills dos agentes, os aparelhos ligados a ela e, à parte, o que não tem
// volta (apagar a conta).
function SignedIn({ profile, sync }: { profile: AccountProfile; sync: AccountSync }) {
  const [chosen, setTab] = useState<Tab>('account');
  // A aba GitHub só existe com o GitHub conectado; sem ele, o "Conectar GitHub" fica na aba Conta.
  const [github, reloadGitHub] = useGitHubStatus();
  const connected = github?.status === 'connected' ? github : null;
  const tab = chosen === 'github' && !connected ? 'account' : chosen;
  return (
    <>
      <Tabs
        value={tab}
        onChange={setTab}
        label={tr('Perfil', 'Profile')}
        options={[
          { value: 'account', label: tr('Conta', 'Account'), icon: <UserRound size={15} /> },
          { value: 'workspaces', label: 'Workspaces', icon: <LayoutGrid size={15} /> },
          { value: 'files', label: tr('Instruções e skills', 'Instructions and skills'), icon: <ScrollText size={15} /> },
          ...(connected ? [{ value: 'github' as const, label: 'GitHub', icon: <FolderGit2 size={15} /> }] : []),
          { value: 'devices', label: tr('Aparelhos conectados', 'Connected devices'), icon: <MonitorSmartphone size={15} /> },
          { value: 'danger', label: tr('Perigo', 'Danger'), icon: <TriangleAlert size={15} className="text-red-400" /> },
        ]}
      />
      {tab === 'account' && (
        <>
        <Group>
          <div className="flex items-center gap-3 border-b border-dashed border-line py-5">
            <Avatar name={profile.name} src={profile.avatar} size={44} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-medium text-text">{profile.name}</div>
              {profile.email && <div className="truncate text-[15px] text-muted">{profile.email}</div>}
            </div>
            <Button onClick={() => window.api.account.signOut()}>{tr('Sair', 'Sign out')}</Button>
          </div>
          <Row label={tr('Logins', 'Sign-in methods')} description={identitiesText(profile)}>
            <div className="flex gap-2 text-text">
              {profile.identities.map((i) => (
                <ProviderMark key={i.provider} provider={i.provider} />
              ))}
            </div>
          </Row>
          {/* Sincroniza sozinho (a cada mudança, ao voltar ao app e a cada 10 minutos): só o estado, e o
              botão só quando falhou. */}
          <Row label={tr('Sincronização', 'Sync')} description={syncText(sync)}>
            {sync.status === 'error' && <Button onClick={() => window.api.account.syncNow()}>{tr('Tentar de novo', 'Try again')}</Button>}
          </Row>
        </Group>
        {!connected && <ProfileGitHub status={github} reload={reloadGitHub} />}
        </>
      )}
      {tab === 'workspaces' && <ProfileWorkspaces />}
      {tab === 'files' && <ProfileAgentFiles />}
      {tab === 'github' && connected && <ProfileGitHubTab status={connected} reload={reloadGitHub} />}
      {tab === 'devices' && <ProfileDevices />}
      {tab === 'danger' && <DeleteAccount />}
    </>
  );
}

export function ProfileSection() {
  const account = useAccount();
  if (!account) return null;
  if (account.status === 'signedIn') return <SignedIn profile={account.profile} sync={account.sync} />;
  return <ProfileSignIn state={account} />;
}
