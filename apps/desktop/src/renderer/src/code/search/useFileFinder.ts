import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import type { FileNameList } from '@argus/shared/files';
import { fuzzyFilter } from './fuzzy';

// Resultados mostrados: quem não achou nos primeiros digita mais.
const LIMIT = 100;

type Names = { root: string; list: FileNameList | null };

// Busca pelo nome (⌘P): a lista de arquivos do projeto é pedida quando a pessoa começa a digitar (de
// novo a cada busca, para pegar arquivos criados enquanto isso) e filtrada aqui a cada tecla.
export function useFileFinder(root: string, query: string, onOpen: (path: string) => void) {
  const active = query.trim() !== '';
  const [names, setNames] = useState<Names>({ root, list: null });
  const [highlight, setHighlight] = useState(0);
  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setHighlight(0);
  }

  useEffect(() => {
    if (!active) return;
    let alive = true;
    window.api.files.names(root).then(
      (list) => alive && setNames({ root, list }),
      (err: unknown) => console.error('[código] nomes dos arquivos:', err),
    );
    return () => {
      alive = false;
    };
  }, [root, active]);

  const list = names.root === root ? names.list : null;
  const hits = useMemo(() => (active && list ? fuzzyFilter(query, list.files, LIMIT) : []), [active, list, query]);

  // Setas escolhem, Enter abre (com o foco no campo, como no VS Code).
  const onKeyDown = (e: KeyboardEvent) => {
    if (!hits.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setHighlight((h) => (h + step + hits.length) % hits.length);
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onOpen(hits[Math.min(highlight, hits.length - 1)].path);
    }
  };

  return { active, loading: active && !list, hits, truncated: !!list?.truncated, highlight, setHighlight, onKeyDown };
}

export type FileFinder = ReturnType<typeof useFileFinder>;
