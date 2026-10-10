import { AppWindow, PanelRight, PictureInPicture2 } from 'lucide-react'
import { Group, Row, Segmented } from '../controls'
import { setPreferences, usePreference } from '../preferences'
import { CliRow } from './CliRow'
import { MenuBarIconRow } from './MenuBarIconRow'
import { UpdatesRow } from './UpdatesRow'

export function GeneralSection() {
  const openIn = usePreference('openIn')
  return (
    <Group>
      <Row label="Abrir conversas em" description="O que acontece ao clicar numa conversa no canvas.">
        <Segmented
          value={openIn}
          onChange={(next) => setPreferences({ openIn: next })}
          options={[
            { value: 'panel', label: 'Painel lateral', icon: <PanelRight size={13} /> },
            { value: 'window', label: 'Janela separada', icon: <AppWindow size={13} /> },
            { value: 'node', label: 'No canvas', icon: <PictureInPicture2 size={13} /> }
          ]}
        />
      </Row>
      <MenuBarIconRow />
      <CliRow />
      <UpdatesRow />
    </Group>
  )
}
