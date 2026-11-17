import { useEffect, useState } from 'react';
import type { CodeEditorId } from '@argus/shared/files';

export const EDITOR_NAMES: Record<CodeEditorId, string> = { vscode: 'VS Code', cursor: 'Cursor' };

// Pergunta uma vez por janela: instalar um editor com o app aberto aparece ao reabrir.
let asked: Promise<CodeEditorId[]> | null = null;

// VS Code e Cursor instalados neste computador (vazio na janela de acesso remoto).
export function useCodeEditors(): CodeEditorId[] {
  const [editors, setEditors] = useState<CodeEditorId[]>([]);
  useEffect(() => {
    let alive = true;
    asked ??= window.api.files.editors().catch(() => []);
    void asked.then((list) => alive && setEditors(list));
    return () => {
      alive = false;
    };
  }, []);
  return editors;
}
