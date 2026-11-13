import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { reloginMethod, type AuthState, type ClaudeAccount } from '@argus/shared/auth';
import { tr } from '../i18n';
import { Presence } from '../motion';
import { Modal } from '../ui/Modal';
import { LoginPanel } from './LoginPanel';
import { useAuth } from './useAuth';

// Entrar de novo numa conta que perdeu o login, com o menor esforço: um clique abre o navegador já
// no jeito que ela entrou da última vez (ver reloginMethod), e o aviso no meio da janela só
// acompanha, com as outras formas num link. Usado pela linha do erro na conversa, pela conta sem
// login na barra de baixo e pelo aviso de prazo no painel dos limites.

// A conta e o lugar do login (distro: o da conta dentro daquela distro do WSL).
export type ReloginTarget = { accountId: string; distro?: string };

// Começa o login agora e devolve o alvo para o LoginModal acompanhar. Um login já em andamento na
// mesma conta e lugar continua, sem abrir outra aba no navegador.
export function startRelogin(auth: AuthState | null, account: ClaudeAccount, distro?: string): ReloginTarget {
  const login = auth?.login;
  const running =
    (login?.status === 'starting' || login?.status === 'waiting') && !login.adding && login.accountId === account.id && login.distro === distro;
  if (!running) window.api.auth.login(account.id, reloginMethod(account), distro);
  return { accountId: account.id, ...(distro && { distro }) };
}

// O aviso que acompanha o login começado por startRelogin. Fecha sozinho quando o login termina
// (deu certo, ou foi cancelado); note: uma frase sobre o lugar do login, abaixo do título.
export function LoginModal({ target, note, onClose }: { target: ReloginTarget | null; note?: string; onClose: () => void }) {
  const auth = useAuth();
  const login = auth?.login;
  const account = target ? auth?.accounts.find((a) => a.id === target.accountId) : undefined;

  // Login terminou: o aviso fecha. Num efeito: quem mostra o aviso guarda o alvo no estado dele.
  const status = login?.status;
  const prev = useRef(status);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const was = prev.current;
    prev.current = status;
    if ((was === 'starting' || was === 'waiting') && status === 'idle') close.current();
  }, [status]);

  const multiple = (auth?.accounts.length ?? 0) > 1;
  const title = target?.distro
    ? tr(`Entrar de novo no WSL (${target.distro})`, `Sign in again to WSL (${target.distro})`)
    : multiple && account
      ? tr(`Entrar de novo em ${account.name}`, `Sign in again to ${account.name}`)
      : tr('Entrar de novo no Claude', 'Sign in again to Claude');

  // No body: dentro da conversa ou da barra, o aviso ficava preso a elas em vez de centrar na janela.
  return createPortal(
    <Presence kind="modal">
      {target && account && login && (
        <Modal variant="alert" labelledBy="relogin-title" onClose={onClose} onRequestClose={() => (window.api.auth.cancel(), true)}>
          <h2 id="relogin-title" className="text-sm font-semibold">
            {title}
          </h2>
          {note && <p className="mt-2 text-xs leading-relaxed text-muted">{note}</p>}
          <div className="mt-4">
            <LoginPanel
              login={login}
              direct={reloginMethod(account)}
              onStart={(method) => window.api.auth.login(account.id, method, target.distro)}
              onCancel={onClose}
            />
          </div>
        </Modal>
      )}
    </Presence>,
    document.body,
  );
}
