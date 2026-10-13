import { Group, Row, Switch } from '../controls'
import { setPreferences, usePreference } from '../preferences'
import { tr } from '../../i18n'

// Coisas em teste ou só por diversão. Tudo aqui vem desligado.
export function ExperimentsSection() {
  const mascot = usePreference('mascot')
  const orchestrator = usePreference('orchestratorEnabled')
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
    </Group>
  )
}
