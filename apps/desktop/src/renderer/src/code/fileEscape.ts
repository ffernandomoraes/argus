import { createContext, useContext, useLayoutEffect, type RefObject } from 'react'
import { useEscape } from '../useEscape'

// Esc no painel de código: com arquivo aberto, fecha só o arquivo (volta para a árvore); sem, fecha
// o painel. Um Esc só, o do CodeExplorer: com dois (o do painel e o do arquivo), o de cima da pilha
// dependia da ordem de montagem, e o arquivo aberto por link do chat (montado junto com o painel,
// o filho antes do pai) ficava embaixo: o Esc fechava tudo.
export type FileEscapeSlot = RefObject<(() => void) | null>
export const FileEscapeContext = createContext<FileEscapeSlot | null>(null)

// No arquivo aberto: entrega ao painel como fechar só ele. Fora de um painel (sem o contexto),
// registra o próprio Esc, como antes.
export function useFileEscape(onClose: () => void): void {
  const closeFileRef = useContext(FileEscapeContext)
  useLayoutEffect(() => {
    if (!closeFileRef) return
    closeFileRef.current = onClose
    return () => {
      if (closeFileRef.current === onClose) closeFileRef.current = null
    }
  })
  useEscape(onClose, !closeFileRef)
}
