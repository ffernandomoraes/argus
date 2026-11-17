import { useEffect } from 'react';
import { gutterChanges } from './gutterChanges';
import type { useCodeEditor } from './useCodeEditor';

type Editor = ReturnType<typeof useCodeEditor>;

// Marcas do git na margem do arquivo aberto: pedidas ao abrir e de novo quando `refresh` muda (o
// arquivo mudou no disco, foi salvo, ou o git status mudou). Fora de repositório: sem marcas.
export function useGitMarks(root: string, path: string, editor: Editor, refresh: string): void {
  const ready = !!editor.content?.ok;
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    window.api.files.diff(root, path).then(
      (res) => {
        if (!alive) return;
        const changes = res.ok ? gutterChanges(res.hunks) : [];
        editor.command((view, engine) => engine.showGitMarks(view, changes));
      },
      (err: unknown) => console.error('[código] marcas do git:', err),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- editor muda a cada render; o que importa é o arquivo e o refresh
  }, [root, path, ready, refresh]);
}
