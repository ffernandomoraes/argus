import { FolderSearch } from 'lucide-react';
import { IS_REMOTE } from '../../remote';
import { Button } from '../../ui/Button';
import { useCanvasActions } from '../CanvasContext';
import { tr } from '../../i18n';

// Faixa embaixo do cabeçalho do card quando a pasta sumiu (renomeada, movida ou apagada fora do
// Argus): o que aconteceu e o botão para dizer onde ela está agora. No acesso remoto, sem o botão:
// o seletor de pastas abriria no computador errado.
export function MissingFolderStrip({ nodeId }: { nodeId: string }) {
  const { relocateFolder } = useCanvasActions();
  return (
    <div className="flex items-center gap-3 border-t border-line px-3 py-2.5">
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
        {IS_REMOTE
          ? tr('A pasta foi renomeada, movida ou apagada. Localize-a no computador de casa.', 'The folder was renamed, moved or deleted. Locate it on the home computer.')
          : tr('A pasta foi renomeada, movida ou apagada.', 'The folder was renamed, moved or deleted.')}
      </p>
      {!IS_REMOTE && (
        <Button
          size="sm"
          className="nodrag shrink-0"
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
