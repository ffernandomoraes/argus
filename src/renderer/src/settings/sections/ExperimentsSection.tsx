import { Group, Row, Switch } from '../controls'
import { setPreferences, usePreference } from '../preferences'
import { tr } from '../../i18n'

// Coisas em teste ou só por diversão. Tudo aqui vem desligado.
export function ExperimentsSection() {
  const mascot = usePreference('mascot')
  const orchestrator = usePreference('orchestratorEnabled')
  const multiAgents = usePreference('multiAgents')
  const designMode = usePreference('designMode')
  const worktrees = usePreference('worktrees')
  return (
    <Group>
      <Row
        label={tr('Mascote', 'Mascot')}
        description={tr(
          'Um bonequinho no canto do canvas que reage às conversas: chicoteia no envio, dança enquanto trabalham, faz joia no fim. Arraste para mudar o lugar dele; dois cliques voltam ao canto.',
          'A little character at the edge of the canvas that reacts to chats: cracks the whip on send, dances while they work, thumbs up at the end. Drag to move it; double-click sends it back to the corner.'
        )}
      >
        <Switch label={tr('Mascote', 'Mascot')} checked={mascot} onChange={(next) => setPreferences({ mascot: next })} />
      </Row>
      <Row
        label={tr('Orquestrador', 'Orchestrator')}
        description={tr(
          'Na conversa em que for ligado, não executa: divide o pedido em etapas e manda cada uma ao modelo e esforço que ela pede. Liga o item no seletor de modelo e a aba Orquestrador, onde ficam as regras.',
          'In the chat where it’s on, it doesn’t do the work: splits the request into steps and sends each to the model and effort it needs. Enables the item in the model picker and the Orchestrator tab, where the rules live.'
        )}
      >
        <Switch label={tr('Orquestrador', 'Orchestrator')} checked={orchestrator} onChange={(next) => setPreferences({ orchestratorEnabled: next })} />
      </Row>
      <Row
        label={tr('Codex, Gemini e Cursor', 'Codex, Gemini and Cursor')}
        description={tr(
          'Outros agentes além do Claude, cada um com as próprias contas. Liga as seções deles em Contas.',
          'Other agents besides Claude, each with its own accounts. Turns on their sections in Accounts.'
        )}
      >
        <Switch label={tr('Codex, Gemini e Cursor', 'Codex, Gemini and Cursor')} checked={multiAgents} onChange={(next) => setPreferences({ multiAgents: next })} />
      </Row>
      <Row
        label={tr('Modo design', 'Design mode')}
        description={tr(
          'Protótipos de tela no código do projeto, com a página do servidor de desenvolvimento ao lado do chat. Liga o "Novo design" no menu da pasta e os designs na lista dela.',
          'Screen prototypes in the project’s code, with the dev server page next to the chat. Turns on "New design" in the folder menu and the designs in its list.'
        )}
      >
        <Switch label={tr('Modo design', 'Design mode')} checked={designMode} onChange={(next) => setPreferences({ designMode: next })} />
      </Row>
      <Row
        label={tr('Tarefas em paralelo (worktrees)', 'Parallel tasks (worktrees)')}
        description={tr(
          'Várias tarefas no mesmo projeto ao mesmo tempo, sem uma mexer nos arquivos da outra: cada uma ganha uma cópia da pasta (git worktree) e uma branch própria, num card ligado à pasta. Liga o "Nova tarefa em paralelo" no menu da pasta.',
          'Several tasks in the same project at once, without one touching the other’s files: each gets its own copy of the folder (git worktree) and branch, in a card linked to the folder. Turns on "New parallel task" in the folder menu.'
        )}
      >
        <Switch label={tr('Tarefas em paralelo', 'Parallel tasks')} checked={worktrees} onChange={(next) => setPreferences({ worktrees: next })} />
      </Row>
    </Group>
  )
}
