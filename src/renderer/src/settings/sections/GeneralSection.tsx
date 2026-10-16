import { AppWindow, PanelRight, PictureInPicture2 } from 'lucide-react'
import { Group, Row, Segmented, Switch } from '../controls'
import { setPreferences, usePreference } from '../preferences'
import { ClaudeVersionRow } from './ClaudeVersionRow'
import { CliRow } from './CliRow'
import { LanguageRow } from './LanguageRow'
import { UpdatesRow } from './UpdatesRow'
import { WslRow } from './WslRow'
import { tr } from '../../i18n'

export function GeneralSection() {
  const openIn = usePreference('openIn')
  const mediaPlayer = usePreference('mediaPlayer')
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
      <Row
        label={tr('Player de música', 'Music player')}
        description={tr(
          'Mostra na barra de título o que toca no computador, com tocar/pausar e volume.',
          'Shows what is playing on the computer in the title bar, with play/pause and volume.'
        )}
      >
        <Switch label={tr('Player de música', 'Music player')} checked={mediaPlayer} onChange={(next) => setPreferences({ mediaPlayer: next })} />
      </Row>
      <CliRow />
      <WslRow />
      <UpdatesRow />
      <ClaudeVersionRow />
    </Group>
  )
}
