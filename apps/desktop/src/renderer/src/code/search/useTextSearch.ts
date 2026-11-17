import { useEffect, useState } from 'react';
import type { TextSearchOptions, TextSearchResult } from '@argus/shared/files';
import { tr } from '../../i18n';

// Espera a pessoa parar de digitar antes de buscar.
const DEBOUNCE = 250;

type State = { key: string; result: TextSearchResult | null; searching: boolean };

// Busca no conteúdo dos arquivos do projeto enquanto a pessoa digita. O resultado anterior fica na
// tela até o novo chegar (sem piscar a lista a cada tecla); `rerun` busca de novo (Enter), para ver
// o que mudou nos arquivos.
export function useTextSearch(root: string, query: string, options: TextSearchOptions) {
  const [run, setRun] = useState(0);
  const key = `${root}\0${query}\0${options.caseSensitive}\0${options.wholeWord}\0${options.regex}\0${run}`;
  const [state, setState] = useState<State>({ key: '', result: null, searching: false });
  // Busca nova: marca "buscando" no mesmo render, sem esperar o efeito.
  if (state.key !== key) setState((s) => ({ key, result: query ? s.result : null, searching: !!query }));

  useEffect(() => {
    if (!query) return;
    let alive = true;
    const id = setTimeout(() => {
      window.api.files.search(root, query, options).then(
        (result) => {
          // Cancelada por uma busca mais nova: a nova responde.
          if (!alive || (!result.ok && result.cancelled)) return;
          setState((s) => (s.key === key ? { ...s, result, searching: false } : s));
        },
        (err: unknown) => {
          if (!alive) return;
          const result: TextSearchResult = { ok: false, error: tr(`Não consegui buscar: ${String(err)}`, `Could not search: ${String(err)}`) };
          setState((s) => (s.key === key ? { ...s, result, searching: false } : s));
        },
      );
    }, DEBOUNCE);
    return () => {
      alive = false;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key já tem root, query, opções e run
  }, [key]);

  return { result: state.result, searching: state.searching, rerun: () => setRun((n) => n + 1) };
}
