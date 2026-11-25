import { useEffect, useState } from 'react';
import type { AccountState } from '@argus/shared/account';
import { IS_REMOTE } from '../remote';

// A conta do Argus deste computador (Configurações > Perfil). Nula enquanto carrega e na janela
// remota: a conta é de cada computador, e a tela dela não aparece lá.
export function useAccount(): AccountState | null {
  const [state, setState] = useState<AccountState | null>(null);
  useEffect(() => {
    if (IS_REMOTE) return;
    let alive = true;
    // O aviso que chegou antes da resposta é mais novo que ela.
    void window.api.account.state().then((s) => alive && setState((prev) => prev ?? s));
    const off = window.api.account.onState(setState);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return state;
}
