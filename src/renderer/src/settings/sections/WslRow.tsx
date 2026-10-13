import { useEffect, useState } from 'react'
import { useCopied } from '../../lib/useCopied'
import { IS_WIN } from '../../platform'
import { Button } from '../../ui/Button'
import { Row } from '../controls'

// Windows com WSL: projetos no Linux rodam com o Claude Code de lá. Quando algo não funciona, o
// diagnóstico junta o que o app achou em cada distro e o que pediu ao WSL, para mandar a quem ajuda.
export function WslRow() {
  const [distros, setDistros] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const { copied, copy } = useCopied()
  useEffect(() => {
    if (!IS_WIN) return
    let alive = true
    window.api.wsl.distros().then(
      (d) => alive && setDistros(d),
      (err: unknown) => console.error('[configurações] WSL:', err)
    )
    return () => {
      alive = false
    }
  }, [])

  if (!distros.length) return null
  const run = () => {
    setBusy(true)
    void window.api.wsl
      .diagnostics()
      .then(copy)
      .catch((err: unknown) => console.error('[configurações] diagnóstico do WSL:', err))
      .finally(() => setBusy(false))
  }
  return (
    <Row
      label="Linux (WSL)"
      description={`Pastas do WSL (${distros.join(', ')}) rodam com o Claude Code, o login e o git de lá. Se algo não funcionar, copie o diagnóstico e mande para quem te ajuda.`}
    >
      <Button disabled={busy} onClick={run}>
        {copied ? 'Copiado' : busy ? 'Lendo…' : 'Copiar diagnóstico'}
      </Button>
    </Row>
  )
}
