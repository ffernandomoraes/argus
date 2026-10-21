import { Code2, Terminal } from 'lucide-react'
import { tr } from '../../i18n'

// Quadrado, só com o ícone; o nome vai no title e no leitor de tela.
const toggleClass = (on: boolean) => `flex size-7 shrink-0 items-center justify-center rounded-md text-faint ${on ? 'bg-surface-2 text-text' : 'hover:bg-surface-2 hover:text-text'}`

// Botões do código e do terminal, à direita da linha em cima da caixa de escrever, só com o ícone.
// Iguais no drawer e na conversa do canvas. Sem onToggleCode, o do código não aparece.
export function CodeTerminalButtons({
  codeOpen,
  onToggleCode,
  terminalOpen,
  onToggleTerminal
}: {
  codeOpen: boolean
  onToggleCode?: () => void
  terminalOpen: boolean
  onToggleTerminal: () => void
}) {
  const codeLabel = codeOpen ? tr('Fechar código', 'Close code') : tr('Código', 'Code')
  const terminalLabel = terminalOpen ? tr('Fechar terminal', 'Close terminal') : tr('Terminal', 'Terminal')
  return (
    <div className="flex shrink-0 items-center gap-1">
      {onToggleCode && (
        <button aria-pressed={codeOpen} aria-label={codeLabel} title={codeLabel} onClick={onToggleCode} className={toggleClass(codeOpen)}>
          <Code2 size={16} />
        </button>
      )}
      <button aria-pressed={terminalOpen} aria-label={terminalLabel} title={terminalLabel} onClick={onToggleTerminal} className={toggleClass(terminalOpen)}>
        <Terminal size={16} />
      </button>
    </div>
  )
}
