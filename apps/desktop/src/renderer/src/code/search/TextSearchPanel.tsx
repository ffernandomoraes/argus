import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { CaseSensitive, Loader2, Regex, WholeWord } from 'lucide-react';
import type { TextSearchOptions } from '@argus/shared/files';
import type { LineRange } from '../../conversation/fileLinks';
import { LOCALE, tr } from '../../i18n';
import { IconButton } from '../../ui/IconButton';
import { SearchField } from './SearchField';
import { SearchResults } from './SearchResults';
import { savedSearch, saveSearch } from './searchState';
import { useTextSearch } from './useTextSearch';

const OPTIONS: { key: keyof TextSearchOptions; label: string; icon: ReactNode }[] = [
  { key: 'caseSensitive', label: tr('Diferenciar maiúsculas', 'Match case'), icon: <CaseSensitive size={15} /> },
  { key: 'wholeWord', label: tr('Palavra inteira', 'Match whole word'), icon: <WholeWord size={15} /> },
  { key: 'regex', label: tr('Expressão regular', 'Use regular expression'), icon: <Regex size={14} /> },
];

const count = (n: number) => n.toLocaleString(LOCALE);

// Aba Buscar do painel de código: o texto em todos os arquivos do projeto (como o ⌘⇧F do VS Code),
// com diferenciar maiúsculas, palavra inteira e expressão regular. Respeita o .gitignore.
export function TextSearchPanel({
  root,
  inputRef,
  initialQuery,
  onOpen,
}: {
  root: string
  inputRef: RefObject<HTMLInputElement | null>
  // Texto selecionado quando a busca foi chamada pelo atalho (muda a cada chamada).
  initialQuery: { text: string } | null
  onOpen: (path: string, lines: LineRange) => void
}) {
  const [query, setQuery] = useState(() => savedSearch(root).query);
  const [options, setOptions] = useState(() => savedSearch(root).options);
  const [active, setActive] = useState<string | null>(null);
  const [prevInitial, setPrevInitial] = useState(initialQuery);
  if (prevInitial !== initialQuery) {
    setPrevInitial(initialQuery);
    if (initialQuery?.text) setQuery(initialQuery.text);
  }
  useEffect(() => saveSearch(root, { query, options }), [root, query, options]);
  const { result, searching, rerun } = useTextSearch(root, query, options);

  const open = (path: string, lines: LineRange) => {
    setActive(`${path}:${lines.start}`);
    onOpen(path, lines);
  };

  let status: ReactNode = null;
  if (result && !result.ok) status = <span className="text-red-400">{result.error}</span>;
  else if (result?.ok && query) {
    const files = result.files.length;
    status = result.total
      ? tr(
        `${count(result.total)} ${result.total === 1 ? 'resultado' : 'resultados'} em ${count(files)} ${files === 1 ? 'arquivo' : 'arquivos'}`,
        `${count(result.total)} ${result.total === 1 ? 'result' : 'results'} in ${count(files)} ${files === 1 ? 'file' : 'files'}`,
      ) + (result.truncated ? tr(' - mostrando só os primeiros', ' - showing only the first ones') : '')
      : tr('Nada encontrado', 'No results');
  }

  return (
    <>
      <div className="px-1.5 pt-1.5">
        <SearchField
          inputRef={inputRef}
          value={query}
          onChange={setQuery}
          onEnter={rerun}
          placeholder={tr('Buscar nos arquivos', 'Search in files')}
        >
          {OPTIONS.map((o) => (
            <IconButton
              key={o.key}
              label={o.label}
              size="xs"
              variant="subtle"
              pressed={options[o.key]}
              onClick={() => setOptions((prev) => ({ ...prev, [o.key]: !prev[o.key] }))}
            >
              {o.icon}
            </IconButton>
          ))}
        </SearchField>
        <p className="flex min-h-6 items-center gap-1.5 px-1 py-1 text-[12px] text-faint">
          {searching && <Loader2 size={12} className="shrink-0 animate-spin" />}
          <span className="min-w-0 truncate">{status}</span>
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
        {result?.ok && query && <SearchResults files={result.files} active={active} onOpen={open} />}
      </div>
    </>
  );
}
