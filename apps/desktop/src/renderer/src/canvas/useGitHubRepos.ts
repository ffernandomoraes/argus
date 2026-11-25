import { useCallback, useEffect, useRef, useState } from 'react';
import type { GitHubRepoList } from '@argus/shared/accountGitHub';

// A lista do "Clonar do GitHub" e o "+ Outra organização": enquanto a pessoa está no navegador
// liberando outra conta ou organização, `adding` é 'browser'; ao voltar ao Argus (a janela ganha o
// foco), 'loading' até a lista nova chegar. Apareceu um dono novo: `onNewOwner` com ele, para a tela
// já mostrar o que entrou.

export type Adding = 'browser' | 'loading' | null;

const ownersOf = (list: GitHubRepoList | null): string[] => (list?.ok ? [...new Set(list.repos.map((r) => r.owner))] : []);

export function useGitHubRepos(onNewOwner: (owner: string) => void) {
  const [list, setList] = useState<GitHubRepoList | null>(null);
  const [adding, setAddingState] = useState<Adding>(null);
  const addingRef = useRef<Adding>(null);
  const listRef = useRef<GitHubRepoList | null>(null);
  const onNewOwnerRef = useRef(onNewOwner);
  onNewOwnerRef.current = onNewOwner;

  const setAdding = (value: Adding) => {
    addingRef.current = value;
    setAddingState(value);
  };

  const load = useCallback(async () => {
    const next = await window.api.account.githubRepos();
    listRef.current = next;
    setList(next);
    return next;
  }, []);

  useEffect(() => {
    void load();
    // Voltou do GitHub: a lista vem de novo.
    const onFocus = () => {
      const waiting = addingRef.current === 'browser';
      const before = new Set(ownersOf(listRef.current));
      if (waiting) setAdding('loading');
      void load().then((next) => {
        if (!waiting) return;
        setAdding(null);
        const fresh = ownersOf(next).filter((o) => !before.has(o));
        if (fresh.length === 1) onNewOwnerRef.current(fresh[0]!);
      });
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const startAdding = (installUrl: string) => {
    setAdding('browser');
    window.open(installUrl);
  };

  // Desistiu (ou o navegador não tirou o foco do Argus): para de esperar e busca de novo.
  const stopAdding = () => {
    setAdding(null);
    void load();
  };

  return { list, load: () => void load(), adding, startAdding, stopAdding };
}
