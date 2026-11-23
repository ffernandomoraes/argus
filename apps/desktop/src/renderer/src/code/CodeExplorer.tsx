import { useEffect, useEffectEvent, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Folder } from 'lucide-react';
import { ConfirmDialog } from '../canvas/ConfirmDialog';
import { ContextMenu } from '../canvas/ContextMenu';
import { PANEL_BOTTOM, PANEL_TOP } from '../conversation/FloatingPanel';
import { Presence } from '../motion';
import { useEscape } from '../useEscape';
import { CloseCodeButton } from './CloseCodeButton';
import { FileEscapeContext } from './fileEscape';
import { TreeButtons, TreePane } from './tree/TreePane';
import { useFileTree } from './tree/useFileTree';
import { useTreeActions } from './tree/useTreeActions';
import { WidthResizer } from '../ui/WidthResizer';
import { useWidth } from '../ui/widthStore';
import { treeWidth } from './treeWidth';
import type { LineRange } from '../conversation/fileLinks';
import { ExplorerSearch } from './search/ExplorerSearch';
import { useExplorerSearch } from './search/useExplorerSearch';
import { useFileFinder } from './search/useFileFinder';
import { useRevealInTree } from './tree/useRevealInTree';

// Painel de código: árvore de pastas e arquivos do projeto (carregada sob demanda) e, com um
// arquivo aberto, o conteúdo dele ao lado, no mesmo painel, que então se estica até a conversa.
// Na árvore dá para criar, renomear, excluir (vai para a Lixeira), copiar e colar, inclusive
// arquivos copiados no Finder: botão direito, os ícones do cabeçalho ou os atalhos. No alto, a busca
// pelo nome (⌘P) e a aba Buscar, no conteúdo dos arquivos (⇧⌘F).
export function CodeExplorer({
  root,
  name,
  selected,
  rightOffset,
  onOpenFile,
  onRenamed,
  onDeleted,
  onClose,
  children,
}: {
  root: string
  name: string
  selected: string | null
  // Espaço ocupado pelo painel da conversa à direita; vale só com arquivo aberto.
  rightOffset: number | string
  // lines: a linha de um resultado da busca no conteúdo.
  onOpenFile: (path: string, lines?: LineRange) => void
  // Item renomeado ou excluído: o arquivo aberto pode ser ele ou estar dentro dele.
  onRenamed: (from: string, to: string) => void
  onDeleted: (path: string) => void
  onClose: () => void
  // Arquivo aberto (FileViewer), mostrado à direita da árvore.
  children?: ReactNode
}) {
  const treeRef = useRef<HTMLDivElement>(null);
  const width = useWidth(treeWidth);
  const tree = useFileTree(root);
  const actions = useTreeActions({ root, tree, selected, treeRef, onOpenFile, onRenamed, onDeleted });
  // Com arquivo aberto, o Esc fecha só ele (o FileViewer entrega como, ver fileEscape.ts).
  const closeFileRef = useRef<(() => void) | null>(null);
  useEscape(() => (closeFileRef.current ? closeFileRef.current() : onClose()));

  const search = useExplorerSearch();

  const revealInTree = useRevealInTree(tree, treeRef);
  // Aberto pela busca pelo nome: o campo limpa e a árvore mostra onde ele está.
  const openByName = (path: string) => {
    search.setNameQuery('');
    revealInTree(path);
    onOpenFile(path);
  };
  const finder = useFileFinder(root, search.nameQuery, openByName);

  // Todo arquivo aberto (pela aba, por um link do chat, pela busca no conteúdo) aparece na árvore:
  // as pastas até ele abrem e a linha dele rola para a vista. Recolher depois fica como a pessoa deixou.
  const revealSelected = useEffectEvent((path: string) => revealInTree(path));
  useEffect(() => {
    if (selected) revealSelected(selected);
  }, [root, selected]);

  const filesTab = search.tab === 'files';

  return (
    <aside
      // Sem arquivo aberto, o painel acompanha a largura da árvore (arrastada pela borda).
      style={{ top: PANEL_TOP, bottom: PANEL_BOTTOM, ...(children ? { right: rightOffset } : {}) }}
      className="absolute left-2 z-40 flex overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/50"
      onKeyDown={search.onKeyDown}
    >
      <div style={{ width }} className={`relative flex shrink-0 flex-col ${children ? 'border-r border-line' : ''}`}>
        <header className="flex h-12 items-center gap-1 border-b border-line pr-3 pl-3">
          <Folder size={14} className="mr-1 shrink-0 text-muted" />
          <span className="flex-1 truncate text-sm font-medium">{name}</span>
          {/* Com arquivo aberto, o X fica no canto do painel, no cabeçalho do arquivo. */}
          {!children && <CloseCodeButton onClick={onClose} />}
        </header>
        <ExplorerSearch root={root} search={search} finder={finder} onOpenByName={openByName} onOpenFile={onOpenFile} treeButtons={<TreeButtons tree={tree} actions={actions} />} />
        <TreePane root={root} tree={tree} actions={actions} treeRef={treeRef} hidden={!filesTab || finder.active} onRenamed={onRenamed} />
        {actions.error && (
          <p role="alert" className="border-t border-line px-3 py-2 text-[12px] text-red-400">
            {actions.error}
          </p>
        )}
        <WidthResizer width={treeWidth} />
      </div>
      <FileEscapeContext.Provider value={closeFileRef}>{children}</FileEscapeContext.Provider>
      {/* No body: o painel da conversa, na mesma camada e depois no DOM, cobriria os dois. */}
      {createPortal(
        <Presence kind="menu">{actions.menu && <ContextMenu menu={actions.menu} onClose={actions.closeMenu} />}</Presence>,
        document.body,
      )}
      {createPortal(
        <Presence kind="modal">{actions.confirm && <ConfirmDialog request={actions.confirm} onClose={actions.closeConfirm} />}</Presence>,
        document.body,
      )}
    </aside>
  );
}
