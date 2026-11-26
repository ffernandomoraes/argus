import { useState } from 'react';
import { tr } from '../i18n';
import { useHost } from '../lib/host';
import { forgetPush } from '../lib/push';
import { resetToStart } from '../lib/router';
import type { AccountHost } from '../net/account';
import { ConfirmSheet } from '../ui/ConfirmSheet';
import { Row, Section } from '../ui/List';
import { takeAccountNotice } from './AccountReturn';
import { AccountLoginRows, HostRows } from './AccountHosts';
import { useAccountHosts } from './useAccountHosts';

// Topo da aba Conta: a conta do Argus (entrar com GitHub/Google, quem está dentro, sair) e os
// computadores dela, para trocar de computador sem código. A volta do login cai aqui (AccountReturn).
export function AccountSection() {
  const { conn } = useHost();
  const [notice] = useState(() => takeAccountNotice());
  const { session, hosts, busy, error, login, connect, signOut } = useAccountHosts(notice);
  const [switchTo, setSwitchTo] = useState<AccountHost | null>(null);
  // O nome fica depois de fechar, para o título não sumir na animação da gaveta.
  const [askingSwitch, setAskingSwitch] = useState(false);
  const [askingSignOut, setAskingSignOut] = useState(false);

  // Trocar de computador: pareia com o novo e recomeça o app nele, como o "Esquecer".
  const switchHost = async (host: AccountHost) => {
    if (!(await connect(host))) return;
    void forgetPush(conn).catch(() => {});
    conn.stop();
    resetToStart();
    location.reload();
  };

  const errorLine = error && <p className="mt-1.5 px-4 text-[12px] leading-snug text-red">{error}</p>;

  if (!session)
    return (
      <>
        <AccountLoginRows
          busy={busy}
          onLogin={login}
          footer={tr(
            'Entre com a mesma conta do Argus do computador para trocar de computador sem código.',
            'Sign in with the same Argus account as the computer to switch computers without a code.',
          )}
        />
        {errorLine}
      </>
    );

  return (
    <>
      <Section title={tr('Conta do Argus', 'Argus account')}>
        <Row
          icon={<Initial name={session.name} />}
          title={session.name}
          subtitle={session.email ?? undefined}
        />
        <Row title={tr('Sair da conta', 'Sign out')} danger chevron={false} onClick={() => setAskingSignOut(true)} />
      </Section>
      <Section
        title={tr('Seus computadores', 'Your computers')}
        footer={tr('Toque em outro computador para trocar. O celular fica ligado a um computador por vez.', 'Tap another computer to switch. The phone connects to one computer at a time.')}
      >
        <HostRows hosts={hosts} busy={busy} currentHostId={conn.host.hostId} onPick={(h) => {
            setSwitchTo(h);
            setAskingSwitch(true);
          }} />
      </Section>
      {errorLine}
      <ConfirmSheet
        open={askingSwitch}
        title={tr(`Trocar para ${switchTo?.name ?? ''}?`, `Switch to ${switchTo?.name ?? ''}?`)}
        message={tr(
          `O celular deixa de entrar em ${conn.host.hostName} e passa a mostrar as conversas de ${switchTo?.name ?? ''}.`,
          `The phone stops connecting to ${conn.host.hostName} and shows the chats of ${switchTo?.name ?? ''} instead.`,
        )}
        confirmLabel={tr('Trocar', 'Switch')}
        onConfirm={() => switchTo && void switchHost(switchTo)}
        onClose={() => setAskingSwitch(false)}
      />
      <ConfirmSheet
        open={askingSignOut}
        title={tr('Sair da conta do Argus?', 'Sign out of your Argus account?')}
        message={
          conn.host.viaAccount
            ? tr(
                `Este celular entrou em ${conn.host.hostName} pela conta: saindo dela, ele também sai do computador e vai precisar parear de novo.`,
                `This phone joined ${conn.host.hostName} through the account: signing out also disconnects it from the computer, and it will need to pair again.`,
              )
            : tr(`O celular continua ligado a ${conn.host.hostName}.`, `The phone stays connected to ${conn.host.hostName}.`)
        }
        confirmLabel={tr('Sair', 'Sign out')}
        danger
        onConfirm={signOut}
        onClose={() => setAskingSignOut(false)}
      />
    </>
  );
}

// Sem a foto: as do GitHub e do Google vêm de outros endereços, que a CSP do app não deixa carregar.
function Initial({ name }: { name: string }) {
  return (
    <span className="flex size-7 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-white">
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}
