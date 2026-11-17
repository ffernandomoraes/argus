import type { FileEntry } from '@argus/shared/files';
import type { ConfirmRequest } from '../../canvas/ConfirmDialog';
import { tr } from '../../i18n';
import { HOST_IS_MAC, HOST_IS_WIN, isWslFolder } from '../../platform';
import { outermost } from './treePaths';

// A Lixeira do Windows abre direto da Área de Trabalho; a do Mac, pelo Finder.
// Em inglês, a Lixeira tem nome diferente em cada sistema.
const TRASH = HOST_IS_WIN ? 'Recycle Bin' : 'Trash';
const RECOVER = HOST_IS_MAC
  ? tr('Dá para recuperar pelo Finder.', 'You can restore it from the Finder.')
  : tr('Dá para recuperar pela Lixeira.', `You can restore it from the ${TRASH}.`);
// Pasta do WSL não tem Lixeira do Windows: vai para a do Linux (ver main/wsl/trash.ts).
const WSL_RECOVER = tr('Fica em ~/.local/share/Trash, não na Lixeira do Windows.', 'It stays in ~/.local/share/Trash, not the Windows Recycle Bin.');

function describe(root: string, entries: FileEntry[]): { title: string; description: string } {
  const wsl = isWslFolder(root);
  if (entries.length > 1) {
    return {
      title: tr(`Excluir ${entries.length} itens?`, `Delete ${entries.length} items?`),
      description: wsl
        ? tr(`Vão para a Lixeira do Linux (WSL). ${WSL_RECOVER}`, `They go to the Linux (WSL) Trash. ${WSL_RECOVER}`)
        : tr(`Vão para a Lixeira. ${RECOVER}`, `They go to the ${TRASH}. ${RECOVER}`),
    };
  }
  const [entry] = entries;
  return {
    title: entry.isDir
      ? tr(`Excluir a pasta "${entry.name}"?`, `Delete the folder "${entry.name}"?`)
      : tr(`Excluir o arquivo "${entry.name}"?`, `Delete the file "${entry.name}"?`),
    description: wsl
      ? entry.isDir
        ? tr(`A pasta e tudo o que há dentro dela vão para a Lixeira do Linux (WSL). ${WSL_RECOVER}`, `The folder and everything in it go to the Linux (WSL) Trash. ${WSL_RECOVER}`)
        : tr(`O arquivo vai para a Lixeira do Linux (WSL). ${WSL_RECOVER}`, `The file goes to the Linux (WSL) Trash. ${WSL_RECOVER}`)
      : entry.isDir
        ? tr(`A pasta e tudo o que há dentro dela vão para a Lixeira. ${RECOVER}`, `The folder and everything in it go to the ${TRASH}. ${RECOVER}`)
        : tr(`O arquivo vai para a Lixeira. ${RECOVER}`, `The file goes to the ${TRASH}. ${RECOVER}`),
  };
}

// Confirmação de excluir um ou vários itens da árvore (vão para a Lixeira). Pasta e itens dela
// escolhidos juntos contam uma vez. Nada escolhido: null.
export function deleteRequest(root: string, entries: FileEntry[], onConfirm: (paths: string[]) => void): ConfirmRequest | null {
  const top = outermost(entries.map((e) => e.path));
  const kept = entries.filter((e) => top.includes(e.path));
  if (!kept.length) return null;
  return { ...describe(root, kept), confirmLabel: tr('Mover para a Lixeira', `Move to ${TRASH}`), onConfirm: () => onConfirm(top) };
}
