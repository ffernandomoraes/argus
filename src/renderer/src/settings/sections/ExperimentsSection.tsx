import { Group, Row, Switch } from '../controls'
import { setPreferences, usePreference } from '../preferences'
import { tr } from '../../i18n'

// Coisas em teste ou só por diversão. Tudo aqui vem desligado.
export function ExperimentsSection() {
  const mascot = usePreference('mascot')
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
    </Group>
  )
}
