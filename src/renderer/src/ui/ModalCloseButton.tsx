import { X } from 'lucide-react'
import { IconButton } from './IconButton'
import type { ButtonVariant } from './buttonStyles'
import { useModalClose } from './modalContext'
import { tr } from '../i18n'

// O X de fechar dos modais: pede para fechar o modal em volta (passa pelo onRequestClose dele).
// `className` só para o lugar (ex.: "absolute right-3 top-3 z-10").
export function ModalCloseButton({
  label = tr('Fechar', 'Close'),
  variant,
  className
}: {
  label?: string
  variant?: ButtonVariant
  className?: string
}) {
  const close = useModalClose()
  return (
    <IconButton label={label} variant={variant} className={className} onClick={() => close('button')}>
      <X size={15} />
    </IconButton>
  )
}
