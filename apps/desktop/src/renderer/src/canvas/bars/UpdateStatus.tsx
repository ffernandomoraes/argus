import { CircleArrowUp } from 'lucide-react';
import { tr } from '../../i18n';
import type { UpdateProgress } from './updateProgress';
import { installUpdate } from '../../updates/installUpdate';
import type { UpdateTrouble as Trouble } from '../../updates/trouble';
import { UpdateTrouble } from '../../updates/UpdateTrouble';

// Canto direito da barra de título: "Nova versão disponível" quando há versão nova pronta, o andamento da
// conferência, o aviso de que não deu para atualizar (um dia ou mais sem funcionar) e a versão em uso.
export function UpdateStatus({ version, ready, progress, trouble }: UpdateProgress & { version: string; trouble: Trouble | null }) {
  return (
    <>
      {trouble && <UpdateTrouble trouble={trouble} version={version} />}
      {ready && (
        <button
          onClick={() => installUpdate()}
          title={tr('Reinicia o Argus na versão mais recente', 'Restarts Argus on the latest version')}
          className="no-drag flex items-center gap-1.5 rounded-md border border-line bg-fill px-2.5 py-0.5 text-[12px] text-text hover:bg-surface-2"
        >
          <CircleArrowUp size={14} className="text-running" />
          {tr('Nova versão disponível', 'New version available')}
        </button>
      )}
      {progress && <span className="text-[12px] tabular-nums text-faint">{progress}</span>}
      <span className="text-[12px] tabular-nums text-faint">v{version}</span>
    </>
  );
}
