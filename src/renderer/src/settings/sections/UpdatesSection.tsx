import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Presence } from '../../motion'
import { Button } from '../../ui/Button'
import { ReleaseNotesModal } from '../../updates/ReleaseNotesModal'
import { useUpdates } from '../../updates/useUpdates'
import { Group, Row } from '../controls'
import { ClaudeVersionRow } from './ClaudeVersionRow'
import { UpdatesRow } from './UpdatesRow'
import { tr } from '../../i18n'

export function UpdatesSection() {
  const updates = useUpdates()
  const [notesOpen, setNotesOpen] = useState(false)
  return (
    <Group>
      <UpdatesRow />
      <ClaudeVersionRow />
      <Row label={tr('Novidades', "What's new")} description={tr('O que mudou nas últimas versões do Argus.', 'What changed in the latest Argus versions.')}>
        <Button disabled={!updates} onClick={() => setNotesOpen(true)}>
          {tr('Ver novidades', "See what's new")}
        </Button>
      </Row>
      {/* No body: dentro do modal das configurações, a caixa ficaria cortada por ele. O Esc fecha só
          as novidades, que abriram por último. */}
      {createPortal(
        <Presence kind="modal">{notesOpen && updates && <ReleaseNotesModal current={updates.version} onClose={() => setNotesOpen(false)} />}</Presence>,
        document.body
      )}
    </Group>
  )
}
