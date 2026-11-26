import { useEffect, useState } from 'react';
import { tr } from '../i18n';
import { listAccountHosts, loadAccount, pairTicket, signOutAccount, startAccountLogin, type AccountHost, type AccountProvider } from '../net/account';
import { pairWithCode } from '../net/connection';

// A conta do Argus e os computadores dela, para a tela de parear (AccountHosts) e a aba Conta
// (AccountSection). `notice`: o aviso que veio da volta do login.
export function useAccountHosts(notice?: string | null) {
  const [session, setSession] = useState(() => loadAccount());
  // undefined: buscando; null: não deu para buscar.
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
    setError(null);
    void startAccountLogin(provider).catch(() => setBusy(null));
  };

  // Pareia com o computador da conta. O código pode ter acabado de ser trocado no computador: busca
  // a lista de novo e tenta mais uma vez. Devolve se deu certo (o erro fica em `error`).
  const connect = async (host: AccountHost): Promise<boolean> => {
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
    if (err) setError(err);
    return !err;
  };

  const signOut = () => {
    void signOutAccount().then(() => {
      setSession(null);
      setHosts(undefined);
    });
  };

  return { session, hosts, busy, error, login, connect, signOut };
}
