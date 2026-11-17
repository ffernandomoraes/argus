import { useState, type MouseEvent } from 'react';
import type { FileEntry } from '@argus/shared/files';
import { isMod } from '../../platform';
import { pathsBetween, visiblePaths } from './treePaths';
import type { FileTree } from './useFileTree';

const NONE: ReadonlySet<string> = new Set();

// Itens escolhidos na árvore, como no Finder: o clique escolhe um; ⌘-clique (Ctrl no Windows)
// junta ou tira um; ⇧-clique escolhe tudo entre o último e este. `focused` é o último escolhido:
// criar e colar valem para a pasta dele. O arquivo aberto (também por um link do chat) passa a ser
// o escolhido.
export function useTreeSelection(tree: FileTree, selected: string | null) {
  const [focused, setFocusedState] = useState<string | null>(selected);
  const [selection, setSelection] = useState<ReadonlySet<string>>(() => (selected ? new Set([selected]) : NONE));

  const setFocused = (path: string | null) => {
    setFocusedState(path);
    setSelection(path === null ? NONE : new Set([path]));
  };

  const [prevSelected, setPrevSelected] = useState(selected);
  if (selected !== prevSelected) {
    setPrevSelected(selected);
    setFocused(selected);
  }

  // Clique num item. Devolve true se foi o clique comum (abre o arquivo ou a pasta).
  const click = (entry: FileEntry, e: MouseEvent): boolean => {
    if (isMod(e)) {
      const next = new Set(selection);
      if (next.has(entry.path)) next.delete(entry.path);
      else next.add(entry.path);
      setSelection(next);
      setFocusedState(entry.path);
      return false;
    }
    if (e.shiftKey) {
      setSelection(new Set(pathsBetween(visiblePaths(tree.listings, tree.expanded), focused, entry.path)));
      return false;
    }
    setFocused(entry.path);
    return true;
  };

  // O botão direito num item fora da seleção escolhe só ele; num item dela, mantém todos.
  const pick = (path: string | null) => {
    if (path !== null && selection.has(path)) setFocusedState(path);
    else setFocused(path);
  };

  // Os escolhidos que ainda existem na árvore, na ordem em que aparecem.
  const chosen = (): FileEntry[] => {
    const entries = [...selection].map((p) => tree.entryOf(p)).filter((e): e is FileEntry => !!e);
    return entries.length ? entries : [tree.entryOf(focused)].filter((e): e is FileEntry => !!e);
  };

  return { focused, setFocused, selection, click, pick, chosen };
}
