import { Group, Row, Switch } from '../controls'
import { setPreferences, usePreference } from '../preferences'
import { tr } from '../../i18n'

// Coisas em teste ou só por diversão. Tudo aqui vem desligado.
export function ExperimentsSection() {
  const mascot = usePreference('mascot')
  const orchestrator = usePreference('orchestratorEnabled')
  const designMode = usePreference('designMode')
  const worktrees = usePreference('worktrees')
  const audioTranscription = usePreference('audioTranscription')
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
        label={tr('Orquestrador', 'Orchestrator')}
        description={tr('Divide o pedido em etapas e delega cada uma a outro agente.', 'Splits the request into steps and delegates each to another agent.')}
        info={tr(
          'Na conversa em que for ligado, não executa: divide o pedido em etapas e manda cada uma ao agente, modelo e esforço que ela pede, de qualquer empresa (Claude, Codex, Gemini, Cursor). Liga o item no seletor de modelo e a aba Orquestrador, onde ficam as regras. Vale para as conversas abertas depois de ligar.',
          'In the chat where it’s on, it doesn’t do the work: splits the request into steps and sends each to the agent, model and effort it needs, from any company (Claude, Codex, Gemini, Cursor). Enables the item in the model picker and the Orchestrator tab, where the rules live. Applies to chats opened after turning it on.'
        )}
      >
        <Switch label={tr('Orquestrador', 'Orchestrator')} checked={orchestrator} onChange={(next) => setPreferences({ orchestratorEnabled: next })} />
      </Row>
      <Row
        label={tr('Modo design', 'Design mode')}
        description={tr('Protótipos de tela no código, com a página ao lado do chat.', 'Screen prototypes in code, with the page next to the chat.')}
        info={tr(
          'Protótipos de tela no código do projeto, com a página do servidor de desenvolvimento ao lado do chat. Liga o "Novo design" no menu da pasta e os designs na lista dela.',
          'Screen prototypes in the project’s code, with the dev server page next to the chat. Turns on "New design" in the folder menu and the designs in its list.'
        )}
      >
        <Switch label={tr('Modo design', 'Design mode')} checked={designMode} onChange={(next) => setPreferences({ designMode: next })} />
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
      <Row
        label={tr('Transcrever áudios anexados', 'Transcribe attached audio')}
        description={tr('Transforma áudio anexado em texto, neste computador.', 'Turns attached audio into text, on this computer.')}
        info={tr(
          'Áudio anexado na conversa (.ogg do WhatsApp, .mp3, .m4a…) é transcrito neste computador, e o texto vai junto da mensagem. Na primeira vez, pede para baixar o modelo de transcrição (~300 MB).',
          'Audio attached to a chat (WhatsApp .ogg, .mp3, .m4a…) is transcribed on this computer, and the text goes with the message. The first time, it asks to download the transcription model (~300 MB).'
        )}
      >
        <Switch
          label={tr('Transcrever áudios anexados', 'Transcribe attached audio')}
          checked={audioTranscription}
          onChange={(next) => setPreferences({ audioTranscription: next })}
        />
      </Row>
    </Group>
  )
}
