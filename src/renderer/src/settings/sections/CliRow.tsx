import { useEffect, useState } from 'react'
import type { CliStatus } from '../../../../shared/cli'
import { Button } from '../../ui/Button'
import { Row } from '../controls'
import { tr } from '../../i18n'

// `argus .` em qualquer terminal abre a pasta no canvas, como o `code .` do VS Code.
export function CliRow() {
  const [status, setStatus] = useState<CliStatus | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    window.api.cli.status().then(
      (s) => alive && setStatus(s),
      (err: unknown) => console.error('[configurações] comando argus:', err)
    )
    return () => {
      alive = false
    }
  }, [])

  const run = (action: () => Promise<CliStatus>) => {
    setBusy(true)
    void action()
      .then(setStatus)
      .catch((err: unknown) => console.error('[configurações] comando argus:', err))
      .finally(() => setBusy(false))
  }

  const note = status?.error ?? status?.warning
  return (
    <Row
      label={tr('Comando argus no terminal', 'argus command in the terminal')}
      description={tr('"argus ." abre a pasta no canvas.', '"argus ." opens the folder on the canvas.') + (note ? ` ${note}` : '')}
      info={tr(
        'Digite "argus ." em qualquer terminal para abrir a pasta no canvas. Nos terminais do app ele já funciona sem instalar.',
        'Type "argus ." in any terminal to open the folder on the canvas. In the app\'s terminals it already works without installing.'
      )}
    >
      {status && (
        <Button
          disabled={busy || !!status.error}
          onClick={() => run(status.installed ? window.api.cli.uninstall : window.api.cli.install)}
        >
          {status.installed ? tr('Remover', 'Remove') : tr('Instalar', 'Install')}
        </Button>
      )}
    </Row>
  )
}
