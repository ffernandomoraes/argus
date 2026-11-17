import { useEffect, useRef } from 'react';
import { File } from 'lucide-react';
import { tr } from '../../i18n';
import { Marked, positionsToRanges } from './Marked';
import type { FileFinder } from './useFileFinder';

// Resultados da busca pelo nome, no lugar da árvore enquanto há algo digitado: nome do arquivo com as
// letras achadas marcadas e a pasta dele, apagada, ao lado.
export function FileFinderList({ finder, onOpen }: { finder: FileFinder; onOpen: (path: string) => void }) {
  const listRef = useRef<HTMLUListElement>(null);
  const { hits, highlight, loading, truncated } = finder;

  // A escolhida pelas setas fica sempre à vista.
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  if (loading) return <p className="px-2 py-1 text-xs text-faint">{tr('Carregando…', 'Loading…')}</p>;
  if (!hits.length) return <p className="px-2 py-1 text-xs text-faint">{tr('Nenhum arquivo com esse nome', 'No file matches that name')}</p>;

  return (
    <ul ref={listRef} role="listbox" aria-label={tr('Arquivos encontrados', 'Matching files')}>
      {hits.map((hit, i) => {
        const nameStart = hit.path.lastIndexOf('/') + 1;
        const selected = i === highlight;
        return (
          <li key={hit.path} role="option" aria-selected={selected}>
            <button
              onClick={() => onOpen(hit.path)}
              onMouseMove={() => !selected && finder.setHighlight(i)}
              title={hit.path}
              className={`flex w-full items-center gap-1.5 rounded-md py-1 pr-2 pl-2 text-left text-xs outline-none ${
                selected ? 'bg-selection text-white [&_*]:text-white' : 'text-muted hover:text-text'
              }`}
            >
              <File size={13} className="shrink-0 text-faint" />
              <span className="shrink-0 text-text">
                <Marked text={hit.path.slice(nameStart)} ranges={positionsToRanges(hit.positions, nameStart)} className="bg-transparent font-semibold text-accent" />
              </span>
              <span className="min-w-0 truncate text-faint">
                <Marked text={hit.path.slice(0, Math.max(0, nameStart - 1))} ranges={positionsToRanges(hit.positions, 0, nameStart - 1)} className="bg-transparent text-muted" />
              </span>
            </button>
          </li>
        );
      })}
      {truncated && (
        <li className="px-2 py-1 text-[12px] text-faint">
          {tr('Projeto grande: a busca olha só os primeiros 50 mil arquivos.', 'Large project: only the first 50,000 files are searched.')}
        </li>
      )}
    </ul>
  );
}
