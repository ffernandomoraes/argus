import { useEffect, useState } from 'react'
import { useCopied } from '../../lib/useCopied'
import { HOST_IS_WIN } from '../../platform'
import { Button } from '../../ui/Button'
import { Row, Switch } from '../controls'
import { tr } from '../../i18n'

// Windows com WSL: projetos no Linux rodam com o Claude Code de lá. Quando algo não funciona, o
// diagnóstico junta o que o app achou em cada distro e o que pediu ao WSL, para mandar a quem ajuda.
export function WslRow() {
  const [distros, setDistros] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  // O mesmo login do Windows nas pastas do WSL (vem ligado; ver main/wsl/sharedLogin.ts).
  const [shared, setShared] = useState<boolean | null>(null)
  const { copied, copy } = useCopied()
  useEffect(() => {
    if (!HOST_IS_WIN) return
    let alive = true
    window.api.wsl.distros().then(
      (d) => alive && setDistros(d),
      (err: unknown) => console.error('[configurações] WSL:', err)
    )
    window.api.settings.get().then(
      (s) => alive && setShared(s.wslSharedLogin !== false),
      (err: unknown) => console.error('[configurações] login do WSL:', err)
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
  const sharedLabel = tr('Mesmo login no WSL', 'Same sign-in in WSL')
  return (
    <>
      <Row
        label="Linux (WSL)"
        description={tr('Pastas do WSL rodam com as ferramentas de lá.', 'WSL folders run with the tools from there.')}
        info={tr(
          `Pastas do WSL (${distros.join(', ')}) rodam com o Claude Code e o git de lá. Se algo não funcionar, copie o diagnóstico e mande para quem te ajuda.`,
          `WSL folders (${distros.join(', ')}) run with the Claude Code and git from there. If something does not work, copy the diagnostics and send them to whoever is helping you.`
        )}
      >
        <Button disabled={busy} onClick={run}>
          {copied ? tr('Copiado', 'Copied') : busy ? tr('Lendo…', 'Reading…') : tr('Copiar diagnóstico', 'Copy diagnostics')}
        </Button>
      </Row>
      <Row
        label={sharedLabel}
        description={tr(
          'As pastas do WSL usam o mesmo login de cada conta do Windows. Desligado, cada conta entra de novo dentro do WSL.',
          'WSL folders use the same sign-in as each account on Windows. When off, each account signs in again inside WSL.'
        )}
      >
        {shared !== null && (
          <Switch
            label={sharedLabel}
            checked={shared}
            onChange={(next) => {
              setShared(next)
              void window.api.settings.setWslSharedLogin(next)
            }}
          />
        )}
      </Row>
    </>
  )
}
