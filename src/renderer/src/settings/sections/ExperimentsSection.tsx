import { Group, Row, Switch } from '../controls'
import { setPreferences, usePreference } from '../preferences'
import { tr } from '../../i18n'
import { IS_REMOTE } from '../../remote'

// Coisas em teste ou só por diversão. Tudo aqui vem desligado.
export function ExperimentsSection() {
  const mascot = usePreference('mascot')
  const worktrees = usePreference('worktrees')
  const remoteAccess = usePreference('remoteAccess')
  return (
    <Group>
      <Row
        label={tr('Mascote', 'Mascot')}
        description={tr('Um bonequinho que reage às suas conversas.', 'A little character that reacts to your chats.')}
        info={tr(
          'Um bonequinho no canvas que reage às conversas: anda até a pasta e dá um golpe no envio, trabalha junto, faz joia no fim. Arraste para qualquer lugar; dois cliques voltam ao canto. Liga a aba Mascote, onde você monta o visual, escolhe o golpe e pode deixá-lo fixo na tela, por cima de qualquer app.',
          'A little character on the canvas that reacts to chats: walks to the folder and strikes on send, works along, thumbs up at the end. Drag it anywhere; double-click sends it back to the corner. Enables the Mascot tab, where you build its look, pick the strike and can pin it on the screen, on top of any app.'
        )}
      >
        <Switch label={tr('Mascote', 'Mascot')} checked={mascot} onChange={(next) => setPreferences({ mascot: next })} />
      </Row>
      <Row
        label={tr('Tarefas em paralelo (worktrees)', 'Parallel tasks (worktrees)')}
        description={tr('Várias tarefas no mesmo projeto, cada uma na sua cópia da pasta.', 'Several tasks in the same project, each in its own copy of the folder.')}
        info={tr(
          'Várias tarefas no mesmo projeto ao mesmo tempo, sem uma mexer nos arquivos da outra: cada uma ganha uma cópia da pasta (git worktree) e uma branch própria, num card ligado à pasta. Liga o "Nova tarefa em paralelo" no menu da pasta.',
          'Several tasks in the same project at once, without one touching the other’s files: each gets its own copy of the folder (git worktree) and branch, in a card linked to the folder. Turns on "New parallel task" in the folder menu.'
        )}
      >
        <Switch label={tr('Tarefas em paralelo', 'Parallel tasks')} checked={worktrees} onChange={(next) => setPreferences({ worktrees: next })} />
      </Row>
      {/* Na janela remota, não: parear e hospedar são da máquina de quem está usando. */}
      {!IS_REMOTE && (
        <Row
          label={tr('Acesso remoto', 'Remote access')}
          description={tr('Use o Argus deste computador de outro, como o notebook do trabalho.', 'Use this computer’s Argus from another one, like your work laptop.')}
          info={tr(
            'Deixe um computador ligado com o Argus e abra ele de outro, com os projetos, conversas e terminais de lá. Os dois pareiam uma vez com um código; depois, a ligação passa pela ponte do Argus na internet, cifrada de ponta a ponta. Liga a aba Acesso remoto. Os dois computadores precisam estar na mesma versão do Argus.',
            'Leave a computer on with Argus and open it from another one, with its projects, chats and terminals. Both pair once with a code; after that, the connection goes through the Argus relay on the internet, end-to-end encrypted. Enables the Remote access tab. Both computers must be on the same Argus version.'
          )}
        >
          <Switch
            label={tr('Acesso remoto', 'Remote access')}
            checked={remoteAccess}
            onChange={(next) => {
              setPreferences({ remoteAccess: next })
              // Desligado o experimento, este computador para de aceitar conexões.
              if (!next) void window.api.remoteAccess.setHosting(false)
            }}
          />
        </Row>
      )}
    </Group>
  )
}
