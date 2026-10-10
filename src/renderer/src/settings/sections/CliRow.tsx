import { useEffect, useState } from 'react'
import type { CliStatus } from '../../../../shared/cli'
import { Button } from '../../ui/Button'
import { Row } from '../controls'

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
      label="Comando argus no terminal"
      description={`Digite "argus ." em qualquer terminal para abrir a pasta no canvas. Nos terminais do app ele já funciona sem instalar.${note ? ` ${note}` : ''}`}
    >
      {status && (
        <Button
          disabled={busy || !!status.error}
          onClick={() => run(status.installed ? window.api.cli.uninstall : window.api.cli.install)}
        >
          {status.installed ? 'Remover' : 'Instalar'}
        </Button>
      )}
    </Row>
  )
}
