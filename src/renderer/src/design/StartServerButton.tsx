import { useState } from 'react'
import { Play } from 'lucide-react'
import { startProjectServer } from '../devServers/projectServers'
import { Button } from '../ui/Button'
import type { ButtonVariant } from '../ui/buttonStyles'

// Inicia o servidor do projeto sem abrir o navegador (a página fica no drawer). Travado enquanto
// inicia: dois cliques seguidos subiam o comando duas vezes.
export function StartServerButton({
  projectPath,
  command,
  retry,
  variant
}: {
  projectPath: string
  // O comando que roda (aparece ao passar o mouse).
  command: string | null
  // Já tentou e o servidor parou com erro.
  retry: boolean
  variant: ButtonVariant
}) {
  const [starting, setStarting] = useState(false)
  const start = () => {
    if (starting) return
    setStarting(true)
    void startProjectServer(projectPath, true)
      .catch((err: unknown) => console.error('[design] iniciar o servidor:', err))
      .finally(() => setStarting(false))
  }
  return (
    <Button variant={variant} disabled={starting} onClick={start} title={command ?? undefined}>
      <Play size={11} />
      {retry ? 'Tentar de novo' : 'Iniciar o servidor'}
    </Button>
  )
}
