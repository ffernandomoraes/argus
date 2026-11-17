import { createStore } from '../../lib/createStore';
import { useStore } from '../../lib/useStore';
import { inside } from '../tree/treePaths';

// Abas do painel de código: os arquivos abertos de cada pasta, na ordem em que abriram. Ficam ao
// fechar o painel e voltam ao reabrir (só enquanto o app está aberto). As funções puras ficam
// separadas do store para os testes.

type Tabs = ReadonlyMap<string, readonly string[]>;

const EMPTY: readonly string[] = [];

export const withTab = (tabs: readonly string[], path: string): readonly string[] => (tabs.includes(path) ? tabs : [...tabs, path]);

// Fechar uma aba: a da direita passa a ser a aberta (ou a da esquerda, se era a última).
export function withoutTab(tabs: readonly string[], path: string): { tabs: readonly string[]; next: string | null } {
  const i = tabs.indexOf(path);
  if (i < 0) return { tabs, next: null };
  const rest = tabs.filter((t) => t !== path);
  return { tabs: rest, next: rest[Math.min(i, rest.length - 1)] ?? null };
}

// Renomeado ou movido: a aba dele (e as dos arquivos de dentro, se for pasta) seguem o nome novo.
export const renamedTabs = (tabs: readonly string[], from: string, to: string): readonly string[] =>
  tabs.map((t) => (inside(t, from) ? to + t.slice(from.length) : t));

export const deletedTabs = (tabs: readonly string[], path: string): readonly string[] => tabs.filter((t) => !inside(t, path));

const store = createStore<Tabs>(new Map());

const update = (root: string, change: (tabs: readonly string[]) => readonly string[]) =>
  store.set((all) => {
    const before = all.get(root) ?? EMPTY;
    const after = change(before);
    if (after === before) return all;
    const next = new Map(all);
    if (after.length) next.set(root, after);
    else next.delete(root);
    return next;
  });

export const openTab = (root: string, path: string) => update(root, (tabs) => withTab(tabs, path));
export const renameTabs = (root: string, from: string, to: string) => update(root, (tabs) => renamedTabs(tabs, from, to));
export const deleteTabs = (root: string, path: string) => update(root, (tabs) => deletedTabs(tabs, path));

// Fecha a aba e devolve qual abrir no lugar (null: nenhuma sobrou).
export function closeTab(root: string, path: string): string | null {
  const { tabs, next } = withoutTab(store.get().get(root) ?? EMPTY, path);
  update(root, () => tabs);
  return next;
}

export const closeOtherTabs = (root: string, keep: string) => update(root, (tabs) => tabs.filter((t) => t === keep));

export const useTabs = (root: string): readonly string[] => useStore(store, (all) => all.get(root) ?? EMPTY);
