import { Loader2 } from 'lucide-react'
import { useProjectServer } from '../devServers/projectServers'
import { appLabel } from './address/projectApps'
import { StartServerButton } from './StartServerButton'

// O servidor do projeto à vista, com o botão de iniciar quando está parado: a página só aparece com
// ele rodando.
export function ServerStatus({ projectPath }: { projectPath: string }) {
  const server = useProjectServer(projectPath)
  if (!server) return <p className="text-[12px] text-faint">Conferindo o servidor do projeto…</p>
  if (server.state === 'running')
    return (
      <p className="flex items-center gap-1.5 text-[12px] text-muted">
        <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" />
        Servidor rodando: {(server.apps?.length ? server.apps.map(appLabel) : server.ports.map((p) => `localhost:${p}`)).join(', ')}
      </p>
    )
  if (server.state === 'starting')
    return (
      <p className="flex items-center gap-1.5 text-[12px] text-muted">
        <Loader2 size={12} className="shrink-0 animate-spin" />
        Iniciando o servidor ({server.command})…
      </p>
    )
  if (!server.script) return <p className="text-[12px] text-red-400">Esta pasta não tem script dev ou start para mostrar a página.</p>
  return (
    <div className="flex w-full items-center justify-center gap-2">
      <p className={`min-w-0 truncate text-[12px] ${server.error ? 'text-red-400' : 'text-muted'}`} title={server.error}>
        {server.error ? `O servidor não subiu: ${server.error}` : 'O servidor do projeto está parado.'}
      </p>
      <StartServerButton projectPath={projectPath} command={server.command} retry={!!server.error} variant="secondary" />
    </div>
  )
}
