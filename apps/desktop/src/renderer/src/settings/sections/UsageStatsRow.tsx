import { useEffect, useState } from 'react'
import { Row, Switch } from '../controls'
import { tr } from '../../i18n'

const LABEL = tr('Enviar dados de uso anônimos', 'Send anonymous usage data')

// Guardada no processo principal: é ele que junta e manda (ver main/telemetry). Vem ligada.
export function UsageStatsRow() {
  const [on, setOn] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    window.api.settings.get().then(
      (s) => alive && setOn(s.usageStats !== false),
      (err: unknown) => console.error('[configurações] dados de uso:', err)
    )
    return () => {
      alive = false
    }
  }, [])

  return (
    <Row
      label={LABEL}
      description={tr(
        'Só números, para entender como o Argus é usado: tempo de uso, conversas criadas, tokens por modelo, sistema e versão. Nunca conversas, arquivos, nomes de pastas ou e-mails.',
        'Numbers only, to understand how Argus is used: usage time, chats created, tokens per model, system and version. Never chats, files, folder names or emails.'
      )}
    >
      {on !== null && (
        <Switch
          label={LABEL}
          checked={on}
          onChange={(next) => {
            setOn(next)
            void window.api.settings.setUsageStats(next)
          }}
        />
      )}
    </Row>
  )
}
