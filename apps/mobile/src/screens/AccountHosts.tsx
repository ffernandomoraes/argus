import { useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';
import { tr } from '../i18n';
import { listAccountHosts, loadAccount, pairTicket, signOutAccount, startAccountLogin, type AccountHost, type AccountProvider } from '../net/account';
import { pairWithCode } from '../net/connection';
import { Empty, Row, Section } from '../ui/List';

// Na tela de parear: entrar na conta do Argus e escolher um dos computadores dela, sem código (o
// computador publicou o código na conta; ver net/account.ts). `notice`: o que veio da volta do login.
export function AccountHosts({ onPaired, notice }: { onPaired: () => void; notice?: string | null }) {
  const [session, setSession] = useState(() => loadAccount());
  const [hosts, setHosts] = useState<AccountHost[] | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(notice ?? null);

  const refresh = async () => {
    try {
      setHosts(await listAccountHosts());
    } catch {
      setSession(loadAccount());
      setHosts(null);
    }
  };

  useEffect(() => {
    if (session) void refresh();
  }, [session]);

  const login = (provider: AccountProvider) => {
    setBusy(provider);
    void startAccountLogin(provider).catch(() => setBusy(null));
  };

  // O código pode ter acabado de ser trocado no computador: busca a lista de novo e tenta mais uma vez.
  const connect = async (host: AccountHost) => {
    setBusy(host.hostId);
    setError(null);
    let code = host.code;
    let err: string | null = tr('Esse computador não está aceitando conexões agora.', 'That computer is not accepting connections right now.');
    for (let attempt = 0; attempt < 2 && code; attempt++) {
      // O bilhete prende o pareamento a esta conta: saindo dela (ou tirado em Aparelhos), o acesso acaba.
      const ticket = await pairTicket(host.hostId);
      if (!ticket) break;
      err = await pairWithCode(code, ticket);
      if (!err) break;
      code = (await listAccountHosts().catch(() => null))?.find((h) => h.hostId === host.hostId)?.code ?? null;
    }
    setBusy(null);
    if (err) return setError(err);
    history.replaceState(null, '', '#/');
    onPaired();
  };

  if (!session) {
    return (
      <>
        <Section
          title={tr('Conta do Argus', 'Argus account')}
          footer={tr(
            'Entre com a mesma conta do Argus do computador para escolher o computador sem código.',
            'Sign in with the same Argus account as the computer to pick it without a code.',
          )}
        >
          <Row title={busy === 'github' ? tr('Abrindo…', 'Opening…') : tr('Entrar com GitHub', 'Sign in with GitHub')} onClick={() => login('github')} />
          <Row title={busy === 'google' ? tr('Abrindo…', 'Opening…') : tr('Entrar com Google', 'Sign in with Google')} onClick={() => login('google')} />
        </Section>
        {error && <p className="mt-3 px-4 text-[14px] leading-snug text-red">{error}</p>}
      </>
    );
  }

  return (
    <>
      <Section
        title={tr('Seus computadores', 'Your computers')}
        action={
          <button
            type="button"
            className="mr-4 text-[13px] text-accent"
            onClick={() => {
              void signOutAccount().then(() => setSession(null));
            }}
          >
            {tr('Sair da conta', 'Sign out')}
          </button>
        }
        footer={tr(`Conta do Argus de ${session.name}.`, `Argus account of ${session.name}.`)}
      >
        {hosts === undefined && <Empty>{tr('Buscando…', 'Loading…')}</Empty>}
        {hosts === null && <Empty>{tr('Não deu para buscar agora. Confira a internet.', "Couldn't load right now. Check your connection.")}</Empty>}
        {hosts?.length === 0 && (
          <Empty>
            {tr(
              'Nenhum computador com o acesso ligado. No computador: entre na mesma conta e ligue Configurações > Acesso remoto > Permitir acesso.',
              'No computer has access on. On the computer: sign in to the same account and turn on Settings > Remote access > Allow access.',
            )}
          </Empty>
        )}
        {hosts?.map((h) => (
          <Row
            key={h.hostId}
            icon={<Monitor size={18} className="text-muted" />}
            title={h.name}
            subtitle={h.code ? undefined : tr('Desligado ou sem internet agora', 'Off or offline right now')}
            trailing={busy === h.hostId ? tr('Conectando…', 'Connecting…') : undefined}
            onClick={h.code && !busy ? () => void connect(h) : undefined}
          />
        ))}
      </Section>
      {error && <p className="mt-3 px-4 text-[14px] leading-snug text-red">{error}</p>}
    </>
  );
}
