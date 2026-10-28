import { Loader2 } from 'lucide-react'
import { ClaudeIcon } from '../../icons/ClaudeIcon'
import { IconTile } from '../../settings/controls'
import { tr } from '../../i18n'

// No lugar das mensagens: o carregando, ou a conversa nova ainda vazia. `empty`: outro texto para a
// conversa vazia (a de um subagente, que só se lê).
export function ChatPlaceholder({ loading, empty }: { loading: boolean; empty?: string }) {
  if (!loading && empty) return <div className="m-auto max-w-72 text-center text-xs leading-relaxed text-faint">{empty}</div>
  if (loading) {
    return (
      <div className="m-auto flex items-center gap-2 text-xs text-faint">
        <Loader2 size={13} className="animate-spin" />
        {tr('Carregando conversa…', 'Loading chat…')}
      </div>
    )
  }
  return (
    <div className="m-auto flex max-w-80 flex-col items-center text-center">
      <IconTile color="#D97757" size={48} soft>
        <ClaudeIcon size={24} />
      </IconTile>
      <p className="mt-4 text-[15px] font-semibold text-text">{tr('Nova conversa', 'New chat')}</p>
      {/* Como escrever já está na caixa de baixo; aqui, o que dá para pedir. */}
      <p className="mt-1 max-w-64 text-xs leading-relaxed text-faint">
        {tr(
          'Peça uma mudança, tire uma dúvida sobre o código ou mostre um bug.',
          'Ask for a change, a question about the code, or show a bug.'
        )}
      </p>
    </div>
  )
}
