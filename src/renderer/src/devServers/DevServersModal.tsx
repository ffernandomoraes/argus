import { useState } from 'react'
import { ExternalLink, Lock, Power, Server } from 'lucide-react'
import { baseName, tildify } from '../platform'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { ModalCloseButton } from '../ui/ModalCloseButton'
import { useDevServers } from './useDevServers'
import { tr } from '../i18n'

const LOCK_REASON = tr(
  'Aberto por uma sessão do Claude Code: encerrar derrubaria a sessão',
  'Opened by a Claude Code session: stopping it would end the session'
)

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
  const [killing, setKilling] = useState<ReadonlySet<number>>(new Set())

  const kill = (pgid: number) => {
    setKilling((s) => new Set(s).add(pgid))
    void killGroup(pgid)
      .then(() => refresh())
      .catch((err: unknown) => console.error('[servidores] encerrar:', err))
      .finally(() =>
        setKilling((s) => {
          const next = new Set(s)
          next.delete(pgid)
          return next
        })
      )
  }

  return (
    <Modal label={tr('Servidores rodando', 'Running servers')} size="md" className="flex flex-col" onClose={onClose}>
      <header className="flex items-start gap-3 border-b border-line px-5 py-3">
        <Server size={15} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{tr('Servidores rodando', 'Running servers')}</div>
          <div className="mt-0.5 truncate text-[12px] text-faint">
            {tr('Portas abertas pelo Claude Code, pelo play ou dentro das pastas do canvas', 'Ports opened by Claude Code, by play or inside canvas folders')}
          </div>
        </div>
        <ModalCloseButton />
      </header>

      {loaded && servers.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">{tr('Nenhum servidor rodando.', 'No servers running.')}</p>
      ) : (
        <ul className="flex flex-col gap-1 overflow-y-auto p-3">
          {servers.map((s) => (
            <li key={`${s.pid}:${s.port}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-sm text-text">{s.appName ?? folderName(s.cwd)}</span>
                  {s.current && <span className="shrink-0 text-xs text-muted">{tr('(este app)', '(this app)')}</span>}
                  <span className="shrink-0 font-mono text-xs text-muted">:{s.port}</span>
                </div>
                <MiddlePath path={tildify(s.cwd)} />
                <div className="truncate font-mono text-[12px] text-faint" title={s.command}>
                  {s.command}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="sm" onClick={() => window.open(`http://localhost:${s.port}`)} title={tr(`Abrir localhost:${s.port} no navegador`, `Open localhost:${s.port} in the browser`)}>
                  <ExternalLink size={12} />
                  {tr('Abrir', 'Open')}
                </Button>
                {s.locked ? (
                  <span
                    title={LOCK_REASON}
                    className="flex shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs text-faint"
                  >
                    <Lock size={12} />
                    {tr('Travado', 'Locked')}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    danger
                    onClick={() => kill(s.pgid)}
                    disabled={killing.has(s.pgid)}
                    title={s.current ? tr('Encerrar o processo: fecha este app', 'Stop the process: closes this app') : tr('Encerrar o processo', 'Stop the process')}
                    className="disabled:animate-pulse"
                  >
                    <Power size={12} />
                    {killing.has(s.pgid) ? tr('Encerrando', 'Stopping') : tr('Encerrar', 'Stop')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
