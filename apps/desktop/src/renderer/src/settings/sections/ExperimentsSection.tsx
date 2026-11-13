import { Group, Row, Switch } from '../controls'
import { setPreferences, usePreference } from '../preferences'
import { tr } from '../../i18n'

// Coisas em teste ou só por diversão. Tudo aqui vem desligado.
export function ExperimentsSection() {
  const mascot = usePreference('mascot')
  const worktrees = usePreference('worktrees')
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
    </Group>
  )
}
