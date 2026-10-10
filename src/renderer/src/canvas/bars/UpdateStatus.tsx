import { CircleArrowUp } from 'lucide-react'
import type { UpdateProgress } from './updateProgress'

// Canto direito da barra de título: "Atualizar para…" com a versão nova pronta, o andamento da
// conferência e a versão em uso.
export function UpdateStatus({ version, ready, progress }: UpdateProgress & { version: string }) {
  return (
    <>
      {ready && (
        <button
          onClick={() => window.api.updates.install()}
          title={`Reinicia o Argus na versão ${ready}`}
          className="no-drag flex items-center gap-1.5 rounded-md border border-line bg-fill px-2.5 py-0.5 text-[12px] text-text hover:bg-surface-2"
        >
          <CircleArrowUp size={12} className="text-running" />
          Atualizar para {ready}
        </button>
      )}
      {progress && <span className="text-[12px] tabular-nums text-faint">{progress}</span>}
      <span className="text-[12px] tabular-nums text-faint">v{version}</span>
    </>
  )
}
