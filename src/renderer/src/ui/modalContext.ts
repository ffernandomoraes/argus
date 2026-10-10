import { createContext, useContext } from 'react'

// Por onde o pedido de fechar veio; o `onRequestClose` do Modal recebe isso.
export type ModalCloseReason = 'escape' | 'backdrop' | 'button'

export const ModalCloseContext = createContext<((reason?: ModalCloseReason) => void) | null>(null)

// Pedir para fechar o modal em volta (botão Fechar, Cancelar...). Passa pelo `onRequestClose`
// dele, que pode recusar (ex.: perguntar antes de descartar alterações).
export function useModalClose(): (reason?: ModalCloseReason) => void {
  const close = useContext(ModalCloseContext)
  if (!close) throw new Error('useModalClose usado fora de um <Modal>')
  return close
}
