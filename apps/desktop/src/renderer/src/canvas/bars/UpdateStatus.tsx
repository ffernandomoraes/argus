import { CircleArrowUp } from 'lucide-react';
import { tr } from '../../i18n';
import type { UpdateProgress } from './updateProgress';
import { installUpdate } from '../../updates/installUpdate';

// Canto direito da barra de título: "Nova versão disponível" quando há versão nova pronta, o andamento da
// conferência e a versão em uso.
export function UpdateStatus({ version, ready, progress }: UpdateProgress & { version: string }) {
  return (
    <>
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
