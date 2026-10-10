import { useEffect, useState } from 'react'
import type { FileDiff } from '../../../shared/files'
import { DiffView } from '../conversation/DiffView'

// Mudanças do arquivo desde o último commit. Relê quando o arquivo muda no disco (revision).
export function DiffPane({ root, path, revision }: { root: string; path: string; revision: number }) {
  const [result, setResult] = useState<FileDiff | null>(null)
  useEffect(() => {
    let cancelled = false
    window.api.files.diff(root, path).then(
      (res) => !cancelled && setResult(res),
      (err: unknown) => !cancelled && setResult({ ok: false, error: `Não consegui ler as mudanças: ${String(err)}` })
    )
    return () => {
      cancelled = true
    }
  }, [root, path, revision])

  return (
    <div className="min-h-0 flex-1 overflow-auto select-text">
      {!result && <p className="p-4 text-xs text-faint">Carregando…</p>}
      {result && !result.ok && <p className="p-4 text-xs text-faint">{result.error}</p>}
      {result?.ok && result.hunks.length === 0 && <p className="p-4 text-xs text-faint">Sem mudanças desde o último commit.</p>}
      {result?.ok && result.hunks.length > 0 && <DiffView hunks={result.hunks} full />}
    </div>
  )
}
