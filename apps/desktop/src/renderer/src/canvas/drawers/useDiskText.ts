import { useEffect, useState } from 'react';
import { useFileRevision } from '../../code/editor/useFileRevision';
import { baseName, parentDir } from '../../platform';

// Texto do .md aberto ao lado como está no disco agora, relido a cada mudança (o Claude gravou uma
// versão nova): sem isso, o painel ficava com o texto do cartão que o abriu. Sem caminho, ou sem
// conseguir ler (apagado, caminho do WSL visto pelo Windows), fica o `fallback`, o do cartão.
export function useDiskText(path: string | undefined, fallback: string): string {
  const root = path ? parentDir(path) : '';
  const rel = path ? baseName(path) : '';
  const revision = useFileRevision(root, rel, !!path);
  const [disk, setDisk] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    void window.api.files.read(root, rel).then((content) => {
      if (alive) setDisk(content.ok ? content.text : null);
    });
    return () => {
      alive = false;
    };
  }, [path, root, rel, revision]);

  return path && disk !== null ? disk : fallback;
}
