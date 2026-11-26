import { Monitor } from 'lucide-react';
import { tr } from '../i18n';
import type { AccountHost, AccountProvider } from '../net/account';
import { Empty, Row, Section } from '../ui/List';
import { useAccountHosts } from './useAccountHosts';

// Na tela de parear: entrar na conta do Argus e escolher um dos computadores dela, sem código (o
// computador publicou o código na conta; ver net/account.ts). `notice`: o que veio da volta do login.
export function AccountHosts({ onPaired, notice }: { onPaired: () => void; notice?: string | null }) {
  const { session, hosts, busy, error, login, connect, signOut } = useAccountHosts(notice);

  if (!session) {
    return (
      <>
        <AccountLoginRows
          busy={busy}
          onLogin={login}
          footer={tr(
            'Entre com a mesma conta do Argus do computador para escolher o computador sem código.',
            'Sign in with the same Argus account as the computer to pick it without a code.',
          )}
        />
        {error && <p className="mt-3 px-4 text-[14px] leading-snug text-red">{error}</p>}
      </>
    );
  }

  return (
    <>
      <Section
        title={tr('Seus computadores', 'Your computers')}
        action={
          <button type="button" className="mr-4 text-[13px] text-accent" onClick={signOut}>
            {tr('Sair da conta', 'Sign out')}
          </button>
        }
        footer={tr(`Conta do Argus de ${session.name}.`, `Argus account of ${session.name}.`)}
      >
        <HostRows
          hosts={hosts}
          busy={busy}
          onPick={(h) =>
            void connect(h).then((ok) => {
              if (!ok) return;
              history.replaceState(null, '', '#/');
              onPaired();
            })
          }
        />
      </Section>
      {error && <p className="mt-3 px-4 text-[14px] leading-snug text-red">{error}</p>}
    </>
  );
}

export function AccountLoginRows({ busy, onLogin, footer }: { busy: string | null; onLogin: (p: AccountProvider) => void; footer: string }) {
  return (
    <Section title={tr('Conta do Argus', 'Argus account')} footer={footer}>
      <Row title={busy === 'github' ? tr('Abrindo…', 'Opening…') : tr('Entrar com GitHub', 'Sign in with GitHub')} onClick={() => onLogin('github')} />
      <Row title={busy === 'google' ? tr('Abrindo…', 'Opening…') : tr('Entrar com Google', 'Sign in with Google')} onClick={() => onLogin('google')} />
    </Section>
  );
}

// As linhas dos computadores da conta. `currentHostId`: o computador pareado agora (marcado, sem toque).
export function HostRows({
  hosts,
  busy,
  currentHostId,
  onPick,
}: {
  hosts: AccountHost[] | null | undefined
  busy: string | null
  currentHostId?: string
  onPick: (host: AccountHost) => void
}) {
  if (hosts === undefined) return <Empty>{tr('Buscando…', 'Loading…')}</Empty>;
  if (hosts === null) return <Empty>{tr('Não deu para buscar agora. Confira a internet.', "Couldn't load right now. Check your connection.")}</Empty>;
  if (hosts.length === 0)
    return (
      <Empty>
        {tr(
          'Nenhum computador com o acesso ligado. No computador: entre na mesma conta e ligue Configurações > Acesso remoto > Permitir acesso.',
          'No computer has access on. On the computer: sign in to the same account and turn on Settings > Remote access > Allow access.',
        )}
      </Empty>
    );
  return (
    <>
      {hosts.map((h) => {
        const current = h.hostId === currentHostId;
        return (
          <Row
            key={h.hostId}
            icon={<Monitor size={18} className="text-muted" />}
            title={h.name}
            subtitle={current || h.code ? undefined : tr('Desligado ou sem internet agora', 'Off or offline right now')}
            trailing={current ? tr('Este', 'This one') : busy === h.hostId ? tr('Conectando…', 'Connecting…') : undefined}
            onClick={!current && h.code && !busy ? () => onPick(h) : undefined}
          />
        );
      })}
    </>
  );
}
