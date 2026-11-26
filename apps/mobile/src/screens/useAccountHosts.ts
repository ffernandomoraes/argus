import { useEffect, useState } from 'react';
import { tr } from '../i18n';
import { listAccountHosts, loadAccount, pairTicket, signOutAccount, startAccountLogin, type AccountHost, type AccountProvider } from '../net/account';
import { pairWithCode } from '../net/connection';
import { cancelPendingLogin, loadPendingLogin, openPendingLogin, pollPendingLogin, startWaitingLogin, type PendingLogin } from '../net/loginWait';
import { installed } from '../lib/push';

// Com o login aberto no navegador, de quanto em quanto tempo o app pergunta se terminou.
const POLL_MS = 2500;

// A conta do Argus e os computadores dela, para a tela de parear (AccountHosts) e a aba Conta
// (AccountSection). `notice`: o aviso que veio da volta do login.
export function useAccountHosts(notice?: string | null) {
  const [session, setSession] = useState(() => loadAccount());
  // undefined: buscando; null: não deu para buscar.
  const [hosts, setHosts] = useState<AccountHost[] | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(notice ?? null);
  // Login aberto no navegador, com o app instalado esperando o fim (ver net/loginWait.ts).
  const [pending, setPending] = useState<PendingLogin | null>(() => loadPendingLogin());

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

  // Pergunta logo, a cada POLL_MS com o app na tela e ao voltar do navegador (o iPhone congela o app
  // enquanto o navegador está na frente).
  useEffect(() => {
    if (!pending) return;
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      if (!loadPendingLogin()) {
        setPending(null);
        return setError(tr('O login demorou demais. Tente de novo.', 'Sign-in took too long. Try again.'));
      }
      const result = await pollPendingLogin(pending);
      if (stopped || result === 'pending') return;
      setPending(null);
      if (result === 'done') setSession(loadAccount());
      else setError(tr('O login não terminou a tempo. Tente de novo.', "Sign-in didn't finish in time. Try again."));
    };
    void check();
    const timer = setInterval(() => void check(), POLL_MS);
    const onVisible = () => void check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pending]);

  // Instalado, o navegador não volta para o app: o app espera. No navegador, o login volta para cá.
  const login = (provider: AccountProvider) => {
    setError(null);
    if (installed()) {
      void startWaitingLogin(provider).then(setPending);
      return;
    }
    setBusy(provider);
    void startAccountLogin(provider).catch(() => setBusy(null));
  };

  const waiting = pending && {
    pending,
    reopen: () => openPendingLogin(pending),
    cancel: () => {
      cancelPendingLogin();
      setPending(null);
    },
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

  return { session, hosts, busy, error, waiting, login, connect, signOut };
}
