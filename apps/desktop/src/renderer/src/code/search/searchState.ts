import type { TextSearchOptions } from '@argus/shared/files';

// As duas abas do painel de código: a árvore (com a busca pelo nome) e a busca no conteúdo.
export type ExplorerTab = 'files' | 'search';

export const DEFAULT_OPTIONS: TextSearchOptions = { caseSensitive: false, wholeWord: false, regex: false };

export type SavedSearch = { query: string; options: TextSearchOptions };

// A busca no conteúdo de cada pasta continua lá ao fechar e reabrir o painel, como no VS Code.
// Só enquanto o app está aberto.
const saved = new Map<string, SavedSearch>();

export const savedSearch = (root: string): SavedSearch => saved.get(root) ?? { query: '', options: DEFAULT_OPTIONS };

export const saveSearch = (root: string, search: SavedSearch): void => void saved.set(root, search);

// Texto selecionado no editor (ou em qualquer lugar da janela) para começar a busca, como o ⌘⇧F do
// VS Code. Só uma linha, e curta: um parágrafo inteiro não é o que se quer buscar.
export function selectedText(): string {
  const text = window.getSelection()?.toString() ?? '';
  return text && !text.includes('\n') && text.length <= 200 ? text : '';
}
