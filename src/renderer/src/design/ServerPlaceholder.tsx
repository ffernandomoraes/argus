import { Code2, Loader2 } from 'lucide-react'
import type { ProjectServer } from '../../../shared/devServers'
import { StartServerButton } from './StartServerButton'

// O que o placeholder diz sobre o servidor do projeto. O que o Claude está fazendo fica só no chat.
function serverText(server: ProjectServer | null, running: boolean, checking: boolean): string {
  if (!server) return 'Conferindo o servidor do projeto…'
  if (checking) return 'Conferindo quais portas do projeto mostram página…'
  if (server.state !== 'running') {
    if (server.error) return `O servidor do projeto não subiu: ${server.error}`
    if (!server.script) return 'Esta pasta não tem script dev ou start para mostrar a página.'
    return server.state === 'starting' ? 'Subindo o servidor do projeto…' : 'O servidor do projeto está parado. Inicie para ver a página aqui.'
  }
  return running
    ? 'O Claude está escrevendo a tela no projeto. A página aparece aqui assim que ele disser o endereço dela.'
    : 'A página aparece aqui pelo servidor do projeto.'
}

// No lugar da página enquanto ela não aparece: o servidor do projeto e, parado, o botão de iniciar.
export function ServerPlaceholder({
  projectPath,
  server,
  running,
  checking
}: {
  projectPath: string
  server: ProjectServer | null
  // A conversa trabalhando.
  running: boolean
  checking: boolean
}) {
  const busy = !server || checking || server.state === 'starting' || (running && server.state === 'running')
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
      {busy ? <Loader2 size={20} className="animate-spin text-faint" /> : <Code2 size={20} className="text-faint" />}
      <p className={`max-w-sm text-xs leading-relaxed ${server?.error ? 'text-red-400' : 'text-faint'}`}>{serverText(server, running, checking)}</p>
      {server?.state === 'stopped' && server.script && (
        <StartServerButton
          projectPath={projectPath}
          command={server.command}
          retry={!!server.error}
          variant={server.error ? 'secondary' : 'primary'}
        />
      )}
    </div>
  )
}
