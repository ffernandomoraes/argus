import { useEffect, useRef } from 'react';
import { tr } from '../i18n';
import { finishAccountLogin, loginErrorText } from '../net/account';
import { loadPairedHost } from '../net/connection';

// Volta do login da conta do Argus (#account=<código> ou #account-error=<motivo>): troca o código pela
// sessão deste aparelho e volta: já pareado, para a aba Conta (onde o login começou); senão, para a
// tela de parear. O que der errado aparece numa das duas.
const NOTICE_KEY = 'argus-account-notice';

export function takeAccountNotice(): string | null {
  try {
    const text = sessionStorage.getItem(NOTICE_KEY);
    sessionStorage.removeItem(NOTICE_KEY);
    return text;
  } catch {
    return null;
  }
}

export function AccountReturn({ code, error }: { code?: string; error?: string }) {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const problem = code ? await finishAccountLogin(code) : loginErrorText(error ?? 'error');
      try {
        if (problem) sessionStorage.setItem(NOTICE_KEY, problem);
      } catch {
        // Sem armazenamento: o aviso se perde, a tela de parear continua.
      }
      // O código não fica no endereço (nem no histórico).
      location.replace(loadPairedHost() ? '#/settings' : '#/');
    })();
  }, [code, error]);
  return <p className="pt-safe px-6 pt-24 text-center text-[15px] text-muted">{tr('Entrando…', 'Signing in…')}</p>;
}
