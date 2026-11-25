import { useState } from 'react';
import { FolderSearch, GitBranch } from 'lucide-react';
import { IS_REMOTE } from '../../remote';
import { Button } from '../../ui/Button';
import { useCanvasActions } from '../CanvasContext';
import { tr } from '../../i18n';

// Faixa embaixo do cabeçalho do card quando a pasta sumiu (renomeada, movida ou apagada fora do
// Argus): o que aconteceu e o botão para dizer onde ela está agora. No acesso remoto, sem os botões:
// o seletor de pastas abriria no computador errado.
// imported: o card veio de outro computador pela conta (ver main/account/workspaces.ts); cloneUrl:
// o repositório dele, para clonar aqui em vez de localizar.
export function MissingFolderStrip({ nodeId, imported, cloneUrl }: { nodeId: string; imported?: boolean; cloneUrl?: string }) {
  const { relocateFolder, cloneFolder } = useCanvasActions();
  const [cloning, setCloning] = useState(false);
  const canClone = !IS_REMOTE && imported && !!cloneUrl;
  return (
    <div className="flex items-center gap-3 border-t border-line px-3 py-2.5">
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
        {IS_REMOTE
          ? tr('A pasta foi renomeada, movida ou apagada. Localize-a no computador de casa.', 'The folder was renamed, moved or deleted. Locate it on the home computer.')
          : imported
            ? cloneUrl
              ? tr('Esta pasta veio de outro computador e não foi achada aqui. Clone o repositório ou localize a pasta.', 'This folder came from another computer and was not found here. Clone the repository or locate the folder.')
              : tr('Esta pasta veio de outro computador e não foi achada aqui.', 'This folder came from another computer and was not found here.')
            : tr('A pasta foi renomeada, movida ou apagada.', 'The folder was renamed, moved or deleted.')}
      </p>
      {canClone && (
        <Button
          size="sm"
          variant="primary"
          className="nodrag shrink-0"
          disabled={cloning}
          title={cloneUrl}
          onClick={(e) => {
            e.stopPropagation();
            setCloning(true);
            void cloneFolder(nodeId).finally(() => setCloning(false));
          }}
        >
          <GitBranch size={13} />
          {cloning ? tr('Clonando…', 'Cloning…') : tr('Clonar…', 'Clone…')}
        </Button>
      )}
      {!IS_REMOTE && (
        <Button
          size="sm"
          className="nodrag shrink-0"
          disabled={cloning}
          onClick={(e) => {
            e.stopPropagation();
            relocateFolder(nodeId);
          }}
        >
          <FolderSearch size={13} />
          {tr('Localizar pasta…', 'Locate folder…')}
        </Button>
      )}
    </div>
  );
}
