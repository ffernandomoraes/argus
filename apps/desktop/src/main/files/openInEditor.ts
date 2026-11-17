import { app, shell } from 'electron';
import type { CodeEditorId } from '@argus/shared/files';
import { insideRoot } from '../paths';
import { parseWslPath } from '../wsl';

// Editores que abrem um arquivo numa linha pelo link deles (vscode://file/...:linha), no Mac, no
// Windows e no Linux, sem depender do comando `code` no PATH.
const SCHEMES: Record<CodeEditorId, string> = { vscode: 'vscode', cursor: 'cursor' };

// Os instalados: o sistema conhece o link deles.
export function installedEditors(): CodeEditorId[] {
  return (Object.keys(SCHEMES) as CodeEditorId[]).filter((id) => {
    try {
      return !!app.getApplicationNameForProtocol(`${SCHEMES[id]}://`);
    } catch {
      return false;
    }
  });
}

// O arquivo no editor, na linha pedida. Pasta do WSL: pela extensão de WSL do editor, que abre o
// arquivo do lado do Linux.
export function openInEditor(root: string, rel: string, { editor, line }: { editor: CodeEditorId; line?: number }): void {
  const full = insideRoot(root, rel);
  if (full && SCHEMES[editor]) void shell.openExternal(editorUrl(SCHEMES[editor], full, line));
}

// vscode://file/Users/ana/a.ts:42 no Mac; vscode://file/C:/Users/ana/a.ts:42 no Windows;
// vscode://vscode-remote/wsl+Ubuntu/home/ana/a.ts:42 numa pasta do WSL.
export function editorUrl(scheme: string, full: string, line?: number): string {
  const at = line ? `:${line}` : '';
  const wsl = parseWslPath(full);
  const target = wsl
    ? `vscode-remote/wsl+${encodeURIComponent(wsl.distro)}${encodeURI(wsl.linux)}`
    : `file${encodeURI(full.replace(/\\/g, '/').replace(/^(?=[A-Za-z]:)/, '/'))}`;
  return `${scheme}://${target}${at}`;
}
