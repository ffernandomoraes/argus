import { useEffect, useState, type KeyboardEvent, type MouseEvent, type RefObject } from 'react';
import type { FileEntry, FileOpResult } from '@argus/shared/files';
import type { ConfirmRequest } from '../../canvas/ConfirmDialog';
import type { MenuState } from '../../canvas/ContextMenu';
import { refreshNow } from '../../canvas/sessionsStore';
import { useStableCallback } from '../../lib/useStableCallback';
import { HOST_IS_WIN, IS_MAC, isMod, SEP, untildify } from '../../platform';
import { moveDrafts } from '../drafts';
import type { Editing } from './FileTree';
import { treeMenu, treeMenuForMany, type TreeMenuActions } from './treeMenu';
import { useCodeEditors } from '../useCodeEditors';
import { useTreeSelection } from './useTreeSelection';
import { deleteRequest } from './treeDelete';
import { dirsUpTo, parentOf } from './treePaths';
import type { FileTree } from './useFileTree';
import { tr } from '../../i18n';
import { IS_REMOTE } from '../../remote';

// Janela de acesso remoto: a área de transferência do sistema é a deste computador, e os arquivos são
// do outro. Copiar na árvore guarda aqui o que foi copiado, e colar copia direto entre as pastas de
// lá (vale entre árvores e projetos desta janela).
let remoteCopied: { root: string; rels: string[] } | null = null;

type Options = {
  root: string
  tree: FileTree
  // Arquivo aberto (também por um link do chat): fica marcado na árvore.
  selected: string | null
  // A árvore volta a ter o foco depois de excluir ou cancelar um nome.
  treeRef: RefObject<HTMLDivElement | null>
  onOpenFile: (path: string) => void
  onRenamed: (from: string, to: string) => void
  onDeleted: (path: string) => void
};

// O que dá para fazer na árvore: criar, renomear, excluir (vai para a Lixeira), copiar e colar,
// inclusive arquivos copiados no Finder; pelo botão direito, pelos ícones do cabeçalho ou atalhos.
export function useTreeActions({ root, tree, selected, treeRef, onOpenFile, onRenamed, onDeleted }: Options) {
  const picked = useTreeSelection(tree, selected);
  const { focused, setFocused } = picked;
  const [editing, setEditing] = useState<Editing | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editors = useCodeEditors();

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(id);
  }, [error]);

  // Pasta onde criar ou colar: a pasta em foco, ou a pasta do arquivo em foco, ou a raiz.
  const targetDir = (path: string | null) => (path === null ? '' : tree.isDir(path) ? path : parentOf(path));

  const done = (res: FileOpResult) => {
    if (!res.ok) setError(res.error);
    else refreshNow(root);
    return res.ok ? res.path : null;
  };

  const startCreate = (dir: string, isDir: boolean) => {
    tree.expand(dir);
    setEditing({ kind: 'create', dir, isDir });
  };

  const submitEdit = async (value: string) => {
    const current = editing;
    setEditing(null);
    if (!current) return;
    if (current.kind === 'create') {
      const path = done(await window.api.files.create(root, current.dir, value, current.isDir));
      if (path === null) return;
      // Nome com subpastas ("src/novo.ts"): abre o caminho até o item criado.
      for (const dir of dirsUpTo(path, current.dir)) tree.expand(dir);
      tree.load(current.dir);
      setFocused(path);
      if (!current.isDir) onOpenFile(path);
    } else {
      const path = done(await window.api.files.rename(root, current.path, value));
      if (path === null) return;
      moveDrafts(root, current.path, path);
      tree.renameDirs(current.path, path);
      tree.load(parentOf(current.path));
      setFocused(path);
      onRenamed(current.path, path);
    }
  };

  const trashAll = async (paths: string[]) => {
    for (const path of paths) {
      if (done(await window.api.files.trash(root, path)) === null) break;
      moveDrafts(root, path, null);
      tree.forgetDirs(path);
      onDeleted(path);
    }
    tree.reloadAll();
    setFocused(null);
    treeRef.current?.focus();
  };
  const askDelete = (entries: FileEntry[]) => {
    const request = deleteRequest(root, entries, (paths) => void trashAll(paths));
    if (request) setConfirm(request);
  };

  const paste = async (dir: string) => {
    const path = done(
      !IS_REMOTE
        ? await window.api.files.paste(root, dir)
        : remoteCopied
          ? await window.api.files.copyInto(remoteCopied.root, remoteCopied.rels, root, dir)
          : { ok: false, error: tr('Nada copiado para colar. Copie arquivos aqui na árvore.', 'Nothing to paste. Copy files here in the tree.') },
    );
    if (path === null) return;
    tree.expand(dir);
    tree.load(dir);
    setFocused(path);
  };

  const menuActions: TreeMenuActions = {
    create: startCreate,
    copy: (paths) => (IS_REMOTE ? void (remoteCopied = { root, rels: paths }) : void window.api.files.copy(root, paths)),
    paste: (dir) => void paste(dir),
    copyPath: (path) => void navigator.clipboard.writeText(path),
    // Pasta do projeto + caminho da árvore, com as barras do sistema ("~/proj" vira o caminho completo).
    copyAbsolutePath: (path) =>
      void navigator.clipboard.writeText(untildify(root).replace(/[\\/]+$/, '') + SEP + (HOST_IS_WIN ? path.replace(/\//g, '\\') : path)),
    rename: (path) => setEditing({ kind: 'rename', path }),
    reveal: (path) => window.api.files.reveal(root, path),
    openInBrowser: (path) => window.api.files.openInBrowser(root, path),
    remove: askDelete,
    editors,
    openInEditor: (path, editor) => window.api.files.openInEditor(root, path, { editor }),
  };

  const openMenu = (e: MouseEvent, entry: FileEntry | null) => {
    e.preventDefault();
    e.stopPropagation();
    picked.pick(entry?.path ?? null);
    // Num item da seleção com vários escolhidos, o menu vale para todos.
    const many = entry && picked.selection.has(entry.path) && picked.selection.size > 1 ? picked.chosen() : null;
    setMenu({ x: e.clientX, y: e.clientY, items: many ? treeMenuForMany(many, menuActions) : treeMenu(entry, menuActions) });
  };

  // Atalhos com a árvore em foco: ⌘C copia, ⌘V cola, Enter renomeia, ⌘⌫ exclui. No Windows,
  // Ctrl+C e Ctrl+V, e também o F2 para renomear e o Delete para excluir, como no Explorador.
  // O preventDefault impede que o menu Editar do app trate o mesmo ⌘C / ⌘V.
  const onKeyDown = (e: KeyboardEvent) => {
    if (editing) return;
    const entry = tree.entryOf(focused);
    const chosen = picked.chosen();
    if (isMod(e) && e.key === 'v') {
      e.preventDefault();
      void paste(targetDir(focused));
    } else if (isMod(e) && e.key === 'c' && chosen.length) {
      e.preventDefault();
      menuActions.copy(chosen.map((c) => c.path));
    } else if ((e.key === 'Enter' || (!IS_MAC && e.key === 'F2')) && entry) {
      e.preventDefault();
      setEditing({ kind: 'rename', path: entry.path });
    } else if ((IS_MAC ? e.metaKey && e.key === 'Backspace' : e.key === 'Delete') && chosen.length) {
      e.preventDefault();
      askDelete(chosen);
    }
  };

  const onItemClick = useStableCallback((entry: FileEntry, e: MouseEvent) => {
    // ⌘-clique e ⇧-clique só escolhem.
    if (!picked.click(entry, e)) return;
    if (!entry.isDir) return onOpenFile(entry.path);
    tree.toggle(entry.path);
  });
  const onItemMenu = useStableCallback(openMenu);
  const onSubmitEdit = useStableCallback((name: string) => void submitEdit(name));
  const onCancelEdit = useStableCallback(() => {
    setEditing(null);
    treeRef.current?.focus();
  });

  return {
    focused,
    setFocused,
    selection: picked.selection,
    setError,
    editing,
    menu,
    closeMenu: () => setMenu(null),
    confirm,
    closeConfirm: () => setConfirm(null),
    error,
    targetDir,
    startCreate,
    openMenu,
    onKeyDown,
    onItemClick,
    onItemMenu,
    onSubmitEdit,
    onCancelEdit,
  };
}
