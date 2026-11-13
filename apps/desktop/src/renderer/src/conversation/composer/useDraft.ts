import { useEffect, useRef, useState } from 'react'

// Texto digitado e não enviado, por conversa: fechar o drawer (ESC, X) ou trocar de conversa
// não perde o que estava escrito. Vale enquanto o app está aberto.
const drafts = new Map<string, string>()

// O rascunho do campo. A chave pode mudar com o campo na tela (conversa nova que ganhou o id da
// sessão): o texto continua, e o guardado passa para a chave nova.
export function useDraft(key: string) {
  const [draft, setDraft] = useState(() => drafts.get(key) ?? '')
  const savedAs = useRef(key)

  useEffect(() => {
    if (savedAs.current !== key) {
      drafts.delete(savedAs.current)
      savedAs.current = key
    }
    if (draft) drafts.set(key, draft)
    else drafts.delete(key)
  }, [key, draft])

  return [draft, setDraft] as const
}
