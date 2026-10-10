import { Loader2 } from 'lucide-react'
import { ClaudeIcon } from '../../icons/ClaudeIcon'
import { IconTile } from '../../settings/controls'

// No lugar das mensagens: o carregando, ou a conversa nova ainda vazia.
export function ChatPlaceholder({ loading }: { loading: boolean }) {
  if (loading) {
    return (
      <div className="m-auto flex items-center gap-2 text-xs text-faint">
        <Loader2 size={13} className="animate-spin" />
        Carregando conversa…
      </div>
    )
  }
  return (
    <div className="m-auto flex max-w-80 flex-col items-center text-center">
      <IconTile color="#D97757" size={48} soft>
        <ClaudeIcon size={24} />
      </IconTile>
      <p className="mt-4 text-[15px] font-semibold text-text">Nova conversa</p>
      {/* Como escrever já está na caixa de baixo; aqui, o que dá para pedir. */}
      <p className="mt-1 max-w-64 text-xs leading-relaxed text-faint">
        Peça uma mudança, tire uma dúvida sobre o código ou mostre um bug.
      </p>
    </div>
  )
}
