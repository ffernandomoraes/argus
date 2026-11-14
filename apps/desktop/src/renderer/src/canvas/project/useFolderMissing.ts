import { useEffect, useState } from 'react';

// A pasta do card sumiu (renomeada ou movida no Finder, no Explorer)? Confere ao aparecer e cada
// vez que a janela volta a ter foco: quem renomeia a pasta está em outro app, e ao voltar o card já
// mostra o aviso. Sem resposta (WSL parado), conta como existente (main/sessions/relocate.ts).
export function useFolderMissing(path: string, enabled: boolean): boolean {
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setMissing(false);
      return;
    }
    let alive = true;
    const check = () => {
      void window.api.sessions.exists(path).then(
        (exists) => alive && setMissing(!exists),
        () => {},
      );
    };
    check();
    window.addEventListener('focus', check);
    return () => {
      alive = false;
      window.removeEventListener('focus', check);
    };
  }, [path, enabled]);
  return missing;
}
