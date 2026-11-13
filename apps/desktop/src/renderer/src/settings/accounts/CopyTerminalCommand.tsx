import { Check, Copy } from 'lucide-react'
import { useCopied } from '../../lib/useCopied'
import { Button } from '../../ui/Button'
import { terminalCommand } from './terminalCommand'
import { tr } from '../../i18n'

// Copia o comando que abre o Claude Code com esta conta num terminal fora do app.
export function CopyTerminalCommand({ dir }: { dir: string }) {
  const { copied, copy } = useCopied()
  const command = terminalCommand(dir)
  return (
    <Button title={command} onClick={() => copy(command)}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? tr('Copiado', 'Copied') : tr('Comando para o terminal', 'Terminal command')}
    </Button>
  )
}
