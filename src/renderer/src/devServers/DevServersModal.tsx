import { useState } from 'react'
import { ExternalLink, Lock, Power, Server, X } from 'lucide-react'
import { useDevServers } from './useDevServers'
import { useEscape } from '../useEscape'
import { baseName, tildify } from '../platform'

const LOCK_REASON = 'Aberto por uma sessão do Claude Code: encerrar derrubaria a sessão'

const folderName = (cwd: string) => baseName(cwd) || cwd

// Caminho longo em uma linha só: corta no meio e deixa o começo e a última pasta à vista.
function MiddlePath({ path }: { path: string }) {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1
  return (
    <div className="mt-0.5 flex min-w-0 font-mono text-[12px] text-faint" title={path}>
      <span className="truncate">{path.slice(0, cut)}</span>
      <span className="max-w-[70%] shrink-0 truncate">{path.slice(cut)}</span>
    </div>
  )
}

// Servidores locais que o Claude Code ou o play deixou rodando, ou que rodam dentro de uma pasta
// do canvas (`paths`): abrir no navegador ou encerrar.
export function DevServersModal({ paths, onClose }: { paths: string[]; onClose: () => void }) {
  const { servers, loaded, refresh, kill: killGroup } = useDevServers(paths)
  const [killing, setKilling] = useState<Set<number>>(new Set())

  useEscape(onClose)

  const kill = async (pgid: number) => {
    setKilling((s) => new Set(s).add(pgid))
    await killGroup(pgid)
    await refresh()
    setKilling((s) => {
      const next = new Set(s)
      next.delete(pgid)
      return next
    })
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-6 pt-16"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-label="Servidores rodando"
        className="flex max-h-[min(640px,100%)] w-[min(640px,100%)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/50"
      >
        <header className="flex items-start gap-3 border-b border-line px-5 py-3">
          <Server size={15} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">Servidores rodando</div>
            <div className="mt-0.5 truncate text-[12px] text-faint">
              Portas abertas pelo Claude Code, pelo play ou dentro das pastas do canvas
            </div>
          </div>
          <button
            aria-label="Fechar"
            title="Fechar"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
          >
            <X size={15} />
          </button>
        </header>

        {loaded && servers.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">Nenhum servidor rodando.</p>
        ) : (
          <ul className="flex flex-col gap-1 overflow-y-auto p-3">
            {servers.map((s) => (
              <li
                key={`${s.pid}:${s.port}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm text-text">{s.appName ?? folderName(s.cwd)}</span>
                    {s.current && <span className="shrink-0 text-xs text-muted">(este app)</span>}
                    <span className="shrink-0 font-mono text-xs text-muted">:{s.port}</span>
                  </div>
                  <MiddlePath path={tildify(s.cwd)} />
                  <div className="truncate font-mono text-[12px] text-faint" title={s.command}>
                    {s.command}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => window.open(`http://localhost:${s.port}`)}
                    title={`Abrir localhost:${s.port} no navegador`}
                    className="flex shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs text-text hover:bg-surface-2"
                  >
                    <ExternalLink size={12} />
                    Abrir
                  </button>
                  {s.locked ? (
                    <span
                      title={LOCK_REASON}
                      className="flex shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs text-faint"
                    >
                      <Lock size={12} />
                      Travado
                    </span>
                  ) : (
                    <button
                      onClick={() => kill(s.pgid)}
                      disabled={killing.has(s.pgid)}
                      title={s.current ? 'Encerrar o processo: fecha este app' : 'Encerrar o processo'}
                      className="flex shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:animate-pulse"
                    >
                      <Power size={12} />
                      {killing.has(s.pgid) ? 'Encerrando' : 'Encerrar'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
