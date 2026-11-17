import { useEffect, useState, type KeyboardEvent } from 'react';
import type { CodeEditorId } from '@argus/shared/files';
import type { ConfirmRequest } from '../../canvas/ConfirmDialog';
import { refreshNow } from '../../canvas/sessionsStore';
import { sendToComposer } from '../../conversation/composer/composerInbox';
import { tr } from '../../i18n';
import { isMod } from '../../platform';
import { toggleWrap, useWrap } from '../editor/editorPrefs';
import type { useCodeEditor } from '../editor/useCodeEditor';
import type { Kind } from '../tree/treePaths';

type Editor = ReturnType<typeof useCodeEditor>;

type Options = {
  root: string
  path: string
  editor: Editor
  // Mudança do arquivo desde o último commit (cor da árvore); sem: nada a desfazer.
  change: Kind | undefined
  // Campo da conversa que recebe a seleção; nulo: nenhuma conversa desta pasta à vista.
  askKey: string | null
  // O arquivo deixou de existir (arquivo novo desfeito vai para a Lixeira).
  onDeleted: () => void
};

// O que o cabeçalho do arquivo faz além de salvar: mandar as linhas escolhidas para o Claude (⌘L),
// ir para a linha (⌃G), quebra de linha (⌥Z), abrir no VS Code ou no Cursor e desfazer as
// alterações desde o último commit.
export function useFileTools({ root, path, editor, change, askKey, onDeleted }: Options) {
  const wrapped = useWrap();
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  // A quebra de linha vale para todos os arquivos: muda aqui quando muda em qualquer um.
  const ready = !!editor.content?.ok;
  useEffect(() => {
    if (ready) editor.setWrap(wrapped);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- editor muda a cada render
  }, [wrapped, ready]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(id);
  }, [notice]);

  const lines = () => editor.command((view, engine) => engine.selectedLines(view));

  // "arquivo.ts#L10-L20" no campo da conversa, no formato dos links do chat.
  const ask = () => {
    if (!askKey) return setNotice(tr('Abra uma conversa desta pasta para perguntar ao Claude.', 'Open a chat in this folder to ask Claude.'));
    const l = lines();
    const ref = l ? `${path}#L${l.start}${l.end !== l.start ? `-L${l.end}` : ''}` : path;
    if (!sendToComposer(askKey, `${ref} `)) setNotice(tr('A conversa desta pasta não está à vista.', 'This folder’s chat isn’t open.'));
  };

  // Botão sobre a seleção, só com uma conversa desta pasta para receber.
  useEffect(() => {
    if (ready) editor.setMention(askKey ? ask : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ask e editor mudam a cada render; o que importa é a conversa
  }, [ready, askKey]);

  const goToLine = () => editor.command((view, engine) => engine.goToLine(view));

  const openIn = (id: CodeEditorId) => window.api.files.openInEditor(root, path, { editor: id, line: lines()?.start });

  const isNew = change === 'U' || change === 'A';
  const discard = () =>
    setConfirm({
      title: tr('Desfazer as alterações deste arquivo?', 'Discard this file’s changes?'),
      description: isNew
        ? tr('O arquivo não existe no último commit: vai para a Lixeira.', 'The file isn’t in the last commit: it goes to the Trash.')
        : tr('O arquivo volta a ser como no último commit. As alterações feitas depois dele se perdem.', 'The file goes back to the last commit. Changes made since then are lost.'),
      confirmLabel: tr('Desfazer alterações', 'Discard changes'),
      onConfirm: () => {
        void window.api.files.discard(root, path).then((res) => {
          if (!res.ok) return setNotice(res.error);
          refreshNow(root);
          if (isNew) onDeleted();
          else void editor.reloadFromDisk();
        });
      },
    });

  // Atalhos com o foco no arquivo (antes do CodeMirror: no Windows o Ctrl+G dele é "próximo
  // resultado"). Devolve true se tratou a tecla.
  const onKeyDown = (e: KeyboardEvent): boolean => {
    const plain = !e.shiftKey && !e.altKey;
    let run: (() => void) | null = null;
    if (isMod(e) && plain && e.code === 'KeyL') run = ask;
    else if (e.ctrlKey && !e.metaKey && plain && e.code === 'KeyG') run = goToLine;
    else if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyZ') run = toggleWrap;
    if (!run) return false;
    e.preventDefault();
    e.stopPropagation();
    run();
    return true;
  };

  return { wrapped, notice, confirm, closeConfirm: () => setConfirm(null), canDiscard: !!change, canAsk: !!askKey, ask, goToLine, openIn, discard, onKeyDown };
}

export type FileTools = ReturnType<typeof useFileTools>;
