import { memo, useCallback, useEffect } from 'react';
import { CodeExplorer } from '../../code/CodeExplorer';
import { FileViewer } from '../../code/FileViewer';
import { closeOtherTabs, closeTab, deleteTabs, openTab, renameTabs } from '../../code/tabs/openTabs';
import { FileTabs } from '../../code/tabs/FileTabs';
import type { LineRange } from '../../conversation/fileLinks';
import type { OpenFile } from './drawerState';
import type { DrawerCommands } from './useDrawers';

type Props = {
  root: string
  name: string
  file: OpenFile | null
  // Espaço ocupado pelos drawers à direita (drawerLayout).
  rightOffset: number | string
  commands: DrawerCommands
  // Campo da conversa que recebe a seleção do editor; nulo: nenhuma conversa desta pasta à vista.
  askKey: string | null
};

// Painel de código da pasta do drawer (ou da conversa do canvas que pediu), com o arquivo aberto
// ao lado da árvore.
function CodePanelView({ root, name, file, rightOffset, commands, askKey }: Props) {
  const onOpenFile = useCallback((path: string, lines?: LineRange) => commands.selectFile(root, path, lines), [commands, root]);
  const onRenamed = useCallback(
    (from: string, to: string) => {
      renameTabs(root, from, to);
      commands.renamedFile(root, from, to);
    },
    [commands, root],
  );
  const onDeleted = useCallback(
    (path: string) => {
      deleteTabs(root, path);
      commands.deletedFile(root, path);
    },
    [commands, root],
  );
  const shown = file?.root === root ? file : null;
  // Todo arquivo aberto (pela árvore, pela busca ou por um link do chat) ganha uma aba.
  const shownPath = shown?.path;
  useEffect(() => {
    if (shownPath) openTab(root, shownPath);
  }, [root, shownPath]);

  // Fechar a aba à vista abre a vizinha; sem nenhuma, volta para a árvore.
  const onCloseTab = (path: string) => {
    const next = closeTab(root, path);
    if (path !== shownPath) return;
    if (next) commands.selectFile(root, next);
    else commands.closeFile();
  };
  const onCloseOthers = (path: string) => {
    closeOtherTabs(root, path);
    if (path !== shownPath) commands.selectFile(root, path);
  };

  return (
    <CodeExplorer
      root={root}
      name={name}
      selected={shown ? shown.path : null}
      rightOffset={rightOffset}
      onOpenFile={onOpenFile}
      onRenamed={onRenamed}
      onDeleted={onDeleted}
      onClose={commands.closeCode}
    >
      {shown && (
        <div className="flex min-w-0 flex-1 flex-col">
          <FileTabs root={root} active={shown.path} onSelect={onOpenFile} onClose={onCloseTab} onCloseOthers={onCloseOthers} />
          <FileViewer
          // Outro arquivo começa do zero (rolagem, recargas); o mesmo só recarrega.
          key={`${shown.root}|${shown.path}`}
          root={shown.root}
          path={shown.path}
          lines={shown.lines}
          diff={!!shown.diff}
          onDiffChange={commands.setFileDiff}
          onClose={commands.closeFile}
          onCloseCode={commands.closeCode}
          askKey={askKey}
          onDeleted={() => onDeleted(shown.path)}
          />
        </div>
      )}
    </CodeExplorer>
  );
}

export const CodePanel = memo(CodePanelView);
