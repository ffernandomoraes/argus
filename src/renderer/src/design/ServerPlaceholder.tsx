import { Code2, Loader2 } from 'lucide-react'
import type { ProjectServer } from '../../../shared/devServers'
import { StartServerButton } from './StartServerButton'
import { tr } from '../i18n'

// O que o placeholder diz sobre o servidor do projeto. O que o Claude está fazendo fica só no chat.
function serverText(server: ProjectServer | null, running: boolean, checking: boolean): string {
  if (!server) return tr('Conferindo o servidor do projeto…', 'Checking the project server…')
  if (checking) return tr('Conferindo quais portas do projeto mostram página…', 'Checking which project ports serve a page…')
  if (server.state !== 'running') {
    if (server.error) return tr(`O servidor do projeto não subiu: ${server.error}`, `The project server did not start: ${server.error}`)
    if (!server.script) return tr('Esta pasta não tem script dev ou start para mostrar a página.', 'This folder has no dev or start script to show the page.')
    return server.state === 'starting'
      ? tr('Subindo o servidor do projeto…', 'Starting the project server…')
      : tr('O servidor do projeto está parado. Inicie para ver a página aqui.', 'The project server is stopped. Start it to see the page here.')
  }
  return running
    ? tr(
        'O Claude está escrevendo a tela no projeto. A página aparece aqui assim que ele disser o endereço dela.',
        'Claude is writing the screen in the project. The page shows up here as soon as it gives its address.'
      )
    : tr('A página aparece aqui pelo servidor do projeto.', 'The page shows up here from the project server.')
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
