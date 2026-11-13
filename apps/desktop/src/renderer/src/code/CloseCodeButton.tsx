import { X } from 'lucide-react'
import { IconButton } from '../ui/IconButton'
import { tr } from '../i18n'

// Fecha o painel de código inteiro (a árvore e o arquivo aberto).
export function CloseCodeButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton label={tr('Fechar código', 'Close code')} onClick={onClick}>
      <X size={15} />
    </IconButton>
  )
}
