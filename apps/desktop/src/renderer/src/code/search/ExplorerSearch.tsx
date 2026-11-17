import type { ReactNode } from 'react';
import type { LineRange } from '../../conversation/fileLinks';
import { tr } from '../../i18n';
import { keys } from '../../platform';
import { ExplorerTabs } from './ExplorerTabs';
import { FileFinderList } from './FileFinderList';
import { SearchField } from './SearchField';
import { TextSearchPanel } from './TextSearchPanel';
import type { useExplorerSearch } from './useExplorerSearch';
import type { FileFinder } from './useFileFinder';

// O alto do painel de código: a barra com as abas Arquivos e Buscar e os botões da árvore, o campo da busca pelo nome (com os
// resultados no lugar da árvore enquanto há algo digitado) e a aba Buscar inteira. A árvore em si
// fica no CodeExplorer.
export function ExplorerSearch({
  root,
  search,
  finder,
  onOpenByName,
  onOpenFile,
  treeButtons,
}: {
  root: string
  search: ReturnType<typeof useExplorerSearch>
  finder: FileFinder
  onOpenByName: (path: string) => void
  onOpenFile: (path: string, lines?: LineRange) => void
  // Botões da árvore (criar, atualizar): só na aba Arquivos.
  treeButtons: ReactNode
}) {
  const filesTab = search.tab === 'files';
  return (
    <>
      <div className="flex flex-col gap-1.5 px-1.5 pt-1.5">
        <ExplorerTabs tab={search.tab} onChange={(tab) => search.show(tab)}>
          {filesTab && treeButtons}
        </ExplorerTabs>
        {filesTab && (
          <SearchField
            inputRef={search.nameRef}
            value={search.nameQuery}
            onChange={search.setNameQuery}
            onKeyDown={finder.onKeyDown}
            placeholder={tr('Buscar arquivo pelo nome', 'Find file by name')}
            hint={keys('⌘P')}
          />
        )}
      </div>
      {/* Fora da árvore: o Enter e o ⌘⌫ dela (renomear, excluir) não valem na lista. */}
      {filesTab && finder.active && (
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          <FileFinderList finder={finder} onOpen={onOpenByName} />
        </div>
      )}
      {/* Fica montada na outra aba: os resultados continuam lá ao voltar. */}
      <div className={filesTab ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
        <TextSearchPanel root={root} inputRef={search.searchRef} initialQuery={search.initialQuery} onOpen={onOpenFile} />
      </div>
    </>
  );
}
