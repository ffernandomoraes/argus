import { useEffect, useRef, useState, type DragEvent } from 'react';
import type { FileEntry, FileOpResult } from '@argus/shared/files';
import { refreshNow } from '../../canvas/sessionsStore';
import { tr } from '../../i18n';
import { useStableCallback } from '../../lib/useStableCallback';
import { IS_REMOTE } from '../../remote';
import { moveDrafts } from '../drafts';
import { movedTo, outermost, parentOf } from './treePaths';
import type { FileTree } from './useFileTree';

// Tipo dos dados de um arrasto que começou na própria árvore (os caminhos, em JSON).
const TREE_MIME = 'application/x-argus-tree';
// Tempo parado em cima de uma pasta fechada até ela abrir, como no Finder.
const OPEN_DELAY = 700;

type Options = {
  root: string
  tree: FileTree
  // Os itens escolhidos: arrastar um deles leva todos.
  selection: ReadonlySet<string>
  onRenamed: (from: string, to: string) => void
  setError: (error: string) => void
};

// Pasta onde o item solto cai: a própria pasta, ou a do arquivo; null = a raiz.
const dropDirOf = (entry: FileEntry | null): string => (entry ? (entry.isDir ? entry.path : parentOf(entry.path)) : '');

// Arrastar na árvore move itens para outra pasta; soltar arquivos do Finder (ou do Explorador)
// copia para a pasta onde caíram. A pasta de destino fica marcada durante o arrasto.
export function useTreeDrag({ root, tree, selection, onRenamed, setError }: Options) {
  const [dropDir, setDropDir] = useState<string | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = null;
  };
  useEffect(() => clearTimer, []);

  const done = (res: FileOpResult): boolean => {
    if (!res.ok) setError(res.error);
    tree.reloadAll();
    refreshNow(root);
    return res.ok;
  };

  const onDragStart = useStableCallback((e: DragEvent, entry: FileEntry) => {
    const paths = selection.has(entry.path) ? outermost(selection) : [entry.path];
    e.dataTransfer.setData(TREE_MIME, JSON.stringify({ root, paths }));
    e.dataTransfer.effectAllowed = 'copyMove';
  });

  const onDragOver = useStableCallback((e: DragEvent, entry: FileEntry | null) => {
    const types = e.dataTransfer.types;
    if (!types.includes(TREE_MIME) && !types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = types.includes(TREE_MIME) ? 'move' : 'copy';
    const dir = dropDirOf(entry);
    if (dir === dropDir) return;
    setDropDir(dir);
    clearTimer();
    if (entry?.isDir && !tree.expanded.has(entry.path)) openTimer.current = setTimeout(() => tree.expand(entry.path), OPEN_DELAY);
  });

  const onDragLeave = useStableCallback((e: DragEvent) => {
    // Saiu da árvore inteira (não só de uma linha para a outra).
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    clearTimer();
    setDropDir(null);
  });

  const moveInside = async (paths: string[], dir: string) => {
    if (!done(await window.api.files.move(root, paths, dir))) return;
    for (const path of paths) {
      const to = movedTo(path, dir);
      if (to === path) continue;
      moveDrafts(root, path, to);
      tree.renameDirs(path, to);
      onRenamed(path, to);
    }
    tree.expand(dir);
  };

  const importFiles = async (files: File[], dir: string) => {
    // Na janela remota os arquivos soltos são deste computador; a pasta é do outro.
    const paths = IS_REMOTE ? [] : files.map((f) => window.api.filePath(f)).filter(Boolean);
    if (!paths.length) return setError(tr('Não consegui ler os arquivos soltos aqui.', 'Couldn’t read the files dropped here.'));
    if (done(await window.api.files.importPaths(paths, root, dir))) tree.expand(dir);
  };

  const onDrop = useStableCallback((e: DragEvent, entry: FileEntry | null) => {
    e.preventDefault();
    e.stopPropagation();
    clearTimer();
    setDropDir(null);
    const dir = dropDirOf(entry);
    const internal = e.dataTransfer.getData(TREE_MIME);
    if (internal) {
      const data = JSON.parse(internal) as { root: string; paths: string[] };
      // De outro projeto (outra janela): não move entre pastas de projetos diferentes.
      if (data.root === root) void moveInside(data.paths, dir);
      return;
    }
    if (e.dataTransfer.files.length) void importFiles([...e.dataTransfer.files], dir);
  });

  // Arrasto cancelado (Esc, ou solto fora da árvore): a marca da pasta sai.
  const onDragEnd = () => {
    clearTimer();
    setDropDir(null);
  };

  return { dropDir, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd };
}

export type TreeDrag = ReturnType<typeof useTreeDrag>;
