import { X } from 'lucide-react'
import { IconButton } from '../ui/IconButton'

// Fecha o painel de código inteiro (a árvore e o arquivo aberto).
export function CloseCodeButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton label="Fechar código" onClick={onClick}>
      <X size={15} />
    </IconButton>
  )
}
