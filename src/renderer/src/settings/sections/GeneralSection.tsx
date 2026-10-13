import { AppWindow, PanelRight, PictureInPicture2 } from 'lucide-react'
import { Group, Row, Segmented } from '../controls'
import { setPreferences, usePreference } from '../preferences'
import { CliRow } from './CliRow'
import { LanguageRow } from './LanguageRow'
import { MenuBarIconRow } from './MenuBarIconRow'
import { UpdatesRow } from './UpdatesRow'
import { WslRow } from './WslRow'
import { tr } from '../../i18n'

export function GeneralSection() {
  const openIn = usePreference('openIn')
  return (
    <Group>
      <LanguageRow />
      <Row label={tr('Abrir conversas em', 'Open chats in')} description={tr('O que acontece ao clicar numa conversa no canvas.', 'What happens when you click a chat on the canvas.')}>
        <Segmented
          value={openIn}
          onChange={(next) => setPreferences({ openIn: next })}
          options={[
            { value: 'panel', label: tr('Painel lateral', 'Side panel'), icon: <PanelRight size={13} /> },
            { value: 'window', label: tr('Janela separada', 'Separate window'), icon: <AppWindow size={13} /> },
            { value: 'node', label: tr('No canvas', 'On the canvas'), icon: <PictureInPicture2 size={13} /> }
          ]}
        />
      </Row>
      <MenuBarIconRow />
      <CliRow />
      <WslRow />
      <UpdatesRow />
    </Group>
  )
}
