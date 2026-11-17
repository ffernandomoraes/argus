import { useMemo, type RefObject } from 'react';
import { ChevronsDownUp, FilePlus, FolderPlus, RefreshCw } from 'lucide-react';
import { useUncommitted } from '../../canvas/sessionsStore';
import { tr } from '../../i18n';
import { IconButton } from '../../ui/IconButton';
import { useDraftPaths } from '../drafts';
import { TreeList } from './FileTree';
import { changesInTree } from './treePaths';
import type { FileTree } from './useFileTree';
import type { useTreeActions } from './useTreeActions';
import { useTreeDrag } from './useTreeDrag';

type Actions = ReturnType<typeof useTreeActions>;

// Botões da árvore na barra do alto do painel: criar arquivo e pasta, recolher tudo, atualizar.
export function TreeButtons({ tree, actions }: { tree: FileTree; actions: Actions }) {
  const dir = actions.targetDir(actions.focused);
  return (
    <>
      <IconButton label={tr('Novo arquivo', 'New file')} onClick={() => actions.startCreate(dir, false)}>
        <FilePlus size={14} />
      </IconButton>
      <IconButton label={tr('Nova pasta', 'New folder')} onClick={() => actions.startCreate(dir, true)}>
        <FolderPlus size={14} />
      </IconButton>
      <IconButton label={tr('Recolher pastas', 'Collapse folders')} onClick={tree.collapseAll}>
        <ChevronsDownUp size={14} />
      </IconButton>
      <IconButton label={tr('Atualizar', 'Refresh')} onClick={tree.reloadAll}>
        <RefreshCw size={13} />
      </IconButton>
    </>
  );
}

// A árvore do projeto: as cores do git, os rascunhos, escolher vários itens e arrastar para mover
// (ou soltar arquivos do Finder). Soltar no vazio vai para a raiz.
export function TreePane({
  root,
  tree,
  actions,
  treeRef,
  hidden,
  onRenamed,
}: {
  root: string
  tree: FileTree
  actions: Actions
  treeRef: RefObject<HTMLDivElement | null>
  hidden: boolean
  onRenamed: (from: string, to: string) => void
}) {
  const drafts = useDraftPaths(root);
  const uncommitted = useUncommitted(root);
  const changes = useMemo(() => changesInTree(root, uncommitted), [root, uncommitted]);
  const drag = useTreeDrag({ root, tree, selection: actions.selection, onRenamed, setError: actions.setError });
  const rootEntries = tree.listings[''];

  return (
    <div
      ref={treeRef}
      tabIndex={-1}
      onKeyDown={actions.onKeyDown}
      onContextMenu={(e) => actions.openMenu(e, null)}
      // Clicar no vazio tira o foco do item: criar e colar passam a valer para a raiz.
      onMouseDown={(e) => e.target === e.currentTarget && actions.setFocused(null)}
      onDragOver={(e) => drag.onDragOver(e, null)}
      onDragLeave={drag.onDragLeave}
      onDrop={(e) => drag.onDrop(e, null)}
      onDragEnd={drag.onDragEnd}
      className={`min-h-0 flex-1 overflow-y-auto p-1.5 outline-none ${hidden ? 'hidden' : ''} ${
        drag.dropDir === '' ? 'bg-accent/10 ring-1 ring-inset ring-accent/50' : ''
      }`}
    >
      {!rootEntries && <p className="px-2 py-1 text-xs text-faint">{tr('Carregando…', 'Loading…')}</p>}
      {rootEntries?.length === 0 && !actions.editing && <p className="px-2 py-1 text-xs text-faint">{tr('Pasta vazia ou inexistente', 'Empty or missing folder')}</p>}
      {rootEntries && (
        <TreeList
          dir=""
          entries={rootEntries}
          depth={0}
          listings={tree.listings}
          expanded={tree.expanded}
          selection={actions.selection}
          dropDir={drag.dropDir}
          drafts={drafts}
          changes={changes}
          editing={actions.editing}
          onClick={actions.onItemClick}
          onContextMenu={actions.onItemMenu}
          onDragStart={drag.onDragStart}
          onDragOver={drag.onDragOver}
          onDrop={drag.onDrop}
          onSubmitEdit={actions.onSubmitEdit}
          onCancelEdit={actions.onCancelEdit}
        />
      )}
    </div>
  );
}
