import { useState } from 'react'
import { sameConversation } from '../conversationIdentity'

type Identity = { id: string; sessionId?: string }

// Chave da conversa enquanto ela está na tela. A conversa nova muda de id quando entra na lista da
// pasta ("new-…" vira o id da sessão): a chave continua a de antes, e o chat não é recriado no meio
// da primeira resposta (apagava o que se estava digitando, os anexos e o ditado). Outra conversa no
// mesmo lugar ganha chave nova.
export function useViewKey(conversation: Identity): string {
  const [view, setView] = useState({ id: conversation.id, sessionId: conversation.sessionId, key: conversation.id })
  if (view.id !== conversation.id || view.sessionId !== conversation.sessionId) {
    const key = sameConversation(view, conversation) ? view.key : conversation.id
    setView({ id: conversation.id, sessionId: conversation.sessionId, key })
    return key
  }
  return view.key
}
