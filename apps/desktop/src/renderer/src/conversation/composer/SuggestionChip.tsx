import { useState } from 'react'
import { tr } from '../../i18n'

// Próxima mensagem que o Claude Code prevê ao fim do pedido ("Sim, pode seguir"), no pé da conversa,
// em cima da linha que separa a caixa de escrever: um clique envia como mensagem sua. Na cor do
// grupo da pasta, como as perguntas e permissões (ver askColors), ou cinza sem grupo; o texto fica
// na cor normal, legível também nos grupos de cor clara. Entra e sai com fade, e o espaço abre e
// fecha junto (grid de 0fr a 1fr): a caixa de escrever desliza em vez de pular no fim.
export function SuggestionChip({ text, visible, onSend }: { text?: string; visible: boolean; onSend: (text: string) => void }) {
  // Último texto mostrado: é ele que fica na tela enquanto o balão some.
  const [last, setLast] = useState(text)
  if (text && text !== last) setLast(text)
  const shown = visible && !!text

  return (
    <div
      inert={!shown}
      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${shown ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
    >
      <div className="min-h-0 overflow-hidden">
        {last && (
          <div className="flex items-center gap-1.5 px-4 pb-2">
            <span className="shrink-0 text-xs text-faint">{tr('Sugestão:', 'Suggestion:')}</span>
            <button
              onClick={() => onSend(last)}
              title={tr(`Enviar: ${last}`, `Send: ${last}`)}
              className="flex h-6 min-w-0 max-w-full items-center rounded-md bg-suggest/15 px-2 text-xs text-text hover:bg-suggest/25"
            >
              <span className="truncate">{last}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
