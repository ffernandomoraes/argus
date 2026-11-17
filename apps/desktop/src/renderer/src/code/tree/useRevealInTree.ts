import { useEffect, useState, type RefObject } from 'react';
import { dirsUpTo } from './treePaths';
import type { FileTree } from './useFileTree';

// Mostra um arquivo na árvore (aberto pela busca pelo nome): abre as pastas até ele e rola até a
// linha dele quando as pastas carregarem.
export function useRevealInTree(tree: FileTree, treeRef: RefObject<HTMLDivElement | null>) {
  const [reveal, setReveal] = useState<string | null>(null);

  useEffect(() => {
    if (!reveal) return;
    const item = treeRef.current?.querySelector(`[data-path="${CSS.escape(reveal)}"]`);
    if (!item) return;
    item.scrollIntoView({ block: 'nearest' });
    setReveal(null);
  }, [reveal, tree.listings, treeRef]);

  return (path: string) => {
    for (const dir of dirsUpTo(path, '')) tree.expand(dir);
    setReveal(path);
  };
}
